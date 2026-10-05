import { PersonFactory } from '../domain/people/PersonFactory.js';
import { User as UserModel } from '../models/User.js';
import { UserNotification as UserNotificationModel } from '../models/UserNotification.js';
import { InAppChannel } from './notifications/InAppChannel.js';

// The one way any use case tells a person something (api-contract §11.5). It
// stores an inbox item and hands it to every configured channel, without
// knowing which channels those are. Sending is a side effect of the caller's
// request, so nothing here ever fails it: a storage error is logged, and a
// channel that fails or throws is recorded on the item as FAILED.
export class NotificationService {
  // The User fields a role-wide notification may be narrowed by.
  static #DISTRICT_FIELDS = ['homeDistrict', 'district', 'shiftDistrict'];

  #channels;
  #userNotificationModel;
  #userModel;
  #clock;

  constructor({
    channels = [new InAppChannel()],
    userNotificationModel = UserNotificationModel,
    userModel = UserModel,
    clock = () => new Date(),
  } = {}) {
    this.#channels = channels;
    this.#userNotificationModel = userNotificationModel;
    this.#userModel = userModel;
    this.#clock = clock;
  }

  /**
   * Stores one inbox item for one user and delivers it through every channel.
   * Never throws.
   * @param {string} userId
   * @param {{ type: string, title: string, body: string, link?: string, severity?: string }} payload
   * @returns {Promise<object|null>} the stored item, or null when it could not be stored
   */
  async notifyUser(userId, { type, title, body, link = null, severity = null }) {
    let item;
    try {
      item = await this.#userNotificationModel.create({
        user: userId,
        type,
        title,
        body,
        link,
        severity,
      });
    } catch (error) {
      console.error(`Could not store a ${type} notification for user ${userId}:`, error.message);
      return null;
    }

    item.deliveries = await Promise.all(
      this.#channels.map((channel) => this.#deliver(channel, item)),
    );
    try {
      await item.save();
    } catch (error) {
      console.error(`Could not record deliveries for notification ${item.id}:`, error.message);
    }
    return item;
  }

  /**
   * Notifies every active user holding `role`, or a role that inherits from it
   * (notifying dmc_officer also reaches every duty_officer). With `districtId`,
   * only users whose `districtField` is that district. Never throws for a
   * delivery problem; an unknown role or district field is a coding error and
   * does throw.
   * @param {string} role
   * @param {{ districtId?: string, districtField?: 'homeDistrict'|'district'|'shiftDistrict' }} scope
   * @param {object} payload as for notifyUser
   * @returns {Promise<object[]>} the stored items; empty when nobody matched
   */
  async notifyRole(role, { districtId, districtField } = {}, payload) {
    const filter = { role: { $in: NotificationService.#rolesInheriting(role) }, isActive: true };
    if (districtId !== undefined) {
      if (!NotificationService.#DISTRICT_FIELDS.includes(districtField)) {
        throw new Error(
          `districtField must be one of ${NotificationService.#DISTRICT_FIELDS.join(', ')}`,
        );
      }
      filter[districtField] = districtId;
    }

    const users = await this.#userModel.find(filter).select('_id');
    const items = await Promise.all(users.map((user) => this.notifyUser(user._id, payload)));
    return items.filter((item) => item !== null);
  }

  // A channel's result as a delivery record. A throw becomes FAILED with its message.
  async #deliver(channel, item) {
    let result;
    try {
      result = await channel.send(item);
    } catch (error) {
      result = { status: 'FAILED', reason: error.message };
    }
    return {
      channel: channel.name,
      status: result.status,
      reason: result.reason ?? null,
      at: this.#clock(),
    };
  }

  // The role itself and every role whose class extends it, from the Person
  // hierarchy, so there is no second copy of who inherits from whom.
  static #rolesInheriting(role) {
    const RoleClass = PersonFactory.classFor(role);
    return PersonFactory.classes()
      .filter(
        (PersonClass) => PersonClass === RoleClass || PersonClass.prototype instanceof RoleClass,
      )
      .map((PersonClass) => PersonClass.role);
  }
}

export const notificationService = new NotificationService();
