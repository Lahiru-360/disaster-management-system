import mongoose from 'mongoose';
import { Role } from '../../../src/enums/Role.js';
import { CoordinationPresenter } from '../../../src/services/CoordinationPresenter.js';
import { DistrictScope } from '../../../src/services/DistrictScope.js';
import { OperationalPictureService } from '../../../src/services/OperationalPictureService.js';
import { CoordinationValidator } from '../../../src/validators/CoordinationValidator.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const id = () => new mongoose.Types.ObjectId();

describe('CoordinationPresenter.dispatch on older documents', () => {
  it('Main 14: a dispatch stored before supportRequested existed shows false, and no history is []', () => {
    const doc = {
      toJSON: () => ({
        id: id(),
        status: 'ASSIGNED',
        team: null,
        district: id(),
        incident: id(),
        incidentLocation: { lat: 7, lng: 80 },
        priority: 'HIGH',
        createdBy: id(),
        createdAt: new Date('2026-10-03T09:30:00.000Z'),
      }),
    };

    expect(CoordinationPresenter.dispatch(doc)).toMatchObject({
      team: null,
      supportRequested: false,
      ackDeadline: null,
      declineReason: null,
      statusHistory: [],
      incidentLocation: { lat: 7, lng: 80, label: null },
    });
  });

  it('Main 2: a reference may be a plain object carrying id or _id', () => {
    expect(CoordinationPresenter.reference({ id: 'a1', name: 'X' }, ['name'])).toEqual({
      id: 'a1',
      name: 'X',
    });
    expect(CoordinationPresenter.reference({ _id: 'b2', name: 'Y' }, ['name'])).toEqual({
      id: 'b2',
      name: 'Y',
    });
  });
});

describe('DistrictScope with a district that is only an id', () => {
  it('Main 1: a district officer whose profile holds the district as plain text still reads it', async () => {
    const areas = await seedAreas();
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
    const plain = { ...officer.toObject(), district: areas.gampaha.id };

    await expect(new DistrictScope().readableDistrict(plain)).resolves.toBe(areas.gampaha.id);
  });
});

describe('OperationalPictureService default query', () => {
  it('Main 1: a district officer asking for the picture with no query gets their own district', async () => {
    const areas = await seedAreas();
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });

    const picture = await new OperationalPictureService().getCombinedPictureFor(officer);

    expect(picture.district).toMatchObject({ id: areas.gampaha.id, name: 'Gampaha' });
    expect(picture.incident).toBeNull();
  });
});

describe('CoordinationValidator.shelterBody place label', () => {
  const validate = (location) =>
    CoordinationValidator.shelterBody.validate({ name: 'Hall', location, capacity: 10 });

  it('A1: a label of only spaces is dropped, leaving just the point', () => {
    const { value, error } = validate({ lat: 7, lng: 80, label: '   ' });

    expect(error).toBeUndefined();
    expect(value.location).toEqual({ lat: 7, lng: 80 });
  });

  it('A1: a label is trimmed, and a null label is dropped', () => {
    expect(validate({ lat: 7, lng: 80, label: '  Ja-Ela  ' }).value.location).toEqual({
      lat: 7,
      lng: 80,
      label: 'Ja-Ela',
    });
    expect(validate({ lat: 7, lng: 80, label: null }).value.location).toEqual({ lat: 7, lng: 80 });
  });
});
