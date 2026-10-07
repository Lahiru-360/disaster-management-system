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
    // UC03: how long a rescue team lead has to acknowledge a dispatch.
    this.dispatchAckTimeoutMinutes = Config.#wholeMinutes('DISPATCH_ACK_TIMEOUT_MINUTES', 5);
    // UC01's mocked alert channels fail this share of sends (0-1), to demo E3.
    this.demoFailPushRate = Config.#rate('DEMO_FAIL_PUSH_RATE');
    this.demoFailSmsRate = Config.#rate('DEMO_FAIL_SMS_RATE');
    this.demoFailAudibleRate = Config.#rate('DEMO_FAIL_AUDIBLE_RATE');
  }

  // A whole number of minutes, 1 or more; unset means the default. Anything
  // else throws at startup instead of silently becoming NaN later.
  static #wholeMinutes(key, fallback) {
    const raw = process.env[key];
    if (raw === undefined || raw.trim() === '') {
      return fallback;
    }
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes < 1) {
      throw new Error(`${key} must be a whole number of minutes, 1 or more (got "${raw}")`);
    }
    return minutes;
  }

  // A share from 0 to 1; 0 when unset. Anything else throws at startup.
  static #rate(key) {
    const value = process.env[key];
    if (value === undefined || value === '') return 0;
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new Error(`${key} must be a number from 0 to 1`);
    }
    return rate;
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
