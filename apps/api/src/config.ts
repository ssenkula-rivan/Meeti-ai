import dotenv from 'dotenv';

dotenv.config();

import { PLANS } from './config/plans';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'meeti',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
  },
  
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: '7d',
  },
  
  storage: {
    provider: process.env.STORAGE_PROVIDER || 's3',
    bucket: process.env.STORAGE_BUCKET || 'meeti-recordings',
    region: process.env.STORAGE_REGION || 'us-east-1',
  },
  
  ai: {
    sttProvider: process.env.STT_PROVIDER || 'openai',
    llmProvider: process.env.LLM_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    // Model names are configurable via env.
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o',
    analysisFallbackModel: process.env.OPENAI_ANALYSIS_FALLBACK_MODEL || 'gpt-4o-mini',
  },

  // Server-side limits enforced before AI calls.
  limits: {
    // Max recording length (default 2h).
    maxRecordingSeconds: parseInt(process.env.MAX_RECORDING_SECONDS || '7200', 10),
    // Max upload size (default 200MB).
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES || String(200 * 1024 * 1024), 10),
  },

  // Per-operation cost estimates for reporting only.
  costs: {
    transcriptionUsdPerMinute: parseFloat(process.env.AI_TRANSCRIPTION_USD_PER_MIN || '0.006'),
    analysisUsdPerCall: parseFloat(process.env.AI_ANALYSIS_USD_PER_CALL || '0.01'),
  },

  mail: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  },

  // Security / exposure controls.
  security: {
    // Browsers whose requests may call this API cross-origin. Native apps
    // (iOS/Android) send no Origin header and are always allowed. Override in
    // prod with ALLOWED_ORIGINS (comma-separated).
    allowedOrigins: (process.env.ALLOWED_ORIGINS ||
      [
        'https://meeti.org.uk',
        'https://www.meeti.org.uk',
        // Cloudflare Workers preview + local dev.
        'https://meeti-web.pages.dev',
        'http://localhost:3000',
        'http://localhost:3001',
      ].join(','))
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    rateLimit: {
      // General API traffic: per IP, requests per window.
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
      // Auth endpoints (login/register/OTP/reset): much tighter to stop
      // credential stuffing and brute force.
      authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
      authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
    },
  },

  plans: PLANS,
};

// Fail closed: never let production run with the placeholder signing key,
// otherwise anyone could forge JWTs and read other users' data.
if (config.nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET must be set in production. Refusing to start with the default signing key.');
}
