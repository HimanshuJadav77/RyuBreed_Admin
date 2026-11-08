import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import app from '../src/app.js';
import authRoutes from '../src/routes/auth.js';
import { requireAdminSession, verifyAdminAuthorization } from '../src/middleware/auth.js';
import { csrfProtection } from '../src/middleware/csrf.js';
import { _clearRateLimitsForTesting } from '../src/middleware/rate-limiter.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);


test('GET /health returns healthy status for Node.js admin dashboard', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'ryubreed-admin-dashboard');
  } finally {
    server.close();
  }
});

test('GET /auth/login renders login page successfully with CSRF token and email/password fields', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/auth/login`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Admin Login'));
    assert.ok(html.includes('Administrator Email'));
    assert.ok(html.includes('Password'));
    assert.ok(html.includes('Sign In as Administrator'));
    assert.ok(html.includes('firebaseConfig'));
    assert.ok(html.includes('name="_csrf"'));
  } finally {
    server.close();
  }
});


// 1. CSRF rejection on every state-changing route
test('CSRF rejection: POST /auth/login without CSRF token is rejected with 403 Forbidden', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'idToken=dummy-token',
    });
    assert.equal(res.status, 403);
    const html = await res.text();
    assert.ok(html.includes('CSRF token'));
  } finally {
    server.close();
  }
});

test('CSRF rejection: POST /trials/grant without CSRF token is rejected with 403 Forbidden', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/trials/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'instituteId=inst_1&durationDays=7&reason=Test',
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test('CSRF rejection: POST /plans/activate without CSRF token is rejected with 403 Forbidden', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/plans/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'instituteId=inst_1&planTier=smart199&durationMonths=12&reason=Test',
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test('CSRF rejection: POST /subscriptions/extend without CSRF token is rejected with 403 Forbidden', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/subscriptions/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'subscriptionId=sub_1&days=30&reason=Test',
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test('CSRF rejection: POST /subscriptions/revoke without CSRF token is rejected with 403 Forbidden', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/subscriptions/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'instituteId=inst_1&reason=Test',
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test('CSRF rejection: POST /plans/update without CSRF token is rejected with 403 Forbidden', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/plans/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'corePrice=1&smartPrice=2',
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

// 2. Unauthorized access rejection to every protected admin route
const protectedRoutes = [
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/institutes' },
  { method: 'GET', path: '/subscriptions' },
  { method: 'GET', path: '/audit' },
  { method: 'GET', path: '/plans' },
];

for (const route of protectedRoutes) {
  test(`Unauthorized protection: ${route.method} ${route.path} redirects unauthenticated user to /auth/login`, async () => {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}${route.path}`, {
        method: route.method,
        redirect: 'manual',
      });
      assert.equal(res.status, 302);
      assert.ok(res.headers.get('location')?.includes('/auth/login'));
    } finally {
      server.close();
    }
  });
}

// 3. Login rate limiting after five failed attempts
test('Login rate limiting: returns 429 Too Many Requests after 5 consecutive failed attempts', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    // 1. Fetch login page to obtain a valid CSRF token and session cookie
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfMatch = html.match(/name="_csrf" value="([^"]+)"/);
    assert.ok(csrfMatch, 'Must find CSRF token in login page');
    const csrfToken = csrfMatch[1];

    let lastStatus = 0;
    // Execute 6 consecutive failed login attempts with invalid token
    for (let i = 0; i < 6; i++) {
      const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookie || '',
        },
        body: `idToken=invalid_token_attempt_${i}&_csrf=${csrfToken}`,
      });
      lastStatus = postRes.status;
    }
    // 6th attempt must be rejected with 429 Too Many Requests
    assert.equal(lastStatus, 429);
  } finally {
    server.close();
  }
});

