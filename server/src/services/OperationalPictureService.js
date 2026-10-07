import { RescueTeam } from '../domain/coordination/RescueTeam.js';
import { Shelter } from '../domain/coordination/Shelter.js';
import { EventStatus } from '../enums/EventStatus.js';
import { ShelterStatus } from '../enums/ShelterStatus.js';
import { District as DistrictModel } from '../models/District.js';
import { HazardEvent as HazardEventModel } from '../models/HazardEvent.js';
import { Organisation as OrganisationModel } from '../models/Organisation.js';
import { ReliefStock as ReliefStockModel } from '../models/ReliefStock.js';
import { RescueTeam as RescueTeamModel } from '../models/RescueTeam.js';
import { Shelter as ShelterModel } from '../models/Shelter.js';
import { SupplyDistribution as SupplyDistributionModel } from '../models/SupplyDistribution.js';
import { ApiError } from '../utils/ApiError.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { dispatchService as defaultDispatchService } from './DispatchService.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 main flow steps 1-2 and 14: the combined operational picture of one
// district - shelters, rescue teams, recent supply logs and totals by owning
// organisation - for the coordination dashboard and DMC officers
// (getCombinedPicture in sequence diagram (c)). Who may ask for which
// district is decided before this is called (DistrictScope, DMS-140.6).
export class OperationalPictureService {
  static RECENT_DISTRIBUTIONS = 10;

  #districtModel;
  #hazardEventModel;
  #organisationModel;
  #shelterModel;
  #rescueTeamModel;
  #reliefStockModel;
  #distributionModel;
  #districtScope;
  #dispatchService;

  constructor({
    districtModel = DistrictModel,
    hazardEventModel = HazardEventModel,
    organisationModel = OrganisationModel,
    shelterModel = ShelterModel,
    rescueTeamModel = RescueTeamModel,
    reliefStockModel = ReliefStockModel,
    distributionModel = SupplyDistributionModel,
    districtScope = defaultDistrictScope,
    dispatchService = defaultDispatchService,
  } = {}) {
    this.#districtModel = districtModel;
    this.#hazardEventModel = hazardEventModel;
    this.#organisationModel = organisationModel;
    this.#shelterModel = shelterModel;
    this.#rescueTeamModel = rescueTeamModel;
    this.#reliefStockModel = reliefStockModel;
    this.#distributionModel = distributionModel;
    this.#districtScope = districtScope;
    this.#dispatchService = dispatchService;
  }

  /**
   * The picture of the district the caller may see (§13.1): a district
   * officer's own, or the one a DMC officer names.
   * @param {object} user The signed-in User.
   * @param {{ districtId?: string, organisationId?: string }} [query]
   * @returns {Promise<object>}
   */
  async getCombinedPictureFor(user, { districtId, organisationId } = {}) {
    const readable = await this.#districtScope.readableDistrict(user, districtId);
    return this.getCombinedPicture({ districtId: readable, organisationId });
  }

