import { getFirestore, getAuth, admin } from '../config/firebase.js';
import { WorkerApiClient } from '../services/worker-api.js';

const workerClient = new WorkerApiClient();

function hasDirectFirestoreAccess() {
  return Boolean(
    process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  );
}

function isJsonRequest(req) {
  if (!req) return false;
  return Boolean(
    req.xhr ||
    req.headers?.accept?.includes('application/json') ||
    req.baseUrl?.startsWith('/api') ||
    req.path?.startsWith('/api')
  );
}

export class AdminController {
  static async getDashboard(req, res) {
    try {
      // 1. Try authoritative Cloudflare Worker analytics first
      try {
        const resp = await workerClient.getAnalytics();
        if (resp && resp.success && resp.data) {
          const d = resp.data;
          if (isJsonRequest(req)) {
            return res.json({
              success: true,
              data: {
                totalUsers: d.totalUsers || 0,
                totalInstitutes: d.totalInstitutes || 0,
                activeSubscriptions: d.activeSubscriptions || 0,
                activeTrials: d.activeTrials || 0,
                expiredSubscriptions: d.expiredSubscriptions || 0,
                totalRevenue: d.totalRevenue || 0,
              },
              user: req.session.adminUser,
            });
          }
          return res.render('dashboard', {
            title: 'Executive Overview',
            totalUsers: d.totalUsers || 0,
            totalInstitutes: d.totalInstitutes || 0,
            activeSubscriptions: d.activeSubscriptions || 0,
            activeTrials: d.activeTrials || 0,
            expiredSubscriptions: d.expiredSubscriptions || 0,
            totalRevenue: d.totalRevenue || 0,
            user: req.session.adminUser,
          });
        }
      } catch {
        // Fall back to direct Firestore Admin SDK if worker call is unavailable
      }

      if (!hasDirectFirestoreAccess()) {
        if (isJsonRequest(req)) {
          return res.json({
            success: true,
            data: {
              totalUsers: 0,
              totalInstitutes: 0,
              activeSubscriptions: 0,
              activeTrials: 0,
              expiredSubscriptions: 0,
              totalRevenue: 0,
            },
            user: req.session.adminUser,
          });
        }
        return res.render('dashboard', {
          title: 'Executive Overview',
          totalUsers: 0,
          totalInstitutes: 0,
          activeSubscriptions: 0,
          activeTrials: 0,
          expiredSubscriptions: 0,
          totalRevenue: 0,
          user: req.session.adminUser,
        });
      }

      const db = getFirestore();
      const auth = getAuth();

      // Get count of registered Firebase users using Admin SDK
      const usersList = await auth.listUsers(100).catch(() => ({ users: [] }));
      const institutesSnap = await db.collection('institutes').get().catch(() => ({ size: 0, forEach: () => { } }));
      const subsSnap = await db.collection('subscriptions').get().catch(() => ({ size: 0, forEach: () => { } }));
      const paymentsSnap = await db.collection('subscription_payments').get().catch(() => ({ size: 0, forEach: () => { } }));

      let activeSubs = 0;
      let activeTrials = 0;
      let expiredSubs = 0;

      institutesSnap.forEach((doc) => {
        const s = doc.data()?.subscriptionStatus;
        if (s === 'active') activeSubs++;
        else if (s === 'trial') activeTrials++;
        else if (s === 'expired') expiredSubs++;
      });

      let totalRevenue = 0;
      paymentsSnap.forEach((doc) => {
        totalRevenue += Number(doc.data()?.amount || 0);
      });

      if (isJsonRequest(req)) {
        return res.json({
          success: true,
          data: {
            totalUsers: usersList.users.length,
            totalInstitutes: institutesSnap.size,
            activeSubscriptions: activeSubs,
            activeTrials,
            expiredSubscriptions: expiredSubs,
            totalRevenue,
          },
          user: req.session.adminUser,
        });
      }

      res.render('dashboard', {
        title: 'Executive Overview',
        totalUsers: usersList.users.length,
        totalInstitutes: institutesSnap.size,
        activeSubscriptions: activeSubs,
        activeTrials,
        expiredSubscriptions: expiredSubs,
        totalRevenue,
        user: req.session.adminUser,
      });
    } catch (e) {
      if (isJsonRequest(req)) {
        return res.status(500).json({ success: false, error: e.message });
      }
      res.render('dashboard', {
        title: 'Executive Overview',
        totalUsers: 0,
        totalInstitutes: 0,
        activeSubscriptions: 0,
        activeTrials: 0,
        expiredSubscriptions: 0,
        totalRevenue: 0,
        user: req.session.adminUser,
        error: e.message,
      });
    }
  }

