import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/Config.js';
import { ApiError } from '../utils/ApiError.js';

// Stores and removes files in the project's Supabase Storage bucket.
export class StorageService {
  static #EXTENSIONS_BY_MIME_TYPE = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'application/pdf': '.pdf',
  };

  #client;
  #bucketName;
  #publicUrlMarker;
  #storageOrigin;

  constructor() {
    this.#client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
    this.#bucketName = env.supabaseBucketName;
    this.#publicUrlMarker = `/object/public/${env.supabaseBucketName}/`;
    this.#storageOrigin = new URL(env.supabaseUrl).origin;
  }

  // Lets a caller check a client-supplied URL (e.g. one returned by an earlier upload)
  // against the project's own storage host without downloading it to inspect
  // it — only the origin is compared, never the path or the object's
  // existence. A malformed URL is just "not ours", not a thrown error.
  isStorageUrl(url) {
    try {
      return new URL(url).origin === this.#storageOrigin;
    } catch {
      return false;
    }
  }

  async storeFile(buffer, mimeType, folder) {
    const key = this.#generateObjectKey(folder, mimeType);

    let uploadResult;
    try {
      uploadResult = await this.#bucket().upload(key, buffer, { contentType: mimeType });
    } catch {
      throw StorageService.#storageError('upload');
    }

    if (uploadResult.error) {
      throw StorageService.#storageError('upload');
    }

    const {
      data: { publicUrl },
    } = this.#bucket().getPublicUrl(key);

    return publicUrl;
  }

  async removeFile(urlOrKey) {
    const key = this.#keyFromUrlOrKey(urlOrKey);

    let removeResult;
    try {
      removeResult = await this.#bucket().remove([key]);
    } catch {
      throw StorageService.#storageError('delete');
    }

    if (removeResult.error) {
      throw StorageService.#storageError('delete');
    }
  }

  #bucket() {
    return this.#client.storage.from(this.#bucketName);
  }

  // Never the client-supplied filename: two users uploading photo.jpg must not
  // collide, and the key must not be derivable from a user id, so nothing
  // identifying the uploader goes into it.
  #generateObjectKey(folder, mimeType) {
    const extension = StorageService.#EXTENSIONS_BY_MIME_TYPE[mimeType] ?? '';
    return `${folder}/${randomUUID()}${extension}`;
  }

  // Accepts either a full public URL (what callers store) or a bare object key,
  // so a caller never has to parse Supabase's URL shape itself.
  #keyFromUrlOrKey(urlOrKey) {
    const markerIndex = urlOrKey.indexOf(this.#publicUrlMarker);
    return markerIndex === -1
      ? urlOrKey
      : urlOrKey.slice(markerIndex + this.#publicUrlMarker.length);
  }

  // A Supabase outage, a bad key or a network failure must never reach the
  // client as an unhandled rejection or a bare 500 with a stack trace — the
  // client has to be able to tell "storage is down" from "your file was
  // invalid" (a 400 from the upload middleware). The underlying error is
  // deliberately not attached or logged here: it may carry request details
  // that shouldn't be surfaced.
  static #storageError(action) {
    return new ApiError(
      502,
      'STORAGE_UNAVAILABLE',
      `Could not ${action} the file. Please try again.`,
    );
  }
}

export const storageService = new StorageService();
