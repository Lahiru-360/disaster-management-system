import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/Config.js';
import { ApiError } from '../utils/ApiError.js';

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);

const EXTENSIONS_BY_MIME_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
};

const PUBLIC_URL_MARKER = `/object/public/${env.supabaseBucketName}/`;
const STORAGE_ORIGIN = new URL(env.supabaseUrl).origin;

// Lets a caller check a client-supplied URL (e.g. one returned by an earlier upload)
// against the project's own storage host without downloading it to inspect
// it — only the origin is compared, never the path or the object's
// existence. A malformed URL is just "not ours", not a thrown error.
export const isStorageUrl = (url) => {
  try {
    return new URL(url).origin === STORAGE_ORIGIN;
  } catch {
    return false;
  }
};

// A Supabase outage, a bad key or a network failure must never reach the
// client as an unhandled rejection or a bare 500 with a stack trace — the
// client has to be able to tell "storage is down" from "your file was
// invalid" (a 400 from the upload middleware). The underlying error is
// deliberately not attached or logged here: it may carry request details
// that shouldn't be surfaced.
const storageError = (action) =>
  new ApiError(502, 'STORAGE_UNAVAILABLE', `Could not ${action} the file. Please try again.`);

// Never the client-supplied filename: two users uploading photo.jpg must not
// collide, and the key must not be derivable from a user id, so nothing
// identifying the uploader goes into it.
const generateObjectKey = (folder, mimeType) => {
  const extension = EXTENSIONS_BY_MIME_TYPE[mimeType] ?? '';
  return `${folder}/${randomUUID()}${extension}`;
};

export const storeFile = async (buffer, mimeType, folder) => {
  const key = generateObjectKey(folder, mimeType);

  let uploadResult;
  try {
    uploadResult = await supabase.storage
      .from(env.supabaseBucketName)
      .upload(key, buffer, { contentType: mimeType });
  } catch {
    throw storageError('upload');
  }

  if (uploadResult.error) {
    throw storageError('upload');
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(env.supabaseBucketName).getPublicUrl(key);

  return publicUrl;
};

// Accepts either a full public URL (what callers store) or a bare object key,
// so a caller never has to parse Supabase's URL shape itself.
const keyFromUrlOrKey = (urlOrKey) => {
  const markerIndex = urlOrKey.indexOf(PUBLIC_URL_MARKER);
  return markerIndex === -1 ? urlOrKey : urlOrKey.slice(markerIndex + PUBLIC_URL_MARKER.length);
};

export const removeFile = async (urlOrKey) => {
  const key = keyFromUrlOrKey(urlOrKey);

  let removeResult;
  try {
    removeResult = await supabase.storage.from(env.supabaseBucketName).remove([key]);
  } catch {
    throw storageError('delete');
  }

  if (removeResult.error) {
    throw storageError('delete');
  }
};
