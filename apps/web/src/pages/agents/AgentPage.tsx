import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Play, Pause, Square, Zap, Search, CheckCircle,
  XCircle, Clock, Loader2, RefreshCw, ChevronRight,
  Settings2, ListChecks, UserSearch, MailCheck, Users2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/Toast';

const API = import.meta.env.VITE_API_URL;

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'stopped';
  icp_query: string | null;
  target_sequence_id: string | null;
  leads_per_run: number;
  min_lead_score: number;
  can_find_leads: boolean;
  can_verify_emails: boolean;
  can_enroll_leads: boolean;
  last_run_at: string | null;
  created_at: string;
}

interface AgentLog {
  id: string;
  action: string;
  status: 'success' | 'failed' | 'skipped';
  summary: string;
  details: Record<string, any>;
  created_at: string;
}

interface Sequence { id: string; name: string }

const STATUS_CONFIG = {
  active:  { label: 'Active',  color: 'success' as const, icon: Play },
  paused:  { label: 'Paused',  color: 'warning' as const, icon: Pause },
  stopped: { label: 'Stopped', color: 'muted'   as const, icon: Square },
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  find_leads:    <UserSearch className="w-4 h-4 text-blue-500" />,
  verify_emails: <MailCheck  className="w-4 h-4 text-purple-500" />,
  enroll_leads:  <Users2     className="w-4 h-4 text-green-500" />,
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0 }}
        className={`relative transition-colors focus:outline-none ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'transform 0.15s',
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

function StatusIcon({ status }: { status: 'success' | 'failed' | 'skipped' }) {
  if (status === 'success') return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
  if (status === 'failed')  return <XCircle     className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AgentPage() {
  const { workspaceId } = useWorkspaceStore();
  const { session } = useAuthStore();
  const { toast } = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state mirrors agent config
  const [form, setForm] = useState({
    name: 'AI Sales Agent',
    icp_query: '',
    target_sequence_id: '',
    leads_per_run: 10,
    min_lead_score: 0,
    can_find_leads: true,
    can_verify_emails: true,
    can_enroll_leads: false,
  });

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session]);

  const loadSequences = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from('sequences')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    setSequences(data ?? []);
  }, [workspaceId]);

  const loadLogs = useCallback(async (agentId: string) => {
    const res = await fetch(`${API}/api/v1/agents/${agentId}/logs`, { headers: headers() });
    if (res.ok) setLogs(await res.json());
  }, [headers]);

  const loadAgent = useCallback(async () => {
    if (!workspaceId || !session) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/agents`, { headers: headers() });
      if (!res.ok) throw new Error();
      const list: Agent[] = await res.json();
      if (list.length > 0) {
        const a = list[0];
        setAgent(a);
        setForm({
          name: a.name,
          icp_query: a.icp_query ?? '',
          target_sequence_id: a.target_sequence_id ?? '',
          leads_per_run: a.leads_per_run,
          min_lead_score: a.min_lead_score,
          can_find_leads: a.can_find_leads,
          can_verify_emails: a.can_verify_emails,
          can_enroll_leads: a.can_enroll_leads,
        });
        await loadLogs(a.id);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, session, headers, loadLogs]);

  useEffect(() => {
    loadSequences();
    loadAgent();
  }, [loadAgent, loadSequences]);

  async function createAgent() {
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/v1/agents`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: 'AI Sales Agent' }),
      });
      if (!res.ok) throw new Error();
      await loadAgent();
      toast('Agent created', 'success');
    } catch {
      toast('Failed to create agent', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function saveAgent() {
    if (!agent) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/agents/${agent.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          ...form,
          icp_query: form.icp_query || null,
          target_sequence_id: form.target_sequence_id || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAgent(updated);
      toast('Agent saved', 'success');
    } catch {
      toast('Failed to save agent', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: 'active' | 'paused' | 'stopped') {
    if (!agent) return;
    const res = await fetch(`${API}/api/v1/agents/${agent.id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAgent(updated);
      toast(`Agent ${status}`, 'success');
    }
  }

  async function runNow() {
    if (!agent) return;
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/v1/agents/${agent.id}/run`, {
        method: 'POST',
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Run failed', 'error'); return; }
      toast('Agent run started', 'success');
      setTimeout(() => loadLogs(agent.id), 3000);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 flex flex-col">
        <PageHeader title="AI Agent" description="Autonomous sales automation" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">No agent yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Create your AI sales agent to automatically find leads, verify emails, and enroll them in sequences.
            </p>
          </div>
          <Button onClick={createAgent} loading={creating}>
            <Bot className="w-4 h-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[agent.status];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="AI Agent"
        description={agent.last_run_at ? `Last run ${timeAgo(agent.last_run_at)}` : 'Never run'}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={statusCfg.color}>{statusCfg.label}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadLogs(agent.id)}
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={runNow}
              loading={running}
              disabled={agent.status === 'stopped'}
              title={agent.status === 'stopped' ? 'Set agent to active first' : 'Run agent now'}
            >
              <Zap className="w-4 h-4 mr-1.5" />
              Run Now
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Config card ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Configuration</h3>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent Name</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="AI Sales Agent"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    ICP Query <span className="text-muted-foreground/60">(who to find)</span>
                  </label>
                  <Input
                    value={form.icp_query}
                    onChange={e => setForm(f => ({ ...f, icp_query: e.target.value }))}
                    placeholder="e.g. senior Python developers open source"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Target Sequence</label>
                  <select
                    value={form.target_sequence_id}
                    onChange={e => setForm(f => ({ ...f, target_sequence_id: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— None —</option>
                    {sequences.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Leads per run</label>
                    <Input
                      type="number"
                      min={1} max={50}
                      value={form.leads_per_run}
                      onChange={e => setForm(f => ({ ...f, leads_per_run: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Min lead score</label>
                    <Input
                      type="number"
                      min={0} max={100}
                      value={form.min_lead_score}
                      onChange={e => setForm(f => ({ ...f, min_lead_score: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button size="sm" onClick={saveAgent} loading={saving}>
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Permissions ───────────────────────────────────── */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <ListChecks className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Permissions</h3>
                </div>
                <Toggle
                  label="Find new leads from GitHub"
                  checked={form.can_find_leads}
                  onChange={v => setForm(f => ({ ...f, can_find_leads: v }))}
                />
                <Toggle
                  label="Verify lead emails"
                  checked={form.can_verify_emails}
                  onChange={v => setForm(f => ({ ...f, can_verify_emails: v }))}
                />
                <Toggle
                  label="Auto-enroll leads into sequence"
                  checked={form.can_enroll_leads}
                  onChange={v => setForm(f => ({ ...f, can_enroll_leads: v }))}
                />
                <div className="flex justify-end pt-1">
                  <Button size="sm" onClick={saveAgent} loading={saving}>
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Status controls ───────────────────────────────── */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Status</h3>
                </div>
                <div className="space-y-2">
                  {(['active', 'paused', 'stopped'] as const).map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const Icon = cfg.icon;
                    const isActive = agent.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm transition-colors ${
                          isActive
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1 text-left">{cfg.label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {agent.status === 'active'
                    ? 'Agent runs automatically on schedule.'
                    : agent.status === 'paused'
                    ? 'Agent is paused — manual run still works.'
                    : 'Agent is stopped — no runs will execute.'}
                </p>
              </CardContent>
            </Card>

            {/* ── Stats ─────────────────────────────────────────── */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
                {['find_leads', 'verify_emails', 'enroll_leads'].map(action => {
                  const recent = logs.filter(l => l.action === action);
                  const last = recent[0];
                  return (
                    <div key={action} className="flex items-center gap-2">
                      {ACTION_ICON[action]}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground capitalize">
                          {action.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {last ? last.summary : 'No runs yet'}
                        </p>
                      </div>
                      {last && (
                        <span className="text-xxs text-muted-foreground flex-shrink-0">
                          {timeAgo(last.created_at)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Activity Log ──────────────────────────────────────── */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Activity Log</h3>
              <span className="text-xs text-muted-foreground ml-auto">{logs.length} entries</span>
            </div>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No activity yet — run the agent to see logs here.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <div className="mt-0.5">{ACTION_ICON[log.action] ?? <Bot className="w-4 h-4 text-muted-foreground" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={log.status} />
                        <span className="text-sm text-foreground">{log.summary}</span>
                      </div>
                      {Object.keys(log.details ?? {}).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                      {timeAgo(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
