import { Role } from '../../../src/enums/Role.js';
import { CitizenRegistry, citizenRegistry } from '../../../src/services/CitizenRegistry.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const idsOf = (users) => users.map((user) => user.id).sort();

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
});
