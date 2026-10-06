import mongoose from 'mongoose';
import { fallbackPolicy as defaultFallbackPolicy } from '../domain/alerts/FallbackPolicy.js';
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
import { deliverySummary as defaultDeliverySummary } from './DeliverySummary.js';
import { HazardAlertPresenter } from './HazardAlertPresenter.js';
import { notificationService as defaultNotificationService } from './NotificationService.js';
import { warningService as defaultWarningService } from './WarningService.js';
import { AudibleChannel } from './notifications/AudibleChannel.js';
import { PushChannel } from './notifications/PushChannel.js';
import { SmsChannel } from './notifications/SmsChannel.js';

// UC01 Issue Hazard Warning, broadcasting (main flow steps 11-14) and sending
// an update (A2.3): the WarningController's work in the sequence diagram's
// Broadcast and Update sections. It moves the alert to BROADCAST, or to
// UPDATED with the next version, then, for every recipient and every channel,
// creates a delivery record as QUEUED, sends it through that channel's
// strategy and records the result. The channels are an injected list
// (Strategy), so adding one changes nothing here (Open/Closed). A send that
// fails or throws is resent through the fallback channel as the injected
// FallbackPolicy allows (E3), is recorded as FAILED if it still fails, and
// never stops the others.
export class BroadcastService {
  // Delivery records are written in batches of this many (~500 citizens × 3
  // channels broadcast in one or two round trips).
  static BATCH_SIZE = 1000;

  #alertModel;
  #notificationModel;
  #areaRegistry;
  #citizenRegistry;
  #notifications;
  #warnings;
  #summary;
  #channels;
  #fallback;
  #clock;

  constructor({
    alertModel = HazardAlertModel,
    notificationModel = NotificationModel,
    areaRegistry = defaultAreaRegistry,
    citizenRegistry = defaultCitizenRegistry,
    notifications = defaultNotificationService,
    warnings = defaultWarningService,
    summary = defaultDeliverySummary,
    channels = [new PushChannel(), new SmsChannel(), new AudibleChannel()],
    fallback = defaultFallbackPolicy,
    clock = systemClock,
  } = {}) {
    this.#alertModel = alertModel;
    this.#notificationModel = notificationModel;
    this.#areaRegistry = areaRegistry;
    this.#citizenRegistry = citizenRegistry;
    this.#notifications = notifications;
    this.#warnings = warnings;
    this.#summary = summary;
    this.#channels = channels;
    this.#fallback = fallback;
    this.#clock = clock;
  }

  /**
   * Steps 11-14: broadcasts a DRAFT to everyone in its scope on every channel.
   * @param {string} alertId
   * @param {{ id: string }} officer The signed-in DMC or duty officer.
   * @param {string} message The text as the officer last saw it (≤160, validated).
   * @returns {Promise<{ alert: object, summary: object }>} The alert object, now
   *   BROADCAST, and its delivery summary.
   * @throws {ApiError} 404 for an unknown alert, 409 if it isn't a previewed
   *   DRAFT (or a colleague broadcast it first), its scope holds no citizens
   *   (E2) or an active warning already covers it (A2), 400 if its scope is
   *   no longer registered.
   */
  async broadcast(alertId, officer, message) {
    const doc = await this.#findDoc(alertId);
    const alert = HazardAlert.fromDocument(doc);
    alert.broadcast(officer, this.#clock.now(), message);

    // Re-checked against the current data, in case the preview is stale.
    const districtIds = await this.#currentDistricts(alert);
    const recipients = await this.#recipientsWithoutConflict(alert, districtIds);

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
    return {
      alert: await HazardAlertPresenter.present(broadcastDoc),
      summary: await this.#summary.forAlert(alert.id, alert.version),
    };
  }

  /**
   * A2.3, then steps 9-14 (contract §12.14): updates an active warning's
   * severity and/or scope and sends the update to the citizens in the new
   * scope - recalculated, whether or not they had the original warning - as
   * deliveries of kind UPDATE for the new version. The new draft that found
   * the conflict, if named, is then discarded.
   * @param {string} alertId
   * @param {{ id: string }} officer The signed-in DMC or duty officer.
   * @param {{ severity?: string, areaIds?: string[], message: string,
   *   replacesDraftId?: string }} update Left out, the severity or scope stays.
   * @returns {Promise<{ alert: object, summary: object }>} The alert object, now
   *   UPDATED, and the delivery summary of its new version.
   * @throws {ApiError} 404 for an unknown alert; 400 for an invalid scope or an
   *   update that changes nothing; 409 if it isn't active (or a colleague
   *   changed it first), its new scope holds no citizens (E2) or another
   *   active warning covers it.
   */
  async update(alertId, officer, { severity = null, areaIds = null, message, replacesDraftId }) {
    const doc = await this.#findDoc(alertId);
    const alert = HazardAlert.fromDocument(doc);
    const previousVersion = alert.version;
    const areas = areaIds ? await this.#validAreas(areaIds) : null;
    if (alert.isActive() && !alert.changesWith(severity, areas)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
        { field: 'severity', message: 'change the severity or the scope' },
      ]);
    }
    alert.update(severity, areas, officer, this.#clock.now(), message);

    const districtIds = await this.#currentDistricts(alert);
    const recipients = await this.#recipientsWithoutConflict(alert, districtIds);

    // Only one change to a version can win: the update matches the version read.
    const updatedDoc = await this.#alertModel.findOneAndUpdate(
      { _id: doc._id, status: { $in: HazardAlert.ACTIVE_STATUSES }, version: previousVersion },
      alert.toFields(),
      { returnDocument: 'after' },
    );
    if (!updatedDoc) {
      const current = await this.#alertModel.findById(doc._id).select('status version').lean();
      throw new InvalidAlertTransitionError(
        HazardAlert.ACTIVE_STATUSES.includes(current?.status)
          ? `The alert was changed by someone else – current version: ${current.version}`
          : `Only an active alert can be updated – current status: ${current?.status}`,
        current?.status,
      );
    }

