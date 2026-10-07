import mongoose from 'mongoose';
import { Role } from '../../../src/enums/Role.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { Notification } from '../../../src/models/Notification.js';
import { User } from '../../../src/models/User.js';
import { UserNotification } from '../../../src/models/UserNotification.js';
import { BroadcastService } from '../../../src/services/BroadcastService.js';
import { WarningService } from '../../../src/services/WarningService.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-02T06:31:00.000Z';
const LATER = '2026-10-02T09:00:00.000Z';
const CLEAR_AT = '2026-10-03T08:00:00.000Z';
const ALL_CLEAR =
  'ALL CLEAR: The Flood warning has ended. It is now safe, but follow official guidance.';
const UPDATE_MESSAGE = 'UPDATE: Flood Warning now SEVERE. Move to higher ground.';

describe('Issuing an all-clear (UC01 A3)', () => {
  let clock;
  let areas;
  let officer;
  let colleague;
  let warnings;
  let broadcasts;

  beforeEach(async () => {
    clock = new FakeClock(NOW);
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    colleague = await createUser({ role: Role.DMC_OFFICER });
    warnings = new WarningService({ clock });
    broadcasts = new BroadcastService({ clock, warnings });
  });

  const citizensIn = async (district, count) => {
    const citizens = [];
    for (let i = 0; i < count; i += 1) citizens.push(await createUser({ homeDistrict: district }));
    return citizens;
  };

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

  const idsOf = (users) => users.map((user) => user.id).sort();

  const recipientsOf = async (id, version) =>
    [
      ...new Set(
        (await Notification.find({ alert: id, alertVersion: version }).lean()).map((record) =>
          record.citizen.toString(),
        ),
      ),
    ].sort();

  describe('BroadcastService.allClear', () => {
    it('DMS-124: TC-26 sets CANCELLED as the next version, with the all-clear message and a history entry', async () => {
      await citizensIn(areas.colombo, 2);
      const id = await activeWarning();
      clock.set(CLEAR_AT);

      const { alert } = await broadcasts.allClear(id, colleague);

      expect(alert).toMatchObject({
        status: 'CANCELLED',
        version: 2,
        message: ALL_CLEAR,
        severity: 'HIGH',
        issuedBy: { id: officer.id },
        issuedAt: new Date(NOW),
      });
      expect(alert.statusHistory.at(-1)).toEqual({
        status: 'CANCELLED',
        version: 2,
        at: new Date(CLEAR_AT),
        by: { id: colleague.id, name: colleague.name },
      });
      expect(await HazardAlert.findById(id).lean()).toMatchObject({
        status: 'CANCELLED',
        version: 2,
      });
    });

    it('DMS-124: TC-26 sends kind ALL_CLEAR on every channel to every original recipient', async () => {
      const citizens = await citizensIn(areas.colombo, 2);
      const id = await activeWarning();

      await broadcasts.allClear(id, officer);

      const records = await Notification.find({ alert: id, alertVersion: 2 }).lean();
      expect(records).toHaveLength(6);
      expect(new Set(records.map((record) => record.kind))).toEqual(new Set(['ALL_CLEAR']));
      expect(await recipientsOf(id, 2)).toEqual(idsOf(citizens));
    });

    it('DMS-124: TC-27 a citizen who moved district after the broadcast still gets the all-clear', async () => {
      const [stayed, moved] = await citizensIn(areas.colombo, 2);
      const id = await activeWarning();
      await User.updateOne({ _id: moved._id }, { homeDistrict: areas.kalutara._id });
      const movedIn = await createUser({ homeDistrict: areas.colombo });

      await broadcasts.allClear(id, officer);

      const recipients = await recipientsOf(id, 2);
      expect(recipients).toEqual(idsOf([stayed, moved]));
      expect(recipients).not.toContain(movedIn.id);
    });

    it('DMS-124: TC-27 the original recipients include everyone an update reached, not the recalculated scope', async () => {
      const colombo = await citizensIn(areas.colombo, 1);
      const gampaha = await citizensIn(areas.gampaha, 1);
      await citizensIn(areas.kalutara, 1);
      const id = await activeWarning();
      await broadcasts.update(id, officer, {
        areaIds: [areas.gampaha.id],
        message: UPDATE_MESSAGE,
      });

      const { alert } = await broadcasts.allClear(id, officer);

      expect(alert.version).toBe(3);
      expect(await recipientsOf(id, 3)).toEqual(idsOf([...colombo, ...gampaha]));
    });

    it("DMS-124: puts the all-clear in each original recipient's inbox as LOW", async () => {
      const [citizen] = await citizensIn(areas.colombo, 1);
      const id = await activeWarning();

      await broadcasts.allClear(id, officer);

      const items = await UserNotification.find({ user: citizen._id }).sort({ _id: 1 }).lean();
      expect(items).toHaveLength(2);
      expect(items[1]).toMatchObject({
        type: 'HAZARD_ALERT',
        title: 'Flood Warning: ALL CLEAR',
        body: ALL_CLEAR,
        severity: 'LOW',
      });
    });

    it("DMS-124: TC-26 resumes at step 14 with the all-clear's delivery summary", async () => {
      await citizensIn(areas.colombo, 2);
      const id = await activeWarning();

      const { summary } = await broadcasts.allClear(id, officer);

      expect(summary.version).toBe(2);
      expect(summary.totals.sent).toBe(6);
      expect(await broadcasts.deliverySummary(id)).toMatchObject({ summary });
    });

    it('DMS-124: an UPDATED warning can be cancelled too', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();
      await broadcasts.update(id, officer, { severity: 'SEVERE', message: UPDATE_MESSAGE });

      const { alert } = await broadcasts.allClear(id, officer);

      expect(alert).toMatchObject({ status: 'CANCELLED', version: 3, severity: 'SEVERE' });
      expect(alert.statusHistory.map(({ status, version }) => [status, version])).toEqual([
        ['DRAFT', 1],
        ['BROADCAST', 1],
        ['UPDATED', 2],
        ['CANCELLED', 3],
      ]);
    });

    it.each([
      [
        'a DRAFT never previewed',
        async () => String((await warnings.startDraft(officer)).id),
        'DRAFT',
      ],
      ['a previewed DRAFT', () => previewedDraft(), 'DRAFT'],
      [
        'a CANCELLED alert',
        async () => {
          const id = await activeWarning();
          await broadcasts.allClear(id, officer);
          return id;
        },
        'CANCELLED',
      ],
    ])('DMS-124: TC-28 %s is 409 and nothing changes or is sent', async (_case, make, status) => {
      await citizensIn(areas.colombo, 1);
      const id = await make();
      const before = await HazardAlert.findById(id).lean();
      const records = await Notification.countDocuments({ alert: id });

      await expect(broadcasts.allClear(id, officer)).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_ALERT_TRANSITION',
        message: `Only an active alert can be cancelled – current status: ${status}`,
      });
      expect(await HazardAlert.findById(id).lean()).toEqual(before);
      expect(await Notification.countDocuments({ alert: id })).toBe(records);
    });

    it('DMS-124: two officers issuing the all-clear at once: one wins, one 409', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();

      const results = await Promise.allSettled([
        broadcasts.allClear(id, officer),
        broadcasts.allClear(id, colleague),
      ]);

      const rejected = results.filter((result) => result.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ status: 409, code: 'INVALID_ALERT_TRANSITION' });
      expect(await Notification.countDocuments({ alert: id, kind: 'ALL_CLEAR' })).toBe(3);
    });

    it('DMS-124: an update that lands between the read and the write wins, and the all-clear is 409', async () => {
      await citizensIn(areas.colombo, 1);
      const id = await activeWarning();
      const alertModel = {
        findById: (...args) => HazardAlert.findById(...args),
        findOneAndUpdate: async (...args) => {
          await HazardAlert.updateOne({ _id: id }, { status: 'UPDATED', version: 2 });
          return HazardAlert.findOneAndUpdate(...args);
        },
      };
      const racing = new BroadcastService({ clock, warnings, alertModel });

      await expect(racing.allClear(id, officer)).rejects.toMatchObject({
        status: 409,
        message: 'The alert was changed by someone else – current version: 2',
      });
      expect(await Notification.countDocuments({ alert: id, kind: 'ALL_CLEAR' })).toBe(0);
    });

    it('DMS-124: an unknown or malformed alert id is 404', async () => {
      await expect(
        broadcasts.allClear(new mongoose.Types.ObjectId().toString(), officer),
      ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
      await expect(broadcasts.allClear('nope', officer)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('WarningService.listActive', () => {
    it('DMS-124: lists BROADCAST and UPDATED alerts, most recently issued first, with their original recipients', async () => {
      await citizensIn(areas.colombo, 2);
      await citizensIn(areas.gampaha, 3);
      const first = await activeWarning();
      const second = await activeWarning({ hazardType: 'CYCLONE', scope: [areas.gampaha] });
      await broadcasts.update(second, officer, {
        areaIds: [areas.colombo.id],
        message: UPDATE_MESSAGE,
      });
      const cancelled = await activeWarning({ hazardType: 'DROUGHT' });
      await broadcasts.allClear(cancelled, officer);
      await previewedDraft({ hazardType: 'LANDSLIDE' });

      const alerts = await warnings.listActive();

      expect(
        alerts.map(({ id, status, version, originalRecipientCount }) => [
          String(id),
          status,
          version,
          originalRecipientCount,
        ]),
      ).toEqual([
        [second, 'UPDATED', 2, 5],
        [first, 'BROADCAST', 1, 2],
      ]);
    });

    it('DMS-124: nothing active is []', async () => {
      await previewedDraft();

      await expect(warnings.listActive()).resolves.toEqual([]);
    });
  });
});