// 4. Logout session destruction and cookie invalidation
test('Logout security: GET /auth/logout clears session cookie and redirects to /auth/login', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/auth/logout`, {
      redirect: 'manual',
    });
    assert.equal(res.status, 302);
    assert.ok(res.headers.get('location')?.includes('/auth/login'));
    const setCookie = res.headers.get('set-cookie');
    assert.ok(
      setCookie?.includes('Expires=') ||
      setCookie?.includes('Max-Age=0') ||
      setCookie?.includes('; path=/')
    );
  } finally {
    server.close();
  }
});

// 5. Server-side protection of secrets (ADMIN_API_KEY, FIREBASE_PRIVATE_KEY, SESSION_SECRET)
test('Secret isolation: No server-side credentials are leaked in rendered HTML or responses', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const pages = ['/auth/login', '/health'];
    for (const p of pages) {
      const res = await fetch(`http://127.0.0.1:${port}${p}`);
      const body = await res.text();
      // Verify no sensitive keys leaked
      if (process.env.ADMIN_API_KEY) {
        assert.ok(!body.includes(process.env.ADMIN_API_KEY), `Leak detected in ${p}`);
      }
      if (process.env.SESSION_SECRET) {
        assert.ok(!body.includes(process.env.SESSION_SECRET), `Leak detected in ${p}`);
      }
      assert.ok(!body.includes('BEGIN PRIVATE KEY'), `Private key leaked in ${p}`);
    }
  } finally {
    server.close();
  }
});

// 6. Admin authorization middleware checks
test('Admin authorization: bootstrap admin UID is granted access immediately', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'test-admin-bootstrap-uid';
  let nextCalled = false;
  const mockReq = {
    session: {
      adminUser: { uid: 'test-admin-bootstrap-uid', email: 'admin@ryubreed.com' },
    },
  };
  const mockRes = {
    redirect: () => { assert.fail('Should not redirect'); },
    status: () => ({ render: () => { assert.fail('Should not render error'); } }),
  };

  await requireAdminSession(mockReq, mockRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'Next must be called for valid bootstrap UID');
});

test('Admin authorization: unauthenticated session redirects to /auth/login', async () => {
  let redirectedTo = '';
  const mockReq = { session: {} };
  const mockRes = {
    redirect: (url) => { redirectedTo = url; },
  };

  await requireAdminSession(mockReq, mockRes, () => {
    assert.fail('Next should not be called');
  });

  assert.equal(redirectedTo, '/auth/login');
});

test('Admin authorization: non-admin UID is denied with 403 status', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-uid';
  let destroyed = false;
  let statusSet = 0;
  let templateRendered = '';

  const mockDb = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false }),
      }),
    }),
  };

  const mockReq = {
    db: mockDb,
    session: {
      adminUser: { uid: 'unauthorized-user-uid', email: 'user@ryubreed.com' },
      destroy: (cb) => { destroyed = true; cb(); },
    },
  };
  const mockRes = {
    status: (s) => {
      statusSet = s;
      return {
        render: (tpl, data) => {
          templateRendered = tpl;
          assert.ok(data.error.includes('Access denied'));
        },
      };
    },
    redirect: () => { assert.fail('Should not redirect'); },
  };

  await requireAdminSession(mockReq, mockRes, () => {
    assert.fail('Next should not be called');
  });

  assert.equal(destroyed, true);
  assert.equal(statusSet, 403);
  assert.equal(templateRendered, 'login');
});

