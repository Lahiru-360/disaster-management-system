import { Role } from '../../../src/enums/Role.js';
import { District } from '../../../src/models/District.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { User } from '../../../src/models/User.js';
import { HazardAlertPresenter } from '../../../src/services/HazardAlertPresenter.js';
import { WarningService } from '../../../src/services/WarningService.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

describe('HazardAlertPresenter', () => {
  let areas;
  let officer;
  let warnings;

  beforeEach(async () => {
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    warnings = new WarningService({ clock: new FakeClock('2026-10-02T06:31:00.000Z') });
  });

  const presented = async (id) => HazardAlertPresenter.present(await HazardAlert.findById(id));

  const previewedDraft = async () => {
    const { id } = await warnings.startDraft(officer);
    await warnings.preview(id, {
      hazardType: 'FLOOD',
      severity: 'HIGH',
      areaIds: [areas.colombo.id, areas.kelani.id],
    });
    return id;
  };

  it('Domain: presents targets, people and references with their ids and names', async () => {
    const alert = await presented(await previewedDraft());

    expect(alert.targets).toEqual([
      { kind: 'District', id: areas.colombo.id, name: 'Colombo' },
      { kind: 'RiverBasin', id: areas.kelani.id, name: areas.kelani.name },
    ]);
    expect(alert.createdBy).toEqual({ id: officer.id, name: officer.name });
    expect(alert.statusHistory[0].by).toEqual({ id: officer.id, name: officer.name });
    expect(alert).toMatchObject({ issuedBy: null, event: null, sourceReport: null });
  });

  it('E1: a target area deleted after the preview keeps its id, with name null', async () => {
    const id = await previewedDraft();
    await District.deleteOne({ _id: areas.colombo.id });

    const { targets } = await presented(id);

    expect(targets[0]).toEqual({ kind: 'District', id: areas.colombo.id, name: null });
    expect(targets[1]).toMatchObject({ id: areas.kelani.id, name: areas.kelani.name });
  });

  it('Domain: a deleted officer keeps their id, with name null', async () => {
    const id = await previewedDraft();
    await User.deleteOne({ _id: officer.id });

    const alert = await presented(id);

    expect(alert.createdBy).toEqual({ id: officer.id, name: null });
    expect(alert.statusHistory[0].by).toEqual({ id: officer.id, name: null });
  });

  it('Domain: an alert read already populated is presented the same way', async () => {
    const id = await previewedDraft();
    const doc = await HazardAlert.findById(id).populate('createdBy', 'name');

    expect((await HazardAlertPresenter.present(doc)).createdBy).toEqual({
      id: officer.id,
      name: officer.name,
    });
  });
});
