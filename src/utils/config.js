const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const defaultDatabasePath = path.resolve(__dirname, '..', 'db', 'database.sqlite');

const parseReminderOffsets = () => {
  const raw = process.env.REMINDER_OFFSETS_MINUTES || '60,30,15';
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);
};

module.exports = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  dbUrl: process.env.DB_URL || `sqlite:${defaultDatabasePath}`,
  orgName: process.env.ORG_NAME || 'Tech University',
  maxApiBaseUrl: process.env.MAX_API_BASE_URL || 'https://platform-api.max.ru',
  maxBotToken: process.env.MAX_BOT_TOKEN || '',
  maxWebhookUrl: process.env.MAX_WEBHOOK_URL || '',
  useMockMaxApi: String(process.env.USE_MOCK_MAX_API || 'true').toLowerCase() === 'true',
  reminderLeadMinutes: Number(process.env.REMINDER_LEAD_MINUTES) || 30,
  reminderOffsetsMinutes: parseReminderOffsets(),
  reminderToleranceMinutes: Number(process.env.REMINDER_TOLERANCE_MINUTES) || 5,
  supportedLocales: ['en', 'ru'],
  defaultLocale: (process.env.DEFAULT_LOCALE || 'en').toLowerCase(),
  timezone: process.env.TIMEZONE || 'UTC',
  apiTimeoutMs: Number(process.env.API_TIMEOUT_MS) || 5000
};

