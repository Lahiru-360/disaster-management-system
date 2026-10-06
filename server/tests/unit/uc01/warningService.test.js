import mongoose from 'mongoose';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
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
    it('DMS-120: TC-01 stores a DRAFT, version 1, with an HA- reference and its first history entry', async () => {
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

    it('DMS-120: each draft gets the next reference number', async () => {
      await startDraft();

      await expect(startDraft()).resolves.toMatchObject({ referenceNo: 'HA-0002' });
    });
  });

  describe('preview', () => {
    it('DMS-120: TC-04 counts the citizens across districts and stores the composed draft', async () => {
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

    it('DMS-120: TC-05 a district and a basin covering it count each citizen once', async () => {
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

    it('DMS-120: previewing again replaces the type, severity, scope and message', async () => {
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

    it('DMS-120: E2 a scope with nobody registered is 0, not an error', async () => {
      const { id } = await startDraft();

      await expect(previewOf(id, { areaIds: [areas.kalutara.id] })).resolves.toMatchObject({
        recipientCount: 0,
      });
    });

    it('DMS-120: links the ACTIVE event of the same type that affects the scope', async () => {
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

    it('DMS-120: prefers the event sharing more districts, then the newest', async () => {
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

    it('DMS-120: ignores CLOSED events and events of another hazard type', async () => {
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

    it('DMS-120: E1 names every unknown area id on areaIds, and changes nothing', async () => {
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

    it('DMS-120: E1 an empty scope is a 400 on areaIds', async () => {
      const { id } = await startDraft();

      await expect(previewOf(id, { areaIds: [] })).rejects.toMatchObject({
        status: 400,
        errors: [{ field: 'areaIds', message: 'must contain at least 1 items' }],
      });
    });

    it('DMS-120: previewing an alert that is no longer a draft is 409', async () => {
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
    it('DMS-120: saves the edited message on the draft', async () => {
      const { id } = await startDraft();
      await previewOf(id);

      const alert = await service.saveDraftMessage(id, '  Move to higher ground now.  ');

      expect(alert.message).toBe('Move to higher ground now.');
      expect((await HazardAlert.findById(id)).message).toBe('Move to higher ground now.');
    });

    it('DMS-120: TC-07 accepts exactly 160 characters', async () => {
      const { id } = await startDraft();

      await expect(service.saveDraftMessage(id, 'x'.repeat(160))).resolves.toMatchObject({
        message: 'x'.repeat(160),
      });
    });

    it('DMS-120: editing an alert that is no longer a draft is 409', async () => {
      const { id } = await startDraft();
      await HazardAlert.updateOne({ _id: id }, { status: 'CANCELLED' });

      await expect(service.saveDraftMessage(id, 'Too late')).rejects.toMatchObject({
        status: 409,
        message: 'Only a DRAFT alert can be edited – current status: CANCELLED',
      });
    });
  });

  describe('findById', () => {
    it('DMS-120: returns the alert object', async () => {
      const { id } = await startDraft();

      await expect(service.findById(id)).resolves.toMatchObject({ id, referenceNo: 'HA-0001' });
    });

    it.each([
      ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
      ['a malformed id', () => 'nope'],
    ])('DMS-120: %s is 404 NOT_FOUND', async (_case, idFor) => {
      await expect(service.findById(idFor())).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Hazard alert not found.',
      });
      await expect(service.saveDraftMessage(idFor(), 'x')).rejects.toMatchObject({ status: 404 });
      await expect(previewOf(idFor())).rejects.toMatchObject({ status: 404 });
    });
  });

  it('DMS-120: composing never creates a notification of any kind', async () => {
    await createUser({ homeDistrict: areas.colombo });
    const { id } = await startDraft();
    await previewOf(id);
    await service.saveDraftMessage(id, 'Edited.');

    expect(await UserNotification.countDocuments()).toBe(0);
    expect(
      await mongoose.connection.db.listCollections({ name: 'notifications' }).toArray(),
    ).toEqual([]);
  });

  it('DMS-120: the shared default instance uses the real collaborators', async () => {
    const alert = await warningService.startDraft(officer);

    expect(alert.referenceNo).toMatch(/^HA-\d{4}$/);
  });
});
