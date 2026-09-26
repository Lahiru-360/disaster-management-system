// Role values and what the client needs to know about each. The role hierarchy
// and permissions live on the server (the Person classes in
// server/src/domain/people); this only labels roles and says where each one
// signs in.
//
// A copy of app/src/constants/roles.js, plus isWebRole(). Keep the two in
// sync: a role added or relabelled in one must change in the other.

export const ROLES = Object.freeze({
  CITIZEN: 'citizen',
  COMMUNITY_VOLUNTEER: 'community_volunteer',
  DMC_OFFICER: 'dmc_officer',
  DUTY_OFFICER: 'duty_officer',
  DISTRICT_OFFICER: 'district_officer',
  RESCUE_TEAM_LEAD: 'rescue_team_lead',
});

// Field roles use the mobile app; officer roles use this web portal.
export const PLATFORMS = Object.freeze({
  MOBILE: 'mobile',
  WEB: 'web',
});

const ROLE_DETAILS = {
  [ROLES.CITIZEN]: { label: 'Citizen', platform: PLATFORMS.MOBILE },
  [ROLES.COMMUNITY_VOLUNTEER]: { label: 'Community Volunteer', platform: PLATFORMS.MOBILE },
  [ROLES.RESCUE_TEAM_LEAD]: { label: 'Rescue Team Lead', platform: PLATFORMS.MOBILE },
  [ROLES.DMC_OFFICER]: { label: 'DMC Officer', platform: PLATFORMS.WEB },
  [ROLES.DUTY_OFFICER]: { label: 'Duty Officer', platform: PLATFORMS.WEB },
  [ROLES.DISTRICT_OFFICER]: { label: 'District Officer', platform: PLATFORMS.WEB },
};

// The roles public sign-up accepts. The server enforces the same list; every
// other role is created by its seed script.
export const SELF_SIGN_UP_ROLES = [ROLES.CITIZEN, ROLES.COMMUNITY_VOLUNTEER];

// Undefined for a role this portal doesn't know.
export function roleLabel(role) {
  return ROLE_DETAILS[role]?.label;
}

export function rolePlatform(role) {
  return ROLE_DETAILS[role]?.platform;
}

export function isMobileRole(role) {
  return rolePlatform(role) === PLATFORMS.MOBILE;
}

export function isWebRole(role) {
  return rolePlatform(role) === PLATFORMS.WEB;
}