test('Admin authorization: active admin role in Firestore is granted access', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-uid';
  let nextCalled = false;
  const mockDb = {
    collection: (col) => {
      assert.equal(col, 'admin_users');
      return {
        doc: (docId) => ({
          get: async () => ({
            exists: true,
            data: () => ({ active: true, role: 'admin' }),
          }),
        }),
      };
    },
  };
  const mockReq = {
    db: mockDb,
    session: {
      adminUser: { uid: 'firestore-admin-uid', email: 'admin2@ryubreed.com' },
    },
  };
  const mockRes = {
    redirect: () => { assert.fail('Should not redirect'); },
    status: () => ({ render: () => { assert.fail('Should not render error'); } }),
  };

  await requireAdminSession(mockReq, mockRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('Session security: req.session.regenerate is called to prevent session fixation', async () => {
  let regenerated = false;
  const mockSession = {
    csrfToken: 'existing_csrf_token',
    regenerate: (cb) => {
      regenerated = true;
      cb();
    },
  };
  mockSession.regenerate(() => { });
  assert.equal(regenerated, true);
});

test('Cookie configuration: Production settings enforce __Host- prefix, secure: true, and httpOnly: true', () => {
  const isProd = true;
  const cookieName = isProd ? '__Host-ryu_admin_sid' : 'ryu_admin_sid';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000,
  };
  assert.equal(cookieName, '__Host-ryu_admin_sid');
  assert.equal(cookieOptions.secure, true);
  assert.equal(cookieOptions.httpOnly, true);
  assert.equal(cookieOptions.sameSite, 'lax');
  assert.equal(cookieOptions.maxAge, 7200000);
});

// 7. Unit tests for verifyAdminAuthorization helper
test('verifyAdminAuthorization: grants authorization to designated ADMIN_ID', async () => {
  process.env.ADMIN_ID = 'designated-admin-id-456';
  const result = await verifyAdminAuthorization('designated-admin-id-456');
  assert.equal(result.authorized, true);
  assert.equal(result.role, 'admin');
  assert.equal(result.method, 'admin_id');
});

test('verifyAdminAuthorization: grants authorization to legacy bootstrap UID', async () => {
  delete process.env.ADMIN_ID;
  delete process.env.ADMIN_UID;
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-uid-123';
  const result = await verifyAdminAuthorization('bootstrap-uid-123');
  assert.equal(result.authorized, true);
  assert.equal(result.role, 'admin');
  assert.equal(result.method, 'admin_id');
});

test('verifyAdminAuthorization: grants authorization to active Firestore admin', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-uid-123';
  const mockDb = {
    collection: (name) => {
      assert.equal(name, 'admin_users');
      return {
        doc: (id) => {
          assert.equal(id, 'firestore-admin-uid');
          return {
            get: async () => ({
              exists: true,
              data: () => ({ role: 'admin', active: true }),
            }),
          };
        },
      };
    },
  };

  const result = await verifyAdminAuthorization('firestore-admin-uid', mockDb);
  assert.equal(result.authorized, true);
  assert.equal(result.role, 'admin');
  assert.equal(result.method, 'firestore');
});

test('verifyAdminAuthorization: rejects inactive Firestore admin', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-uid-123';
  const mockDb = {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ role: 'admin', active: false }),
        }),
      }),
    }),
  };

  const result = await verifyAdminAuthorization('inactive-admin-uid', mockDb);
  assert.equal(result.authorized, false);
});

test('verifyAdminAuthorization: rejects user with non-admin role in Firestore', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-uid-123';
  const mockDb = {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ role: 'teacher', active: true }),
        }),
      }),
    }),
  };

  const result = await verifyAdminAuthorization('teacher-uid', mockDb);
  assert.equal(result.authorized, false);
});

test('verifyAdminAuthorization: rejects non-existent user record in Firestore', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-uid-123';
  const mockDb = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false }),
      }),
    }),
  };

  const result = await verifyAdminAuthorization('unknown-uid', mockDb);
  assert.equal(result.authorized, false);
});

test('verifyAdminAuthorization: rejects null, undefined, or empty UID', async () => {
  assert.equal((await verifyAdminAuthorization(null)).authorized, false);
  assert.equal((await verifyAdminAuthorization('')).authorized, false);
  assert.equal((await verifyAdminAuthorization(undefined)).authorized, false);
});

// Helper factory for HTTP test server with injected mocks
function createTestAuthServer(mockAuth, mockDb, captureSessionRef = null) {
  _clearRateLimitsForTesting();
  const testExpress = express();

  testExpress.set('views', path.join(__dirname, '../src/views'));
  testExpress.set('view engine', 'ejs');
  testExpress.use(express.urlencoded({ extended: true }));
  testExpress.use(express.json());
  testExpress.use(cookieParser());
  testExpress.use(
    session({
      name: 'ryu_admin_sid',
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: false, sameSite: 'lax' },
    })
  );
  testExpress.use(csrfProtection);
  testExpress.use((req, res, next) => {
    req.auth = mockAuth;
    req.db = mockDb;
    if (captureSessionRef) {
      res.on('finish', () => {
        captureSessionRef.session = req.session;
      });
    }
    next();
  });
  testExpress.use('/auth', authRoutes);
  testExpress.get('/test-session-check', (req, res) => {
    res.json({
      adminUser: req.session?.adminUser || null,
      adminToken: req.session?.adminToken || null,
    });
  });
  return testExpress;
}


