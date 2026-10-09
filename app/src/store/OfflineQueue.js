// UC02 A3: reports made with no connection, kept on the phone until
// SyncService sends them. Persisted under one key, oldest first, so the queue
// survives an app restart and is sent in the order it was made.
//
// Each item: { clientReportId, description, hazardType, location,
// locationSource, localPhotoUri, createdAt, state, attempts, nextAttemptAt?,
// lastError?, fieldErrors? }. The states (UC02 E2):
//   QUEUED          saved, not tried yet (or "Retry now")
//   SENDING         being sent now
//   WAITING         a try failed for a reason that may pass; tried again
//                   at nextAttemptAt ("Waiting to send")
//   NEEDS_ATTENTION the server refused it (400); fieldErrors say why, and
//                   it is not retried until the reporter corrects it
// A sent report is removed from the queue.
//
// The storage is passed in (AsyncStorage in the app), so the queue's rules
// can be checked without a phone.
export const QUEUE_ITEM_STATE = Object.freeze({
  QUEUED: 'QUEUED',
  SENDING: 'SENDING',
  WAITING: 'WAITING',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
});

export class OfflineQueueFullError extends Error {
  constructor(max) {
    super(
      `You already have ${max} reports waiting to send. Connect to the internet so they can go before you save another.`,
    );
    this.name = 'OfflineQueueFullError';
  }
}

export class OfflineQueue {
  static MAX_ITEMS = 20;

  static #KEY = 'dms.hazardReports.offlineQueue.v1';

  #storage;
  #listeners = new Set();
  #items = null;

  /** @param {{ getItem(key): Promise<string|null>, setItem(key, value): Promise<void> }} storage */
  constructor(storage) {
    this.#storage = storage;
  }

  /** Every item, oldest first. */
  async list() {
    return (await this.#load()).map((item) => ({ ...item }));
  }

  /**
   * Saves a report to send later. Refuses a 21st item - the 20 already
   * waiting are kept - with OfflineQueueFullError.
   * @param {object} report The report fields plus clientReportId and localPhotoUri.
   * @param {Date} [now]
   */
  async enqueue(report, now = new Date()) {
    const items = await this.#load();
    if (items.length >= OfflineQueue.MAX_ITEMS) {
      throw new OfflineQueueFullError(OfflineQueue.MAX_ITEMS);
    }
    const item = {
      clientReportId: report.clientReportId,
      description: report.description,
      hazardType: report.hazardType,
      location: report.location,
      locationSource: report.locationSource,
      localPhotoUri: report.localPhotoUri,
      createdAt: now.toISOString(),
      state: QUEUE_ITEM_STATE.QUEUED,
      attempts: 0,
    };
    await this.#save([...items, item]);
    return { ...item };
  }

  /** Changes one item's fields (e.g. its state), by clientReportId. */
  async update(clientReportId, changes) {
    const items = await this.#load();
    await this.#save(
      items.map((item) =>
        item.clientReportId === clientReportId ? { ...item, ...changes } : item,
      ),
    );
  }

  /** Removes one item once it has been sent. */
  async remove(clientReportId) {
    const items = await this.#load();
    await this.#save(items.filter((item) => item.clientReportId !== clientReportId));
  }

  /** Calls `listener(items)` after every change. Returns the unsubscribe function. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async #load() {
    if (this.#items === null) {
      try {
        const stored = await this.#storage.getItem(OfflineQueue.#KEY);
        // An app killed mid-send leaves an item SENDING: it was not sent, so
        // it goes back to the queue.
        this.#items = (stored ? JSON.parse(stored) : []).map((item) =>
          item.state === QUEUE_ITEM_STATE.SENDING
            ? { ...item, state: QUEUE_ITEM_STATE.QUEUED }
            : item,
        );
      } catch {
        this.#items = [];
      }
    }
    return this.#items;
  }

  async #save(items) {
    this.#items = items;
    await this.#storage.setItem(OfflineQueue.#KEY, JSON.stringify(items));
    for (const listener of this.#listeners) {
      listener(items.map((item) => ({ ...item })));
    }
  }
}
