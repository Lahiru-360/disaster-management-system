import mongoose from 'mongoose';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Notification } from '../../../src/models/Notification.js';
import { UserNotification } from '../../../src/models/UserNotification.js';
import { Role } from '../../../src/enums/Role.js';
import { WarningService, warningService } from '../../../src/services/WarningService.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-02T06:20:00.000Z';

describe('WarningService', () => {
  let clock;
  let service;
  let officer;
  let areas;

  beforeEach(async () => {
    clock = new FakeClock(NOW);
    service = new WarningService({ clock });
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  });

  const startDraft = () => service.startDraft(officer);

  const previewOf = (id, fields = {}) =>
    service.preview(id, {
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      areaIds: [areas.colombo.id],
      ...fields,
    });

  describe('startDraft', () => {
    it('Main 2: TC-01 stores a DRAFT, version 1, with an HA- reference and its first history entry', async () => {
      const alert = await startDraft();

      expect(alert).toMatchObject({
        referenceNo: 'HA-0001',
        status: 'DRAFT',
        version: 1,
        hazardType: null,
        severity: null,
        message: null,
        targets: [],
        event: null,
        sourceReport: null,
        issuedBy: null,
        issuedAt: null,
        createdBy: { id: officer.id, name: officer.name },
      });
      expect(alert.statusHistory).toEqual([
        {
          status: 'DRAFT',
          version: 1,
          at: new Date(NOW),
          by: { id: officer.id, name: officer.name },
        },
      ]);
      expect(await HazardAlert.countDocuments()).toBe(1);
    });

    it('Main 2: each draft gets the next reference number', async () => {
      await startDraft();

      await expect(startDraft()).resolves.toMatchObject({ referenceNo: 'HA-0002' });
    });
  });

  describe('preview', () => {
    it('Main 7: TC-04 counts the citizens across districts and stores the composed draft', async () => {
      await createUser({ homeDistrict: areas.colombo });
      await createUser({ homeDistrict: areas.colombo });
      await createUser({ homeDistrict: areas.gampaha });
      await createUser({ homeDistrict: areas.kalutara });
      const { id } = await startDraft();

      const result = await previewOf(id, { areaIds: [areas.colombo.id, areas.gampaha.id] });

      expect(result.recipientCount).toBe(3);
      expect(result.message).toBe(
        'Flood Warning: SEVERE. Move to higher ground and follow official guidance.',
      );
      expect(result.channels).toEqual([
        { channel: 'PUSH', ready: true },
        { channel: 'SMS', ready: true },
        { channel: 'AUDIBLE', ready: true },
      ]);
      expect(result.activeWarning).toBeNull();
      expect(result.alert).toMatchObject({
        status: 'DRAFT',
        hazardType: 'FLOOD',
        severity: 'SEVERE',
        message: result.message,
        targets: [
          { kind: 'District', id: areas.colombo.id, name: 'Colombo' },
          { kind: 'District', id: areas.gampaha.id, name: 'Gampaha' },
        ],
      });
      const stored = await HazardAlert.findById(id);
      expect(stored).toMatchObject({ hazardType: 'FLOOD', severity: 'SEVERE', status: 'DRAFT' });
    });

    it('Main 7: TC-05 a district and a basin covering it count each citizen once', async () => {
      await createUser({ homeDistrict: areas.colombo });
      await createUser({ homeDistrict: areas.gampaha });
      const { id } = await startDraft();

      const result = await previewOf(id, { areaIds: [areas.colombo.id, areas.kelani.id] });

      expect(result.recipientCount).toBe(2);
      expect(result.alert.targets.map((target) => [target.kind, target.name])).toEqual([
        ['District', 'Colombo'],
        ['RiverBasin', 'Kelani'],
      ]);
    });

    it('Main 7: previewing again replaces the type, severity, scope and message', async () => {
      const { id } = await startDraft();
      await previewOf(id);

      const result = await previewOf(id, {
        hazardType: 'LANDSLIDE',
        severity: 'LOW',
        areaIds: [areas.kalutara.id],
      });

      expect(result.alert).toMatchObject({ hazardType: 'LANDSLIDE', severity: 'LOW' });
      expect(result.alert.targets.map((target) => target.name)).toEqual(['Kalutara']);
      expect(result.message.startsWith('Landslide Warning: LOW.')).toBe(true);
    });

    it('E2: a scope with nobody registered is 0, not an error', async () => {
      const { id } = await startDraft();

      await expect(previewOf(id, { areaIds: [areas.kalutara.id] })).resolves.toMatchObject({
        recipientCount: 0,
      });
    });

    it('Main 7: links the ACTIVE event of the same type that affects the scope', async () => {
      const event = await HazardEvent.create({
        name: 'Flood – Colombo',
        hazardType: 'FLOOD',
        status: 'ACTIVE',
        startDate: new Date('2026-09-25T00:00:00.000Z'),
        districts: [areas.colombo._id],
      });
      const { id } = await startDraft();

      const result = await previewOf(id, { areaIds: [areas.kelani.id] });

      expect(result.alert.event).toEqual({ id: event.id, name: 'Flood – Colombo' });
    });

    it('Main 7: prefers the event sharing more districts, then the newest', async () => {
      const event = (name, districts, startDate) =>
        HazardEvent.create({
          name,
          hazardType: 'FLOOD',
          status: 'ACTIVE',
          startDate: new Date(startDate),
          districts,
        });
      await event('Old wide', [areas.colombo._id, areas.gampaha._id], '2026-09-01');
      const newer = await event('New wide', [areas.colombo._id, areas.gampaha._id], '2026-09-20');
      await event('Newest narrow', [areas.kalutara._id], '2026-09-30');
      const { id } = await startDraft();

      const result = await previewOf(id, {
        areaIds: [areas.colombo.id, areas.gampaha.id, areas.kalutara.id],
      });

      expect(result.alert.event).toEqual({ id: newer.id, name: 'New wide' });
    });

    it('Main 7: ignores CLOSED events and events of another hazard type', async () => {
      await HazardEvent.create({
        name: 'Landslide – Colombo',
        hazardType: 'LANDSLIDE',
        status: 'ACTIVE',
        startDate: new Date('2026-09-25'),
        districts: [areas.colombo._id],
      });
      await HazardEvent.create({
        name: 'Old flood – Colombo',
        hazardType: 'FLOOD',
        status: 'CLOSED',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-10'),
        districts: [areas.colombo._id],
      });
      const { id } = await startDraft();

      await expect(previewOf(id)).resolves.toMatchObject({ alert: { event: null } });
    });

    it('E1: names every unknown area id on areaIds, and changes nothing', async () => {
      const { id } = await startDraft();
      const unknown = new mongoose.Types.ObjectId().toString();

      await expect(
        previewOf(id, { areaIds: [areas.colombo.id, unknown, 'not-an-id'] }),
      ).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'areaIds', message: `unknown area ids: ${unknown}, not-an-id` }],
      });
      expect((await HazardAlert.findById(id)).hazardType).toBeNull();
    });

    it('E1: an empty scope is a 400 on areaIds', async () => {
      const { id } = await startDraft();

      await expect(previewOf(id, { areaIds: [] })).rejects.toMatchObject({
        status: 400,
        errors: [{ field: 'areaIds', message: 'must contain at least 1 items' }],
      });
    });

    it('Main 7: previewing an alert that is no longer a draft is 409', async () => {
      const { id } = await startDraft();
      await HazardAlert.updateOne({ _id: id }, { status: 'BROADCAST' });

      await expect(previewOf(id)).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_ALERT_TRANSITION',
        message: 'Only a DRAFT alert can be previewed – current status: BROADCAST',
      });
    });
  });

  describe('saveDraftMessage', () => {
    it('Main 8: saves the edited message on the draft', async () => {
      const { id } = await startDraft();
      await previewOf(id);

      const alert = await service.saveDraftMessage(id, '  Move to higher ground now.  ');

      expect(alert.message).toBe('Move to higher ground now.');
      expect((await HazardAlert.findById(id)).message).toBe('Move to higher ground now.');
    });

    it('Main 8: TC-07 accepts exactly 160 characters', async () => {
      const { id } = await startDraft();

      await expect(service.saveDraftMessage(id, 'x'.repeat(160))).resolves.toMatchObject({
        message: 'x'.repeat(160),
      });
    });

    it('Main 8: editing an alert that is no longer a draft is 409', async () => {
      const { id } = await startDraft();
      await HazardAlert.updateOne({ _id: id }, { status: 'CANCELLED' });

      await expect(service.saveDraftMessage(id, 'Too late')).rejects.toMatchObject({
        status: 409,
        message: 'Only a DRAFT alert can be edited – current status: CANCELLED',
      });
    });
  });

  describe('discardDraft', () => {
    it('A4: TC-30 removes the draft and returns it as it was', async () => {
      const { id } = await startDraft();
      await previewOf(id);

      const discarded = await service.discardDraft(id);

      expect(discarded).toMatchObject({ id, status: 'DRAFT', hazardType: 'FLOOD' });
      expect(await HazardAlert.countDocuments()).toBe(0);
    });

    it('A4: TC-31 a colleague broadcasting between the read and the delete wins: 409, nothing removed', async () => {
      const { id } = await startDraft();
      // The delete runs just after the broadcast lands.
      const racingModel = {
        findById: (alertId) => HazardAlert.findById(alertId),
        deleteOne: async (filter) => {
          await HazardAlert.updateOne({ _id: id }, { status: 'BROADCAST' });
          return HazardAlert.deleteOne(filter);
        },
      };
      const racing = new WarningService({ alertModel: racingModel, clock });

      await expect(racing.discardDraft(id)).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_ALERT_TRANSITION',
        message: 'Only a DRAFT alert can be discarded – current status: BROADCAST',
      });
      expect(await HazardAlert.exists({ _id: id })).not.toBeNull();
    });

    it('A4: a draft deleted by a colleague between the read and the delete is 404', async () => {
      const { id } = await startDraft();
      const racingModel = {
        findById: (alertId) => HazardAlert.findById(alertId),
        deleteOne: async (filter) => {
          await HazardAlert.deleteOne({ _id: id });
          return HazardAlert.deleteOne(filter);
        },
      };
      const racing = new WarningService({ alertModel: racingModel, clock });

      await expect(racing.discardDraft(id)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('listDrafts', () => {
    it('A4: only drafts, most recently changed first', async () => {
      const first = await startDraft();
      const second = await startDraft();
      const sent = await startDraft();
      await HazardAlert.updateOne({ _id: sent.id }, { status: 'BROADCAST' });
      await HazardAlert.updateOne(
        { _id: first.id },
        { updatedAt: new Date('2026-10-02T07:00:00.000Z') },
        { timestamps: false },
      );
      await HazardAlert.updateOne(
        { _id: second.id },
        { updatedAt: new Date('2026-10-02T06:00:00.000Z') },
        { timestamps: false },
      );

      const drafts = await service.listDrafts();

      expect(drafts.map(({ id }) => id)).toEqual([first.id, second.id]);
    });
  });

  describe('findById', () => {
    it('Main 2: returns the alert object', async () => {
      const { id } = await startDraft();

      await expect(service.findById(id)).resolves.toMatchObject({ id, referenceNo: 'HA-0001' });
    });

    it.each([
      ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
      ['a malformed id', () => 'nope'],
    ])('Main 2: %s is 404 NOT_FOUND', async (_case, idFor) => {
      await expect(service.findById(idFor())).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Hazard alert not found.',
      });
      await expect(service.saveDraftMessage(idFor(), 'x')).rejects.toMatchObject({ status: 404 });
      await expect(previewOf(idFor())).rejects.toMatchObject({ status: 404 });
    });
  });

  it('Main 8: composing never creates a notification of any kind', async () => {
    await createUser({ homeDistrict: areas.colombo });
    const { id } = await startDraft();
    await previewOf(id);
    await service.saveDraftMessage(id, 'Edited.');

    expect(await UserNotification.countDocuments()).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('Main 2: the shared default instance uses the real collaborators', async () => {
    const alert = await warningService.startDraft(officer);

    expect(alert.referenceNo).toMatch(/^HA-\d{4}$/);
  });
});
