import mongoose from 'mongoose';
import { ClusterAssigner } from '../domain/reports/ClusterAssigner.js';
import { Coordinates } from '../domain/reports/Coordinates.js';
import { HazardReport } from '../domain/reports/HazardReport.js';
import { ReportLabels } from '../domain/reports/ReportLabels.js';
import { NotificationType } from '../enums/NotificationType.js';
import { ReportStatus } from '../enums/ReportStatus.js';
import { Role } from '../enums/Role.js';
import { District as DistrictModel } from '../models/District.js';
import { HazardReport as HazardReportModel } from '../models/HazardReport.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { areaRegistry as defaultAreaRegistry } from './AreaRegistry.js';
import { duplicateReportFinder as defaultDuplicateReportFinder } from './DuplicateReportFinder.js';
import { notificationService as defaultNotificationService } from './NotificationService.js';
import { referenceNumberGenerator as defaultReferenceNumberGenerator } from './ReferenceNumberGenerator.js';

// UC02 Submit and Verify Hazard Report: the ReportController's work in the
// sequence diagram. The controller hands it validated input; it applies the
// steps in order and asks the HazardReport domain class for every state
// change. Every collaborator comes through the constructor.
export class HazardReportService {
  #reportModel;
  #districtModel;
  #areaRegistry;
  #duplicateFinder;
  #clusterAssigner;
  #referenceNumbers;
  #notifications;
  #clock;

  constructor({
    reportModel = HazardReportModel,
    districtModel = DistrictModel,
    areaRegistry = defaultAreaRegistry,
    duplicateFinder = defaultDuplicateReportFinder,
    clusterAssigner = new ClusterAssigner(),
    referenceNumbers = defaultReferenceNumberGenerator,
    notifications = defaultNotificationService,
    clock = systemClock,
  } = {}) {
    this.#reportModel = reportModel;
    this.#districtModel = districtModel;
    this.#areaRegistry = areaRegistry;
    this.#duplicateFinder = duplicateFinder;
    this.#clusterAssigner = clusterAssigner;
    this.#referenceNumbers = referenceNumbers;
    this.#notifications = notifications;
    this.#clock = clock;
  }

  /**
   * UC02 main flow steps 7-9, after the validator (step 6):
   * 7. look for PENDING reports of the same type within 500 m / 2 h and
   *    join the oldest one's cluster, or start a new cluster (A4);
   * 8. store the report as PENDING with a new GR- reference, in the
   *    district its location falls in (or the reporter's home district);
   * 9. notify the duty officers on shift in that district - or every DMC
   *    officer if none is - without letting a notification failure fail
   *    the submission.
   * @param {{ _id: object, homeDistrict?: object }} reporter The signed-in citizen (a User).
   * @param {{ description: string, hazardType: string, location: { latitude: number, longitude: number }, locationSource: string, photoUrl: string, clientReportId?: string }} input
   * @returns {Promise<object>} The stored report in the contract's shape (§9.1).
   */
  async submit(reporter, input) {
    const submittedAt = this.#clock.now();
    const location = new Coordinates(input.location);
    const id = new mongoose.Types.ObjectId();

    const matches = await this.#duplicateFinder.findNearbyPending(
      location,
      input.hazardType,
      ClusterAssigner.windowStart(submittedAt),
    );
    const clusterId = this.#clusterAssigner.assign(matches, id);
    const district = await this.#districtFor(location, reporter);

