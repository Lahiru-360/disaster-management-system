import mongoose from 'mongoose';
import { ReliefStock } from '../../../src/domain/coordination/ReliefStock.js';
import { RescueTeam } from '../../../src/domain/coordination/RescueTeam.js';
import { Shelter } from '../../../src/domain/coordination/Shelter.js';
import { ShelterStatus } from '../../../src/enums/ShelterStatus.js';
import { SupplyType } from '../../../src/enums/SupplyType.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { ReliefStock as ReliefStockModel } from '../../../src/models/ReliefStock.js';
import { RescueTeam as RescueTeamModel } from '../../../src/models/RescueTeam.js';
import { Shelter as ShelterModel } from '../../../src/models/Shelter.js';

const ID = '66fb0a1b2c3d4e5f6a7b8c01';
const DISTRICT = new mongoose.Types.ObjectId();
const ORGANISATION = new mongoose.Types.ObjectId();
const location = { lat: 7.0912, lng: 79.9948, label: 'Gampaha town' };

const shelter = (currentOccupancy, capacity = 100) =>
  new Shelter({ shelterId: ID, name: 'Gampaha Central College', capacity, currentOccupancy });

const team = (fields = {}) =>
  new RescueTeam({
    teamId: ID,
    name: 'Team Alpha',
    organisation: ORGANISATION,
    district: DISTRICT,
    memberCount: 8,
    currentLocation: location,
    status: TeamStatus.AVAILABLE,
    ...fields,
  });

const stock = (fields = {}) =>
  new ReliefStock({
    stockId: ID,
    organisation: ORGANISATION,
    district: DISTRICT,
    supplyType: SupplyType.WATER,
    unit: 'bottles',
    quantityAvailable: 1200,
    ...fields,
  });

describe('Shelter.status', () => {
  it.each([
    ['TC-14', 0, ShelterStatus.AVAILABLE],
    ['TC-08', 74, ShelterStatus.AVAILABLE],
    ['TC-09', 75, ShelterStatus.FILLING_UP],
    ['TC-10', 89, ShelterStatus.FILLING_UP],
    ['TC-11', 90, ShelterStatus.NEAR_CAPACITY],
    ['TC-12', 99, ShelterStatus.NEAR_CAPACITY],
    ['TC-13', 100, ShelterStatus.FULL],
    ['TC-13', 101, ShelterStatus.FULL],
  ])('Main 5: %s - %d% is %s', (_tc, occupants, status) => {
    expect(shelter(occupants).status()).toBe(status);
  });

  it('Main 5: compares the exact ratio, so 89.9% is still FILLING_UP', () => {
    expect(shelter(899, 1000).status()).toBe(ShelterStatus.FILLING_UP);
    expect(shelter(900, 1000).status()).toBe(ShelterStatus.NEAR_CAPACITY);
    expect(shelter(749, 1000).status()).toBe(ShelterStatus.AVAILABLE);
    expect(shelter(999, 1000).status()).toBe(ShelterStatus.NEAR_CAPACITY);
  });

  it('Main 5: hits a boundary exactly when the capacity is not a multiple of 100', () => {
    // 3 of 4 is exactly 75%; 9 of 10 exactly 90%; 27 of 30 exactly 90%.
    expect(shelter(3, 4).status()).toBe(ShelterStatus.FILLING_UP);
    expect(shelter(9, 10).status()).toBe(ShelterStatus.NEAR_CAPACITY);
    expect(shelter(27, 30).status()).toBe(ShelterStatus.NEAR_CAPACITY);
    expect(shelter(2, 3).status()).toBe(ShelterStatus.AVAILABLE);
  });
});

describe('Shelter.occupancyRate', () => {
  it('Main 2: is occupants per place, unrounded', () => {
    expect(shelter(460, 500).occupancyRate()).toBe(0.92);
    expect(shelter(2, 3).occupancyRate()).toBe(2 / 3);
  });

  it('TC-14: is 0 for an empty shelter', () => {
    expect(shelter(0).occupancyRate()).toBe(0);
  });

  it('Main 5: goes above 1 when over capacity', () => {
    expect(shelter(105).occupancyRate()).toBe(1.05);
  });
});

describe('Shelter construction', () => {
  it('Main 2: defaults to an empty shelter and keeps its details', () => {
    const built = new Shelter({
      shelterId: ID,
      name: 'Ja-Ela',
      district: DISTRICT,
      location,
      capacity: 300,
    });

    expect(built.currentOccupancy).toBe(0);
    expect(built.shelterId).toBe(ID);
    expect(built.name).toBe('Ja-Ela');
    expect(built.district).toBe(DISTRICT);
    expect(built.capacity).toBe(300);
    expect(built.location).toEqual(location);
    expect(Object.isFrozen(built.location)).toBe(true);
  });

  it('Main 2: needs a shelterId', () => {
    expect(() => new Shelter({ capacity: 10 })).toThrow('Shelter needs a shelterId');
    expect(() => new Shelter()).toThrow('Shelter needs a shelterId');
  });

  it.each([0, -5, 10.5, undefined])('A1: refuses a capacity of %p', (capacity) => {
    expect(() => new Shelter({ shelterId: ID, capacity })).toThrow(
      'Shelter capacity must be a whole number, 1 or more',
    );
  });

  it.each([-1, 12.5])('E1: refuses an occupancy of %p', (currentOccupancy) => {
    expect(() => new Shelter({ shelterId: ID, capacity: 10, currentOccupancy })).toThrow(
      'Shelter occupancy must be a whole number, 0 or more',
    );
  });

  it('Main 2: has no location when none is given', () => {
    expect(new Shelter({ shelterId: ID, capacity: 10 }).location).toBeUndefined();
  });
});

