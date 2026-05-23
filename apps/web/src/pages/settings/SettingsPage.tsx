import { NavLink, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User, Building2, Bell, Key, CreditCard, Plug, Shield, Mail, Linkedin, Calendar, FileSignature, MessageSquare, Database, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useToast } from '@/components/ui/Toast';

const SETTINGS_NAV = [
  { icon: User, label: 'Profile', to: '/settings/profile' },
  { icon: Building2, label: 'Workspace', to: '/settings/workspace' },
  { icon: Plug, label: 'Integrations', to: '/settings/integrations' },
  { icon: Bell, label: 'Notifications', to: '/settings/notifications' },
  { icon: Key, label: 'API Keys', to: '/settings/api-keys' },
  { icon: CreditCard, label: 'Billing', to: '/settings/billing' },
  { icon: Shield, label: 'Security', to: '/settings/security' },
];

const INTEGRATIONS = [
  { name: 'Gmail', desc: 'Sync emails and send sequences', icon: Mail, color: 'text-red-500', bg: 'bg-red-500/10', connected: true },
  { name: 'LinkedIn', desc: 'Import leads and send InMails', icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-600/10', connected: false },
  { name: 'Cal.com', desc: 'Meeting booking and scheduling', icon: Calendar, color: 'text-teal-500', bg: 'bg-teal-500/10', connected: true },
  { name: 'OpenSign', desc: 'E-signature for contracts', icon: FileSignature, color: 'text-violet-500', bg: 'bg-violet-500/10', connected: false },
  { name: 'Slack', desc: 'Deal and task notifications', icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10', connected: false },
  { name: 'HubSpot', desc: 'Bidirectional CRM sync', icon: Database, color: 'text-orange-500', bg: 'bg-orange-500/10', connected: false },
];

function ProfileSettings() {
  const { user } = useAuthStore();
  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><label className="text-xs font-medium">Full Name</label><Input defaultValue={user?.user_metadata?.['name'] ?? ''} /></div>
          <div className="space-y-1"><label className="text-xs font-medium">Email</label><Input defaultValue={user?.email ?? ''} type="email" /></div>
        </div>
        <div className="space-y-1"><label className="text-xs font-medium">Job Title</label><Input placeholder="e.g. Head of Sales" /></div>
        <Button size="sm">Save changes</Button>
      </CardContent>
    </Card>
  );
}

function IntegrationsSettings() {
  const { session } = useAuthStore();
  const { workspaceId } = useWorkspaceStore();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gmailAccounts, setGmailAccounts] = useState<{ id: string; email: string; is_default: boolean }[]>([]);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  async function fetchAccounts() {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/email/accounts`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setGmailAccounts(d.accounts ?? []);
      }
    } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => { fetchAccounts(); }, [session?.access_token]);

  useEffect(() => {
    const gmailStatus = searchParams.get('gmail');
    if (gmailStatus === 'connected') {
      toast('Gmail connected successfully!', 'success');
      fetchAccounts();
    } else if (gmailStatus === 'error') {
      toast('Gmail connection failed. Try again.', 'error');
    } else if (gmailStatus === 'no_refresh_token') {
      toast('No refresh token received. Make sure to grant offline access.', 'error');
    }
    if (gmailStatus) {
      searchParams.delete('gmail');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  async function connectGmail() {
    if (!session?.access_token) return;
    setLoadingConnect(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/email/auth/google`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast('Failed to start Gmail OAuth', 'error');
      setLoadingConnect(false);
    }
  }

  async function disconnectAccount(id: string) {
    if (!session?.access_token) return;
    await fetch(`${import.meta.env.VITE_API_URL}/api/v1/email/accounts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    toast('Gmail disconnected', 'info');
    fetchAccounts();
  }

  const OTHER_INTEGRATIONS = [
    { name: 'LinkedIn', desc: 'Import leads and send InMails', icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-600/10' },
    { name: 'Cal.com', desc: 'Meeting booking and scheduling', icon: Calendar, color: 'text-teal-500', bg: 'bg-teal-500/10' },
    { name: 'OpenSign', desc: 'E-signature for contracts', icon: FileSignature, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { name: 'Slack', desc: 'Deal and task notifications', icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { name: 'HubSpot', desc: 'Bidirectional CRM sync', icon: Database, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Gmail - real connection */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Email</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loadingAccounts ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : gmailAccounts.length > 0 ? (
            <>
              {gmailAccounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {acc.email}
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </p>
                    <p className="text-xs text-muted-foreground">Gmail · Connected</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => disconnectAccount(acc.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Disconnect
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={connectGmail} disabled={loadingConnect}>
                {loadingConnect ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                Connect another Gmail
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Gmail</p>
                <p className="text-xs text-muted-foreground">Connect your Gmail to send outreach sequences from your own address</p>
              </div>
              <Button variant="primary" size="sm" onClick={connectGmail} disabled={loadingConnect}>
                {loadingConnect ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Connect Gmail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other integrations - coming soon */}
      <div className="space-y-2">
        {OTHER_INTEGRATIONS.map(({ name, desc, icon: Icon, color, bg }) => (
          <Card key={name}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Button variant="outline" size="sm" disabled>Coming soon</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Settings" />
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Nav */}
        <nav className="w-48 flex-shrink-0 border-r border-border p-3 space-y-0.5">
          {SETTINGS_NAV.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('sidebar-item', isActive && 'active')
              }
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="integrations" element={<IntegrationsSettings />} />
            <Route path="*" element={
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  This settings section is coming soon.
                </CardContent>
              </Card>
            } />
          </Routes>
        </div>
      </div>
    </div>
  );
}
