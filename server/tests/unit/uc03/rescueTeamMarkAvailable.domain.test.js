import { InvalidTeamTransitionError } from '../../../src/domain/coordination/InvalidTeamTransitionError.js';
import { RescueTeam } from '../../../src/domain/coordination/RescueTeam.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';

const team = (status) => new RescueTeam({ teamId: 'team-1', name: 'Team Alpha', status });

describe('RescueTeam.markAvailable (E4)', () => {
  it('E4: an UNAVAILABLE team becomes AVAILABLE', () => {
    const built = team(TeamStatus.UNAVAILABLE);

    expect(built.markAvailable()).toEqual({ teamStatus: TeamStatus.AVAILABLE });
    expect(built.status).toBe(TeamStatus.AVAILABLE);
    expect(built.isAvailable()).toBe(true);
  });

  it('E4: an AVAILABLE team stays as it is, with no change to apply', () => {
    const built = team(TeamStatus.AVAILABLE);

    expect(built.markAvailable()).toEqual({ teamStatus: null });
    expect(built.status).toBe(TeamStatus.AVAILABLE);
  });

  it.each([TeamStatus.DISPATCHED, TeamStatus.ON_SITE])(
    'E4: a %s team is refused with 409 INVALID_TEAM_TRANSITION and stays put',
    (status) => {
      const built = team(status);

      let error;
      try {
        built.markAvailable();
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(InvalidTeamTransitionError);
      expect(error).toMatchObject({
        status: 409,
        code: 'INVALID_TEAM_TRANSITION',
        message: `Team Alpha is ${status}; it becomes available when its dispatch is completed.`,
        currentStatus: status,
      });
      expect(built.status).toBe(status);
    },
  );
});
