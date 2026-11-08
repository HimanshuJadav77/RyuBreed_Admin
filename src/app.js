import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

import { csrfProtection } from './middleware/csrf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment configuration from admin-dashboard/.env reliably across working directories
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// Trust upstream reverse proxies (Render, Railway, Nginx, Cloudflare) for accurate client IP resolution
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    name: process.env.NODE_ENV === 'production' ? '__Host-ryu_admin_sid' : 'ryu_admin_sid',
    secret: process.env.SESSION_SECRET || 'ryubreed-secret-key-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2-hour session timeout
    },
  })
);

app.use(csrfProtection);

// Expose public Firebase configuration for client-side Web Auth initialization
app.use((req, res, next) => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'ryubreedacedemia';
  res.locals.firebaseConfig = {
    apiKey: process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBsG0VS71b_KGFVyIT7opiG0mDryMB2J3s',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId: projectId,
    appId: process.env.FIREBASE_WEB_APP_ID || '1:146486700881:web:96cece96029fa995464170',
  };
  next();
});

// Static assets for React Vite build & legacy assets
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../public/dist'), { index: false }));
app.use('/assets', express.static(path.join(__dirname, '../public/dist/assets')));

// Public health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ryubreed-admin-dashboard' });
});

// Client session check for React SPA
app.get('/api/session', (req, res) => {
  res.json({
    authenticated: Boolean(req.session?.adminUser),
    user: req.session?.adminUser || null,
    csrfToken: req.csrfToken ? req.csrfToken() : req.session?.csrfToken || '',
    firebaseConfig: res.locals.firebaseConfig,
  });
});

// React SPA routes
app.get(['/console', '/app'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dist/index.html'));
});

app.use('/api', adminRoutes);
app.use('/auth', authRoutes);
app.use('/', adminRoutes);

if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
  app.listen(PORT, () => {
    console.log(`[Admin Dashboard] Server running at http://localhost:${PORT}`);
  });
}

export default app;
