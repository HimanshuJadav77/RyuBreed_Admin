import crypto from 'crypto';

/**
 * Lightweight, session-backed CSRF protection middleware without third-party dependencies.
 */
export function csrfProtection(req, res, next) {
  if (!req.session) {
    return next();
  }

  // 1. Ensure a CSRF token exists for the current session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // 2. Expose CSRF token to all templates via res.locals
  res.locals.csrfToken = req.session.csrfToken;

  // 3. For safe HTTP methods, proceed immediately
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 4. For state-changing methods (POST, PUT, DELETE, PATCH), verify CSRF token
  const submittedToken =
    req.body?._csrf ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'];

  if (!submittedToken || submittedToken !== req.session.csrfToken) {
    return res.status(403).render('login', {
      error: 'Security validation failed: Invalid or missing CSRF token. Please refresh and try again.',
      csrfToken: req.session.csrfToken,
    });
  }

  next();
}