    await this.#deliver(alert, recipients, NotificationKind.UPDATE);
    await this.#putInInboxes(alert, recipients);
    if (replacesDraftId) await this.#discardReplacedDraft(replacesDraftId);
    return {
      alert: await HazardAlertPresenter.present(updatedDoc),
      summary: await this.#summary.forAlert(alert.id, alert.version),
    };
  }

  /**
   * Step 14, reopened at any time (contract §12.7): the alert and the delivery
   * summary of its current version. A DRAFT has sent nothing, so all zeros.
   * @param {string} alertId
   * @returns {Promise<{ alert: object, summary: object }>}
   * @throws {ApiError} 404 for an unknown or malformed id.
   */
  async deliverySummary(alertId) {
    const doc = await this.#findDoc(alertId);
    return {
      alert: await HazardAlertPresenter.present(doc),
      summary: await this.#summary.forAlert(doc.id, doc.version),
    };
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

  // One delivery, per the sequence diagram's opt [failed E3] fragment: the
  // first send, then resends through the fallback channel while it fails and
  // the policy allows another attempt. Only the last result is recorded.
  async #send({ strategy, notification }) {
    let result = await BroadcastService.#attempt(strategy, notification);
    const fallback = this.#channels.find((channel) => channel.channel === this.#fallback.channel);
    while (
      result.status === 'FAILED' &&
      fallback &&
      this.#fallback.allowsResend(notification.attempts)
    ) {
      notification.resendVia(fallback.channel);
      result = await BroadcastService.#attempt(fallback, notification);
    }
    const at = this.#clock.now();
    if (result.status === 'DELIVERED') notification.markDelivered(at);
    else if (result.status === 'SENT') notification.markSent(at);
    else notification.markFailed(result.reason, at);
  }

  // One attempt through one channel; a throw counts as a failed attempt.
  static async #attempt(strategy, notification) {
    try {
      return await strategy.send(notification);
    } catch (error) {
      return { status: 'FAILED', reason: error.message };
    }
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

  // The citizens to send to in these districts, after refusing a scope that
  // reaches no one (E2) or that another active warning of the same type
  // already covers (A2). Either way nothing changes and nothing is sent.
  async #recipientsWithoutConflict(alert, districtIds) {
    const [recipients, conflict] = await Promise.all([
      this.#citizenRegistry.findRecipients(districtIds),
      this.#warnings.findActive(alert.hazardType, districtIds, { excludeId: alert.id }),
    ]);
    if (recipients.length === 0) {
      throw new ApiError(
        409,
        'NO_RECIPIENTS_IN_SCOPE',
        'No registered citizens are in the selected scope',
      );
    }
    if (conflict) {
      throw new ApiError(
        409,
        'ACTIVE_WARNING_EXISTS',
        `An active ${conflict.hazardType} warning (${conflict.referenceNo}) already covers this scope – update it instead`,
      );
    }
    return recipients;
  }

  // A2: the new draft that found the conflict isn't needed once the update
  // is sent. One that is gone or no longer a DRAFT is left alone.
  async #discardReplacedDraft(draftId) {
    try {
      await this.#warnings.discardDraft(draftId);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
  }

  // The scope's districts now; a 400 on areaIds if an area has gone.
  async #currentDistricts(alert) {
    const areas = await this.#validAreas(alert.targets.map((target) => target.areaId));
    return this.#areaRegistry.expandToDistricts(areas);
  }

  // The registered areas for the ids, or a 400 on areaIds naming every id
  // that isn't one (E1).
  async #validAreas(ids) {
    const { areas, unknownIds } = await this.#areaRegistry.validateAreas(ids);
    if (unknownIds.length > 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
        { field: 'areaIds', message: `unknown area ids: ${unknownIds.join(', ')}` },
      ]);
    }
    return areas;
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
