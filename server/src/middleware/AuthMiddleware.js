import { User } from '../models/User.js';
import { tokenService as defaultTokenService } from '../services/TokenService.js';
import { ApiError } from '../utils/ApiError.js';
import { AsyncHandler } from '../utils/AsyncHandler.js';

// Authentication and role checks for routes. The public methods are bound to
// the instance in the constructor, so they can be handed to Express as-is
// (e.g. `authMiddleware.requireAuth`) without losing `this`.
export class AuthMiddleware {
  #tokenService;

  constructor(tokenService = defaultTokenService) {
    this.#tokenService = tokenService;
    this.requireAuth = AsyncHandler.wrap(this.requireAuth.bind(this));
    this.optionalAuth = AsyncHandler.wrap(this.optionalAuth.bind(this));
    this.requireRole = this.requireRole.bind(this);
  }

  async requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
      throw new ApiError(401, 'AUTH_HEADER_MISSING', 'Authorization header is missing.');
    }

    const token = AuthMiddleware.#bearerToken(header);

    if (token === null) {
      throw new ApiError(
        401,
        'AUTH_HEADER_MALFORMED',
        'Authorization header must be in the format "Bearer <token>".',
      );
    }

    let decoded;
    try {
      decoded = this.#tokenService.verifyAccessToken(token);
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
  }

  // For the handful of endpoints that must stay public but still want
  // to know who's asking. Never throws - a missing header, a malformed one, an
  // expired or invalid token, or a token whose user no longer exists all fall
  // through to the guest case (`req.user` left unset) rather than a 401.
  // requireAuth stays the one that rejects; this one only ever adds
  // information, never removes access.
  async optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header ? AuthMiddleware.#bearerToken(header) : null;

    if (token === null) {
      return next();
    }

    let decoded;
    try {
      decoded = this.#tokenService.verifyAccessToken(token);
    } catch {
      return next();
    }

    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
    }

    next();
  }

  requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        throw new ApiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
      }

      if (!roles.includes(req.user.role)) {
        throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
      }

      next();
    };
  }

  // The raw token after "Bearer ", or null when the header isn't in that form.
  static #bearerToken(header) {
    if (!header.startsWith('Bearer ') || !header.slice(7).trim()) {
      return null;
    }
    return header.slice(7);
  }
}

export const authMiddleware = new AuthMiddleware();
