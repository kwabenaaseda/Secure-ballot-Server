import 'express-async-errors'; // MUST be first — routes unhandled async throws to the error middleware below
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import ROUTES from './routes/routes';
import swaggerSpec from './config/swagger';
import { Log } from './utils/Logger';
import { apiLimiter } from './middleware/rateLimit';

const app = express();

app.use(express.json());

// ── SECURITY HEADERS ─────────────────────────────────────────────────────────
// helmet is applied before everything else. contentSecurityPolicy is disabled
// because Swagger UI (mounted below) serves inline scripts/styles that a
// default CSP would block; every other helmet default (HSTS, noSniff,
// frameguard, referrerPolicy, crossOriginResourcePolicy) is active.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — allow the frontend origins to call the API. The allow-list comes
// from the CORS_ORIGIN env var (comma-separated) and falls back to the
// dev + hosted frontends. PATCH is required by the admin org approve/reject/
// suspend workflow (PATCH /admin/organizations/:id/approve etc.).
const CORS_ALLOWED_ORIGINS: string[] = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      CORS_ALLOWED_ORIGINS.length > 0
        ? CORS_ALLOWED_ORIGINS
        : ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://secureballotclient.netlify.app'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Allow specific HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
  })
);
app.set('trust proxy', 1); // Enable trust proxy to get the correct client IP address

// SWAGGER API DOCUMENTATION
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SecureBallot API Documentation',
  explorer: true,
}));

// ROUTES — every /api/vx request passes the coarse global limiter first;
// the stricter authLimiter is applied per auth route inside the route files.
app.use('/api/vx', apiLimiter, ROUTES);

// ── 404 FALLBACK — same response envelope as every endpoint ──────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

// ── TERMINAL ERROR HANDLER ───────────────────────────────────────────────────
// Paired with 'express-async-errors' (imported above): any throw that escapes
// a controller lands here instead of becoming an unhandled rejection. The
// client only ever sees the standard envelope — never a stack trace.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  Log.error('App.ErrorHandler', String(err instanceof Error ? err.message : err), 'UNHANDLED_ERROR');
  if (res.headersSent) return;
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

export default app;
