import jwt from 'jsonwebtoken';
import { env } from '../config/Config.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';

// Issues, rotates and revokes the access/refresh JWT pair. Every refresh token
// is also stored, so it can be revoked before it expires.
export class TokenService {
  async issueTokens(user) {
    const accessToken = this.#sign(user, env.jwtAccessSecret, env.jwtAccessExpiresIn);
    const refreshToken = this.#sign(user, env.jwtRefreshSecret, env.jwtRefreshExpiresIn);

    const { exp } = jwt.decode(refreshToken);
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt: new Date(exp * 1000),
    });

    return { accessToken, refreshToken };
  }

  // Returns the decoded claims, or throws jsonwebtoken's own error
  // (TokenExpiredError, JsonWebTokenError, ...) for the caller to report.
  verifyAccessToken(token) {
    return jwt.verify(token, env.jwtAccessSecret);
  }

  async rotateRefreshToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtRefreshSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new ApiError(401, 'TOKEN_EXPIRED', 'Refresh token has expired. Please log in again.');
      }
      throw new ApiError(401, 'TOKEN_INVALID', 'Refresh token is invalid.');
    }

    const existing = await RefreshToken.findOneAndDelete({ token });

    if (!existing) {
      throw new ApiError(401, 'TOKEN_INVALID', 'Refresh token is invalid.');
    }

    return this.issueTokens({ _id: decoded.id, role: decoded.role });
  }

  async revokeRefreshToken(token) {
    await RefreshToken.deleteOne({ token });
  }

  async revokeAllRefreshTokens(userId) {
    await RefreshToken.deleteMany({ user: userId });
  }

  #sign(user, secret, expiresIn) {
    return jwt.sign({ id: user._id.toString(), role: user.role }, secret, { expiresIn });
  }
}

export const tokenService = new TokenService();