    const doc = await this.#reportModel.create({
      _id: id,
      referenceNo: await this.#referenceNumbers.next(),
      reporter: reporter._id,
      description: input.description,
      photoUrl: input.photoUrl,
      hazardType: input.hazardType,
      location: location.toGeoJSON(),
      locationSource: input.locationSource,
      district: district.id,
      submittedAt,
      clusterId,
      clientReportId: input.clientReportId,
    });

    await this.#notifyDutyOfficers(doc, district);
    return this.#present(doc);
  }

  // Step 8: the district the point falls in, else the reporter's home district
  // (contract §9.1). A point in neither - offshore, from a reporter with no
  // district on file - can't be routed to any officer, so it is refused on
  // the location field like the other E1 errors.
  async #districtFor(location, reporter) {
    const { lat, lng } = location.toPoint();
    const found = await this.#areaRegistry.findDistrictForPoint(lat, lng);
    if (found) {
      return { id: found.areaId, name: found.name };
    }
    const home = reporter.homeDistrict
      ? await this.#districtModel.findById(reporter.homeDistrict).select('name')
      : null;
    if (home) {
      return { id: home.id, name: home.name };
    }
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'location', message: 'must be inside a district of Sri Lanka' },
    ]);
  }

  // Step 9. NotificationService already records a failed channel instead of
  // throwing; this also catches anything else (e.g. the database), because a
  // stored report must never be answered with an error.
  async #notifyDutyOfficers(doc, district) {
    const label = ReportLabels.hazardType(doc.hazardType);
    const payload = {
      type: NotificationType.REPORT_SUBMITTED,
      title: `New ground report ${doc.referenceNo}`,
      body: `New ground report ${doc.referenceNo} – ${label} – ${district.name}`,
      link: `/ground-reports/${doc.id}`,
    };
    try {
      const sent = await this.#notifications.notifyRole(
        Role.DUTY_OFFICER,
        { districtId: district.id, districtField: 'shiftDistrict' },
        payload,
      );
      if (sent.length === 0) {
        // Nobody on shift there: every DMC officer (duty officers included,
        // through role inheritance), so no report goes unseen.
        await this.#notifications.notifyRole(Role.DMC_OFFICER, {}, payload);
      }
    } catch (error) {
      console.error(`Could not notify officers about ${doc.referenceNo}:`, error.message);
    }
  }

  /**
   * UC02 step 10 (§9.4): the PENDING reports in the duty officer's
   * shiftDistrict, grouped by cluster. Clusters are ordered by their newest
   * report and reports inside a cluster newest first, so the first report is
   * the cluster's lead row in the queue. An officer with no shiftDistrict has
   * an empty queue.
   * @param {{ shiftDistrict?: object }} officer The signed-in duty officer (a User).
   * @returns {Promise<Array<{ clusterId: string, count: number, reports: object[] }>>}
   */
  async getPendingByDistrict(officer) {
    if (!officer.shiftDistrict) {
      return [];
    }
    const docs = await this.#reportModel
      .find({ status: ReportStatus.PENDING, district: officer.shiftDistrict })
      .sort({ submittedAt: -1, _id: -1 });
    const reports = await this.#presentAll(docs);

    const clusters = new Map();
    for (const report of reports) {
      const clusterId = String(report.clusterId);
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, { clusterId, count: 0, reports: [] });
      }
      const cluster = clusters.get(clusterId);
      cluster.count += 1;
      cluster.reports.push(report);
    }
    return [...clusters.values()];
  }

  /**
   * UC02 step 11 (§9.5): one report in the officer's district, whatever its
   * status, plus the rest of its cluster (oldest first). count includes this
   * report and every status.
   * @param {string} reportId
   * @param {{ shiftDistrict?: object }} officer
   * @returns {Promise<{ report: object, cluster: { clusterId: string, count: number, others: object[] } }>}
   * @throws {ApiError} 404 NOT_FOUND for an unknown or malformed id, or a report in another district.
   */
  async getDetail(reportId, officer) {
    const doc = await this.#findInDistrict(reportId, officer);
    const others = await this.#reportModel
      .find({ clusterId: doc.clusterId, _id: { $ne: doc._id } })
      .sort({ submittedAt: 1, _id: 1 })
      .select('referenceNo status submittedAt');

    return {
      report: await this.#present(doc),
      cluster: {
        clusterId: String(doc.clusterId),
        count: others.length + 1,
        others: others.map((other) => ({
          id: other.id,
          referenceNo: other.referenceNo,
          status: other.status,
          submittedAt: other.submittedAt,
        })),
      },
    };
  }

  /**
   * The X-1 interface for UC01 (DMS-122): what escalating a report needs to
   * know. No district scoping - UC01 does its own access checks.
   * @param {string} reportId
   * @returns {Promise<{ id: string, referenceNo: string, hazardType: string, location: { latitude: number, longitude: number }, district: { id: string, name: string }, status: string, isEscalatable: boolean }|null>}
   *   null for an unknown or malformed id.
   */
  async findById(reportId) {
    if (!mongoose.isValidObjectId(reportId)) {
      return null;
    }
    const doc = await this.#reportModel.findById(reportId);
    if (!doc) {
      return null;
    }
    const { id, referenceNo, hazardType, location, district, status, isEscalatable } =
      await this.#present(doc);
    return { id: String(id), referenceNo, hazardType, location, district, status, isEscalatable };
  }

  /**
   * UC02 steps 12-14 (§9.6): the duty officer confirms a report in their
   * district. The domain class makes the change (only from PENDING), the
   * reporter is told, and no warning is created or changed - escalating is
   * UC01's, started by the officer.
   * @param {string} reportId
   * @param {{ _id: object, shiftDistrict?: object }} officer
   * @returns {Promise<object>} The updated report (§9.1).
   * @throws {ApiError} 404 NOT_FOUND as in getDetail; ReportAlreadyReviewedError (409) when not PENDING.
   */
  async confirm(reportId, officer) {
    const doc = await this.#findInDistrict(reportId, officer);
    const report = HazardReport.fromDocument(doc);

    report.confirm(officer, this.#clock.now());
    doc.set(report.reviewChanges());
    await doc.save();

    await this.#notifyReporter(doc, {
      type: NotificationType.REPORT_CONFIRMED,
      title: `Report ${doc.referenceNo} confirmed`,
      body: `Your report ${doc.referenceNo} was confirmed by the duty officer. Thank you.`,
    });
    return this.#present(doc);
  }

  /**
   * The reporter's own reports, every status, newest first (§9.3).
   * @param {{ _id: object }} reporter The signed-in citizen.
   * @returns {Promise<object[]>}
   */
  async listMine(reporter) {
    const docs = await this.#reportModel
      .find({ reporter: reporter._id })
      .sort({ submittedAt: -1, _id: -1 });
    return this.#presentAll(docs);
  }

  // A report the officer may see: in their shiftDistrict. Anything else - an
  // unknown or malformed id, or another district's report - is the same 404,
  // so a report's existence isn't revealed.
  async #findInDistrict(reportId, officer) {
    const doc =
      mongoose.isValidObjectId(reportId) && officer.shiftDistrict
        ? await this.#reportModel.findOne({ _id: reportId, district: officer.shiftDistrict })
        : null;
    if (!doc) {
      throw new ApiError(404, 'NOT_FOUND', 'Hazard report not found.');
    }
    return doc;
  }

  // Step 14 / A1.3. Like step 9, a failure is logged and never fails the review.
  async #notifyReporter(doc, payload) {
    try {
      await this.#notifications.notifyUser(doc.reporter, {
        ...payload,
        link: `/my-reports/${doc.id}`,
      });
    } catch (error) {
      console.error(`Could not notify the reporter of ${doc.referenceNo}:`, error.message);
    }
  }

  static #POPULATE = [
    { path: 'district', select: 'name' },
    { path: 'reporter', select: 'role' },
    { path: 'reviewedBy', select: 'name' },
  ];

  async #presentAll(docs) {
    await this.#reportModel.populate(docs, HazardReportService.#POPULATE);
    return docs.map((doc) => HazardReportService.#toContract(doc));
  }

  async #present(doc) {
    await doc.populate(HazardReportService.#POPULATE);
    return HazardReportService.#toContract(doc);
  }

  // The contract's report object (§9.1) from a populated document: district
  // as { id, name }, reporter as { id, role } (never their name or contact
  // details), reviewedBy as { id, name }, and isEscalatable from the domain
  // rule.
  static #toContract(doc) {
    const json = doc.toJSON();
    json.district = HazardReportService.#idAndFields(json.district, ['name']);
    json.reporter = HazardReportService.#idAndFields(json.reporter, ['role']);
    json.reviewedBy = HazardReportService.#idAndFields(json.reviewedBy, ['name']);
    json.isEscalatable = HazardReport.fromDocument(doc).isEscalatable();
    return json;
  }

  static #idAndFields(populated, fields) {
    if (!populated) return null;
    return Object.fromEntries([
      ['id', String(populated.id ?? populated._id)],
      ...fields.map((field) => [field, populated[field]]),
    ]);
  }
}

export const hazardReportService = new HazardReportService();
