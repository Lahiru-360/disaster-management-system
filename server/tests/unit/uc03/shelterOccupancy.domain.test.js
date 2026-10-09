import { Shelter } from '../../../src/domain/coordination/Shelter.js';
import { ShelterStatus } from '../../../src/enums/ShelterStatus.js';

const ID = '66fb0a1b2c3d4e5f6a7b8c01';
const shelter = (currentOccupancy = 0, capacity = 100) =>
  new Shelter({ shelterId: ID, name: 'Gampaha Central College', capacity, currentOccupancy });

describe('Shelter.updateOccupancy', () => {
  it('TC-07: Main 3-4 sets the current number of occupants', () => {
    const built = shelter(380, 500);

    built.updateOccupancy(460);

    expect(built.currentOccupancy).toBe(460);
  });

  it('Main 5: the rate and status follow the new occupancy', () => {
    const built = shelter(0);

    built.updateOccupancy(90);

    expect(built.occupancyRate()).toBe(0.9);
    expect(built.status()).toBe(ShelterStatus.NEAR_CAPACITY);
  });

  it.each([
    ['TC-08', 74, ShelterStatus.AVAILABLE],
    ['TC-09', 75, ShelterStatus.FILLING_UP],
    ['TC-10', 89, ShelterStatus.FILLING_UP],
    ['TC-11', 90, ShelterStatus.NEAR_CAPACITY],
    ['TC-12', 99, ShelterStatus.NEAR_CAPACITY],
    ['TC-13', 100, ShelterStatus.FULL],
    ['TC-13', 101, ShelterStatus.FULL],
  ])('Main 5: %s - updating to %d% gives %s', (_tc, occupants, status) => {
    const built = shelter(50);

    built.updateOccupancy(occupants);

    expect(built.status()).toBe(status);
  });

  it('TC-14: 0 occupants is valid, AVAILABLE at 0%', () => {
    const built = shelter(40);

    built.updateOccupancy(0);

    expect(built.occupancyRate()).toBe(0);
    expect(built.status()).toBe(ShelterStatus.AVAILABLE);
  });

  it('Main 5: an occupancy above capacity is allowed and FULL', () => {
    const built = shelter(0, 500);

    built.updateOccupancy(525);

    expect(built.occupancyRate()).toBe(1.05);
    expect(built.status()).toBe(ShelterStatus.FULL);
  });

  it.each([
    ['TC-43', -1],
    ['TC-44', 12.5],
    ['TC-45', 'abc'],
    ['TC-45', '12'],
    ['TC-45', undefined],
    ['TC-45', null],
    ['TC-45', Number.NaN],
  ])('E1: %s - refuses %p and leaves the shelter unchanged (TC-46)', (_tc, occupants) => {
    const built = shelter(460, 500);

    expect(() => built.updateOccupancy(occupants)).toThrow(
      'Shelter occupancy must be a whole number, 0 or more',
    );
    expect(built.currentOccupancy).toBe(460);
    expect(built.status()).toBe(ShelterStatus.NEAR_CAPACITY);
  });
});
