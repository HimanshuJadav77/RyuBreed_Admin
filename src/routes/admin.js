import { Router } from 'express';
import { AdminController } from '../controllers/admin-controller.js';
import { requireAdminSession } from '../middleware/auth.js';

const router = Router();

router.use(requireAdminSession);

router.get('/', AdminController.getDashboard);
router.get('/institutes', AdminController.getInstitutes);
router.get('/subscriptions', AdminController.getSubscriptions);
router.get('/audit', AdminController.getAuditLogs);

// Subscription mutation actions -> Handed off to Worker API / Firebase Admin
router.post('/trials/grant', AdminController.grantTrial);
router.post('/plans/activate', AdminController.activatePlan);
router.post('/subscriptions/extend', AdminController.extendSubscription);
router.post('/subscriptions/revoke', AdminController.revokeSubscription);

export default router;

