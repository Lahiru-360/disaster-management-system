import { DistrictCapacityAlert as DistrictCapacityAlertModel } from '../models/DistrictCapacityAlert.js';

// UC03 E2 (DMS-148): when no shelter in a district has space, the DMC is told,
// but not every time an officer updates a shelter. For each district the alert
// goes out at most once an hour while the condition lasts, and again if space
// became available in between. This keeps that rule: `claim` says whether a
// new alert is due and records it in the same step, so two updates at once
// can't both send one; `reset` is how "space became available" is noted.
export class CapacityAlertWindow {
  static WINDOW_MS = 60 * 60 * 1000;

  #alertModel;

  constructor({ alertModel = DistrictCapacityAlertModel } = {}) {
    this.#alertModel = alertModel;
  }

  /**
   * Whether the DMC should be alerted now for this district. True when it never
   * was, or was last alerted an hour or more ago (or space was available since);
   * the time is recorded at once, so the caller that gets true sends the alert
   * and every other caller within the hour gets false.
   * @param {object|string} districtId
   * @param {Date} now
   * @returns {Promise<boolean>}
   */
  async claim(districtId, now) {
    const due = new Date(now.getTime() - CapacityAlertWindow.WINDOW_MS);
    try {
      const claimed = await this.#alertModel.findOneAndUpdate(
        {
          district: districtId,
          $or: [{ lastCapacityAlertAt: null }, { lastCapacityAlertAt: { $lte: due } }],
        },
        { $set: { lastCapacityAlertAt: now } },
        { upsert: true, returnDocument: 'after' },
      );
      return Boolean(claimed);
    } catch (error) {
      // The district's record exists and is inside its hour: the upsert tried
      // to create a second one. Someone alerted recently, so none is due.
      if (error?.code === 11000) return false;
      throw error;
    }
  }

  /**
   * Notes that space is available in the district again, so the next time
   * every shelter fills up the DMC is alerted straight away.
   * @param {object|string} districtId
   * @returns {Promise<void>}
   */
  async reset(districtId) {
    await this.#alertModel.updateOne(
      { district: districtId, lastCapacityAlertAt: { $ne: null } },
      { $set: { lastCapacityAlertAt: null } },
    );
  }
}

export const capacityAlertWindow = new CapacityAlertWindow();
