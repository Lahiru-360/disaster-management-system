import Joi from 'joi';
import { PersonFactory } from '../domain/people/PersonFactory.js';

// Request-body schemas for the /api/auth endpoints.
export class AuthValidator {
  static PASSWORD_MIN_LENGTH = 8;

  static NAME_MAX_LENGTH = 100;

  // Only self-registrable roles (Citizen and its subclasses) can sign up; the
  // officer and rescue team roles are created by the seed script.
  static registerSchema = Joi.object({
    name: Joi.string().trim().max(AuthValidator.NAME_MAX_LENGTH).required(),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
    password: Joi.string().min(AuthValidator.PASSWORD_MIN_LENGTH).required(),
    role: Joi.string()
      .valid(...PersonFactory.selfRegistrableRoles())
      .required(),
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
