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
export async function verifyAdminAuthorization(uid, db = null) {
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
    return res.redirect('/auth/login');
  }

  const { uid } = req.session.adminUser;
  const authResult = await verifyAdminAuthorization(uid, req.db);

  if (authResult.authorized) {
    return next();
  }

  const renderDenied = () => {
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