describe('RescueTeam', () => {
  it.each([
    [TeamStatus.AVAILABLE, true],
    [TeamStatus.DISPATCHED, false],
    [TeamStatus.ON_SITE, false],
    [TeamStatus.UNAVAILABLE, false],
  ])('TC-17: a %s team is available: %s', (status, available) => {
    expect(team({ status }).isAvailable()).toBe(available);
  });

  it('Main 7: keeps its details and defaults to no lead', () => {
    const built = team();

    expect(built.teamId).toBe(ID);
    expect(built.name).toBe('Team Alpha');
    expect(built.organisation).toBe(ORGANISATION);
    expect(built.district).toBe(DISTRICT);
    expect(built.memberCount).toBe(8);
    expect(built.lead).toBeNull();
    expect(built.currentLocation).toEqual(location);
    expect(built.status).toBe(TeamStatus.AVAILABLE);
  });

  it('Main 7: has no current location when none is given', () => {
    expect(team({ currentLocation: undefined }).currentLocation).toBeUndefined();
  });

  it('Main 7: needs a teamId and a known status', () => {
    expect(() => team({ teamId: null })).toThrow('RescueTeam needs a teamId');
    expect(() => new RescueTeam()).toThrow('RescueTeam needs a teamId');
    expect(() => team({ status: 'BUSY' })).toThrow('Unknown team status: BUSY');
  });
});

describe('ReliefStock', () => {
  it('Main 12: keeps its details', () => {
    const built = stock();

    expect(built.stockId).toBe(ID);
    expect(built.organisation).toBe(ORGANISATION);
    expect(built.district).toBe(DISTRICT);
    expect(built.supplyType).toBe(SupplyType.WATER);
    expect(built.unit).toBe('bottles');
    expect(built.quantityAvailable).toBe(1200);
  });

  it('E5: allows an empty stock row', () => {
    expect(stock({ quantityAvailable: 0 }).quantityAvailable).toBe(0);
  });

  it('Main 12: needs a stockId and a known supply type', () => {
    expect(() => stock({ stockId: undefined })).toThrow('ReliefStock needs a stockId');
    expect(() => new ReliefStock()).toThrow('ReliefStock needs a stockId');
    expect(() => stock({ supplyType: 'FUEL' })).toThrow('Unknown supply type: FUEL');
  });

  it.each([-1, 2.5, undefined])('E5: refuses a quantity of %p', (quantityAvailable) => {
    expect(() => stock({ quantityAvailable })).toThrow(
      'ReliefStock quantity must be a whole number, 0 or more',
    );
  });
});

describe('fromDocument', () => {
  const shelterDoc = () =>
    new ShelterModel({
      district: DISTRICT,
      name: 'Gampaha Central College',
      location,
      capacity: 500,
      currentOccupancy: 460,
    });

  it.each([
    ['hydrated', (doc) => doc],
    ['lean', (doc) => doc.toObject()],
    ['toJSON', (doc) => doc.toJSON()],
  ])('Main 2: maps a %s Shelter document', (_form, as) => {
    const doc = shelterDoc();

    const built = Shelter.fromDocument(as(doc));

    expect(built.shelterId).toBe(String(doc._id));
    expect(built.name).toBe('Gampaha Central College');
    expect(built.location).toEqual(location);
    expect(built.status()).toBe(ShelterStatus.NEAR_CAPACITY);
  });

  it.each([
    ['hydrated', (doc) => doc],
    ['toJSON', (doc) => doc.toJSON()],
  ])('Main 7: maps a %s RescueTeam document', (_form, as) => {
    const doc = new RescueTeamModel({
      name: 'Team Alpha',
      organisation: ORGANISATION,
      district: DISTRICT,
      memberCount: 8,
      baseLocation: location,
      currentLocation: location,
    });

    const built = RescueTeam.fromDocument(as(doc));

    expect(built.teamId).toBe(String(doc._id));
    expect(built.isAvailable()).toBe(true);
    expect(built.currentLocation).toEqual(location);
  });

  it.each([
    ['hydrated', (doc) => doc],
    ['toJSON', (doc) => doc.toJSON()],
  ])('Main 12: maps a %s ReliefStock document', (_form, as) => {
    const doc = new ReliefStockModel({
      organisation: ORGANISATION,
      district: DISTRICT,
      supplyType: SupplyType.WATER,
      unit: 'bottles',
      quantityAvailable: 1200,
    });

    const built = ReliefStock.fromDocument(as(doc));

    expect(built.stockId).toBe(String(doc._id));
    expect(built.quantityAvailable).toBe(1200);
  });
});
