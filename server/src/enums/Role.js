// The role strings stored on a User and carried in its tokens. What each role
// may do, and which role inherits from which, lives in the Person classes
// under domain/people - this only names the values.
export const Role = Object.freeze({
  CITIZEN: 'citizen',
  COMMUNITY_VOLUNTEER: 'community_volunteer',
  DMC_OFFICER: 'dmc_officer',
  DUTY_OFFICER: 'duty_officer',
  DISTRICT_OFFICER: 'district_officer',
  RESCUE_TEAM_LEAD: 'rescue_team_lead',
});
