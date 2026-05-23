import { useEffect, useState } from 'react';
import { Users, Mail, Zap, ListChecks, Send } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';

/* ── Types ── */
interface Overview {
  total_leads: number;
  emails_sent: number;
  emails_sent_today: number;
  active_sequences: number;
  total_enrolled: number;
}

interface LeadSource { source: string; count: number }
interface EmailDay { date: string; sent: number; failed: number }
interface SequenceRow { id: string; name: string; status: string; enrolled: number; completed: number }

interface Summary {
  overview: Overview;
  lead_sources: LeadSource[];
  email_activity: EmailDay[];
  sequences: SequenceRow[];
}

/* ── Colors ── */
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

/* ── Skeleton ── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-muted animate-pulse ${className}`} />;
}

/* ── Component ── */
export function AnalyticsPage() {
  const { session } = useAuthStore();
  const { workspaceId } = useWorkspaceStore();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !session?.access_token) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/v1/analytics/summary', {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [workspaceId, session?.access_token]);

  const ov = data?.overview;

  const STAT_CARDS = ov ? [
    { label: 'Total Leads', value: ov.total_leads, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Emails Sent', value: ov.emails_sent, icon: Mail, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: 'Sent Today', value: ov.emails_sent_today, icon: Send, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Active Sequences', value: ov.active_sequences, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Total Enrolled', value: ov.total_enrolled, icon: ListChecks, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ] : [];

  const totalSources = (data?.lead_sources ?? []).reduce((s, l) => s + l.count, 0);

  const statusBadge: Record<string, 'success' | 'warning' | 'muted'> = {
    active: 'success', paused: 'warning', draft: 'muted', archived: 'muted',
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Analytics" description="Real-time outreach & lead performance" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-5 gap-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
              ))
            : STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                      </div>
                      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Email Activity */}
          <Card className="col-span-2">
            <CardHeader><CardTitle>Email Activity — Last 14 Days</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <Skeleton className="h-48" />
              ) : (data?.email_activity ?? []).every(d => d.sent === 0 && d.failed === 0) ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Mail className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No emails sent in the last 14 days</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={data?.email_activity}>
                    <defs>
                      <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(234,89%,65%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(234,89%,65%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="sent" stroke="hsl(234,89%,65%)" strokeWidth={2} fill="url(#sentGrad)" name="Sent" />
                    <Area type="monotone" dataKey="failed" stroke="hsl(0,72%,51%)" strokeWidth={2} fill="url(#failGrad)" name="Failed" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Lead Sources */}
          <Card>
            <CardHeader><CardTitle>Lead Sources</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <Skeleton className="h-48" />
              ) : totalSources === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Users className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No leads yet</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={data?.lead_sources} dataKey="count" cx="50%" cy="50%" innerRadius={38} outerRadius={60}>
                        {(data?.lead_sources ?? []).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-1.5">
                    {(data?.lead_sources ?? []).map(({ source, count }, i) => (
                      <div key={source} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 truncate">{source}</span>
                        <span className="font-semibold tabular-nums">{count}</span>
                        <span className="text-muted-foreground">({Math.round(count / totalSources * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sequence Performance */}
        <Card>
          <CardHeader><CardTitle>Sequence Performance</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (data?.sequences ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Zap className="w-8 h-8 opacity-20" />
                <p className="text-sm">No sequences yet — create one in Outreach</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xxs text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="text-left pb-2 font-medium">Sequence</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-right pb-2 font-medium">Enrolled</th>
                    <th className="text-right pb-2 font-medium">Completed</th>
                    <th className="text-right pb-2 font-medium">Completion %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.sequences ?? []).map((s) => {
                    const pct = s.enrolled > 0 ? Math.round(s.completed / s.enrolled * 100) : 0;
                    return (
                      <tr key={s.id} className="hover:bg-accent/50 transition-colors">
                        <td className="py-2.5 text-sm font-medium">{s.name}</td>
                        <td className="py-2.5">
                          <Badge variant={statusBadge[s.status] ?? 'muted'}>{s.status}</Badge>
                        </td>
                        <td className="py-2.5 text-sm text-right tabular-nums">{s.enrolled}</td>
                        <td className="py-2.5 text-sm text-right tabular-nums">{s.completed}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums w-8">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
