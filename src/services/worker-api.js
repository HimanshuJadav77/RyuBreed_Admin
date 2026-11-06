import { getAuth } from '../config/firebase.js';

export class WorkerApiClient {
  constructor() {
    this.baseUrl = (process.env.WORKER_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
  }

  async getAdminBearerToken(adminUid) {
    // Generate custom token or use session token
    // For server-to-server calls between Node.js dashboard and Cloudflare Worker:
    try {
      const adminId = adminUid || process.env.ADMIN_ID || process.env.ADMIN_UID || process.env.ADMIN_BOOTSTRAP_UID || 'node-admin';
      const customToken = await auth.createCustomToken(adminId);
      return customToken;
    } catch {
      return 'admin-server-token';
    }
  }

  async callWorker(endpoint, method = 'GET', body = null, token = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
    };

    if (process.env.ADMIN_API_KEY) {
      headers['X-Admin-Api-Key'] = process.env.ADMIN_API_KEY;
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const message = errorData.error?.message || `Worker API error (${res.status})`;
      throw new Error(message);
    }

    return res.json();
  }

  async getHealth() {
    return this.callWorker('/health');
  }

  async getAnalytics(token) {
    return this.callWorker('/admin/analytics', 'GET', null, token);
  }

  async listInstitutes(token, search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.callWorker(`/admin/institutes${query}`, 'GET', null, token);
  }

  async listSubscriptions(token, status) {
    const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return this.callWorker(`/admin/subscriptions${query}`, 'GET', null, token);
  }

  async getSubscription(subscriptionId, token) {
    return this.callWorker(`/admin/subscriptions/${subscriptionId}`, 'GET', null, token);
  }

  async getAuditLogs(token) {
    return this.callWorker('/admin/audit-logs', 'GET', null, token);
  }

  async grantTrial(instituteId, durationDays, reason, token, idempotencyKey) {
    const body = { instituteId, durationDays, reason };
    if (idempotencyKey) body.idempotencyKey = idempotencyKey;
    return this.callWorker('/admin/trials/grant', 'POST', body, token);
  }

  async extendSubscription(subscriptionId, days, reason, token, idempotencyKey) {
    const body = { subscriptionId, days, reason };
    if (idempotencyKey) body.idempotencyKey = idempotencyKey;
    return this.callWorker('/admin/subscriptions/extend', 'POST', body, token);
  }

  async revokeSubscription(instituteId, reason, token, idempotencyKey) {
    const body = { instituteId, reason };
    if (idempotencyKey) body.idempotencyKey = idempotencyKey;
    return this.callWorker('/admin/subscriptions/revoke', 'POST', body, token);
  }

  async getPlans(token) {
    return this.callWorker('/admin/plans', 'GET', null, token);
  }

  async updatePlans(plans, token) {
    return this.callWorker('/admin/plans', 'PUT', { plans }, token);
  }
}