  static async getInstitutes(req, res) {
    const search = (req.query.search || '').toLowerCase().trim();
    let connectionWarning = null;
    try {
      let institutes = [];
      try {
        const resp = await workerClient.listInstitutes(null, search);
        institutes = resp.data || [];
      } catch (workerErr) {
        // Fallback to direct Firestore Admin SDK only if credentials are configured
        if (hasDirectFirestoreAccess()) {
          try {
            const db = getFirestore();
            const snap = await db.collection('institutes').limit(50).get();
            snap.forEach((doc) => {
              const data = doc.data();
              data.id = doc.id;
              if (!search || data.name?.toLowerCase().includes(search) || data.email?.toLowerCase().includes(search) || doc.id.toLowerCase().includes(search)) {
                institutes.push(data);
              }
            });
          } catch (fsErr) {
            console.error('[Admin Dashboard] Direct Firestore query error:', fsErr.message);
            connectionWarning = `Firestore access error: ${fsErr.message}. Verify FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.`;
          }
        } else {
          connectionWarning = 'Firebase Admin credentials not found in .env. Configure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.';
        }
      }

      // Enrich institutes with academic footprint and license mirror (students, batches, license status)
      if (hasDirectFirestoreAccess() && institutes.length > 0) {
        try {
          const db = getFirestore();
          await Promise.all(
            institutes.map(async (inst) => {
              const instId = inst.id || inst._id;
              if (!inst.id) inst.id = instId;
              try {
                const [sSnap, bSnap, licSnap] = await Promise.all([
                  db.collection(`institutes/${instId}/students`).count().get().catch(() => null),
                  db.collection(`institutes/${instId}/batches`).count().get().catch(() => null),
                  db.doc(`institutes/${instId}/license/current`).get().catch(() => null),
                ]);
                if (sSnap) inst.studentsCount = sSnap.data().count;
                if (bSnap) inst.batchesCount = bSnap.data().count;
                if (licSnap && licSnap.exists) {
                  const lic = licSnap.data();
                  inst.licenseStatus = lic.status || inst.subscriptionStatus;
                  inst.validUntil = lic.validUntil || inst.validUntil;
                  inst.licenseKey = lic.licenseKey || inst.licenseKey;
                  if (lic.isTrial) inst.licenseStatus = 'trial';
                  if (lic.isLifetime) inst.isLifetime = true;
                  if (lic.planId) inst.planTier = lic.planId;
                }
              } catch {
                // Non-blocking
              }
            })
          );
        } catch {
          // Non-blocking
        }
      }

      if (isJsonRequest(req)) {
        return res.json({
          success: true,
          institutes,
          search,
          user: req.session.adminUser,
          connectionWarning,
        });
      }

      res.render('institutes', {
        title: 'Institute Directory & Management',
        institutes,
        search,
        user: req.session.adminUser,
        connectionWarning,
      });
    } catch (e) {
      if (isJsonRequest(req)) {
        return res.status(500).json({ success: false, error: e.message, institutes: [] });
      }
      res.render('institutes', {
        title: 'Institute Directory & Management',
        institutes: [],
        search,
        user: req.session.adminUser,
        error: e.message,
        connectionWarning: e.message,
      });
    }
  }

  static async getSubscriptions(req, res) {
    const statusFilter = req.query.status || 'all';
    try {
      let subscriptions = [];
      try {
        const resp = await workerClient.listSubscriptions(null, statusFilter);
        subscriptions = resp.data || [];
      } catch (workerErr) {
        // Fallback to direct Firestore Admin SDK only if credentials are configured
        if (hasDirectFirestoreAccess()) {
          try {
            const db = getFirestore();
            let query = db.collection('subscriptions');
            if (statusFilter !== 'all') {
              query = query.where('status', '==', statusFilter);
            }
            const snap = await query.limit(50).get();
            snap.forEach((doc) => {
              const d = doc.data();
              d.id = doc.id;
              subscriptions.push(d);
            });
          } catch {
            // Direct query failed gracefully
          }
        }
      }

      if (isJsonRequest(req)) {
        return res.json({
          success: true,
          subscriptions,
          statusFilter,
          user: req.session.adminUser,
        });
      }

      res.render('subscriptions', {
        title: 'Subscription Ledger',
        subscriptions,
        statusFilter,
        user: req.session.adminUser,
      });
    } catch (e) {
      if (isJsonRequest(req)) {
        return res.status(500).json({ success: false, error: e.message, subscriptions: [] });
      }
      res.render('subscriptions', {
        title: 'Subscription Ledger',
        subscriptions: [],
        statusFilter: 'all',
        user: req.session.adminUser,
        error: e.message,
      });
    }
  }