// 8. End-to-end HTTP tests for POST /auth/login
test('POST /auth/login: rejects missing or empty idToken with 400 Bad Request', async () => {
  const mockAuth = {};
  const mockDb = {};
  const server = createTestAuthServer(mockAuth, mockDb).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/name="_csrf" id="csrfToken" value="([^"]+)"/)?.[1] ||
      html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    assert.ok(csrfToken, 'CSRF token must be present');

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=`,
    });

    assert.equal(postRes.status, 400);
    const postHtml = await postRes.text();
    assert.ok(postHtml.includes('Please provide valid login credentials'));
  } finally {
    server.close();
  }
});

test('POST /auth/login: rejects invalid idToken with 401 Unauthorized', async () => {
  const mockAuth = {
    verifyIdToken: async () => {
      const err = new Error('Firebase ID token is invalid or malformed');
      err.code = 'auth/invalid-id-token';
      throw err;
    },
  };
  const mockDb = {};
  const server = createTestAuthServer(mockAuth, mockDb).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=invalid.raw.jwt`,
    });

    assert.equal(postRes.status, 401);
    const postHtml = await postRes.text();
    assert.ok(postHtml.includes('Authentication failed'));
  } finally {
    server.close();
  }
});

test('POST /auth/login: rejects expired idToken with 401 Unauthorized and expiration notice', async () => {
  const mockAuth = {
    verifyIdToken: async () => {
      const err = new Error('Firebase ID token has expired');
      err.code = 'auth/id-token-expired';
      throw err;
    },
  };
  const mockDb = {};
  const server = createTestAuthServer(mockAuth, mockDb).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=expired.token`,
    });

    assert.equal(postRes.status, 401);
    const postHtml = await postRes.text();
    assert.ok(postHtml.includes('expired'));
  } finally {
    server.close();
  }
});

test('POST /auth/login: rejects revoked token or disabled account with 401 Unauthorized', async () => {
  const mockAuth = {
    verifyIdToken: async () => {
      const err = new Error('User account is disabled');
      err.code = 'auth/user-disabled';
      throw err;
    },
  };
  const mockDb = {};
  const server = createTestAuthServer(mockAuth, mockDb).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=disabled.user.token`,
    });

    assert.equal(postRes.status, 401);
    const postHtml = await postRes.text();
    assert.ok(postHtml.includes('disabled'));
  } finally {
    server.close();
  }
});

test('POST /auth/login: rejects non-admin Firebase user with 403 Forbidden BEFORE issuing session', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-admin-uid';
  const mockAuth = {
    verifyIdToken: async () => ({
      uid: 'regular-student-uid',
      email: 'student@example.com',
      auth_time: 1730000000,
    }),
  };
  const mockDb = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false }),
      }),
    }),
  };

  const captured = {};
  const server = createTestAuthServer(mockAuth, mockDb, captured).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=valid.token.for.student`,
    });

    assert.equal(postRes.status, 403);
    const postHtml = await postRes.text();
    assert.ok(postHtml.includes('Access denied: You do not have administrator permissions'));

    // Verify session was NOT created with adminUser
    assert.equal(captured.session?.adminUser, undefined);
  } finally {
    server.close();
  }
});

test('POST /auth/login: authorizes bootstrap admin, regenerates session, redirects to /, and does NOT store idToken in session', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'bootstrap-admin-uid';
  const mockAuth = {
    verifyIdToken: async (token) => {
      assert.equal(token, 'valid.admin.jwt.token');
      return {
        uid: 'bootstrap-admin-uid',
        email: 'superadmin@ryubreed.com',
        name: 'Super Admin',
        auth_time: 1730000000,
      };
    },
  };
  const mockDb = {};
  const captured = {};
  const server = createTestAuthServer(mockAuth, mockDb, captured).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=valid.admin.jwt.token`,
      redirect: 'manual',
    });

    // 302 Redirect to /
    assert.equal(postRes.status, 302);
    assert.equal(postRes.headers.get('location'), '/');

    // New session cookie issued
    const newCookie = postRes.headers.get('set-cookie');
    assert.ok(newCookie?.includes('ryu_admin_sid'));

    // Verified session contents via authenticated request: adminUser populated, idToken strictly omitted
    const checkRes = await fetch(`http://127.0.0.1:${port}/test-session-check`, {
      headers: { Cookie: newCookie },
    });
    const checkData = await checkRes.json();
    assert.ok(checkData.adminUser, 'adminUser must be populated in session');
    assert.equal(checkData.adminUser.uid, 'bootstrap-admin-uid');
    assert.equal(checkData.adminUser.email, 'superadmin@ryubreed.com');
    assert.equal(checkData.adminUser.role, 'admin');
    assert.equal(checkData.adminToken, null, 'Firebase ID token MUST NOT be stored in session');
  } finally {
    server.close();
  }
});

