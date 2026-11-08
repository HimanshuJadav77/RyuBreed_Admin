import { getFirestore } from '../config/firebase.js';

/**
 * Validates whether a given Firebase UID is authorized as an active administrator.
 * Authorization mechanism:
 * 1. Designated Admin ID via ADMIN_ID / ADMIN_UID (or ADMIN_BOOTSTRAP_UID) environment variable.
 * 2. Active administrator record in Cloud Firestore: admin_users/{uid} with role === 'admin' and active === true.
 *
 * @param {string} uid - Firebase user UID
 * @param {object|null} db - Optional Firestore instance (for testing/dependency injection)
 * @returns {Promise<{ authorized: boolean, role?: string, method?: string, reason?: string }>}
 */
export async function verifyAdminAuthorization(uid, db = null, email = null) {
  if (!uid || typeof uid !== 'string') {
    return { authorized: false, reason: 'Invalid or missing user identity' };
  }

  // 1. Designated Admin ID from environment
  const configuredAdminIds = [
    process.env.ADMIN_ID,
    process.env.ADMIN_UID,
    process.env.ADMIN_BOOTSTRAP_UID,
  ].filter(Boolean).map((id) => id.trim());

  if (configuredAdminIds.includes(uid.trim())) {
    return { authorized: true, role: 'admin', method: 'admin_id' };
  }

  // 2. Designated Admin Emails from environment (comma-separated list)
  const configuredAdminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (email && typeof email === 'string' && configuredAdminEmails.includes(email.trim().toLowerCase())) {
    return { authorized: true, role: 'admin', method: 'admin_email' };
  }

  // 3. Active administrator record in Cloud Firestore: admin_users/{uid}
  try {
    const firestore = db || getFirestore();
    const adminDoc = await firestore.collection('admin_users').doc(uid.trim()).get();

    if (adminDoc.exists && adminDoc.data()?.active === true && adminDoc.data()?.role === 'admin') {
      return { authorized: true, role: 'admin', method: 'firestore' };
    }
  } catch (e) {
    console.error('Admin authorization lookup error:', e);
  }

  return { authorized: false, reason: 'User is not an active administrator' };
}

export async function requireAdminSession(req, res, next) {
  if (!req.session || !req.session.adminUser) {
    if (req.xhr || req.headers?.accept?.includes('application/json') || req.baseUrl?.startsWith('/api') || req.path?.startsWith('/api')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/auth/login');
  }

  const { uid, email } = req.session.adminUser;
  const authResult = await verifyAdminAuthorization(uid, req.db, email);

  if (authResult.authorized) {
    return next();
  }

  const renderDenied = () => {
    if (req.xhr || req.headers?.accept?.includes('application/json') || req.baseUrl?.startsWith('/api') || req.path?.startsWith('/api')) {
      return res.status(403).json({ error: 'Access denied: You do not have administrator permissions.' });
    }
    res.status(403).render('login', {
      error: 'Access denied: You do not have administrator permissions.',
    });
  };

  if (typeof req.session.destroy === 'function') {
    req.session.destroy(renderDenied);
  } else {
    renderDenied();
  }
}
