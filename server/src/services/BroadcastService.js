import mongoose from 'mongoose';
import { HazardAlert } from '../domain/alerts/HazardAlert.js';
import { InvalidAlertTransitionError } from '../domain/alerts/InvalidAlertTransitionError.js';
import { MessageTemplate } from '../domain/alerts/MessageTemplate.js';
import { Notification } from '../domain/alerts/Notification.js';
import { AlertStatus } from '../enums/AlertStatus.js';
import { NotificationKind } from '../enums/NotificationKind.js';
import { NotificationType } from '../enums/NotificationType.js';
import { HazardAlert as HazardAlertModel } from '../models/HazardAlert.js';
import { Notification as NotificationModel } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { areaRegistry as defaultAreaRegistry } from './AreaRegistry.js';
import { citizenRegistry as defaultCitizenRegistry } from './CitizenRegistry.js';
import { HazardAlertPresenter } from './HazardAlertPresenter.js';
import { notificationService as defaultNotificationService } from './NotificationService.js';
import { AudibleChannel } from './notifications/AudibleChannel.js';
import { PushChannel } from './notifications/PushChannel.js';
import { SmsChannel } from './notifications/SmsChannel.js';

// UC01 Issue Hazard Warning, broadcasting (main flow steps 11-14): the
// WarningController's work in the sequence diagram's Broadcast section. It
// moves the alert to BROADCAST, then, for every recipient and every channel,
// creates a delivery record as QUEUED, sends it through that channel's
// strategy and records the result. The channels are an injected list
// (Strategy), so adding one changes nothing here (Open/Closed). A channel that
// fails or throws is recorded as FAILED and never stops the others.
export class BroadcastService {
  // Delivery records are written in batches of this many (~500 citizens × 3
  // channels broadcast in one or two round trips).
  static BATCH_SIZE = 1000;

  #alertModel;
  #notificationModel;
  #areaRegistry;
  #citizenRegistry;
  #notifications;
  #channels;
  #clock;

  constructor({
    alertModel = HazardAlertModel,
    notificationModel = NotificationModel,
    areaRegistry = defaultAreaRegistry,
    citizenRegistry = defaultCitizenRegistry,
    notifications = defaultNotificationService,
    channels = [new PushChannel(), new SmsChannel(), new AudibleChannel()],
    clock = systemClock,
  } = {}) {
    this.#alertModel = alertModel;
    this.#notificationModel = notificationModel;
    this.#areaRegistry = areaRegistry;
    this.#citizenRegistry = citizenRegistry;
    this.#notifications = notifications;
    this.#channels = channels;
    this.#clock = clock;
  }

  /**
   * Steps 11-14: broadcasts a DRAFT to everyone in its scope on every channel.
   * @param {string} alertId
   * @param {{ id: string }} officer The signed-in DMC or duty officer.
   * @param {string} message The text as the officer last saw it (≤160, validated).
   * @returns {Promise<{ alert: object }>} The alert object, now BROADCAST.
   * @throws {ApiError} 404 for an unknown alert, 409 if it isn't a previewed
   *   DRAFT (or a colleague broadcast it first), 400 if its scope is no longer
   *   registered.
   */
  async broadcast(alertId, officer, message) {
    const doc = await this.#findDoc(alertId);
    const alert = HazardAlert.fromDocument(doc);
    alert.broadcast(officer, this.#clock.now(), message);

    // Re-checked against the current data, in case the preview is stale.
    const districtIds = await this.#currentDistricts(alert);
    const recipients = await this.#citizenRegistry.findRecipients(districtIds);

    // Only one broadcast of a draft can win: the update matches DRAFT only.
    const broadcastDoc = await this.#alertModel.findOneAndUpdate(
      { _id: doc._id, status: AlertStatus.DRAFT },
      alert.toFields(),
      { returnDocument: 'after' },
    );
    if (!broadcastDoc) {
      const current = await this.#alertModel.findById(doc._id).select('status').lean();
      throw new InvalidAlertTransitionError(
        `Only a DRAFT alert can be broadcast – current status: ${current?.status}`,
        current?.status,
      );
    }

    await this.#deliver(alert, recipients, NotificationKind.WARNING);
    await this.#putInInboxes(alert, recipients);
    return { alert: await HazardAlertPresenter.present(broadcastDoc) };
  }

  // The recipient × channel loop, a batch at a time: create each delivery as
  // QUEUED, send it through its channel, then save every result together.
  async #deliver(alert, recipients, kind) {
    const deliveries = recipients.flatMap((recipient) =>
      this.#channels.map((strategy) => ({
        strategy,
        notification: new Notification({
          id: new mongoose.Types.ObjectId(),
          alert: alert.id,
          alertVersion: alert.version,
          kind,
          citizen: recipient.id,
          channel: strategy.channel,
        }),
      })),
    );

    for (let start = 0; start < deliveries.length; start += BroadcastService.BATCH_SIZE) {
      const batch = deliveries.slice(start, start + BroadcastService.BATCH_SIZE);
      await this.#notificationModel.insertMany(
        batch.map(({ notification }) => ({
          _id: notification.id,
          alert: notification.alertId,
          alertVersion: notification.alertVersion,
          kind: notification.kind,
          citizen: notification.citizenId,
          channel: notification.channel,
        })),
      );
      await Promise.all(batch.map((delivery) => this.#send(delivery)));
      await this.#notificationModel.bulkWrite(
        batch.map(({ notification }) => ({
          updateOne: {
            filter: { _id: notification.id },
            update: { $set: notification.deliveryChanges() },
          },
        })),
      );
    }
  }

  // One send: the channel's result on the delivery, a throw recorded as FAILED.
  async #send({ strategy, notification }) {
    let result;
    try {
      result = await strategy.send(notification);
    } catch (error) {
      result = { status: 'FAILED', reason: error.message };
    }
    const at = this.#clock.now();
    if (result.status === 'DELIVERED') notification.markDelivered(at);
    else if (result.status === 'SENT') notification.markSent(at);
    else notification.markFailed(result.reason, at);
  }

  // The citizen-side stand-in for the mocked push, SMS and audible alert: an
  // inbox item each, coloured by severity in the app. NotificationService
  // never throws, so the inbox can't fail the broadcast.
  async #putInInboxes(alert, recipients) {
    const payload = {
      type: NotificationType.HAZARD_ALERT,
      title: MessageTemplate.title(alert.hazardType, alert.severity),
      body: alert.message,
      severity: alert.severity,
    };
    await Promise.all(
      recipients.map((recipient) => this.#notifications.notifyUser(recipient.id, payload)),
    );
  }

  // The scope's districts now; a 400 on areaIds if an area has gone.
  async #currentDistricts(alert) {
    const ids = alert.targets.map((target) => target.areaId);
    const { areas, unknownIds } = await this.#areaRegistry.validateAreas(ids);
    if (unknownIds.length > 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
        { field: 'areaIds', message: `unknown area ids: ${unknownIds.join(', ')}` },
      ]);
    }
    return this.#areaRegistry.expandToDistricts(areas);
  }

  async #findDoc(alertId) {
    const doc = mongoose.isValidObjectId(alertId) ? await this.#alertModel.findById(alertId) : null;
    if (!doc) {
      throw new ApiError(404, 'NOT_FOUND', 'Hazard alert not found.');
    }
    return doc;
  }
}

export const broadcastService = new BroadcastService();
