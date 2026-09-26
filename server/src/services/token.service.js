import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { RefreshToken } from '../models/refreshToken.model.js';
import { ApiError } from '../utils/ApiError.js';

const signAccessToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });

export const issueTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const { exp } = jwt.decode(refreshToken);
  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt: new Date(exp * 1000),
  });

  return { accessToken, refreshToken };
};

export const rotateRefreshToken = async (token) => {
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

  return issueTokens({ _id: decoded.id, role: decoded.role });
};

export const revokeRefreshToken = async (token) => {
  await RefreshToken.deleteOne({ token });
};

export const revokeAllRefreshTokensForUser = async (userId) => {
  await RefreshToken.deleteMany({ user: userId });
};
