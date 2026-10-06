import { QUEUE_ITEM_STATE } from '../store/OfflineQueue';

// UC02 A3.2: sends the reports saved offline once the phone is back online.
// One at a time, oldest first: upload the photo (§6), then POST the report
// with its clientReportId (§9.2), so a report that reached the server before
// a connection dropped is not stored twice - the server answers with the
// report it already has. A sent report leaves the queue and `onSent(report)`
// is called (the "Report GR-#### sent" notice).
//
// A failure leaves the report on the phone: with no connection it goes back
// to QUEUED; a server refusal marks it FAILED with the reason. Automatic
// retries with a backoff are E2's (DMS-137).
//
// Everything it uses is passed in, so it runs without a phone in tests.
export class SyncService {
  #queue;
  #uploadApi;
  #hazardReportsApi;
  #onSent;
  #running = null;

  constructor({ queue, uploadApi, hazardReportsApi, onSent = () => {} }) {
    this.#queue = queue;
    this.#uploadApi = uploadApi;
    this.#hazardReportsApi = hazardReportsApi;
    this.#onSent = onSent;
  }

  /**
   * Sends every waiting report, one after another. A call while a sync is
   * already running joins that run instead of starting a second one.
   * @returns {Promise<{ sent: number, failed: number }>}
   */
  syncAll() {
    if (!this.#running) {
      this.#running = this.#run().finally(() => {
        this.#running = null;
      });
    }
    return this.#running;
  }

  async #run() {
    let sent = 0;
    let failed = 0;
    for (const item of await this.#queue.list()) {
      if (item.state === QUEUE_ITEM_STATE.SENDING) continue;
      const outcome = await this.#send(item);
      if (outcome === 'sent') sent += 1;
      if (outcome === 'failed') failed += 1;
      // No connection: the rest would fail the same way, so stop here.
      if (outcome === 'offline') break;
    }
    return { sent, failed };
  }

  async #send(item) {
    await this.#queue.update(item.clientReportId, {
      state: QUEUE_ITEM_STATE.SENDING,
      attempts: (item.attempts ?? 0) + 1,
    });
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
      return 'sent';
    } catch (error) {
      if (!error?.response) {
        await this.#queue.update(item.clientReportId, { state: QUEUE_ITEM_STATE.QUEUED });
        return 'offline';
      }
      await this.#queue.update(item.clientReportId, {
        state: QUEUE_ITEM_STATE.FAILED,
        lastError: error.response.data?.error?.message ?? `Server error ${error.response.status}`,
      });
      return 'failed';
    }
  }
}
