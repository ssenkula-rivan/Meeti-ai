import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { Database } from '@meeti/database';
import { errorHandler } from './middleware/error-handler';
import { rateLimit, configureFromRedis } from './middleware/rate-limit';
import { corsOriginDelegate } from './middleware/cors';
import { authRouter } from './routes/auth';
import { oauthRouter } from './routes/oauth';
import { meetingsRouter } from './routes/meetings';
import { notesRouter } from './routes/notes';
import { actionItemsRouter } from './routes/action-items';
import { uploadRouter } from './routes/upload';
import { transcriptsRouter } from './routes/transcripts';
import { integrationsRouter } from './routes/integrations';
import { exportsRouter } from './routes/exports';
import organizationsRouter from './routes/organizations';
import subscriptionsRouter from './routes/subscriptions';
import { slackRouter } from './routes/slack';
import { webhooksRouter } from './routes/webhooks';
import { apiKeysRouter } from './routes/api-keys';
import { searchRouter } from './routes/search';
import { foldersRouter } from './routes/folders';
import { tagsRouter } from './routes/tags';
import { publicApiRouter } from './routes/public-api';
import { zoomRouter } from './routes/zoom';

// Configure the shared rate-limit counting backend before any limiter is built
// (limiters resolve their store when created). Falls back to in-process counters
// when Redis is not configured — correct for the single-node deployment today.
const rateLimitStore = configureFromRedis();

// A dedicated pool for the readiness probe; ping() opens a real connection
// without touching user data.
const readinessDb = new Database(config.database);

const app = express();

// Behind Caddy / an ALB we must trust the proxy hop to see the real client IP
// (used for rate limiting and abuse logs). trust proxy=1 means Express takes
// exactly one hop (Caddy) and derives req.ip from it — we never read the raw,
// spoofable X-Forwarded-For value ourselves.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    // Allowlist logic lives in ./middleware/cors (unit-tested). Non-browser
    // clients (native apps, curl, server-to-server) send no Origin and pass.
    origin: corsOriginDelegate(config.security.allowedOrigins),
    // Auth is via Bearer tokens in a header, not cookies, so no credentials.
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  })
);
app.use(express.json({ limit: '10mb' }));

// Broad rate limiting for the whole API surface.
app.use(
  rateLimit({
    name: 'global',
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.max,
  })
);

// Liveness: the process is up. No dependency checks, so it stays fast and does
// not flap-fail when a downstream is briefly down (the orchestrator must not
// kill a recoverable process on this signal).
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: verify the dependencies actually needed to serve traffic, so a
// transient DB outage drains load via /ready while /health keeps the process up.
app.get('/ready', async (req, res) => {
  const checks: Record<string, string> = {};

  // Bound the DB probe so the readiness check itself can never hang.
  const dbResult = await Promise.race([
    readinessDb.ping().then(() => 'up').catch(() => 'down'),
    new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), config.health.dbTimeoutMs)),
  ]);
  checks.database = dbResult;

  if (config.redis.enabled) {
    // ioredis uses lazyConnect, so a store existing means distributed counting
    // is wired, not that Redis is reachable this instant. Report it honestly.
    checks.redis = rateLimitStore ? 'configured' : 'in-memory';
  }

  const ready = dbResult === 'up';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Much tighter limit on the auth surface to stop credential stuffing / brute
// force on login, register, OTP and password reset. Fails closed: if the
// counting store is unavailable we reject rather than silently drop protection.
app.use(
  '/auth',
  rateLimit({
    name: 'auth',
    windowMs: config.security.rateLimit.authWindowMs,
    max: config.security.rateLimit.authMax,
    message: 'Too many authentication attempts. Please try again later.',
    failOpen: false,
  }),
  authRouter
);
app.use('/oauth', oauthRouter);
app.use('/meetings', meetingsRouter);
app.use('/notes', notesRouter);
app.use('/action-items', actionItemsRouter);
// Uploads are expensive and a prime abuse target: per-hour, fail-closed limit.
app.use(
  '/upload',
  rateLimit({
    name: 'upload',
    windowMs: config.security.rateLimit.uploadWindowMs,
    max: config.security.rateLimit.uploadMax,
    message: 'Too many uploads. Please try again later.',
    failOpen: false,
  }),
  uploadRouter
);
app.use('/transcripts', transcriptsRouter);
app.use('/integrations', integrationsRouter);
// Exports are CPU-heavy (PDF/DOCX generation): a separate, tighter budget.
app.use(
  '/exports',
  rateLimit({
    name: 'export',
    windowMs: config.security.rateLimit.exportWindowMs,
    max: config.security.rateLimit.exportMax,
    message: 'Too many exports. Please try again later.',
    failOpen: false,
  }),
  exportsRouter
);
app.use('/organizations', organizationsRouter);
app.use('/billing', subscriptionsRouter);
app.use('/slack', slackRouter);
app.use('/webhooks', webhooksRouter);
app.use('/api-keys', apiKeysRouter);
app.use('/search', searchRouter);
app.use('/folders', foldersRouter);
app.use('/tags', tagsRouter);
app.use('/v1', publicApiRouter);
app.use('/zoom', zoomRouter);

app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API server running on port ${config.port}`);
});
