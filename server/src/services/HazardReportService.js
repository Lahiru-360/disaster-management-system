import mongoose from 'mongoose';
import { ClusterAssigner } from '../domain/reports/ClusterAssigner.js';
import { Coordinates } from '../domain/reports/Coordinates.js';
import { HazardReport } from '../domain/reports/HazardReport.js';
import { ReportLabels } from '../domain/reports/ReportLabels.js';
import { NotificationType } from '../enums/NotificationType.js';
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
   *
   * A3: a resend of a report the same reporter already sent (same
   * clientReportId) returns the stored report, with created false, and
   * nothing is stored or notified again. Two copies arriving at the same
   * moment both pass that lookup; the unique index then refuses the second,
   * which re-reads and returns the first.
   * @returns {Promise<{ report: object, created: boolean }>} The report in the contract's shape (§9.1).
   */
  async submit(reporter, input) {
    const resent = await this.#findResent(reporter, input.clientReportId);
    if (resent) {
      return { report: await this.#present(resent), created: false };
    }

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

    let doc;
    try {
      doc = await this.#reportModel.create({
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
    } catch (error) {
      const raced = HazardReportService.#isDuplicateClientReportId(error)
        ? await this.#findResent(reporter, input.clientReportId)
        : null;
      if (!raced) {
        throw HazardReportService.#clientReportIdTaken(error);
      }
      return { report: await this.#present(raced), created: false };
    }

    await this.#notifyDutyOfficers(doc, district);
    return { report: await this.#present(doc), created: true };
  }

  // A3: the reporter's own report with this clientReportId, if they sent one.
  async #findResent(reporter, clientReportId) {
    if (!clientReportId) return null;
    return this.#reportModel.findOne({ clientReportId, reporter: reporter._id });
  }

  static #isDuplicateClientReportId(error) {
    return error?.code === 11000 && Boolean(error.keyPattern?.clientReportId);
  }

  // The unique index refused the clientReportId but the report isn't the
  // caller's (another device made the same UUID - vanishingly unlikely). Any
  // other database error is passed on unchanged.
  static #clientReportIdTaken(error) {
    if (!HazardReportService.#isDuplicateClientReportId(error)) {
      return error;
    }
    return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'clientReportId', message: 'is already used - generate a new one' },
    ]);
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

  // The contract's report object (§9.1): district as { id, name }, reporter
  // as { id, role } (never their name or contact details), reviewedBy as
  // { id, name }, and isEscalatable from the domain rule.
  async #present(doc) {
    await doc.populate([
      { path: 'district', select: 'name' },
      { path: 'reporter', select: 'role' },
      { path: 'reviewedBy', select: 'name' },
    ]);
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