  static async getAuditLogs(req, res) {
    try {
      let logs = [];
      try {
        const resp = await workerClient.getAuditLogs(null);
        logs = resp.data || [];
      } catch (workerErr) {
        // Fallback to direct Firestore Admin SDK only if credentials are configured
        if (hasDirectFirestoreAccess()) {
          try {
            const db = getFirestore();
            const snap = await db.collection('subscription_audit_logs').limit(100).get();
            snap.forEach((doc) => {
              const d = doc.data();
              d.id = doc.id;
              logs.push(d);
            });
          } catch {
            // Direct query failed gracefully
          }
        }
      }

      if (isJsonRequest(req)) {
        return res.json({
          success: true,
          logs,
          user: req.session.adminUser,
        });
      }

      res.render('audit', {
        title: 'Security & Audit Logs',
        logs,
        user: req.session.adminUser,
      });
    } catch (e) {
      if (isJsonRequest(req)) {
        return res.status(500).json({ success: false, error: e.message, logs: [] });
      }
      res.render('audit', {
        title: 'Security & Audit Logs',
        logs: [],
        user: req.session.adminUser,
        error: e.message,
      });
    }
  }

  // Authoritative mutations routed exclusively through Cloudflare Worker (REG-IMPL-01)
  static async grantTrial(req, res) {
    const { instituteId, durationDays, reason } = req.body;
    try {
      if (!instituteId) {
        throw new Error('Institute ID is required');
      }
      await workerClient.grantTrial(instituteId, Number(durationDays), reason, null);
      if (isJsonRequest(req)) {
        return res.json({ success: true, message: 'Trial granted successfully' });
      }
      return res.redirect('/institutes?success=Trial+granted+successfully');
    } catch (e) {
      console.error('[AdminController] grantTrial error:', e.message);
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, error: 'Worker subscription API error: ' + e.message });
      }
      return res.redirect(`/institutes?error=${encodeURIComponent('Worker subscription API error: ' + e.message)}`);
    }
  }

  static async activatePlan(req, res) {
    const { instituteId, planTier, durationMonths, reason } = req.body;
    try {
      if (!instituteId) {
        throw new Error('Institute ID is required');
      }
      await workerClient.activatePlan(instituteId, planTier, Number(durationMonths), reason, null);
      if (isJsonRequest(req)) {
        return res.json({ success: true, message: 'Plan activated and synchronized successfully' });
      }
      return res.redirect('/institutes?success=Plan+activated+and+synchronized+successfully');
    } catch (e) {
      console.error('[AdminController] activatePlan error:', e.message);
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, error: 'Worker subscription API error: ' + e.message });
      }
      return res.redirect(`/institutes?error=${encodeURIComponent('Worker subscription API error: ' + e.message)}`);
    }
  }

  static async extendSubscription(req, res) {
    const { subscriptionId, days, reason } = req.body;
    try {
      if (!subscriptionId) {
        throw new Error('Subscription ID is required');
      }
      await workerClient.extendSubscription(subscriptionId, Number(days), reason, null);
      if (isJsonRequest(req)) {
        return res.json({ success: true, message: 'Subscription extended successfully' });
      }
      return res.redirect('/subscriptions?success=Subscription+extended+successfully');
    } catch (e) {
      console.error('[AdminController] extendSubscription error:', e.message);
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, error: 'Worker subscription API error: ' + e.message });
      }
      return res.redirect(`/subscriptions?error=${encodeURIComponent('Worker subscription API error: ' + e.message)}`);
    }
  }

  static async revokeSubscription(req, res) {
    const { instituteId, reason } = req.body;
    try {
      if (!instituteId) {
        throw new Error('Institute ID is required');
      }
      await workerClient.revokeSubscription(instituteId, reason, null);
      if (isJsonRequest(req)) {
        return res.json({ success: true, message: 'Subscription revoked successfully' });
      }
      return res.redirect('/institutes?success=Subscription+revoked+successfully');
    } catch (e) {
      console.error('[AdminController] revokeSubscription error:', e.message);
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, error: 'Worker subscription API error: ' + e.message });
      }
      return res.redirect(`/institutes?error=${encodeURIComponent('Worker subscription API error: ' + e.message)}`);
    }
  }

  static async getPlans(req, res) {
    try {
      let plans = [
        {
          id: 'core99',
          name: 'Core Plan',
          priceINR: 99,
          annualPriceINR: 948,
          durationDays: 30,
          features: [
            'Up to 150 Students',
            'Up to 10 Batches',
            'Up to 5 Staff Members',
            'Attendance & Fee Tracking',
            'Cloud Sync & Multi-Device Access',
            'Basic PDF Receipts'
          ]
        },
        {
          id: 'smart199',
          name: 'Smart Plan',
          priceINR: 199,
          annualPriceINR: 1908,
          durationDays: 30,
          features: [
            'Unlimited Students, Batches & Staff',
            'Full Academics Hub (Homework & Tests)',
            'Study Materials & Lesson Plans',
            'Automated WhatsApp Reports & Queue',
            'Graphical Performance PDF Reports',
            'Student ID Cards & Merit Certificates'
          ]
        }
      ];

      try {
        const resp = await workerClient.getPlans();
        if (resp && resp.success && Array.isArray(resp.plans)) {
          plans = resp.plans;
        }
      } catch {
        if (hasDirectFirestoreAccess()) {
          const db = getFirestore();
          const doc = await db.doc('system_config/plans').get();
          if (doc.exists && Array.isArray(doc.data().plans)) {
            plans = doc.data().plans;
          }
        }
      }

      if (isJsonRequest(req)) {
        return res.json({
          success: true,
          plans,
          user: req.session.adminUser,
        });
      }

      return res.render('plans', {
        title: 'Subscription Plans Management',
        plans,
        user: req.session.adminUser,
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        success: req.query.success,
        error: req.query.error,
      });
    } catch (e) {
      if (isJsonRequest(req)) {
        return res.status(500).json({ success: false, error: e.message, plans: [] });
      }
      return res.render('plans', {
        title: 'Subscription Plans Management',
        plans: [],
        user: req.session.adminUser,
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        error: e.message,
      });
    }
  }

  static async updatePlans(req, res) {
    try {
      const {
        corePrice, coreAnnualPrice, coreName,
        smartPrice, smartAnnualPrice, smartName,
      } = req.body;

      const pCore = Number(corePrice);
      const pCoreAnnual = Number(coreAnnualPrice);
      const pSmart = Number(smartPrice);
      const pSmartAnnual = Number(smartAnnualPrice);

      if (isNaN(pCore) || pCore < 1) {
        if (isJsonRequest(req)) {
          return res.status(400).json({ success: false, error: 'Core plan monthly price must be at least Rs 1' });
        }
        return res.redirect('/plans?error=Core+plan+monthly+price+must+be+at+least+Rs+1');
      }
      if (isNaN(pSmart) || pSmart < 1) {
        if (isJsonRequest(req)) {
          return res.status(400).json({ success: false, error: 'Smart plan monthly price must be at least Rs 1' });
        }
        return res.redirect('/plans?error=Smart+plan+monthly+price+must+be+at+least+Rs+1');
      }

      const updatedPlans = [
        {
          id: 'core99',
          name: coreName?.trim() || 'Core Plan',
          priceINR: Math.round(pCore),
          annualPriceINR: isNaN(pCoreAnnual) || pCoreAnnual < 1 ? Math.round(pCore * 12) : Math.round(pCoreAnnual),
          durationDays: 30,
          features: [
            'Up to 150 Students',
            'Up to 10 Batches',
            'Up to 5 Staff Members',
            'Attendance & Fee Tracking',
            'Cloud Sync & Multi-Device Access',
            'Basic PDF Receipts'
          ]
        },
        {
          id: 'smart199',
          name: smartName?.trim() || 'Smart Plan',
          priceINR: Math.round(pSmart),
          annualPriceINR: isNaN(pSmartAnnual) || pSmartAnnual < 1 ? Math.round(pSmart * 12) : Math.round(pSmartAnnual),
          durationDays: 30,
          features: [
            'Unlimited Students, Batches & Staff',
            'Full Academics Hub (Homework & Tests)',
            'Study Materials & Lesson Plans',
            'Automated WhatsApp Reports & Queue',
            'Graphical Performance PDF Reports',
            'Student ID Cards & Merit Certificates'
          ]
        }
      ];

      try {
        await workerClient.updatePlans(updatedPlans);
        if (isJsonRequest(req)) {
          return res.json({ success: true, message: 'Plans updated successfully' });
        }
        return res.redirect('/plans?success=Plans+updated+successfully!+New+prices+are+now+live+in+Flutter+and+Razorpay.');
      } catch (workerErr) {
        console.error('[AdminController] updatePlans error:', workerErr.message);
        if (isJsonRequest(req)) {
          return res.status(400).json({ success: false, error: 'Worker subscription API error: ' + workerErr.message });
        }
        return res.redirect(`/plans?error=${encodeURIComponent('Worker subscription API error: ' + workerErr.message)}`);
      }
    } catch (e) {
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, error: e.message });
      }
      return res.redirect(`/plans?error=${encodeURIComponent(e.message)}`);
    }
  }
}
