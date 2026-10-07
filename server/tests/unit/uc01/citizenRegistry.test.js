import mongoose from 'mongoose';
import { Role } from '../../../src/enums/Role.js';
import { Notification } from '../../../src/models/Notification.js';
import { User } from '../../../src/models/User.js';
import { CitizenRegistry, citizenRegistry } from '../../../src/services/CitizenRegistry.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const idsOf = (users) => users.map((user) => user.id).sort();

// Delivery records for an alert: one per citizen × channel, at a version and kind.
const sent = (
  alert,
  citizens,
  { version = 1, kind = 'WARNING', channels = ['PUSH', 'SMS'] } = {},
) =>
  Notification.insertMany(
    citizens.flatMap((citizen) =>
      channels.map((channel) => ({
        alert,
        alertVersion: version,
        kind,
        citizen: citizen._id,
        channel,
      })),
    ),
  );

describe('CitizenRegistry', () => {
  let colombo;
  let gampaha;
  let kalutara;

  beforeEach(async () => {
    ({ colombo, gampaha, kalutara } = await seedAreas());
  });

  it('DMS-120: TC-04 counts the citizens of every district in scope', async () => {
    await createUser({ homeDistrict: colombo });
    await createUser({ homeDistrict: colombo });
    await createUser({ homeDistrict: gampaha });
    await createUser({ homeDistrict: kalutara });

    await expect(citizenRegistry.countRecipients([colombo.id, gampaha.id])).resolves.toBe(3);
  });

  it('DMS-120: TC-05 a district given twice still counts each citizen once', async () => {
    await createUser({ homeDistrict: colombo });

    await expect(
      citizenRegistry.countRecipients([colombo.id, colombo._id, String(colombo._id)]),
    ).resolves.toBe(1);
  });

  it('DMS-120: community volunteers are citizens; officers and team leads are not', async () => {
    const residents = [
      await createUser({ homeDistrict: colombo }),
      await createUser({ role: Role.COMMUNITY_VOLUNTEER, homeDistrict: colombo }),
    ];
    await createUser({ role: Role.DUTY_OFFICER, homeDistrict: colombo, shiftDistrict: colombo });
    await createUser({ role: Role.DISTRICT_OFFICER, homeDistrict: colombo, district: colombo });
    await createUser({ role: Role.RESCUE_TEAM_LEAD, homeDistrict: colombo });

    await expect(citizenRegistry.countRecipients([colombo.id])).resolves.toBe(2);
    expect((await citizenRegistry.findRecipients([colombo.id])).map((r) => r.id).sort()).toEqual(
      idsOf(residents),
    );
  });

  it('DMS-120: deactivated accounts and citizens with no home district are left out', async () => {
    await createUser({ homeDistrict: colombo, isActive: false });
    await createUser();

    await expect(citizenRegistry.countRecipients([colombo.id])).resolves.toBe(0);
  });

  it('DMS-120: findRecipients returns each citizen once with name, phone and home district', async () => {
    const withPhone = await createUser({ homeDistrict: colombo, phone: '+94771234567' });
    const withoutPhone = await createUser({ homeDistrict: gampaha });

    const recipients = await citizenRegistry.findRecipients([gampaha.id, colombo.id, colombo.id]);

    expect(recipients).toHaveLength(2);
    expect(recipients).toEqual(
      expect.arrayContaining([
        {
          id: withPhone.id,
          name: withPhone.name,
          phone: '+94771234567',
          homeDistrictId: colombo.id,
        },
        { id: withoutPhone.id, name: withoutPhone.name, phone: null, homeDistrictId: gampaha.id },
      ]),
    );
  });

  it.each([
    ['no districts', []],
    ['only malformed ids', ['not-an-id']],
    ['nothing at all', undefined],
  ])('DMS-120: %s is nobody, without querying', async (_case, ids) => {
    await createUser({ homeDistrict: colombo });
    const userModel = { countDocuments: () => Promise.reject(new Error('queried')) };
    const registry = new CitizenRegistry({ userModel });

    await expect(registry.countRecipients(ids)).resolves.toBe(0);
    await expect(registry.findRecipients(ids)).resolves.toEqual([]);
  });

  it('DMS-120: a district with nobody registered counts 0', async () => {
    await createUser({ homeDistrict: gampaha });

    await expect(citizenRegistry.countRecipients([kalutara.id])).resolves.toBe(0);
    await expect(citizenRegistry.findRecipients([kalutara.id])).resolves.toEqual([]);
  });

  describe('original recipients (DMS-124, A3)', () => {
    const alertId = () => new mongoose.Types.ObjectId();

    it('DMS-124: TC-27 are everyone the alert was sent to, wherever they live now', async () => {
      const alert = alertId();
      const stayed = await createUser({ homeDistrict: colombo, phone: '+94771234567' });
      const moved = await createUser({ homeDistrict: colombo });
      const reachedByUpdate = await createUser({ homeDistrict: kalutara });
      await createUser({ homeDistrict: colombo });
      await sent(alert, [stayed, moved]);
      await sent(alert, [stayed, reachedByUpdate], { version: 2, kind: 'UPDATE' });
      await User.updateOne({ _id: moved._id }, { homeDistrict: gampaha._id });

      const recipients = await citizenRegistry.findOriginalRecipients(String(alert));

      expect(recipients.map((r) => r.id).sort()).toEqual(idsOf([stayed, moved, reachedByUpdate]));
      expect(recipients).toContainEqual({
        id: moved.id,
        name: moved.name,
        phone: null,
        homeDistrictId: gampaha.id,
      });
    });

    it("DMS-124: leave out other alerts' recipients", async () => {
      const alert = alertId();
      const mine = await createUser({ homeDistrict: colombo });
      const theirs = await createUser({ homeDistrict: colombo });
      await sent(alert, [mine]);
      await sent(alertId(), [theirs]);

      expect((await citizenRegistry.findOriginalRecipients(alert)).map((r) => r.id)).toEqual([
        mine.id,
      ]);
    });

    it('DMS-124: an alert that sent nothing, or a malformed id, has none', async () => {
      await expect(citizenRegistry.findOriginalRecipients(String(alertId()))).resolves.toEqual([]);
      await expect(citizenRegistry.findOriginalRecipients('not-an-id')).resolves.toEqual([]);
    });

    it('DMS-124: are counted once each, per alert, across versions and channels', async () => {
      const first = alertId();
      const second = alertId();
      const [a, b, c] = [
        await createUser({ homeDistrict: colombo }),
        await createUser({ homeDistrict: colombo }),
        await createUser({ homeDistrict: gampaha }),
      ];
      await sent(first, [a, b], { channels: ['PUSH', 'SMS', 'AUDIBLE'] });
      await sent(first, [b, c], { version: 2, kind: 'UPDATE' });
      await sent(second, [c]);

      const counts = await citizenRegistry.countOriginalRecipients([
        String(first),
        second,
        String(alertId()),
        'not-an-id',
      ]);

      expect([...counts.values()]).toEqual([3, 1, 0]);
      expect(counts.get(String(first))).toBe(3);
      expect(counts.get(String(second))).toBe(1);
    });

    it('DMS-124: counting no alerts is an empty map, without querying', async () => {
      const notificationModel = { aggregate: () => Promise.reject(new Error('queried')) };
      const registry = new CitizenRegistry({ notificationModel });

      await expect(registry.countOriginalRecipients([])).resolves.toEqual(new Map());
      await expect(registry.countOriginalRecipients()).resolves.toEqual(new Map());
    });
  });
});
