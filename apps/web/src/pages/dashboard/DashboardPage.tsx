import { useEffect, useState } from 'react';
import { TrendingUp, Users, Briefcase, Mail, Zap, Target, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspace.store';

/* ── Types ── */
interface Stats {
  leads: number;
  pipelineValue: number;
  emailsSent: number;
  activeDeals: number;
}

interface MonthlyPoint { month: string; value: number }

interface RecentLead {
  id: string;
  name: string;
  company_name: string | null;
  title: string | null;
  score: number;
  status: string;
}

/* ── Helpers ── */
function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function fmtCount(n: number) {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const statusBadge: Record<string, 'danger' | 'warning' | 'muted' | 'success'> = {
  hot: 'danger', warm: 'warning', cold: 'muted', qualified: 'success', new: 'muted', contacted: 'primary' as any,
};

/* ── Skeleton ── */
function StatSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-7 w-24 rounded bg-muted animate-pulse" />
            <div className="h-3 w-14 rounded bg-muted animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Component ── */
export function DashboardPage() {
  const { workspaceId, loading: wsLoading } = useWorkspaceStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<MonthlyPoint[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      setStatsLoading(true);
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      const [leadsRes, dealsRes, emailsRes, leadsListRes] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('deals').select('amount, created_at')
          .eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('email_logs').select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).eq('status', 'sent'),
        supabase.from('leads').select('id, first_name, last_name, company_name, title, score, status')
          .eq('workspace_id', workspaceId).is('deleted_at', null)
          .order('score', { ascending: false }).limit(5),
      ]);

      const deals = dealsRes.data ?? [];
      const openDeals = deals.filter(d => d.amount != null);
      const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

      // Build monthly chart from deals created this year
      const monthly: Record<number, number> = {};
      for (const d of deals) {
        if (!d.created_at) continue;
        const m = new Date(d.created_at).getMonth();
        monthly[m] = (monthly[m] || 0) + (Number(d.amount) || 0);
      }
      const points = Array.from({ length: now.getMonth() + 1 }, (_, i) => ({
        month: MONTH_LABELS[i],
        value: monthly[i] || 0,
      }));

      setStats({
        leads: leadsRes.count ?? 0,
        pipelineValue,
        emailsSent: emailsRes.count ?? 0,
        activeDeals: openDeals.length,
      });
      setChartData(points);
      setRecentLeads(
        (leadsListRes.data ?? []).map(l => ({
          ...l,
          name: `${l.first_name} ${l.last_name}`.trim() || '—',
        }))
      );
      setStatsLoading(false);
    }

    load();
  }, [workspaceId]);

  const loading = wsLoading || statsLoading;

  const STAT_CARDS = stats ? [
    {
      label: 'Total Leads',
      value: fmtCount(stats.leads),
      sub: `${stats.leads} contacts`,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Pipeline Value',
      value: fmt(stats.pipelineValue),
      sub: `${stats.activeDeals} open deals`,
      icon: Briefcase,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Emails Sent',
      value: fmtCount(stats.emailsSent),
      sub: 'via sequences',
      icon: Mail,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Active Deals',
      value: String(stats.activeDeals),
      sub: 'in pipeline',
      icon: TrendingUp,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ] : [];

  const hasChartData = chartData.some(p => p.value > 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Dashboard" description="Your AI-powered sales overview" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            : STAT_CARDS.map(({ label, value, sub, icon: Icon, color, bg }) => (
              <Card key={label} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold tracking-tight">{value}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          }
        </div>

        {/* Pipeline Chart + Activity */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pipeline Value</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Revenue trend this year</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {loading ? (
                <div className="h-44 rounded-lg bg-muted animate-pulse" />
              ) : !hasChartData ? (
                <div className="h-44 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Briefcase className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No deals yet — add your first deal to see the trend</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={176}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="pipelineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(234,89%,65%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(234,89%,65%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: number) => [`$${(v / 1000).toFixed(1)}k`, 'Pipeline']}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="hsl(234,89%,65%)" strokeWidth={2} fill="url(#pipelineGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                { icon: Users, label: 'Find Leads', desc: 'AI-powered lead discovery', href: '/leads', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { icon: Mail, label: 'Start Sequence', desc: 'AI-written email sequences', href: '/outreach', color: 'text-violet-500', bg: 'bg-violet-500/10' },
                { icon: Briefcase, label: 'Add Deal', desc: 'Track a new opportunity', href: '/deals', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { icon: Zap, label: 'New Proposal', desc: 'AI-generated proposals', href: '/proposals', color: 'text-amber-500', bg: 'bg-amber-500/10' },
              ].map(({ icon: Icon, label, desc, href, color, bg }) => (
                <a key={label} href={href}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/60 transition-colors cursor-pointer group">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-xxs text-muted-foreground">{desc}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Leads */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Top AI-Scored Leads</CardTitle>
            <a href="/leads" className="text-xs text-primary hover:underline">View all</a>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Users className="w-8 h-8 opacity-20" />
                <p className="text-sm">No leads yet — import from the Leads page</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xxs text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="text-left pb-2 font-medium">Contact</th>
                    <th className="text-left pb-2 font-medium">Company</th>
                    <th className="text-left pb-2 font-medium">Title</th>
                    <th className="text-left pb-2 font-medium">Score</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar fallback={(lead.name[0] || '?').toUpperCase()} size="sm" />
                          <span className="text-sm font-medium">{lead.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-sm text-muted-foreground">{lead.company_name || '—'}</td>
                      <td className="py-2.5 text-sm text-muted-foreground">{lead.title || '—'}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${lead.score}%` }} />
                          </div>
                          <span className="text-xs font-medium tabular-nums">{lead.score}</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Badge variant={statusBadge[lead.status] ?? 'muted'}>{lead.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
