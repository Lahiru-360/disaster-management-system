import mongoose from 'mongoose';
import { MessageTemplate } from '../../../src/domain/alerts/MessageTemplate.js';
import { AlertHazardType } from '../../../src/enums/AlertHazardType.js';
import { Role } from '../../../src/enums/Role.js';
import { SeverityLevel } from '../../../src/enums/SeverityLevel.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { Notification } from '../../../src/models/Notification.js';
import { UserNotification } from '../../../src/models/UserNotification.js';
import { BroadcastService } from '../../../src/services/BroadcastService.js';
import { WarningService } from '../../../src/services/WarningService.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-02T06:31:00.000Z';
const LATER = '2026-10-02T09:00:00.000Z';
const UPDATE_MESSAGE =
  'UPDATE: Flood Warning now SEVERE. Move to higher ground and follow official guidance.';

describe('MessageTemplate.update', () => {
  it('A2: names the type and the new severity, with the advice for it', () => {
    expect(MessageTemplate.update('FLOOD', 'SEVERE')).toBe(UPDATE_MESSAGE);
    expect(MessageTemplate.update('LANDSLIDE', 'LOW')).toBe(
      'UPDATE: Landslide Warning now LOW. Watch slopes for cracks or falling rocks, and be ready to leave.',
    );
  });

  it('A2: fits in one SMS for every type and severity', () => {
    for (const type of Object.values(AlertHazardType)) {
      for (const severity of Object.values(SeverityLevel)) {
        expect(MessageTemplate.update(type, severity).length).toBeLessThanOrEqual(160);
      }
    }
  });

  it('A2: refuses an unknown type or severity', () => {
    expect(() => MessageTemplate.update('TSUNAMI', 'LOW')).toThrow('unknown hazard type');
    expect(() => MessageTemplate.update('FLOOD', 'EXTREME')).toThrow('unknown severity');
  });
});

