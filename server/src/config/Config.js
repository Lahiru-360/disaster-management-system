import dotenv from 'dotenv';

dotenv.config();

// Reads the process environment once, when the shared instance below is
// created at import. A missing required variable throws right then, so the
// server fails loudly on startup rather than on the first request that needs it.
export class Config {
  constructor() {
    const emailTransport = process.env.EMAIL_TRANSPORT === 'brevo' ? 'brevo' : 'noop';

    this.nodeEnv = process.env.NODE_ENV || 'development';
    this.port = process.env.PORT || 3000;
    this.mongoUri = process.env.MONGODB_URI;
    this.jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.supabaseUrl = Config.#required('SUPABASE_URL');
    this.supabaseServiceRoleKey = Config.#required('SUPABASE_SERVICE_ROLE_KEY');
    this.supabaseBucketName = Config.#required('SUPABASE_BUCKET_NAME');
    this.emailTransport = emailTransport;
    this.emailFrom = process.env.EMAIL_FROM;
    this.brevoApiKey =
      emailTransport === 'brevo' ? Config.#required('BREVO_API_KEY') : process.env.BREVO_API_KEY;
    this.passwordResetUrlBase =
      process.env.PASSWORD_RESET_URL_BASE || 'https://example.com/reset-password';
  }

  static #required(key) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }
}

export const env = new Config();
