import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';
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

const app = express();

// Behind Caddy / an ALB we must trust the proxy hop to see the real client IP
// (used for rate limiting and abuse logs).
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (native iOS/Android, curl, server-to-server)
      // that send no Origin, plus any explicitly allow-listed web origin.
      if (!origin || config.security.allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
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
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.max,
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Much tighter limit on the auth surface to stop credential stuffing / brute
// force on login, register, OTP and password reset.
app.use(
  '/auth',
  rateLimit({
    windowMs: config.security.rateLimit.authWindowMs,
    max: config.security.rateLimit.authMax,
    message: 'Too many authentication attempts. Please try again later.',
  }),
  authRouter
);
app.use('/oauth', oauthRouter);
app.use('/meetings', meetingsRouter);
app.use('/notes', notesRouter);
app.use('/action-items', actionItemsRouter);
app.use('/upload', uploadRouter);
app.use('/transcripts', transcriptsRouter);
app.use('/integrations', integrationsRouter);
app.use('/exports', exportsRouter);
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
