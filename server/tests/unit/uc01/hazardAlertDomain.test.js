import mongoose from 'mongoose';
import { District } from '../../../src/domain/areas/District.js';
import { RiverBasin } from '../../../src/domain/areas/RiverBasin.js';
import { HazardAlert } from '../../../src/domain/alerts/HazardAlert.js';
import { InvalidAlertTransitionError } from '../../../src/domain/alerts/InvalidAlertTransitionError.js';
import { HazardAlert as HazardAlertModel } from '../../../src/models/HazardAlert.js';

const OFFICER = 'officer-1';
const COLLEAGUE = 'officer-2';
const T0 = new Date('2026-10-02T06:20:00.000Z');
const T1 = new Date('2026-10-02T06:31:00.000Z');
const T2 = new Date('2026-10-02T07:05:00.000Z');
const MESSAGE = 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.';

const colombo = new District({ areaId: 'd-colombo', name: 'Colombo' });
const gampaha = new District({ areaId: 'd-gampaha', name: 'Gampaha' });
const kelani = new RiverBasin({
  areaId: 'b-kelani',
  name: 'Kelani',
  districts: [colombo, gampaha],
});

const draft = () => HazardAlert.startDraft({ referenceNo: 'HA-1043', officer: OFFICER, at: T0 });

const composed = () => {
  const alert = draft();
  alert.compose({ hazardType: 'FLOOD', severity: 'SEVERE', targets: [colombo], message: MESSAGE });
  return alert;
};

const broadcast = () => {
  const alert = composed();
  alert.broadcast(OFFICER, T1);
  return alert;
};

