import { GeoDistance } from '../../src/utils/GeoDistance.js';

const colombo = { lat: 6.9271, lng: 79.8612 };
const gampaha = { lat: 7.0917, lng: 79.9999 };
const kandy = { lat: 7.2906, lng: 80.6337 };

const km = (metres) => metres / 1000;

describe('GeoDistance.haversineMetres', () => {
  it('DMS-104: measures Colombo to Gampaha as about 23 km (±1 km)', () => {
    expect(Math.abs(km(GeoDistance.haversineMetres(colombo, gampaha)) - 23)).toBeLessThanOrEqual(1);
  });

  it('DMS-104: measures Colombo to Kandy as about 94 km', () => {
    expect(km(GeoDistance.haversineMetres(colombo, kandy))).toBeCloseTo(94.3, 0);
  });

  it('DMS-104: gives the same distance in both directions', () => {
    expect(GeoDistance.haversineMetres(gampaha, colombo)).toBe(
      GeoDistance.haversineMetres(colombo, gampaha),
    );
  });

  it('DMS-104: gives 0 between a point and itself', () => {
    expect(GeoDistance.haversineMetres(colombo, { ...colombo })).toBe(0);
  });

  it('DMS-104: gives half the circumference between antipodes', () => {
    const metres = GeoDistance.haversineMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });

    expect(metres).toBeCloseTo(Math.PI * 6371000, 0);
  });

  it.each([
    ['null', null],
    ['an empty object', {}],
    ['a missing lng', { lat: 6.9 }],
    ['a string lat', { lat: '6.9', lng: 79.8 }],
    ['a NaN lat', { lat: NaN, lng: 79.8 }],
    ['an infinite lng', { lat: 6.9, lng: Infinity }],
  ])('DMS-104: throws a TypeError for %s rather than returning NaN', (_label, point) => {
    expect(() => GeoDistance.haversineMetres(point, colombo)).toThrow(TypeError);
    expect(() => GeoDistance.haversineMetres(colombo, point)).toThrow(TypeError);
  });
});

describe('GeoDistance.metresOutsideBox', () => {
  const box = { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 };

  it('DMS-104: gives 0 for a point inside the box', () => {
    expect(GeoDistance.metresOutsideBox({ lat: 6.9, lng: 80 }, box)).toBe(0);
  });

  it.each([
    ['the northern edge', { lat: 6.98, lng: 80 }],
    ['the western edge', { lat: 6.9, lng: 79.83 }],
    ['a corner', { lat: 6.75, lng: 80.22 }],
  ])('DMS-104: gives 0 for a point on %s', (_label, point) => {
    expect(GeoDistance.metresOutsideBox(point, box)).toBe(0);
  });

  it('DMS-104: gives the distance to the nearest edge for a point outside', () => {
    // 0.1 degrees of longitude at 6.9 N is about 11 km.
    expect(km(GeoDistance.metresOutsideBox({ lat: 6.9, lng: 79.73 }, box))).toBeCloseTo(11.04, 1);
  });

  it('DMS-104: gives the distance to the nearest corner for a point off a corner', () => {
    const point = { lat: 7.08, lng: 80.32 };

    expect(GeoDistance.metresOutsideBox(point, box)).toBeCloseTo(
      GeoDistance.haversineMetres(point, { lat: 6.98, lng: 80.22 }),
      6,
    );
  });

  it('DMS-104: throws a TypeError for a bad point', () => {
    expect(() => GeoDistance.metresOutsideBox({ lat: 'x', lng: 1 }, box)).toThrow(TypeError);
  });
});
