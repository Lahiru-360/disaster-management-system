// Upload client. `POST /api/uploads` (docs/api-contract.md §6) takes
// multipart form data under the fixed `file` field plus a `folder` purpose;
// the client never talks to Supabase directly, only to this endpoint.
//
// React Native's `FormData` needs a `{ uri, name, type }` object for a file
// entry, not a browser `File`/`Blob` - a mismatch here surfaces as an empty
// upload rather than an error, so all three are always set explicitly from
// the `expo-image-picker` asset.

import client from './client';

/**
 * `POST /api/uploads` - uploads a single image for the given purpose and
 * returns its stored URL (`data.url`, §6.1). `asset` is an
 * `expo-image-picker` result asset; `folder` is one of the server's closed
 * purposes (only `"avatars"` so far).
 */
async function uploadImage(asset, folder) {
  const mimeType = asset.mimeType || 'image/jpeg';
  const extension = mimeType.split('/')[1] || 'jpg';

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `photo.${extension}`,
    type: mimeType,
  });
  formData.append('folder', folder);

  const response = await client.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data.url;
}

/**
 * `POST /api/uploads` for a non-image file (e.g. a PDF). `asset` has the
 * shape of an `expo-document-picker`
 * result asset - `{ uri, name, mimeType }` - which already carries a real
 * file name and MIME type, unlike `expo-image-picker`'s asset shape that
 * `uploadImage` above has to derive them from.
 */
async function uploadFile(asset, folder) {
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType,
  });
  formData.append('folder', folder);

  const response = await client.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data.url;
}

export default {
  uploadImage,
  uploadFile,
};
