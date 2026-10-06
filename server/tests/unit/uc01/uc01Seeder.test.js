import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { Uc01Seeder } from '../../../scripts/Uc01Seeder.js';

describe('Uc01Seeder', () => {
  it('DMS-120: seeds no hazard alerts, so the demo starts with none', async () => {
    await new Uc01Seeder().run();

    expect(await HazardAlert.countDocuments()).toBe(0);
  });

  it('DMS-120: is selected as uc01, and lets --reset-demo empty the alerts', () => {
    const seeder = new Uc01Seeder();

    expect(seeder.name).toBe('uc01');
    expect(seeder.demoModels).toEqual([HazardAlert]);
  });

  it('DMS-120: fails the seed when a preview message is over 160 characters', async () => {
    const messageTemplate = {
      generate: (type, severity) =>
        type === 'CYCLONE' && severity === 'LOW' ? 'x'.repeat(161) : 'ok',
    };

    await expect(new Uc01Seeder({ messageTemplate }).run()).rejects.toThrow(
      'preview messages over 160 characters: CYCLONE/LOW',
    );
  });
});
