import { Role } from '../../src/enums/Role.js';
import { User } from '../../src/models/User.js';

// Counts up across a test file so every user gets its own email; the unique
// index on User.email would refuse a repeat.
let sequence = 0;

// A district given as a document (e.g. from areaFixtures) or as a bare id.
const idOf = (district) => district?._id ?? district;

/**
 * Creates a user straight through the model, in any role. Only citizens and
 * community volunteers can register through the public API, so this is how a
 * test gets an officer (see server/README.md -> Testing).
 *
 * @param {object} [fields]
 * @param {string} [fields.role=Role.CITIZEN] A value from enums/Role.js.
 * @param {object|string} [fields.homeDistrict] District document or id (citizens).
 * @param {object|string} [fields.district] District document or id (district officers).
 * @param {object|string} [fields.shiftDistrict] District document or id (duty officers).
 * @param {string} [fields.name] Defaults to "Test <role> <n>".
 * @param {string} [fields.email] Defaults to a unique "<role>.<n>@helpers.test".
 * @param {string} [fields.phone]
 * @param {string} [fields.passwordHash] Defaults to a placeholder no password matches.
 * @param {boolean} [fields.isActive=true]
 * @returns {Promise<User>} The saved User document.
 */
export const createUser = ({
  role = Role.CITIZEN,
  homeDistrict,
  district,
  shiftDistrict,
  ...rest
} = {}) => {
  sequence += 1;
  return User.create({
    name: `Test ${role} ${sequence}`,
    email: `${role}.${sequence}@helpers.test`,
    passwordHash: 'not-a-real-hash',
    role,
    homeDistrict: idOf(homeDistrict),
    district: idOf(district),
    shiftDistrict: idOf(shiftDistrict),
    ...rest,
  });
};