const expectTransitionError = (action, message) => {
  let error;
  try {
    action();
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(InvalidAlertTransitionError);
  expect(error).toMatchObject({ status: 409, code: 'INVALID_ALERT_TRANSITION', message });
  return error;
};

describe('HazardAlert (domain)', () => {
  it('DMS-120: TC-01 startDraft opens a DRAFT at version 1 with one history entry', () => {
    const alert = draft();

    expect(alert).toMatchObject({
      referenceNo: 'HA-1043',
      status: 'DRAFT',
      version: 1,
      hazardType: null,
      severity: null,
      message: null,
      createdById: OFFICER,
      issuedById: null,
    });
    expect(alert.statusHistory).toEqual([{ status: 'DRAFT', version: 1, at: T0, byId: OFFICER }]);
    expect(alert.isActive()).toBe(false);
  });

  it('DMS-120: compose sets type, severity, scope, message and event on a draft', () => {
    const alert = draft();

    alert.compose({
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      targets: [colombo, kelani],
      message: `  ${MESSAGE}  `,
      event: 'event-1',
    });

    expect(alert).toMatchObject({
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      message: MESSAGE,
      eventId: 'event-1',
      status: 'DRAFT',
    });
    expect(alert.targets).toEqual([
      { kind: 'District', areaId: 'd-colombo' },
      { kind: 'RiverBasin', areaId: 'b-kelani' },
    ]);
  });

  it('DMS-120: compose refuses an unknown type or severity, an empty scope or a bad message', () => {
    const alert = draft();
    const valid = { hazardType: 'FLOOD', severity: 'HIGH', targets: [colombo], message: MESSAGE };

    expect(() => alert.compose({ ...valid, hazardType: 'RISING_RIVER_FLOOD' })).toThrow(
      'unknown hazard type',
    );
    expect(() => alert.compose({ ...valid, severity: 'EXTREME' })).toThrow('unknown severity');
    expect(() => alert.compose({ ...valid, targets: [] })).toThrow('at least one area');
    expect(() => alert.compose({ ...valid, targets: [{ kind: 'Province', area: 'p1' }] })).toThrow(
      'District or a RiverBasin',
    );
    expect(() => alert.compose({ ...valid, message: 'x'.repeat(161) })).toThrow('1-160 characters');
    expect(() => alert.compose({ ...valid, message: '   ' })).toThrow('1-160 characters');
    expect(alert.hazardType).toBeNull();
  });

  it('DMS-120: TC-07 editMessage accepts exactly 160 characters', () => {
    const alert = composed();

    alert.editMessage('x'.repeat(160));

    expect(alert.message).toHaveLength(160);
  });

  it('DMS-120: broadcast moves DRAFT to BROADCAST and records who and when', () => {
    const alert = broadcast();

    expect(alert).toMatchObject({ status: 'BROADCAST', issuedById: OFFICER, issuedAt: T1 });
    expect(alert.statusHistory.at(-1)).toEqual({
      status: 'BROADCAST',
      version: 1,
      at: T1,
      byId: OFFICER,
    });
    expect(alert.isActive()).toBe(true);
  });

  it("DMS-121: broadcast takes the final message, replacing the draft's", () => {
    const alert = composed();

    alert.broadcast(OFFICER, T1, '  Move to higher ground now.  ');

    expect(alert.message).toBe('Move to higher ground now.');
    expect(() => composed().broadcast(OFFICER, T1, 'x'.repeat(161))).toThrow('1-160 characters');
  });

  it('DMS-120: a draft that was never previewed cannot be broadcast', () => {
    const alert = draft();

    expectTransitionError(
      () => alert.broadcast(OFFICER, T1),
      'Preview the warning before broadcasting it',
    );
    expect(alert.status).toBe('DRAFT');
  });

  it('DMS-120: TC-12 broadcasting twice is refused, naming the current status', () => {
    const alert = broadcast();

    const error = expectTransitionError(
      () => alert.broadcast(COLLEAGUE, T2),
      'Only a DRAFT alert can be broadcast – current status: BROADCAST',
    );
    expect(error.currentStatus).toBe('BROADCAST');
    expect(alert.issuedById).toBe(OFFICER);
  });

  it('DMS-120: composing or editing a broadcast alert is refused', () => {
    const alert = broadcast();

    expectTransitionError(
      () =>
        alert.compose({ hazardType: 'FLOOD', severity: 'LOW', targets: [colombo], message: 'x' }),
      'Only a DRAFT alert can be previewed – current status: BROADCAST',
    );
    expectTransitionError(
      () => alert.editMessage('x'),
      'Only a DRAFT alert can be edited – current status: BROADCAST',
    );
    expect(alert.severity).toBe('SEVERE');
  });

  it('DMS-120: update raises the version each time and records UPDATED (1 → 2 → 3)', () => {
    const alert = broadcast();

    alert.update('HIGH', [colombo, gampaha], COLLEAGUE, T2);
    alert.update('SEVERE', null, OFFICER, T2);

    expect(alert).toMatchObject({ status: 'UPDATED', version: 3, severity: 'SEVERE' });
    expect(alert.targets.map((target) => target.areaId)).toEqual(['d-colombo', 'd-gampaha']);
    expect(alert.statusHistory.map(({ status, version }) => [status, version])).toEqual([
      ['DRAFT', 1],
      ['BROADCAST', 1],
      ['UPDATED', 2],
      ['UPDATED', 3],
    ]);
    expect(alert.isActive()).toBe(true);
  });

  it('DMS-120: update refuses an unknown severity or an empty scope, and changes nothing', () => {
    const alert = broadcast();

    expect(() => alert.update('EXTREME', null, OFFICER, T2)).toThrow('unknown severity');
    expect(() => alert.update(null, [], OFFICER, T2)).toThrow('at least one area');
    expect(alert).toMatchObject({ status: 'BROADCAST', version: 1 });
  });

  it('DMS-123: TC-24 update records UPDATED at the new version, by whom and when', () => {
    const alert = broadcast();

    alert.update(null, [kelani], COLLEAGUE, T2);

    expect(alert).toMatchObject({ status: 'UPDATED', version: 2, severity: 'SEVERE' });
    expect(alert.targets).toEqual([{ kind: 'RiverBasin', areaId: 'b-kelani' }]);
    expect(alert.statusHistory.at(-1)).toEqual({
      status: 'UPDATED',
      version: 2,
      at: T2,
      byId: COLLEAGUE,
    });
    expect(alert.issuedById).toBe(OFFICER);
    expect(alert.issuedAt).toBe(T1);
  });

  it('DMS-123: update replaces the message with the update message, trimmed', () => {
    const alert = broadcast();
    const update =
      'UPDATE: Flood Warning now HIGH. Move to higher ground and follow official guidance.';

    alert.update('HIGH', null, OFFICER, T2, `  ${update} `);

    expect(alert.message).toBe(update);
    expect(alert.toFields()).toMatchObject({ message: update, version: 2, status: 'UPDATED' });
  });

  it('DMS-123: update without a message keeps the current one', () => {
    const alert = broadcast();

    alert.update('HIGH', null, OFFICER, T2);

    expect(alert.message).toBe(MESSAGE);
  });

  it.each([
    ['no severity and no scope', null, null],
    ['the same severity', 'SEVERE', null],
    ['the same scope', null, [colombo]],
    ['the same severity and scope', 'SEVERE', [colombo]],
  ])('DMS-123: update refuses %s, and changes nothing', (label, severity, areas) => {
    const alert = broadcast();

    expect(() => alert.update(severity, areas, OFFICER, T2)).toThrow(
      'an update must change the severity or the scope',
    );
    expect(alert).toMatchObject({ status: 'BROADCAST', version: 1, severity: 'SEVERE' });
    expect(alert.statusHistory).toHaveLength(2);
  });

  it('DMS-123: update refuses a message over 160 characters, and changes nothing', () => {
    const alert = broadcast();

    expect(() => alert.update('HIGH', [gampaha], OFFICER, T2, 'x'.repeat(161))).toThrow(
      'the message must be 1-160 characters',
    );
    expect(alert).toMatchObject({
      status: 'BROADCAST',
      version: 1,
      severity: 'SEVERE',
      message: MESSAGE,
    });
    expect(alert.targets).toEqual([{ kind: 'District', areaId: 'd-colombo' }]);
  });

  it('DMS-123: changesWith compares the set of areas, not their order or repeats', () => {
    const alert = broadcast();
    alert.update(null, [colombo, gampaha], OFFICER, T2);

    expect(alert.changesWith(null, [gampaha, colombo])).toBe(false);
    expect(alert.changesWith(null, [gampaha, colombo, gampaha])).toBe(false);
    expect(alert.changesWith(null, [colombo])).toBe(true);
    expect(alert.changesWith(null, [kelani])).toBe(true);
    expect(alert.changesWith('HIGH', [gampaha, colombo])).toBe(true);
    expect(alert.changesWith('SEVERE', null)).toBe(false);
  });

  it('DMS-123: changesWith refuses an unknown severity or an empty scope', () => {
    const alert = broadcast();

    expect(() => alert.changesWith('EXTREME', null)).toThrow('unknown severity');
    expect(() => alert.changesWith(null, [])).toThrow('at least one area');
  });

  it('DMS-123: an update of a CANCELLED alert is refused before its changes are checked', () => {
    const alert = broadcast();
    alert.cancel(OFFICER, T2);

    expectTransitionError(
      () => alert.update(null, null, OFFICER, T2),
      'Only an active alert can be updated – current status: CANCELLED',
    );
  });

  it('DMS-124: TC-26 cancel ends an active alert with CANCELLED as the next version', () => {
    const alert = broadcast();
    alert.update('HIGH', null, OFFICER, T2);

    alert.cancel(COLLEAGUE, T2);

    expect(alert.status).toBe('CANCELLED');
    expect(alert.version).toBe(3);
    expect(alert.isActive()).toBe(false);
    expect(alert.statusHistory.at(-1)).toEqual({
      status: 'CANCELLED',
      version: 3,
      at: T2,
      byId: COLLEAGUE,
    });
    expect(alert.message).toBe(MESSAGE);
    expect(alert).toMatchObject({ issuedById: OFFICER, issuedAt: T1 });
  });

  it('DMS-124: cancel of a BROADCAST alert stores the all-clear message', () => {
    const alert = broadcast();
    const allClear =
      'ALL CLEAR: The Flood warning has ended. It is now safe, but follow official guidance.';

    alert.cancel(OFFICER, T2, allClear);

    expect(alert).toMatchObject({ status: 'CANCELLED', version: 2, message: allClear });
    expect(alert.statusHistory.map(({ status, version }) => [status, version])).toEqual([
      ['DRAFT', 1],
      ['BROADCAST', 1],
      ['CANCELLED', 2],
    ]);
  });

  it('DMS-124: cancel refuses a message over 160 characters, and changes nothing', () => {
    const alert = broadcast();

    expect(() => alert.cancel(OFFICER, T2, 'x'.repeat(161))).toThrow(
      'the message must be 1-160 characters',
    );
    expect(alert).toMatchObject({ status: 'BROADCAST', version: 1, message: MESSAGE });
    expect(alert.statusHistory).toHaveLength(2);
  });

  it('DMS-124: TC-28 a refused cancel leaves the version and history unchanged', () => {
    const alert = broadcast();
    alert.cancel(OFFICER, T2);

    expectTransitionError(
      () => alert.cancel(COLLEAGUE, T2, 'ALL CLEAR again'),
      'Only an active alert can be cancelled – current status: CANCELLED',
    );
    expect(alert).toMatchObject({ status: 'CANCELLED', version: 2 });
    expect(alert.statusHistory).toHaveLength(3);
  });

  it.each([
    ['DRAFT', 'update', (alert) => alert.update('HIGH', null, OFFICER, T2)],
    ['DRAFT', 'cancel', (alert) => alert.cancel(OFFICER, T2)],
    ['CANCELLED', 'update', (alert) => alert.update('HIGH', null, OFFICER, T2)],
    ['CANCELLED', 'cancel', (alert) => alert.cancel(OFFICER, T2)],
    ['CANCELLED', 'broadcast', (alert) => alert.broadcast(OFFICER, T2)],
  ])('DMS-120: TC-15 refuses %s → %s', (status, action, change) => {
    const alert = new HazardAlert({
      referenceNo: 'HA-1',
      createdBy: OFFICER,
      status,
      hazardType: 'FLOOD',
      severity: 'LOW',
      message: MESSAGE,
      targets: [colombo],
    });

    const verb = { update: 'updated', cancel: 'cancelled', broadcast: 'broadcast' }[action];
    const kind = action === 'broadcast' ? 'a DRAFT' : 'an active';
    expectTransitionError(
      () => change(alert),
      `Only ${kind} alert can be ${verb} – current status: ${status}`,
    );
    expect(alert.status).toBe(status);
  });

  it('DMS-125: discard allows a DRAFT, previewed or not, and changes nothing', () => {
    for (const alert of [draft(), composed()]) {
      const before = alert.toFields();

      expect(() => alert.discard()).not.toThrow();
      expect(alert.toFields()).toEqual(before);
    }
  });

  it.each([
    ['BROADCAST', () => broadcast()],
    [
      'UPDATED',
      () => {
        const alert = broadcast();
        alert.update('HIGH', null, OFFICER, T2);
        return alert;
      },
    ],
    [
      'CANCELLED',
      () => {
        const alert = broadcast();
        alert.cancel(OFFICER, T2);
        return alert;
      },
    ],
  ])('DMS-125: TC-31 discard refuses a %s alert', (status, make) => {
    const error = expectTransitionError(
      () => make().discard(),
      `Only a DRAFT alert can be discarded – current status: ${status}`,
    );
    expect(error.currentStatus).toBe(status);
  });

  it('DMS-120: a status change needs the officer and a valid time', () => {
    expect(() => composed().broadcast(null, T1)).toThrow('needs the officer');
    expect(() => composed().broadcast(OFFICER, new Date('nope'))).toThrow('needs the time');
    expect(() => composed().broadcast(OFFICER, '2026-10-02')).toThrow('needs the time');
  });

  it('DMS-120: refuses an unknown status', () => {
    expect(() => new HazardAlert({ status: 'SENT' })).toThrow('unknown status "SENT"');
  });

  it('DMS-120: toFields round-trips through the model and fromDocument', async () => {
    const alert = broadcast();
    const officerId = new mongoose.Types.ObjectId();
    const areaId = new mongoose.Types.ObjectId().toString();
    const stored = HazardAlert.startDraft({ referenceNo: 'HA-2001', officer: officerId, at: T0 });
    stored.compose({
      hazardType: 'LANDSLIDE',
      severity: 'MEDIUM',
      targets: [{ kind: 'District', area: areaId }],
      message: 'Landslide Warning: MEDIUM.',
    });
    stored.broadcast(officerId, T1);

    const doc = await HazardAlertModel.create({
      referenceNo: stored.referenceNo,
      createdBy: officerId,
      ...stored.toFields(),
    });
    const loaded = HazardAlert.fromDocument(doc);

    expect(loaded).toMatchObject({
      id: doc.id,
      status: 'BROADCAST',
      hazardType: 'LANDSLIDE',
      issuedById: officerId.toString(),
      createdById: officerId.toString(),
    });
    expect(loaded.targets).toEqual([{ kind: 'District', areaId }]);
    expect(loaded.statusHistory.map((entry) => entry.byId)).toEqual([
      officerId.toString(),
      officerId.toString(),
    ]);
    expect(alert.toFields().targets).toEqual([{ kind: 'District', area: 'd-colombo' }]);
  });

  it('DMS-120: fromDocument accepts a plain object with populated references', () => {
    const loaded = HazardAlert.fromDocument({
      id: 'a1',
      referenceNo: 'HA-9',
      createdBy: { id: 'u1' },
      event: { _id: 'e1' },
      sourceReport: 'r1',
      targets: [{ kind: 'RiverBasin', area: { _id: 'b1' } }],
    });

    expect(loaded).toMatchObject({
      id: 'a1',
      createdById: 'u1',
      eventId: 'e1',
      sourceReportId: 'r1',
    });
    expect(loaded.targets).toEqual([{ kind: 'RiverBasin', areaId: 'b1' }]);
  });
});
