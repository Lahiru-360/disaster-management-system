// Mock of ../uploadApi.js (docs/api-contract.md §6): resolves with a
// placeholder URL in the requested folder instead of storing the file, so a
// screen that uploads before submitting (e.g. the hazard report photo) works
// with USE_MOCK. Same signatures as the real client.

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomName() {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function uploadImage(asset, folder) {
  await delay();
  const extension = (asset?.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
  return `https://mock.storage.test/${folder}/${randomName()}.${extension}`;
}

async function uploadFile(asset, folder) {
  await delay();
  const extension = (asset?.name || 'file.pdf').split('.').pop();
  return `https://mock.storage.test/${folder}/${randomName()}.${extension}`;
}

export default {
  uploadImage,
  uploadFile,
};