  /**
   * The contract's operational picture (§13.3) for one district. With an
   * organisation, teams, stock and distributions narrow to it; shelters
   * belong to no organisation, so they are always all shown. Distributions
   * are counted from the active incident's start, or over all time when the
   * district has no active incident.
   * @param {{ districtId: string, organisationId?: string|null }} filter
   * @returns {Promise<object>}
   * @throws {ApiError} 404 NOT_FOUND for an unknown district or organisation.
   */
  async getCombinedPicture({ districtId, organisationId = null }) {
    const district = await this.#districtModel.findById(districtId).select('name');
    if (!district) throw new ApiError(404, 'NOT_FOUND', 'District not found.');
    const organisation = organisationId ? await this.#findOrganisation(organisationId) : null;

    const owned = organisation ? { organisation: organisation._id } : {};
    const incident = await this.#activeIncident(district._id);
    const counted = {
      district: district._id,
      ...owned,
      ...(incident ? { distributedAt: { $gte: incident.startDate } } : {}),
    };

    const [shelterDocs, teamDocs, stockDocs, recentDocs, distributedByOrganisation] =
      await Promise.all([
        this.#shelterModel
          .find({ district: district._id })
          .sort({ name: 1 })
          .populate(CoordinationPresenter.SHELTER_POPULATE),
        this.#rescueTeamModel
          .find({ district: district._id, ...owned })
          .sort({ name: 1 })
          .populate(CoordinationPresenter.TEAM_POPULATE),
        this.#reliefStockModel.find({ district: district._id, ...owned }),
        this.#distributionModel
          .find({ district: district._id, ...owned })
          .sort({ distributedAt: -1, _id: -1 })
          .limit(OperationalPictureService.RECENT_DISTRIBUTIONS)
          .populate(CoordinationPresenter.DISTRIBUTION_POPULATE),
        this.#distributionModel.aggregate([
          { $match: counted },
          { $group: { _id: '$organisation', quantity: { $sum: '$quantity' } } },
        ]),
      ]);

    const currentTasks = await this.#dispatchService.currentTasksFor(
      teamDocs.map((doc) => doc._id),
    );

    return {
      district: CoordinationPresenter.reference(district, ['name']),
      incident: incident
        ? {
            id: String(incident._id),
            name: incident.name,
            hazardType: incident.hazardType,
            startDate: incident.startDate,
          }
        : null,
      organisation: organisation ? CoordinationPresenter.organisation(organisation) : null,
      summary: OperationalPictureService.#summary(shelterDocs, teamDocs, distributedByOrganisation),
      shelters: shelterDocs.map((doc) => CoordinationPresenter.shelter(doc)),
      teams: teamDocs.map((doc) =>
        CoordinationPresenter.team(doc, currentTasks.get(String(doc._id)) ?? null),
      ),
      recentDistributions: recentDocs.map((doc) => CoordinationPresenter.distribution(doc)),
      totalsByOrganisation: await this.#totalsByOrganisation(
        teamDocs,
        stockDocs,
        distributedByOrganisation,
      ),
    };
  }

  async #findOrganisation(organisationId) {
    const organisation = await this.#organisationModel.findById(organisationId);
    if (!organisation) throw new ApiError(404, 'NOT_FOUND', 'Organisation not found.');
    return organisation;
  }

  // The incident: the district's ACTIVE hazard event. A district has at most
  // one (§8); the most recent start wins if the data ever says otherwise.
  #activeIncident(districtId) {
    return this.#hazardEventModel
      .findOne({ status: EventStatus.ACTIVE, districts: districtId })
      .sort({ startDate: -1 });
  }

  static #summary(shelterDocs, teamDocs, distributedByOrganisation) {
    const shelters = shelterDocs.map((doc) => Shelter.fromDocument(doc));
    const teams = teamDocs.map((doc) => RescueTeam.fromDocument(doc));
    const nearCapacity = [ShelterStatus.NEAR_CAPACITY, ShelterStatus.FULL];
    return {
      shelters: shelters.length,
      sheltersNearCapacity: shelters.filter((shelter) => nearCapacity.includes(shelter.status()))
        .length,
      teams: teams.length,
      teamsAvailable: teams.filter((team) => team.isAvailable()).length,
      suppliesDistributed: distributedByOrganisation.reduce((sum, row) => sum + row.quantity, 0),
      affectedPeople: shelters.reduce((sum, shelter) => sum + shelter.currentOccupancy, 0),
    };
  }

  // One row per organisation with a team, stock or counted distribution in
  // the district, sorted by organisation name.
  async #totalsByOrganisation(teamDocs, stockDocs, distributedByOrganisation) {
    const totals = new Map();
    const totalFor = (organisationId) => {
      const key = String(organisationId);
      if (!totals.has(key)) totals.set(key, { teams: 0, stockItems: 0, distributed: 0 });
      return totals.get(key);
    };
    for (const team of teamDocs) totalFor(team.organisation._id ?? team.organisation).teams += 1;
    for (const stock of stockDocs)
      totalFor(stock.organisation).stockItems += stock.quantityAvailable;
    for (const row of distributedByOrganisation) totalFor(row._id).distributed += row.quantity;

    const organisations = await this.#organisationModel
      .find({ _id: { $in: [...totals.keys()] } })
      .sort({ name: 1 });
    return organisations.map((organisation) => ({
      organisation: CoordinationPresenter.organisation(organisation),
      ...totals.get(String(organisation._id)),
    }));
  }
}

export const operationalPictureService = new OperationalPictureService();
