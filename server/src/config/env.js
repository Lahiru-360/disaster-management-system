import dotenv from 'dotenv';

dotenv.config();

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const emailTransport = process.env.EMAIL_TRANSPORT === 'brevo' ? 'brevo' : 'noop';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseBucketName: requireEnv('SUPABASE_BUCKET_NAME'),
  emailTransport,
  emailFrom: process.env.EMAIL_FROM,
  brevoApiKey: emailTransport === 'brevo' ? requireEnv('BREVO_API_KEY') : process.env.BREVO_API_KEY,
  passwordResetUrlBase: process.env.PASSWORD_RESET_URL_BASE || 'https://example.com/reset-password',
};
