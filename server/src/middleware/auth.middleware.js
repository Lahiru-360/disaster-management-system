import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { AsyncHandler } from '../utils/AsyncHandler.js';

export const requireAuth = AsyncHandler.wrap(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    throw new ApiError(401, 'AUTH_HEADER_MISSING', 'Authorization header is missing.');
  }

  if (!header.startsWith('Bearer ') || !header.slice(7).trim()) {
    throw new ApiError(
      401,
      'AUTH_HEADER_MALFORMED',

      'Authorization header must be in the format "Bearer <token>".',
    );
  }

  const token = header.slice(7);

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtAccessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired.');
    }
    throw new ApiError(401, 'TOKEN_INVALID', 'Access token is invalid.');
  }

  const user = await User.findById(decoded.id);

  // Re-loaded from the database rather than trusted from the token's claim,
  // so a token minted before deactivation and still inside its expiry window
  // is refused the moment isActive flips, instead of working for up to
  // fifteen more minutes.
  if (!user || user.isActive === false) {
    throw new ApiError(401, 'TOKEN_INVALID', 'Access token is invalid.');
  }

  req.user = user;
  next();
});

// For the handful of endpoints that must stay public but still want
// to know who's asking. Never throws - a missing header, a malformed one, an
// expired or invalid token, or a token whose user no longer exists all fall
// through to the guest case (`req.user` left unset) rather than a 401.
// requireAuth stays the one that rejects; this one only ever adds
// information, never removes access.
export const optionalAuth = AsyncHandler.wrap(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ') || !header.slice(7).trim()) {
    return next();
  }

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), env.jwtAccessSecret);
  } catch {
    return next();
  }

  const user = await User.findById(decoded.id);
  if (user) {
    req.user = user;
  }

  next();
});

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    next();
  };
