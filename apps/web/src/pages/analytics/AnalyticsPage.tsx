import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIPELINE_DATA = [
  { month: 'Jan', won: 120000, lost: 45000 },
  { month: 'Feb', won: 180000, lost: 32000 },
  { month: 'Mar', won: 145000, lost: 58000 },
  { month: 'Apr', won: 240000, lost: 28000 },
  { month: 'May', won: 198000, lost: 41000 },
  { month: 'Jun', won: 320000, lost: 22000 },
];

const OUTREACH_DATA = [
  { day: 'Mon', sent: 420, replied: 142 },
  { day: 'Tue', sent: 380, replied: 118 },
  { day: 'Wed', sent: 510, replied: 189 },
  { day: 'Thu', sent: 295, replied: 98 },
  { day: 'Fri', sent: 460, replied: 165 },
];

const SOURCE_DATA = [
  { name: 'LinkedIn', value: 42, color: '#3b82f6' },
  { name: 'Apollo', value: 28, color: '#8b5cf6' },
  { name: 'CSV Import', value: 18, color: '#10b981' },
  { name: 'Enrichment', value: 12, color: '#f59e0b' },
];

const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

export function AnalyticsPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Analytics" description="Revenue and outreach performance" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Won vs Lost */}
          <Card>
            <CardHeader><CardTitle>Won vs Lost Revenue</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={PIPELINE_DATA}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${(v / 1000).toFixed(0)}k`]} />
                  <Bar dataKey="won" fill="hsl(152,69%,40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Lead Sources */}
          <Card>
            <CardHeader><CardTitle>Lead Sources</CardTitle></CardHeader>
            <CardContent className="pt-0 flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={SOURCE_DATA} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                    {SOURCE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {SOURCE_DATA.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-xs flex-1">{name}</span>
                    <span className="text-xs font-semibold">{value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outreach Performance */}
        <Card>
          <CardHeader><CardTitle>Outreach Performance (This Week)</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={OUTREACH_DATA}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(234,89%,65%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(234,89%,65%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="repliedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152,69%,40%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(152,69%,40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="sent" stroke="hsl(234,89%,65%)" strokeWidth={2} fill="url(#sentGrad)" name="Sent" />
                <Area type="monotone" dataKey="replied" stroke="hsl(152,69%,40%)" strokeWidth={2} fill="url(#repliedGrad)" name="Replied" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
