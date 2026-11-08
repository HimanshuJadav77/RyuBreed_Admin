import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdminController } from '../controllers/admin-controller.js';
import { requireAdminSession } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distHtml = path.resolve(__dirname, '../../public/dist/index.html');

const router = Router();

router.use(requireAdminSession);

function serveReactOrApi(apiHandler) {
  return (req, res, next) => {
    if (req.xhr || req.headers?.accept?.includes('application/json') || req.baseUrl?.startsWith('/api')) {
      return apiHandler(req, res, next);
    }
    return res.sendFile(distHtml);
  };
}

router.get('/', serveReactOrApi(AdminController.getDashboard));
router.get('/institutes', serveReactOrApi(AdminController.getInstitutes));
router.get('/subscriptions', serveReactOrApi(AdminController.getSubscriptions));
router.get('/audit', serveReactOrApi(AdminController.getAuditLogs));
router.get('/plans', serveReactOrApi(AdminController.getPlans));

// Subscription mutation actions -> Handed off to Worker API / Firebase Admin
router.post('/trials/grant', AdminController.grantTrial);
router.post('/plans/activate', AdminController.activatePlan);
router.post('/plans/update', AdminController.updatePlans);
router.post('/subscriptions/extend', AdminController.extendSubscription);
router.post('/subscriptions/revoke', AdminController.revokeSubscription);

export default router;

