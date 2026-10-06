// Mock of ../areasApi.js (§7.1): the districts the other mocks refer to, with
// the server's centroids.

const DISTRICTS = [
  {
    id: '66f7c1a2b3c4d5e6f7a8b901',
    name: 'Colombo',
    province: 'Western',
    centroid: { lat: 6.9271, lng: 79.8612 },
  },
  {
    id: '66f7c1a2b3c4d5e6f7a8b902',
    name: 'Gampaha',
    province: 'Western',
    centroid: { lat: 7.0917, lng: 79.9999 },
  },
  {
    id: '66f7c1a2b3c4d5e6f7a8b903',
    name: 'Kalutara',
    province: 'Western',
    centroid: { lat: 6.5854, lng: 79.9607 },
  },
  {
    id: '66f7c1a2b3c4d5e6f7a8b904',
    name: 'Kandy',
    province: 'Central',
    centroid: { lat: 7.2906, lng: 80.6337 },
  },
];

async function listDistricts() {
  return DISTRICTS.map((district) => ({ ...district, centroid: { ...district.centroid } }));
}

export default {
  listDistricts,
};
