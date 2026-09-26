import Joi from 'joi';

// Request-body schemas for the /api/auth endpoints.
export class AuthValidator {
  static PASSWORD_MIN_LENGTH = 8;

  static registerSchema = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
    password: Joi.string().min(AuthValidator.PASSWORD_MIN_LENGTH).required(),
    role: Joi.string().valid('seeker', 'business').required(),
  });

  static loginSchema = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
    password: Joi.string().required(),
  });

  static refreshSchema = Joi.object({
    refreshToken: Joi.string().required(),
  });

  static logoutSchema = Joi.object({
    refreshToken: Joi.string().required(),
  });

  static changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(AuthValidator.PASSWORD_MIN_LENGTH).required(),
  });

  static forgotPasswordSchema = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
  });

  static resetPasswordSchema = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(AuthValidator.PASSWORD_MIN_LENGTH).required(),
  });
}
