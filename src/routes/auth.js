import { Router } from 'express';
import crypto from 'crypto';
import { getAuth } from '../config/firebase.js';
import { loginRateLimiter } from '../middleware/rate-limiter.js';
import { verifyAdminAuthorization } from '../middleware/auth.js';

const router = Router();

router.get('/csrf-token', (req, res) => {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({ csrfToken: req.session?.csrfToken || '' });
});

router.get('/login', (req, res) => {
  // If already logged in with valid admin session, redirect directly to dashboard
  if (req.session && req.session.adminUser) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

router.post('/login', loginRateLimiter, async (req, res) => {
  const { idToken } = req.body;
  if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
    return res.status(400).render('login', {
      error: 'Please provide valid login credentials.',
    });
  }

  try {
    const auth = req.auth || getAuth();
    // Cryptographically verify Firebase ID token against Google's public JWKS certificates.
    // checkRevoked is false so authentication operates purely from .env via dotenv.
    const decoded = await auth.verifyIdToken(idToken.trim(), false);

    // Verify administrator authorization BEFORE creating an authenticated session
    const authResult = await verifyAdminAuthorization(decoded.uid, req.db, decoded.email);
    if (!authResult.authorized) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ success: false, error: 'Access denied: You do not have administrator permissions.' });
      }
      return res.status(403).render('login', {
        error: 'Access denied: You do not have administrator permissions.',
      });
    }

    // Regenerate session to eliminate session fixation vulnerability
    const prevCsrf = req.session.csrfToken;
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).render('login', {
          error: 'Session initialization failed',
        });
      }

      req.session.csrfToken = prevCsrf;
      // Store only verified administrator identity and authorization details
      // Firebase ID token is intentionally NOT stored in session
      req.session.adminUser = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.email,
        role: 'admin',
        authTime: decoded.auth_time,
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Failed to save session' });
          }
          return res.status(500).render('login', {
            error: 'Failed to save session',
          });
        }
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.json({ success: true, user: req.session.adminUser });
        }
        res.redirect('/');
      });
    });
  } catch (err) {
    let errorMessage = 'Authentication failed. Please verify your credentials.';
    if (err.code === 'auth/id-token-expired') {
      errorMessage = 'Your authentication token has expired. Please sign in again.';
    } else if (err.code === 'auth/id-token-revoked') {
      errorMessage = 'This authentication token has been revoked. Please sign in again.';
    } else if (err.code === 'auth/user-disabled') {
      errorMessage = 'This administrator account has been disabled.';
    } else if (err.code === 'auth/argument-error' || err.code === 'auth/invalid-id-token') {
      errorMessage = 'Invalid authentication token. Please sign in again.';
    } else if (err.message) {
      errorMessage = `Authentication failed: ${err.message}`;
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ success: false, error: errorMessage });
    }
    res.status(401).render('login', { error: errorMessage });
  }
});

router.get('/logout', (req, res) => {
  const cookieName = process.env.NODE_ENV === 'production' ? '__Host-ryu_admin_sid' : 'ryu_admin_sid';
  req.session.destroy(() => {
    res.clearCookie(cookieName);
    res.redirect('/auth/login');
  });
});

export default router;
