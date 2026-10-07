import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { Role } from '../../../src/enums/Role.js';
import { AreaRegistry } from '../../../src/services/AreaRegistry.js';
import { WarningService } from '../../../src/services/WarningService.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-02T06:20:00.000Z';

describe('AreaRegistry.areaIdsCovering', () => {
  let areas;
  const registry = new AreaRegistry();

  beforeEach(async () => {
    areas = await seedAreas();
  });

  it('A2: gives each district and every basin spanning one of them', async () => {
    const ids = await registry.areaIdsCovering([areas.colombo.id]);

    expect(ids.sort()).toEqual([areas.colombo.id, areas.kelani.id].sort());
  });

  it('A2: gives only the district when no basin spans it', async () => {
    await expect(registry.areaIdsCovering([areas.kalutara.id])).resolves.toEqual([
      areas.kalutara.id,
    ]);
  });

  it('A2: lists a basin once when it spans several of the districts', async () => {
    const ids = await registry.areaIdsCovering([areas.colombo.id, areas.gampaha.id]);

    expect(ids.sort()).toEqual([areas.colombo.id, areas.gampaha.id, areas.kelani.id].sort());
  });

  it('A2: gives nothing for no districts', async () => {
    await expect(registry.areaIdsCovering([])).resolves.toEqual([]);
  });
});

describe('WarningService.findActive', () => {
  let service;
  let officer;
  let areas;
  let nextRef;

  beforeEach(async () => {
    service = new WarningService({ clock: new FakeClock(NOW) });
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    nextRef = 1000;
  });

  const target = (area) => ({
    kind: area === areas.kelani ? 'RiverBasin' : 'District',
    area: area._id,
  });

  // A stored alert, active (BROADCAST) unless told otherwise.
  const storeAlert = ({
    hazardType = 'FLOOD',
    severity = 'HIGH',
    status = 'BROADCAST',
    version = 1,
    scope = [areas.colombo],
    issuedAt = new Date(NOW),
  } = {}) =>
    HazardAlert.create({
      referenceNo: `HA-${(nextRef += 1)}`,
      createdBy: officer._id,
      hazardType,
      severity,
      message: 'Flood Warning: HIGH. Move to higher ground and follow official guidance.',
      status,
      version,
      targets: scope.map(target),
      issuedBy: status === 'DRAFT' ? null : officer._id,
      issuedAt: status === 'DRAFT' ? null : issuedAt,
    });

  const findActive = (scope, options) =>
    service.findActive(
      'FLOOD',
      scope.map((area) => area.id),
      options,
    );

  it('A2: TC-20 finds an active warning of the same type on the same district', async () => {
    const active = await storeAlert();

    await expect(findActive([areas.colombo])).resolves.toEqual({
      id: active.id,
      referenceNo: active.referenceNo,
      hazardType: 'FLOOD',
      severity: 'HIGH',
      targets: [{ kind: 'District', id: areas.colombo.id, name: 'Colombo' }],
      version: 1,
    });
  });

  it('A2: TC-21 finds an active warning on a basin that spans a chosen district', async () => {
    const active = await storeAlert({ scope: [areas.kelani] });

    await expect(findActive([areas.gampaha])).resolves.toMatchObject({ id: active.id });
  });

  it('A2: TC-21 finds an active district warning from a chosen basin, once expanded', async () => {
    const active = await storeAlert({ scope: [areas.gampaha] });
    const districtIds = [areas.colombo.id, areas.gampaha.id];

    await expect(service.findActive('FLOOD', districtIds)).resolves.toMatchObject({
      id: active.id,
    });
  });

  it('A2: TC-22 a different hazard type on the same district is not a conflict', async () => {
    await storeAlert({ hazardType: 'LANDSLIDE' });

    await expect(findActive([areas.colombo])).resolves.toBeNull();
  });

  it('A2: no district in common is not a conflict', async () => {
    await storeAlert({ scope: [areas.kelani] });

    await expect(findActive([areas.kalutara])).resolves.toBeNull();
  });

  it('A2: an UPDATED warning is active and found with its version', async () => {
    const active = await storeAlert({ status: 'UPDATED', version: 3, severity: 'SEVERE' });

    await expect(findActive([areas.colombo])).resolves.toMatchObject({
      id: active.id,
      severity: 'SEVERE',
      version: 3,
    });
  });

  it.each(['CANCELLED', 'DRAFT'])(
    'A2: a %s alert is not active, so not a conflict',
    async (status) => {
      await storeAlert({ status });

      await expect(findActive([areas.colombo])).resolves.toBeNull();
    },
  );

  it('A2: gives the most recently issued when several conflict', async () => {
    await storeAlert({ issuedAt: new Date('2026-10-01T06:00:00.000Z') });
    const latest = await storeAlert({ issuedAt: new Date('2026-10-02T06:00:00.000Z') });
    await storeAlert({ issuedAt: new Date('2026-09-30T06:00:00.000Z') });

    await expect(findActive([areas.colombo])).resolves.toMatchObject({ id: latest.id });
  });

  it('A2: leaves out the excluded alert, so an update never conflicts with itself', async () => {
    const active = await storeAlert();

    await expect(findActive([areas.colombo], { excludeId: active.id })).resolves.toBeNull();
  });

  it('A2: an excluded alert still lets another conflicting one be found', async () => {
    const own = await storeAlert();
    const other = await storeAlert({ scope: [areas.kelani] });

    await expect(findActive([areas.colombo], { excludeId: own.id })).resolves.toMatchObject({
      id: other.id,
    });
  });

  it('A2: an empty scope conflicts with nothing', async () => {
    await storeAlert();

    await expect(service.findActive('FLOOD', [])).resolves.toBeNull();
  });

  it('A2: TC-20 the preview of a new draft returns the conflicting warning', async () => {
    const active = await storeAlert({ scope: [areas.kelani] });
    const draft = await service.startDraft(officer);

    const result = await service.preview(draft.id, {
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      areaIds: [areas.colombo.id],
    });

    expect(result.activeWarning).toEqual({
      id: active.id,
      referenceNo: active.referenceNo,
      hazardType: 'FLOOD',
      severity: 'HIGH',
      targets: [{ kind: 'RiverBasin', id: areas.kelani.id, name: 'Kelani' }],
      version: 1,
    });
    expect(result.alert.status).toBe('DRAFT');
  });
});