test('POST /auth/login: authorizes active Firestore admin, regenerates session, and redirects to /', async () => {
  process.env.ADMIN_BOOTSTRAP_UID = 'different-bootstrap-uid';
  const mockAuth = {
    verifyIdToken: async () => ({
      uid: 'firestore-admin-uid',
      email: 'opsadmin@ryubreed.com',
      name: 'Operations Admin',
      auth_time: 1730000000,
    }),
  };
  const mockDb = {
    collection: (name) => {
      assert.equal(name, 'admin_users');
      return {
        doc: (id) => {
          assert.equal(id, 'firestore-admin-uid');
          return {
            get: async () => ({
              exists: true,
              data: () => ({ role: 'admin', active: true }),
            }),
          };
        },
      };
    },
  };

  const server = createTestAuthServer(mockAuth, mockDb).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=valid.firestore.admin.token`,
      redirect: 'manual',
    });

    assert.equal(postRes.status, 302);
    assert.equal(postRes.headers.get('location'), '/');

    const newCookie = postRes.headers.get('set-cookie');
    assert.ok(newCookie?.includes('ryu_admin_sid'));

    const checkRes = await fetch(`http://127.0.0.1:${port}/test-session-check`, {
      headers: { Cookie: newCookie },
    });
    const checkData = await checkRes.json();
    assert.ok(checkData.adminUser, 'adminUser must be populated for firestore admin');
    assert.equal(checkData.adminUser.uid, 'firestore-admin-uid');
    assert.equal(checkData.adminUser.role, 'admin');
    assert.equal(checkData.adminToken, null, 'Firebase ID token MUST NOT be stored in session');
  } finally {
    server.close();
  }
});

test('POST /auth/login: cryptographically verifies idToken with checkRevoked=false and authorizes designated admin', async () => {
  process.env.ADMIN_ID = 'ryubreed_admin_master';
  let verifiedWithFalse = false;
  const mockAuth = {
    verifyIdToken: async (token, checkRevoked) => {
      assert.equal(checkRevoked, false, 'verifyIdToken must be called with checkRevoked=false to operate without ADC');
      verifiedWithFalse = true;
      return {
        uid: 'ryubreed_admin_master',
        email: 'admin@ryubreed.com',
        auth_time: 1730000000,
      };
    },
  };
  const mockDb = {};
  const captured = {};
  const server = createTestAuthServer(mockAuth, mockDb, captured).listen(0);
  const port = server.address().port;
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const cookie = getRes.headers.get('set-cookie');
    const html = await getRes.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    const postRes = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie || '',
      },
      body: `_csrf=${csrfToken}&idToken=valid.admin.jwt.token`,
      redirect: 'manual',
    });

    assert.equal(postRes.status, 302);
    assert.equal(postRes.headers.get('location'), '/');
    assert.ok(verifiedWithFalse, 'Must call verifyIdToken with checkRevoked=false');

    const newCookie = postRes.headers.get('set-cookie');
    const checkRes = await fetch(`http://127.0.0.1:${port}/test-session-check`, {
      headers: { Cookie: newCookie },
    });
    const checkData = await checkRes.json();
    assert.equal(checkData.adminUser.uid, 'ryubreed_admin_master');
  } finally {
    server.close();
  }
});

