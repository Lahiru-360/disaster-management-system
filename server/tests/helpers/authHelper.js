import jwt from 'jsonwebtoken';
import { env } from '../../src/config/Config.js';

/**
 * Signs an access token for a user with the same secret and claims
 * ({ id, role }) as TokenService, without storing a refresh token.
 *
 * @param {{ id: string, role: string }} user A User document, or any object with id and role.
 * @param {object} [options]
 * @param {string|number} [options.expiresIn=env.jwtAccessExpiresIn] A jsonwebtoken expiry;
 *   a negative number of seconds gives a token that has already expired.
 * @returns {string} The raw JWT.
 */
export const accessTokenFor = (user, { expiresIn = env.jwtAccessExpiresIn } = {}) =>
  jwt.sign({ id: String(user.id ?? user._id), role: user.role }, env.jwtAccessSecret, {
    expiresIn,
  });

/**
 * The Authorization header value for a user: `request(app).get(path).set('Authorization', bearerFor(user))`.
 *
 * @param {{ id: string, role: string }} user
 * @returns {string} "Bearer <access token>".
 */
export const bearerFor = (user) => `Bearer ${accessTokenFor(user)}`;

/**
 * Like bearerFor, but the token expired ten seconds ago, for the 401
 * TOKEN_EXPIRED path.
 *
 * @param {{ id: string, role: string }} user
 * @returns {string} "Bearer <expired access token>".
 */
export const expiredBearerFor = (user) => `Bearer ${accessTokenFor(user, { expiresIn: -10 })}`;
