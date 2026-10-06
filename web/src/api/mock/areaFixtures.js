// Mock geography for the web mocks: the 25 districts and the river basins
// DistrictSeeder seeds, with made-up ids and a made-up count of registered
// citizens per district (Colombo + Gampaha = 48,200, as in the UC01
// wireframe). Mullaitivu has none, so choosing only it shows E2 (no
// recipients in scope). Shared by every mock that needs to know what an area
// id is.

const district = (n, name, province, citizens) => ({
  id: `66f7c1a2b3c4d5e6f7a8b9${String(n).padStart(2, '0')}`,
  name,
  province,
  citizens,
});

export const DISTRICTS = [
  district(1, 'Colombo', 'Western', 31500),
  district(2, 'Gampaha', 'Western', 16700),
  district(3, 'Kalutara', 'Western', 9800),
  district(4, 'Kandy', 'Central', 11200),
  district(5, 'Matale', 'Central', 4100),
  district(6, 'Nuwara Eliya', 'Central', 5300),
  district(7, 'Galle', 'Southern', 8900),
  district(8, 'Matara', 'Southern', 6700),
  district(9, 'Hambantota', 'Southern', 4800),
  district(10, 'Jaffna', 'Northern', 4900),
  district(11, 'Kilinochchi', 'Northern', 1100),
  district(12, 'Mannar', 'Northern', 900),
  district(13, 'Vavuniya', 'Northern', 1500),
  district(14, 'Mullaitivu', 'Northern', 0),
  district(15, 'Batticaloa', 'Eastern', 4400),
  district(16, 'Ampara', 'Eastern', 5200),
  district(17, 'Trincomalee', 'Eastern', 3200),
  district(18, 'Kurunegala', 'North Western', 13100),
  district(19, 'Puttalam', 'North Western', 6000),
  district(20, 'Anuradhapura', 'North Central', 7100),
  district(21, 'Polonnaruwa', 'North Central', 3300),
  district(22, 'Badulla', 'Uva', 6600),
  district(23, 'Monaragala', 'Uva', 3700),
  district(24, 'Ratnapura', 'Sabaragamuwa', 8800),
  district(25, 'Kegalle', 'Sabaragamuwa', 6800),
];

const byName = new Map(DISTRICTS.map((item) => [item.name, item]));

const basin = (n, name, districtNames) => ({
  id: `66f7c1a2b3c4d5e6f7a8b9a${n}`,
  name,
  districts: districtNames.map((districtName) => {
    const { id } = byName.get(districtName);
    return { id, name: districtName };
  }),
});

export const RIVER_BASINS = [
  basin(1, 'Kelani', ['Colombo', 'Gampaha', 'Kegalle', 'Ratnapura', 'Nuwara Eliya']),
  basin(2, 'Kalu', ['Ratnapura', 'Kalutara']),
  basin(3, 'Gin', ['Galle', 'Matara']),
  basin(4, 'Nilwala', ['Matara']),
  basin(5, 'Mahaweli', [
    'Nuwara Eliya',
    'Kandy',
    'Matale',
    'Badulla',
    'Polonnaruwa',
    'Trincomalee',
  ]),
  basin(6, 'Walawe', ['Ratnapura', 'Hambantota', 'Monaragala']),
  basin(7, 'Deduru Oya', ['Kurunegala', 'Puttalam']),
  basin(8, 'Maha Oya', ['Kegalle', 'Kurunegala', 'Gampaha', 'Puttalam']),
];

// An area id as { kind, area }, or null when it names no district or basin.
export function findArea(id) {
  const foundDistrict = DISTRICTS.find((item) => item.id === id);
  if (foundDistrict) return { kind: 'District', area: foundDistrict };
  const foundBasin = RIVER_BASINS.find((item) => item.id === id);
  return foundBasin ? { kind: 'RiverBasin', area: foundBasin } : null;
}

// The ids of every district the areas cover, each once.
export function expandToDistrictIds(areas) {
  const ids = areas.flatMap(({ kind, area }) =>
    kind === 'District' ? [area.id] : area.districts.map((item) => item.id),
  );
  return [...new Set(ids)];
}

export function citizensIn(districtIds) {
  return districtIds.reduce(
    (sum, id) => sum + (DISTRICTS.find((d) => d.id === id)?.citizens ?? 0),
    0,
  );
}