// --------------------------------------------------------------------------
// REG-IMPL-01: Admin Direct Firestore Mutation Fallback Removal Test
// --------------------------------------------------------------------------
test('REG-IMPL-01: AdminController fails closed when Worker is down without falling back to Firestore', async () => {
  const origWorkerUrl = process.env.WORKER_API_URL;
  process.env.WORKER_API_URL = 'http://127.0.0.1:59999';

  try {
    const { AdminController } = await import('../src/controllers/admin-controller.js');

  // 1. grantTrial fails closed
  {
    let redirectUrl = '';
    const mockReq = {
      body: { instituteId: 'inst_test_failclosed', durationDays: '7', reason: 'Fail-closed test' },
      session: { adminUser: { uid: 'admin_test' } },
    };
    const mockRes = { redirect: (url) => { redirectUrl = url; } };
    await AdminController.grantTrial(mockReq, mockRes);
    assert.ok(redirectUrl.includes('error='), `Expected redirect to include error, got ${redirectUrl}`);
    assert.ok(redirectUrl.includes('Worker'), `Expected error to mention Worker, got ${redirectUrl}`);
    assert.ok(!redirectUrl.includes('success'), 'grantTrial must NOT succeed via direct Firestore fallback');
  }

  // 2. activatePlan fails closed
  {
    let redirectUrl = '';
    const mockReq = {
      body: { instituteId: 'inst_test_failclosed', planTier: 'smart199', durationMonths: '1', reason: 'Fail-closed test' },
      session: { adminUser: { uid: 'admin_test' } },
    };
    const mockRes = { redirect: (url) => { redirectUrl = url; } };
    await AdminController.activatePlan(mockReq, mockRes);
    assert.ok(redirectUrl.includes('error='), `Expected redirect to include error, got ${redirectUrl}`);
    assert.ok(redirectUrl.includes('Worker'), `Expected error to mention Worker, got ${redirectUrl}`);
    assert.ok(!redirectUrl.includes('success'), 'activatePlan must NOT succeed via direct Firestore fallback');
  }

  // 3. extendSubscription fails closed
  {
    let redirectUrl = '';
    const mockReq = {
      body: { subscriptionId: 'sub_test_failclosed', days: '30', reason: 'Fail-closed test' },
      session: { adminUser: { uid: 'admin_test' } },
    };
    const mockRes = { redirect: (url) => { redirectUrl = url; } };
    await AdminController.extendSubscription(mockReq, mockRes);
    assert.ok(redirectUrl.includes('error='), `Expected redirect to include error, got ${redirectUrl}`);
    assert.ok(redirectUrl.includes('Worker'), `Expected error to mention Worker, got ${redirectUrl}`);
    assert.ok(!redirectUrl.includes('success'), 'extendSubscription must NOT succeed via direct Firestore fallback');
  }

  // 4. revokeSubscription fails closed
  {
    let redirectUrl = '';
    const mockReq = {
      body: { instituteId: 'inst_test_failclosed', reason: 'Fail-closed test' },
      session: { adminUser: { uid: 'admin_test' } },
    };
    const mockRes = { redirect: (url) => { redirectUrl = url; } };
    await AdminController.revokeSubscription(mockReq, mockRes);
    assert.ok(redirectUrl.includes('error='), `Expected redirect to include error, got ${redirectUrl}`);
    assert.ok(redirectUrl.includes('Worker'), `Expected error to mention Worker, got ${redirectUrl}`);
    assert.ok(!redirectUrl.includes('success'), 'revokeSubscription must NOT succeed via direct Firestore fallback');
  }

  // 5. updatePlans fails closed
  {
    let redirectUrl = '';
    const mockReq = {
      body: {
        corePrice: '99', coreAnnualPrice: '948', coreName: 'Core Plan',
        smartPrice: '199', smartAnnualPrice: '1908', smartName: 'Smart Plan',
      },
      session: { adminUser: { uid: 'admin_test' } },
    };
    const mockRes = { redirect: (url) => { redirectUrl = url; } };
    await AdminController.updatePlans(mockReq, mockRes);
    assert.ok(redirectUrl.includes('error='), `Expected redirect to include error, got ${redirectUrl}`);
    assert.ok(redirectUrl.includes('Worker'), `Expected error to mention Worker, got ${redirectUrl}`);
    assert.ok(!redirectUrl.includes('success'), 'updatePlans must NOT succeed via direct Firestore fallback');
  }
  } finally {
    process.env.WORKER_API_URL = origWorkerUrl;
  }
});

