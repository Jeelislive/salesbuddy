import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LandingPage } from '@/pages/landing/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { CallbackPage } from '@/pages/auth/CallbackPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { LeadsPage } from '@/pages/leads/LeadsPage';
import { DealsPage } from '@/pages/deals/DealsPage';
import { OutreachPage } from '@/pages/outreach/OutreachPage';
import { ProposalsPage } from '@/pages/proposals/ProposalsPage';
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { AgentPage } from '@/pages/agents/AgentPage';
import { PrivacyPage } from '@/pages/legal/PrivacyPage';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { supabase } from '@/lib/supabase';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  const { setSession, user } = useAuthStore();
  const { initWorkspace, reset: resetWorkspace } = useWorkspaceStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) resetWorkspace();
    });

    return () => subscription.unsubscribe();
  }, [setSession, resetWorkspace]);

  // Init workspace once user is known
  useEffect(() => {
    if (!user) return;
    initWorkspace(
      user.id,
      user.user_metadata?.['name'] ?? '',
      user.email ?? '',
    );
  }, [user?.id, initWorkspace]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route path="/auth/callback" element={<CallbackPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/outreach" element={<OutreachPage />} />
        <Route path="/proposals" element={<ProposalsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/agent" element={<AgentPage />} />
      </Route>

      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
