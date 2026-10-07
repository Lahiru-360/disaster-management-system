import { QUEUE_ITEM_STATE } from '../store/OfflineQueue';
import { RetryPolicy } from './RetryPolicy';

// UC02 A3.2 / E2: sends the reports saved offline once the phone is back
// online. One at a time, oldest first: upload the photo (§6), then POST the
// report with its clientReportId (§9.2), so a report that reached the server
// before a connection dropped is not stored twice - the server answers with
// the report it already has. A sent report leaves the queue and
// `onSent(report)` is called (the "Report GR-#### sent" notice).
//
// When a send fails (E2), the report stays on the phone:
// - no response, a timeout or a 5xx: WAITING, tried again on the
//   RetryPolicy's schedule (30 s, 1 min, 2 min, 5 min, then every 10 min);
//   with no connection at all the run also stops, since the rest would fail
//   the same way;
// - a 401 that client.js's token refresh couldn't fix: WAITING too - the
//   reporter is signed out, and it goes once they sign in again;
// - a 400: NEEDS_ATTENTION with the server's field errors, not retried until
//   the reporter corrects it (E1).
//
// Everything it uses is passed in, so it runs without a phone in tests.
export class SyncService {
  #queue;
  #uploadApi;
  #hazardReportsApi;
  #retryPolicy;
  #onSent;
  #running = null;

  constructor({
    queue,
    uploadApi,
    hazardReportsApi,
    retryPolicy = new RetryPolicy(),
    onSent = () => {},
  }) {
    this.#queue = queue;
    this.#uploadApi = uploadApi;
    this.#hazardReportsApi = hazardReportsApi;
    this.#retryPolicy = retryPolicy;
    this.#onSent = onSent;
  }

  /**
   * Sends every report that is due, one after another. A call while a sync is
   * already running joins that run instead of starting a second one.
   * @returns {Promise<{ sent: number, waiting: number, needsAttention: number }>}
   */
  syncAll() {
    if (!this.#running) {
      this.#running = this.#run().finally(() => {
        this.#running = null;
      });
    }
    return this.#running;
  }

  /**
   * "Retry now" on My reports: the item is sent at once, whatever its
   * schedule. A NEEDS_ATTENTION item is retried too - the reporter may have
   * fixed what was wrong.
   * @param {string} clientReportId
   */
  async retryNow(clientReportId) {
    await this.#queue.update(clientReportId, {
      state: QUEUE_ITEM_STATE.QUEUED,
      nextAttemptAt: null,
    });
    return this.syncAll();
  }

  /**
   * When the earliest WAITING item is due, so the caller can wake up then.
   * @returns {Promise<string|null>} ISO 8601 time, or null when nothing waits.
   */
  async nextDueAt() {
    const times = (await this.#queue.list())
      .filter((item) => item.state === QUEUE_ITEM_STATE.WAITING && item.nextAttemptAt)
      .map((item) => item.nextAttemptAt)
      .sort();
    return times[0] ?? null;
  }

  async #run() {
    const tally = { sent: 0, waiting: 0, needsAttention: 0 };
    for (const item of await this.#queue.list()) {
      if (!this.#isDue(item)) continue;
      const outcome = await this.#send(item);
      tally[outcome.result] += 1;
      if (outcome.offline) break;
    }
    return tally;
  }

  #isDue(item) {
    if (item.state === QUEUE_ITEM_STATE.QUEUED) return true;
    if (item.state === QUEUE_ITEM_STATE.WAITING) {
      return this.#retryPolicy.isDue(item.nextAttemptAt);
    }
    return false;
  }

  async #send(item) {
    const attempts = (item.attempts ?? 0) + 1;
    await this.#queue.update(item.clientReportId, { state: QUEUE_ITEM_STATE.SENDING, attempts });
    try {
      const photoUrl = item.localPhotoUri
        ? await this.#uploadApi.uploadImage({ uri: item.localPhotoUri }, 'hazard-reports')
        : null;
      const report = await this.#hazardReportsApi.submit({
        description: item.description,
        hazardType: item.hazardType,
        location: item.location,
        locationSource: item.locationSource,
        photoUrl,
        clientReportId: item.clientReportId,
      });
      await this.#queue.remove(item.clientReportId);
      this.#onSent(report);
      return { result: 'sent' };
    } catch (error) {
      const status = error?.response?.status;
      if (this.#retryPolicy.isRetryable(error) || status === 401) {
        await this.#queue.update(item.clientReportId, {
          state: QUEUE_ITEM_STATE.WAITING,
          nextAttemptAt: this.#retryPolicy.nextAttemptAt(attempts),
          lastError: SyncService.#describe(error),
        });
        return { result: 'waiting', offline: status === undefined };
      }
      await this.#queue.update(item.clientReportId, {
        state: QUEUE_ITEM_STATE.NEEDS_ATTENTION,
        nextAttemptAt: null,
        lastError: SyncService.#describe(error),
        fieldErrors: error.response.data?.error?.errors ?? [],
      });
      return { result: 'needsAttention' };
    }
  }

  static #describe(error) {
    if (!error?.response) return 'No connection';
    return error.response.data?.error?.message ?? `Server error ${error.response.status}`;
  }
}
