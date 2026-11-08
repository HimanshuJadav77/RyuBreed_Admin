import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import DashboardView from './views/DashboardView.jsx';
import InstitutesView from './views/InstitutesView.jsx';
import SubscriptionsView from './views/SubscriptionsView.jsx';
import PlansView from './views/PlansView.jsx';
import AuditView from './views/AuditView.jsx';
import LoginView from './views/LoginView.jsx';

export default function App() {
  const [session, setSession] = useState(null); // { authenticated, user, csrfToken, firebaseConfig }
  const [checkingSession, setCheckingSession] = useState(true);
  const getInitialTab = () => {
    const p = window.location.pathname.replace(/^\//, '').toLowerCase();
    if (['institutes', 'subscriptions', 'plans', 'audit'].includes(p)) {
      return p;
    }
    return 'dashboard';
  };

  const [currentTab, setCurrentTabState] = useState(getInitialTab);

  const setCurrentTab = (tab) => {
    setCurrentTabState(tab);
    const targetUrl = tab === 'dashboard' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/^\//, '').toLowerCase();
      setCurrentTabState(['institutes', 'subscriptions', 'plans', 'audit'].includes(p) ? p : 'dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workerHealthy, setWorkerHealthy] = useState(true);

  // Tab data states
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [dashboardData, setDashboardData] = useState(null);
  const [institutes, setInstitutes] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMsg || tabError) {
      const timer = setTimeout(() => {
        setSuccessMsg(null);
        setTabError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg, tabError]);

  // Fetch initial session
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/session', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch {
      // Offline or network error
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Load data for active tab
  const loadTabData = useCallback(async (tab = currentTab) => {
    setTabLoading(true);
    setTabError(null);
    try {
      if (tab === 'dashboard') {
        const res = await fetch('/api/', { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          setDashboardData(json.data || {});
        }
      } else if (tab === 'institutes') {
        const res = await fetch('/api/institutes', { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          setInstitutes(json.institutes || []);
        }
      } else if (tab === 'subscriptions') {
        const res = await fetch('/api/subscriptions', { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          setSubscriptions(json.subscriptions || []);
        }
      } else if (tab === 'plans') {
        const res = await fetch('/api/plans', { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          setPlans(json.plans || []);
        }
      } else if (tab === 'audit') {
        const res = await fetch('/api/audit', { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          setAuditLogs(json.logs || []);
        }
      }
    } catch (e) {
      setTabError('Failed to fetch data: ' + e.message);
    } finally {
      setTabLoading(false);
    }
  }, [currentTab]);

  useEffect(() => {
    if (session?.authenticated) {
      loadTabData(currentTab);
    }
  }, [session?.authenticated, currentTab, loadTabData]);

  // Handle Login via Firebase REST Auth -> /auth/login
  const handleLogin = async ({ email, password }) => {
    const apiKey = session?.firebaseConfig?.apiKey;
    if (!apiKey) {
      throw new Error('Firebase configuration not available. Please refresh.');
    }

    // Authenticate with Firebase REST API
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const fbRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    const fbData = await fbRes.json();
    if (!fbRes.ok || !fbData.idToken) {
      const msg = fbData.error?.message || 'Invalid email or password.';
      throw new Error(msg.replace(/_/g, ' '));
    }

    // Exchange ID token with session
    const csrfToken = session?.csrfToken;
    const loginRes = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        idToken: fbData.idToken,
        _csrf: csrfToken,
      }),
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(loginData.error || 'Authentication denied. You may lack administrative privileges.');
    }

    await checkSession();
    setCurrentTab('dashboard');
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/auth/logout');
    } finally {
      setSession(null);
      await checkSession();
    }
  };

  // Perform Mutation Action
  const handleAction = async (endpoint, payload) => {
    setTabError(null);
    setSuccessMsg(null);
    const csrfToken = session?.csrfToken;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        _csrf: csrfToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      const err = data.error || 'Operation failed.';
      setTabError(err);
      throw new Error(err);
    }

    setSuccessMsg(data.message || 'Operation executed successfully.');
    // Reload active tab data to refresh UI state immediately
    await loadTabData(currentTab);
    return data;
  };

  // Initial loading state
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-zinc-500 font-mono">Initializing console...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated view
  if (!session?.authenticated) {
    return (
      <LoginView
        onLogin={handleLogin}
        error={tabError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        user={session.user}
        onLogout={handleLogout}
        workerHealthy={workerHealthy}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Shell (Sidebar + Content) */}
      <div className="flex-1 flex w-full">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              onNavigate={setCurrentTab}
              onRefresh={() => loadTabData('dashboard')}
              loading={tabLoading}
            />
          )}

          {currentTab === 'institutes' && (
            <InstitutesView
              institutes={institutes}
              onRefresh={() => loadTabData('institutes')}
              onAction={handleAction}
              loading={tabLoading}
              error={tabError}
              successMsg={successMsg}
            />
          )}

          {currentTab === 'subscriptions' && (
            <SubscriptionsView
              subscriptions={subscriptions}
              onAction={handleAction}
              loading={tabLoading}
              error={tabError}
              successMsg={successMsg}
            />
          )}

          {currentTab === 'plans' && (
            <PlansView
              plans={plans}
              onAction={handleAction}
              loading={tabLoading}
              error={tabError}
              successMsg={successMsg}
            />
          )}

          {currentTab === 'audit' && (
            <AuditView
              logs={auditLogs}
              loading={tabLoading}
              error={tabError}
            />
          )}
        </main>
      </div>
    </div>
  );
}

