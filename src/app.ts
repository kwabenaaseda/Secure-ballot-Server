import express from 'express';
import cors from 'cors';
import ROUTES from './routes/routes';

const app = express();

app.use(express.json());

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
// ROUTES
app.use('/api/vx', ROUTES);

export default app;
