import mongoose from 'mongoose';
import { DistrictCapacityAlert } from '../../../src/models/DistrictCapacityAlert.js';
import { CapacityAlertWindow } from '../../../src/services/CapacityAlertWindow.js';

// UC03 E2 (DMS-148): at most one DMC alert an hour per district.
const HOUR = 60 * 60 * 1000;
const T0 = new Date('2026-10-03T09:00:00.000Z');
const at = (offsetMs) => new Date(T0.getTime() + offsetMs);

const district = () => new mongoose.Types.ObjectId();

let window;

beforeAll(async () => {
  await DistrictCapacityAlert.init();
});

beforeEach(() => {
  window = new CapacityAlertWindow();
});

describe('CapacityAlertWindow.claim', () => {
  it('TC-47: is due the first time for a district, and records when', async () => {
    const id = district();

    expect(await window.claim(id, T0)).toBe(true);

    const record = await DistrictCapacityAlert.findOne({ district: id });
    expect(record.lastCapacityAlertAt).toEqual(T0);
  });

  it('TC-48: is not due again within the hour, and leaves the recorded time alone', async () => {
    const id = district();
    await window.claim(id, T0);

    expect(await window.claim(id, at(10 * 60 * 1000))).toBe(false);
    expect(await window.claim(id, at(HOUR - 1))).toBe(false);

    const record = await DistrictCapacityAlert.findOne({ district: id });
    expect(record.lastCapacityAlertAt).toEqual(T0);
  });

  it('TC-48: is due again at exactly one hour, and records the new time', async () => {
    const id = district();
    await window.claim(id, T0);

    expect(await window.claim(id, at(HOUR))).toBe(true);

    const record = await DistrictCapacityAlert.findOne({ district: id });
    expect(record.lastCapacityAlertAt).toEqual(at(HOUR));
  });

  it('keeps one record per district, however many times it is claimed', async () => {
    const id = district();
    await window.claim(id, T0);
    await window.claim(id, at(2 * HOUR));
    await window.claim(id, at(5 * HOUR));

    expect(await DistrictCapacityAlert.countDocuments({ district: id })).toBe(1);
  });

  it('gives each district its own hour', async () => {
    const first = district();
    const second = district();
    await window.claim(first, T0);

    expect(await window.claim(second, at(1000))).toBe(true);
    expect(await window.claim(first, at(2000))).toBe(false);
  });

  it('TC-48: of several claims at once, exactly one is due', async () => {
    const id = district();

    const results = await Promise.all(Array.from({ length: 6 }, () => window.claim(id, T0)));

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await DistrictCapacityAlert.countDocuments({ district: id })).toBe(1);
  });

  it('lets any other failure through unchanged', async () => {
    const failure = new Error('connection lost');
    const broken = new CapacityAlertWindow({
      alertModel: {
        findOneAndUpdate: async () => {
          throw failure;
        },
      },
    });

    await expect(broken.claim(district(), T0)).rejects.toBe(failure);
  });
});

describe('CapacityAlertWindow.reset', () => {
  it('TC-49: makes the next claim due at once, even within the hour', async () => {
    const id = district();
    await window.claim(id, T0);

    await window.reset(id);

    expect(await window.claim(id, at(1000))).toBe(true);
  });

  it('clears the recorded time', async () => {
    const id = district();
    await window.claim(id, T0);

    await window.reset(id);

    expect((await DistrictCapacityAlert.findOne({ district: id })).lastCapacityAlertAt).toBeNull();
  });

  it('does nothing for a district that was never alerted, and creates no record', async () => {
    const id = district();

    await window.reset(id);

    expect(await DistrictCapacityAlert.countDocuments({ district: id })).toBe(0);
  });

  it("leaves other districts' hours alone", async () => {
    const first = district();
    const second = district();
    await window.claim(first, T0);
    await window.claim(second, T0);

    await window.reset(first);

    expect(await window.claim(second, at(1000))).toBe(false);
  });
});

describe('DistrictCapacityAlert model', () => {
  it('needs a district, and has no alert time to begin with', () => {
    const empty = new DistrictCapacityAlert({});
    const built = new DistrictCapacityAlert({ district: district() });

    expect(empty.validateSync().errors.district).toBeDefined();
    expect(built.validateSync()).toBeUndefined();
    expect(built.lastCapacityAlertAt).toBeNull();
  });

  it('shows an id, without the internal fields', () => {
    const json = new DistrictCapacityAlert({ district: district() }).toJSON();

    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
