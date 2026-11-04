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
    // Pool sizing / resilience. All bounded so a saturated or slow database
    // degrades with a clear error instead of piling up requests indefinitely.
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
    // Give up acquiring/creating a connection after this rather than queueing
    // forever when the pool is exhausted (fail fast, surface the outage).
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '10000', 10),
    // Keep TCP keep-alives on so an idle pooled client is not silently dropped
    // by Caddy / a NAT gateway / Postgres' own idle timeout between uses.
    keepAlive: process.env.DB_POOL_KEEP_ALIVE !== 'false',
    // Per-statement ceiling so one runaway query can't pin a connection. Sent
    // via `SET statement_timeout` on connect (not a pg pool option).
    statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
  },
  
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    // Native TCP/TLS endpoint (redis:// or rediss://) used by ioredis + BullMQ.
    // Deliberately separate from the Upstash REST url above, which is HTTPS and
    // incompatible with ioredis. Empty means fall back to in-process limits.
    tlsUrl: process.env.REDIS_URL || process.env.REDIS_TLS_URL || '',
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
      // Expensive or high-abuse surfaces each get their own named bucket so a
      // strict limit never bleeds into general traffic. Windows are per hour.
      uploadWindowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || '3600000', 10),
      uploadMax: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '30', 10),
      meetingWindowMs: parseInt(process.env.MEETING_RATE_LIMIT_WINDOW_MS || '3600000', 10),
      meetingMax: parseInt(process.env.MEETING_RATE_LIMIT_MAX || '60', 10),
      exportWindowMs: parseInt(process.env.EXPORT_RATE_LIMIT_WINDOW_MS || '3600000', 10),
      exportMax: parseInt(process.env.EXPORT_RATE_LIMIT_MAX || '20', 10),
    },
  },

  // Readiness probe budgets. A dependency check that blows its budget reports
  // "not ready" instead of hanging the probe forever.
  health: {
    dbTimeoutMs: parseInt(process.env.HEALTH_DB_TIMEOUT_MS || '2000', 10),
  },

  plans: PLANS,
};

// Fail closed: never let production run with the placeholder signing key,
// otherwise anyone could forge JWTs and read other users' data.
if (config.nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET must be set in production. Refusing to start with the default signing key.');
}
