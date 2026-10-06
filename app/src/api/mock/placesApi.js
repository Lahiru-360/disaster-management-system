// Mock of ../placesApi.js (§9.8): a few places from the server's gazetteer,
// searched the same way - case-insensitive name prefix, at most 10, by name.

const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 500;

const COLOMBO = { id: '66f7c1a2b3c4d5e6f7a8b901', name: 'Colombo' };
const GAMPAHA = { id: '66f7c1a2b3c4d5e6f7a8b902', name: 'Gampaha' };
const KANDY = { id: '66f7c1a2b3c4d5e6f7a8b904', name: 'Kandy' };

const PLACES = [
  ['Colombo Fort', COLOMBO, 6.9344, 79.8428],
  ['Dehiwala', COLOMBO, 6.8517, 79.8653],
  ['Kaduwela', COLOMBO, 6.9333, 79.9833],
  ['Kolonnawa', COLOMBO, 6.9329, 79.8848],
  ['Kotikawatta', COLOMBO, 6.9282, 79.9122],
  ['Maharagama', COLOMBO, 6.8484, 79.9265],
  ['Biyagama', GAMPAHA, 6.9425, 79.9878],
  ['Gampaha', GAMPAHA, 7.0917, 79.9999],
  ['Ja-Ela', GAMPAHA, 7.0744, 79.8919],
  ['Kelaniya', GAMPAHA, 6.9553, 79.922],
  ['Negombo', GAMPAHA, 7.2083, 79.8358],
  ['Kandy', KANDY, 7.2906, 80.6337],
  ['Peradeniya', KANDY, 7.2692, 80.5942],
].map(([name, district, latitude, longitude], index) => ({
  id: `66f9b1d2c3e4f5a6b7c8d9${String(index).padStart(2, '0')}`,
  name,
  district,
  location: { latitude, longitude },
}));

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function search(q) {
  await delay();
  const prefix = (q || '').trim().toLowerCase();
  return PLACES.filter((place) => place.name.toLowerCase().startsWith(prefix))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((place) => ({ ...place }));
}

export default {
  search,
};