describe('Updating an active warning (UC01 A2)', () => {
  let clock;
  let areas;
  let officer;
  let warnings;
  let broadcasts;

  beforeEach(async () => {
    clock = new FakeClock(NOW);
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    warnings = new WarningService({ clock });
    broadcasts = new BroadcastService({ clock, warnings });
  });

  const citizensIn = async (district, count) => {
    const citizens = [];
    for (let i = 0; i < count; i += 1) citizens.push(await createUser({ homeDistrict: district }));
    return citizens;
  };

  // A previewed draft, not yet broadcast.
  const previewedDraft = async ({ hazardType = 'FLOOD', scope = [areas.colombo] } = {}) => {
    const { id } = await warnings.startDraft(officer);
    await warnings.preview(id, {
      hazardType,
      severity: 'HIGH',
      areaIds: scope.map((area) => area.id),
    });
    return String(id);
  };

  // A HIGH warning broadcast to the scope: active, version 1.
  const activeWarning = async (options) => {
    const id = await previewedDraft(options);
    await broadcasts.broadcast(id, officer, 'Flood Warning: HIGH. Move to higher ground.');
    clock.set(LATER);
    return id;
  };

  const cancel = (id) => HazardAlert.updateOne({ _id: id }, { status: 'CANCELLED' });

  describe('WarningService.previewUpdate', () => {
    it('A2: recalculates the recipients for the new scope and writes the update message', async () => {
      await citizensIn(areas.colombo, 2);
      await citizensIn(areas.gampaha, 3);
      const id = await activeWarning();

      const preview = await warnings.previewUpdate(id, {
        severity: 'SEVERE',
        areaIds: [areas.colombo.id, areas.gampaha.id],
      });

      expect(preview).toMatchObject({
        alert: { status: 'BROADCAST', severity: 'HIGH', version: 1 },
        nextVersion: 2,
        recipientCount: 5,
        message: UPDATE_MESSAGE,
        channels: [
          { channel: 'PUSH', ready: true },
          { channel: 'SMS', ready: true },
          { channel: 'AUDIBLE', ready: true },
        ],
        activeWarning: null,
      });
      expect(String(preview.alert.id)).toBe(id);
    });

    it('A2: changes nothing on the alert', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();
      const before = await HazardAlert.findById(id).lean();

      await warnings.previewUpdate(id, { severity: 'SEVERE' });

      expect(await HazardAlert.findById(id).lean()).toEqual(before);
    });

    it('A2: keeps the current scope and severity when they are left out', async () => {
      await citizensIn(areas.colombo, 2);
      await citizensIn(areas.gampaha, 1);
      const id = await activeWarning();

      const preview = await warnings.previewUpdate(id, { areaIds: [areas.gampaha.id] });
      const sameScope = await warnings.previewUpdate(id, { severity: 'LOW' });

      expect(preview.recipientCount).toBe(1);
      expect(preview.message).toMatch(/^UPDATE: Flood Warning now HIGH\./);
      expect(sameScope.recipientCount).toBe(2);
    });

    it('A2: returns another active warning the new scope would duplicate, never itself', async () => {
      await citizensIn(areas.colombo, 1);
      await citizensIn(areas.gampaha, 1);
      const id = await activeWarning();
      const other = await activeWarning({ scope: [areas.gampaha] });

      const own = await warnings.previewUpdate(id, { severity: 'SEVERE' });
      const widened = await warnings.previewUpdate(id, { areaIds: [areas.kelani.id] });

      expect(own.activeWarning).toBeNull();
      expect(widened.activeWarning).toMatchObject({ id: other, hazardType: 'FLOOD' });
    });

    it('A2: no recipients in the new scope is a preview of 0, not an error', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();

      await expect(
        warnings.previewUpdate(id, { areaIds: [areas.kalutara.id] }),
      ).resolves.toMatchObject({ recipientCount: 0 });
    });

    it('A2: a DRAFT or CANCELLED alert is 409', async () => {
      await citizensIn(areas.colombo, 1);
      const draft = await previewedDraft();
      const cancelled = await activeWarning();
      await cancel(cancelled);

      await expect(warnings.previewUpdate(draft, { severity: 'SEVERE' })).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_ALERT_TRANSITION',
        message: 'Only an active alert can be updated – current status: DRAFT',
      });
      await expect(warnings.previewUpdate(cancelled, { severity: 'SEVERE' })).rejects.toMatchObject(
        { status: 409, code: 'INVALID_ALERT_TRANSITION' },
      );
    });

    it('A2: an unknown area id is 400 on areaIds (E1), an unknown alert 404', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();
      const unknown = new mongoose.Types.ObjectId().toString();

      await expect(warnings.previewUpdate(id, { areaIds: [unknown] })).rejects.toMatchObject({
        status: 400,
        errors: [{ field: 'areaIds', message: `unknown area ids: ${unknown}` }],
      });
      await expect(warnings.previewUpdate(unknown, { severity: 'LOW' })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('BroadcastService.update', () => {
    it('A2: sets UPDATED, version 2, the new severity, scope and message, and a history entry', async () => {
      await citizensIn(areas.colombo, 1);
      await citizensIn(areas.gampaha, 1);
      const id = await activeWarning();

      const { alert } = await broadcasts.update(id, officer, {
        severity: 'SEVERE',
        areaIds: [areas.colombo.id, areas.gampaha.id],
        message: UPDATE_MESSAGE,
      });

      expect(alert).toMatchObject({
        status: 'UPDATED',
        version: 2,
        severity: 'SEVERE',
        message: UPDATE_MESSAGE,
        issuedAt: new Date(NOW),
        issuedBy: { id: officer.id },
      });
      expect(alert.targets.map((target) => target.id)).toEqual([
        areas.colombo.id,
        areas.gampaha.id,
      ]);
      expect(alert.statusHistory.at(-1)).toMatchObject({
        status: 'UPDATED',
        version: 2,
        at: new Date(LATER),
      });
    });

    it('A2: sends kind UPDATE for the new version to the recalculated recipients only', async () => {
      const [stays] = await citizensIn(areas.colombo, 1);
      const [joins] = await citizensIn(areas.gampaha, 1);
      const id = await activeWarning();

      await broadcasts.update(id, officer, {
        areaIds: [areas.gampaha.id],
        message: UPDATE_MESSAGE,
      });

      const updates = await Notification.find({ alert: id, alertVersion: 2 }).lean();
      expect(updates).toHaveLength(3);
      expect(updates.every((record) => record.kind === 'UPDATE')).toBe(true);
      expect(new Set(updates.map((record) => record.citizen.toString()))).toEqual(
        new Set([joins.id]),
      );
      expect(
        await Notification.countDocuments({ alert: id, citizen: stays.id, alertVersion: 1 }),
      ).toBe(3);
    });

    it("A2: puts the update in each recipient's inbox with the new severity", async () => {
      const [citizen] = await citizensIn(areas.colombo, 1);
      const id = await activeWarning();

      await broadcasts.update(id, officer, { severity: 'SEVERE', message: UPDATE_MESSAGE });

      const inbox = await UserNotification.find({ user: citizen.id }).sort({ _id: 1 }).lean();
      expect(inbox.at(-1)).toMatchObject({
        type: 'HAZARD_ALERT',
        title: 'Flood Warning: SEVERE',
        body: UPDATE_MESSAGE,
        severity: 'SEVERE',
      });
    });

    it('A2: returns the delivery summary of the new version', async () => {
      await citizensIn(areas.colombo, 2);
      await citizensIn(areas.gampaha, 1);
      const id = await activeWarning();

      const { summary } = await broadcasts.update(id, officer, {
        areaIds: [areas.kelani.id],
        message: UPDATE_MESSAGE,
      });

      expect(summary).toMatchObject({ version: 2, totals: { sent: 9, delivered: 9, failed: 0 } });
    });

    it('A2: an UPDATED warning can be updated again, to version 3', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();
      await broadcasts.update(id, officer, { severity: 'SEVERE', message: UPDATE_MESSAGE });

      const { alert } = await broadcasts.update(id, officer, {
        severity: 'MEDIUM',
        message: 'UPDATE: Flood Warning now MEDIUM.',
      });

      expect(alert).toMatchObject({ status: 'UPDATED', version: 3, severity: 'MEDIUM' });
    });

    it('A2: discards the new draft it replaces once the update is sent', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();
      const newDraft = await previewedDraft();

      await broadcasts.update(id, officer, {
        severity: 'SEVERE',
        message: UPDATE_MESSAGE,
        replacesDraftId: newDraft,
      });

      expect(await HazardAlert.findById(newDraft)).toBeNull();
    });

    it('A2: a replaced draft that is gone or no longer a DRAFT is left alone', async () => {
      await citizensIn(areas.colombo, 1);
      await citizensIn(areas.kalutara, 1);
      const id = await activeWarning();
      const other = await activeWarning({ hazardType: 'CYCLONE', scope: [areas.kalutara] });

      await broadcasts.update(id, officer, {
        severity: 'SEVERE',
        message: UPDATE_MESSAGE,
        replacesDraftId: other,
      });
      const { alert } = await broadcasts.update(id, officer, {
        severity: 'LOW',
        message: 'UPDATE: Flood Warning now LOW.',
        replacesDraftId: new mongoose.Types.ObjectId().toString(),
      });

      expect(alert.version).toBe(3);
      expect(await HazardAlert.findById(other).lean()).toMatchObject({ status: 'BROADCAST' });
    });

    it('A2: an update that changes nothing is 400 and sends nothing', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();

      await expect(
        broadcasts.update(id, officer, {
          severity: 'HIGH',
          areaIds: [areas.colombo.id, areas.colombo.id],
          message: UPDATE_MESSAGE,
        }),
      ).rejects.toMatchObject({
        status: 400,
        errors: [{ field: 'severity', message: 'change the severity or the scope' }],
      });
      expect(await Notification.countDocuments({ alert: id, alertVersion: 2 })).toBe(0);
    });

    it('A2: a DRAFT or CANCELLED alert is 409 and nothing is sent', async () => {
      await citizensIn(areas.colombo, 1);
      const draft = await previewedDraft();
      const cancelled = await activeWarning();
      await cancel(cancelled);

      for (const id of [draft, cancelled]) {
        await expect(
          broadcasts.update(id, officer, { severity: 'SEVERE', message: UPDATE_MESSAGE }),
        ).rejects.toMatchObject({ status: 409, code: 'INVALID_ALERT_TRANSITION' });
      }
      expect(await Notification.countDocuments({ kind: 'UPDATE' })).toBe(0);
    });

    it('A2: a new scope with no citizens is 409 NO_RECIPIENTS_IN_SCOPE and changes nothing (E2)', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();
      const newDraft = await previewedDraft();

      await expect(
        broadcasts.update(id, officer, {
          areaIds: [areas.kalutara.id],
          message: UPDATE_MESSAGE,
          replacesDraftId: newDraft,
        }),
      ).rejects.toMatchObject({ status: 409, code: 'NO_RECIPIENTS_IN_SCOPE' });
      expect(await HazardAlert.findById(id).lean()).toMatchObject({
        status: 'BROADCAST',
        version: 1,
      });
      expect(await HazardAlert.findById(newDraft)).not.toBeNull();
    });

    it('A2: a new scope another active warning covers is 409 ACTIVE_WARNING_EXISTS', async () => {
      await citizensIn(areas.colombo, 1);
      await citizensIn(areas.gampaha, 1);
      const id = await activeWarning();
      const other = await activeWarning({ scope: [areas.gampaha] });
      const { referenceNo } = await warnings.findById(other);

      await expect(
        broadcasts.update(id, officer, { areaIds: [areas.kelani.id], message: UPDATE_MESSAGE }),
      ).rejects.toMatchObject({
        status: 409,
        code: 'ACTIVE_WARNING_EXISTS',
        message: `An active FLOOD warning (${referenceNo}) already covers this scope – update it instead`,
      });
      expect(await HazardAlert.findById(id).lean()).toMatchObject({ version: 1 });
    });

    it('A2: two officers updating the same version at once: one wins, one 409', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();

      const results = await Promise.allSettled([
        broadcasts.update(id, officer, { severity: 'SEVERE', message: UPDATE_MESSAGE }),
        broadcasts.update(id, officer, { severity: 'LOW', message: 'UPDATE: now LOW.' }),
      ]);

      const rejected = results.filter((result) => result.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        status: 409,
        code: 'INVALID_ALERT_TRANSITION',
        message: 'The alert was changed by someone else – current version: 2',
      });
      expect(await Notification.countDocuments({ alert: id, alertVersion: 2 })).toBe(3);
    });
  });

  describe('BroadcastService.broadcast with an active warning (A2)', () => {
    it('A2: a new draft that duplicates an active warning is 409 and stays DRAFT', async () => {
      await citizensIn(areas.colombo, 1);
      const active = await activeWarning({ scope: [areas.kelani] });
      const { referenceNo } = await warnings.findById(active);
      const duplicate = await previewedDraft();

      await expect(
        broadcasts.broadcast(duplicate, officer, 'Flood Warning: HIGH.'),
      ).rejects.toMatchObject({
        status: 409,
        code: 'ACTIVE_WARNING_EXISTS',
        message: `An active FLOOD warning (${referenceNo}) already covers this scope – update it instead`,
      });
      expect(await HazardAlert.findById(duplicate).lean()).toMatchObject({ status: 'DRAFT' });
      expect(await Notification.countDocuments({ alert: duplicate })).toBe(0);
    });

    it('A2: a different hazard type on the same district still broadcasts', async () => {
      await citizensIn(areas.colombo, 1);
      await activeWarning();
      const cyclone = await previewedDraft({ hazardType: 'CYCLONE' });

      const { alert } = await broadcasts.broadcast(cyclone, officer, 'Cyclone Warning: HIGH.');

      expect(alert.status).toBe('BROADCAST');
    });
  });
});
