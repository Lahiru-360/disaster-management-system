import mongoose from 'mongoose';
import { District } from '../../src/domain/areas/District.js';
import { RiverBasin } from '../../src/domain/areas/RiverBasin.js';
import { TargetArea } from '../../src/domain/areas/TargetArea.js';

const colomboId = new mongoose.Types.ObjectId();
const gampahaId = new mongoose.Types.ObjectId();
const kalutaraId = new mongoose.Types.ObjectId();

const colombo = new District({
  areaId: colomboId,
  name: 'Colombo',
  province: 'Western',
  centroid: { lat: 6.9271, lng: 79.8612 },
  bounds: { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 },
});
const gampaha = new District({ areaId: gampahaId.toString(), name: 'Gampaha' });
const kelani = new RiverBasin({
  areaId: 'kelani-id',
  name: 'Kelani',
  districts: [colombo, gampaha],
});

describe('TargetArea', () => {
  it('DMS-104: cannot be constructed itself', () => {
    expect(() => new TargetArea({ areaId: 'x', name: 'X' })).toThrow('TargetArea is abstract');
  });

  it('DMS-104: contains() throws in a subclass that does not override it', () => {
    class Unfinished extends TargetArea {}

    expect(() => new Unfinished({ areaId: 'u', name: 'U' }).contains({})).toThrow(
      'Unfinished must override contains()',
    );
  });

  it('DMS-104: refuses an area without an areaId', () => {
    expect(() => new District({ name: 'Nameless' })).toThrow('District needs an areaId');
    expect(() => new District({ areaId: null, name: 'Nameless' })).toThrow('needs an areaId');
  });

  it('DMS-104: stores areaId as a string, so an ObjectId and its hex compare equal', () => {
    expect(colombo.areaId).toBe(colomboId.toString());
    expect(typeof colombo.areaId).toBe('string');
  });

  it('DMS-104: makes a District and a RiverBasin both TargetAreas', () => {
    expect(colombo).toBeInstanceOf(TargetArea);
    expect(kelani).toBeInstanceOf(TargetArea);
  });
});

describe('District', () => {
  it('DMS-104: exposes its name, province, centroid and bounds', () => {
    expect(colombo.name).toBe('Colombo');
    expect(colombo.province).toBe('Western');
    expect(colombo.centroid).toEqual({ lat: 6.9271, lng: 79.8612 });
    expect(colombo.bounds).toEqual({ minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 });
  });

  it('DMS-104: leaves province, centroid and bounds undefined when built from { id, name }', () => {
    expect(gampaha.province).toBeUndefined();
    expect(gampaha.centroid).toBeUndefined();
    expect(gampaha.bounds).toBeUndefined();
  });

  it('DMS-104: keeps centroid and bounds immutable, even from the object it was given', () => {
    const centroid = { lat: 7, lng: 80 };
    const district = new District({ areaId: 'd', name: 'D', centroid });
    centroid.lat = 0;

    expect(district.centroid.lat).toBe(7);
    expect(Object.isFrozen(district.centroid)).toBe(true);
    expect(Object.isFrozen(colombo.bounds)).toBe(true);
  });

  it.each([
    ['a District', colombo],
    ['its id as an ObjectId', colomboId],
    ['its id as a string', colomboId.toString()],
    [
      'a separately built District with the same id',
      new District({ areaId: colomboId, name: 'Colombo' }),
    ],
  ])('DMS-104: contains a citizen whose homeDistrict is %s', (_label, homeDistrict) => {
    expect(colombo.contains({ homeDistrict })).toBe(true);
  });

  it('DMS-104: does not contain a citizen of another district', () => {
    expect(colombo.contains({ homeDistrict: gampahaId })).toBe(false);
    expect(colombo.contains({ homeDistrict: gampaha })).toBe(false);
  });

  it.each([
    ['no homeDistrict', {}],
    ['a null homeDistrict', { homeDistrict: null }],
    ['no citizen at all', undefined],
  ])('DMS-104: does not contain a citizen with %s', (_label, citizen) => {
    expect(colombo.contains(citizen)).toBe(false);
  });
});

describe('RiverBasin', () => {
  it('DMS-104: contains a citizen of any district it spans', () => {
    expect(kelani.contains({ homeDistrict: colomboId })).toBe(true);
    expect(kelani.contains({ homeDistrict: gampaha })).toBe(true);
  });

  it('DMS-104: does not contain a citizen of a district outside the basin', () => {
    expect(kelani.contains({ homeDistrict: kalutaraId })).toBe(false);
  });

  it('DMS-104: does not contain a citizen with no home district on file', () => {
    expect(kelani.contains({})).toBe(false);
  });

  it("DMS-104: does not treat the basin's own id as a home district", () => {
    expect(kelani.contains({ homeDistrict: 'kelani-id' })).toBe(false);
  });

  it('DMS-104: exposes its districts as a copy, so the basin cannot be changed from outside', () => {
    const districts = kelani.districts;
    districts.push(new District({ areaId: kalutaraId, name: 'Kalutara' }));

    expect(kelani.districts).toEqual([colombo, gampaha]);
    expect(kelani.contains({ homeDistrict: kalutaraId })).toBe(false);
  });

  it.each([
    ['an empty list', { districts: [] }],
    ['no list', {}],
  ])('DMS-104: refuses a basin with %s of districts', (_label, fields) => {
    expect(() => new RiverBasin({ areaId: 'b', name: 'Empty', ...fields })).toThrow(
      'RiverBasin "Empty" must span at least one district',
    );
  });

  it('DMS-104: refuses a basin spanning raw ids instead of District objects', () => {
    expect(() => new RiverBasin({ areaId: 'b', name: 'Ids', districts: [colomboId] })).toThrow(
      'can only span District objects',
    );
  });
});
