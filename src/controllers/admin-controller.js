import { getFirestore, getAuth, admin } from '../config/firebase.js';
import { WorkerApiClient } from '../services/worker-api.js';

const workerClient = new WorkerApiClient();

function hasDirectFirestoreAccess() {
  return Boolean(
    process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
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
      const institutesSnap = await db.collection('institutes').get().catch(() => ({ size: 0, forEach: () => {} }));
      const subsSnap = await db.collection('subscriptions').get().catch(() => ({ size: 0, forEach: () => {} }));
      const paymentsSnap = await db.collection('subscription_payments').get().catch(() => ({ size: 0, forEach: () => {} }));

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

      res.render('institutes', {
        title: 'Institute Directory & Management',
        institutes,
        search,
        user: req.session.adminUser,
        connectionWarning,
      });
    } catch (e) {
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

      res.render('subscriptions', {
        title: 'Subscription Ledger',
        subscriptions,
        statusFilter,
        user: req.session.adminUser,
      });
    } catch (e) {
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

      res.render('audit', {
        title: 'Security & Audit Logs',
        logs,
        user: req.session.adminUser,
      });
    } catch (e) {
      res.render('audit', {
        title: 'Security & Audit Logs',
        logs: [],
        user: req.session.adminUser,
        error: e.message,
      });
    }
  }

  // Mutations with direct Firebase Admin SDK execution
  static async grantTrial(req, res) {
    const { instituteId, durationDays, reason } = req.body;
    try {
      try {
        await workerClient.grantTrial(instituteId, Number(durationDays), reason, null);
        return res.redirect('/institutes?success=Trial+granted+successfully');
      } catch (workerErr) {
        // Direct Firebase Admin SDK mutation
        const db = getFirestore();
        const days = Number(durationDays) || 7;
        const startAt = new Date();
        const endAt = new Date(startAt.getTime() + Math.round(days * 86400000));
        const durationText = days < 1 ? `${Math.round(days * 24)} hour(s)` : `${days} day(s)`;
        const licenseKey = `LIC-TRIAL-${instituteId.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const adminUid = req.session?.adminUser?.uid || 'admin';

        const batch = db.batch();
        batch.set(db.doc(`subscription_trials/${instituteId}`), {
          trialId: `trial_${Date.now()}`,
          instituteId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          durationDays: days,
          licenseKey,
          grantedBy: adminUid,
          reason: reason || `Admin granted ${durationText} trial`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        batch.set(db.doc(`institutes/${instituteId}`), {
          subscriptionStatus: 'trial',
          trialUsed: true,
          trialStartedAt: startAt.toISOString(),
          trialEndsAt: endAt.toISOString(),
          licenseKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        batch.set(db.doc(`institutes/${instituteId}/license/current`), {
          licenseKey,
          planId: 'smart199',
          status: 'active',
          isTrial: true,
          activatedAt: startAt.toISOString(),
          validUntil: endAt.toISOString(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        batch.set(db.doc(`subscription_audit_logs/log_${Date.now()}`), {
          action: 'ADMIN_TRIAL_GRANTED',
          instituteId,
          performedBy: adminUid,
          newValue: 'trial',
          reason: reason || `Admin trial granted for ${days} days`,
          timestamp: new Date().toISOString(),
        });

        await batch.commit();
        return res.redirect('/institutes?success=Trial+granted+successfully');
      }
    } catch (e) {
      res.redirect(`/institutes?error=${encodeURIComponent(e.message)}`);
    }
  }

  static async activatePlan(req, res) {
    const { instituteId, planTier, durationMonths, reason } = req.body;
    try {
      if (!instituteId) {
        throw new Error('Institute ID is required');
      }

      const isLifetime = planTier === 'lifetime';
      const actualPlanTier = isLifetime ? 'smart199' : (planTier || 'smart199');
      const months = isLifetime ? 1200 : (Number(durationMonths) || 12);
      const startAt = new Date();
      const validUntil = isLifetime
        ? new Date('2099-12-31T23:59:59.000Z')
        : new Date(startAt.getTime() + months * 30 * 86400000);

      const licenseKey = `LIC-${isLifetime ? 'LIFE' : actualPlanTier.toUpperCase()}-${instituteId.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const adminUid = req.session?.adminUser?.uid || 'admin';

      const db = getFirestore();
      const batch = db.batch();

      batch.set(db.doc(`institutes/${instituteId}`), {
        subscriptionStatus: 'active',
        plan: actualPlanTier,
        planTier: actualPlanTier,
        isLifetime,
        isSubscribed: true,
        licenseKey,
        expiryDate: validUntil.toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      batch.set(db.doc(`institutes/${instituteId}/license/current`), {
        licenseKey,
        planId: actualPlanTier,
        status: 'active',
        isTrial: false,
        isLifetime,
        activatedAt: startAt.toISOString(),
        validUntil: validUntil.toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      batch.set(db.doc(`subscriptions/${instituteId}`), {
        instituteId,
        planId: actualPlanTier,
        planName: isLifetime ? 'Lifetime Access' : (actualPlanTier === 'core99' ? 'Core Plan (₹99)' : 'Smart Plan (₹199)'),
        status: 'active',
        licenseKey,
        isLifetime,
        amount: isLifetime ? 4999 : (actualPlanTier === 'core99' ? 99 * months : 199 * months),
        startAt: startAt.toISOString(),
        endAt: validUntil.toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      batch.set(db.doc(`subscription_audit_logs/log_${Date.now()}`), {
        action: 'ADMIN_PLAN_ACTIVATED',
        instituteId,
        planTier: actualPlanTier,
        isLifetime,
        performedBy: adminUid,
        reason: reason || `Admin activated ${isLifetime ? 'Lifetime' : actualPlanTier} plan`,
        timestamp: new Date().toISOString(),
      });

      await batch.commit();
      return res.redirect('/institutes?success=Plan+activated+and+synchronized+successfully');
    } catch (e) {
      res.redirect(`/institutes?error=${encodeURIComponent(e.message)}`);
    }
  }

  static async extendSubscription(req, res) {
    const { subscriptionId, days, reason } = req.body;
    try {
      try {
        await workerClient.extendSubscription(subscriptionId, Number(days), reason, null);
        return res.redirect('/subscriptions?success=Subscription+extended+successfully');
      } catch (workerErr) {
        const db = getFirestore();
        const subDoc = await db.doc(`subscriptions/${subscriptionId}`).get();
        if (!subDoc.exists) {
          throw new Error(`Subscription ${subscriptionId} not found`);
        }
        const sub = subDoc.data();
        const numDays = Number(days) || 30;
        const now = new Date();
        const currentEnd = sub.endAt ? new Date(sub.endAt) : now;
        const baseDate = currentEnd.getTime() > now.getTime() ? currentEnd : now;
        const newEnd = new Date(baseDate.getTime() + numDays * 86400000);
        const adminUid = req.session?.adminUser?.uid || 'admin';

        const batch = db.batch();
        batch.set(db.doc(`subscriptions/${subscriptionId}`), {
          endAt: newEnd.toISOString(),
          status: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        if (sub.instituteId) {
          batch.set(db.doc(`institutes/${sub.instituteId}`), {
            subscriptionStatus: 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          batch.set(db.doc(`institutes/${sub.instituteId}/license/current`), {
            status: 'active',
            validUntil: newEnd.toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        batch.set(db.doc(`subscription_audit_logs/log_${Date.now()}`), {
          action: 'ADMIN_SUBSCRIPTION_EXTENDED',
          subscriptionId,
          instituteId: sub.instituteId || 'unknown',
          performedBy: adminUid,
          oldValue: sub.endAt || 'none',
          newValue: newEnd.toISOString(),
          reason: reason || `Extended by ${numDays} days`,
          timestamp: new Date().toISOString(),
        });

        await batch.commit();
        return res.redirect('/subscriptions?success=Subscription+extended+successfully');
      }
    } catch (e) {
      res.redirect(`/subscriptions?error=${encodeURIComponent(e.message)}`);
    }
  }

  static async revokeSubscription(req, res) {
    const { instituteId, reason } = req.body;
    try {
      try {
        await workerClient.revokeSubscription(instituteId, reason, null);
        return res.redirect('/institutes?success=Subscription+revoked+successfully');
      } catch (workerErr) {
        const db = getFirestore();
        const adminUid = req.session?.adminUser?.uid || 'admin';

        const batch = db.batch();
        batch.set(db.doc(`institutes/${instituteId}`), {
          subscriptionStatus: 'revoked',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        batch.set(db.doc(`institutes/${instituteId}/license/current`), {
          status: 'revoked',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        batch.set(db.doc(`subscription_audit_logs/log_${Date.now()}`), {
          action: 'ADMIN_SUBSCRIPTION_REVOKED',
          instituteId,
          performedBy: adminUid,
          reason: reason || 'Revoked by administrator',
          timestamp: new Date().toISOString(),
        });

        await batch.commit();
        return res.redirect('/institutes?success=Subscription+revoked+successfully');
      }
    } catch (e) {
      res.redirect(`/institutes?error=${encodeURIComponent(e.message)}`);
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

      return res.render('plans', {
        title: 'Subscription Plans Management',
        plans,
        user: req.session.adminUser,
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        success: req.query.success,
        error: req.query.error,
      });
    } catch (e) {
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
        return res.redirect('/plans?error=Core+plan+monthly+price+must+be+at+least+Rs+1');
      }
      if (isNaN(pSmart) || pSmart < 1) {
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
        return res.redirect('/plans?success=Plans+updated+successfully!+New+prices+are+now+live+in+Flutter+and+Razorpay.');
      } catch (workerErr) {
        if (hasDirectFirestoreAccess()) {
          const db = getFirestore();
          const adminUid = req.session?.adminUser?.uid || 'admin';
          await db.doc('system_config/plans').set({
            plans: updatedPlans,
            updatedAt: new Date().toISOString(),
            updatedBy: adminUid,
          });
          await db.collection('subscription_audit_logs').add({
            action: 'PLANS_UPDATED',
            adminUid,
            plans: updatedPlans,
            timestamp: new Date().toISOString(),
          });
          return res.redirect('/plans?success=Plans+updated+successfully!+New+prices+are+now+live+in+Flutter+and+Razorpay.');
        }
        throw workerErr;
      }
    } catch (e) {
      return res.redirect(`/plans?error=${encodeURIComponent(e.message)}`);
    }
  }
}
