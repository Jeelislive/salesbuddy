import { Link } from 'react-router-dom';
import {
  ArrowRight, Zap, Mail, Linkedin, Database,
  BarChart2, Target, Users, Calendar, CheckCircle,
  ChevronRight, Star, Play, TrendingUp, Shield,
  Sparkles, Globe, Lock, Activity, FileSignature,
  Building2, Search, Filter, MessageSquare, Cpu,
  PieChart, SlidersHorizontal, Layers,
  GitBranch, Radar, Send, BrainCircuit, Workflow,
  LayoutDashboard, Briefcase, FileText, Settings,
  Flame, Gauge, Network, Sun, Moon,
} from 'lucide-react';
import { useThemeStore } from '@/store/theme.store';

const COMPANY_COLORS: Record<string, { bg: string; text: string; icon: typeof Building2 }> = {
  Anthropic: { bg: 'bg-orange-100 dark:bg-orange-950/40',  text: 'text-orange-600 dark:text-orange-400',  icon: BrainCircuit },
  Notion:    { bg: 'bg-gray-100 dark:bg-gray-800/50',      text: 'text-gray-600 dark:text-gray-400',      icon: Layers },
  Vercel:    { bg: 'bg-gray-800 dark:bg-gray-700',         text: 'text-white',                            icon: GitBranch },
  Linear:    { bg: 'bg-violet-100 dark:bg-violet-950/40',  text: 'text-violet-600 dark:text-violet-400',  icon: Activity },
  Figma:     { bg: 'bg-pink-100 dark:bg-pink-950/40',      text: 'text-pink-600 dark:text-pink-400',      icon: PieChart },
  Stripe:    { bg: 'bg-blue-100 dark:bg-blue-950/40',      text: 'text-blue-600 dark:text-blue-400',      icon: Cpu },
  GitHub:    { bg: 'bg-slate-100 dark:bg-slate-800/50',    text: 'text-slate-700 dark:text-slate-400',    icon: GitBranch },
  Loom:      { bg: 'bg-purple-100 dark:bg-purple-950/40',  text: 'text-purple-600 dark:text-purple-400',  icon: Play },
};

const COMPANIES = [
  { name: 'Anthropic', domain: 'anthropic.com', owner: 'AK', ownerColor: 'bg-orange-100 text-orange-700', icp: true,  arr: '$840K',  industry: 'AI / Research',  employees: '450',   status: 'hot',  score: 94 },
  { name: 'Notion',    domain: 'notion.so',     owner: 'SC', ownerColor: 'bg-gray-100 text-gray-700',    icp: true,  arr: '$360K',  industry: 'Productivity',   employees: '700',   status: 'warm', score: 83 },
  { name: 'Vercel',    domain: 'vercel.com',    owner: 'JK', ownerColor: 'bg-indigo-100 text-indigo-700',icp: true,  arr: '$1.2M',  industry: 'Dev Tools',      employees: '500',   status: 'hot',  score: 91 },
  { name: 'Linear',    domain: 'linear.app',    owner: 'MJ', ownerColor: 'bg-violet-100 text-violet-700',icp: false, arr: '$180K',  industry: 'SaaS',           employees: '80',    status: 'warm', score: 72 },
  { name: 'Figma',     domain: 'figma.com',     owner: 'PP', ownerColor: 'bg-pink-100 text-pink-700',    icp: true,  arr: '$480K',  industry: 'Design',         employees: '1,200', status: 'cold', score: 58 },
  { name: 'Stripe',    domain: 'stripe.com',    owner: 'TS', ownerColor: 'bg-blue-100 text-blue-700',    icp: true,  arr: '$2.4M',  industry: 'Fintech',        employees: '8,000', status: 'hot',  score: 97 },
  { name: 'GitHub',    domain: 'github.com',    owner: 'AK', ownerColor: 'bg-slate-100 text-slate-700',  icp: false, arr: '$960K',  industry: 'Dev Tools',      employees: '3,000', status: 'cold', score: 61 },
  { name: 'Loom',      domain: 'loom.com',      owner: 'CW', ownerColor: 'bg-purple-100 text-purple-700',icp: true,  arr: '$240K',  industry: 'Video / Async',  employees: '300',   status: 'warm', score: 79 },
];

const STATUS_STYLES: Record<string, string> = {
  hot:  'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-900/40',
  warm: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-900/40',
  cold: 'bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-800/40',
};
const STATUS_DOT: Record<string, string> = {
  hot: 'bg-red-400', warm: 'bg-amber-400', cold: 'bg-slate-400 dark:bg-slate-600',
};

const TICKER_COMPANIES = [
  'Anthropic','Notion','Vercel','Linear','Figma',
  'Stripe','GitHub','Loom','Intercom','Retool',
  'Airtable','Coda','Segment','Mixpanel','Amplitude',
];

const STATS = [
  { value: '250M+', label: 'Verified B2B contacts',    sub: 'across 50+ countries',      icon: Database },
  { value: '10×',   label: 'More pipeline generated',  sub: 'vs. manual outreach',       icon: TrendingUp },
  { value: '34%',   label: 'Average reply rate',       sub: 'industry avg is 8%',        icon: MessageSquare },
  { value: '$0',    label: 'SDR salary cost',          sub: 'Buddy works 24/7 for free', icon: Gauge },
];

const HOW_STEPS = [
  {
    n: '01', icon: Radar,
    title: 'Finds and prioritizes high-intent leads',
    desc: 'Search 250M+ verified B2B contacts or import from your CRM. Buddy enriches every prospect using 22+ data sources - firmographics, technographics, intent signals, funding rounds, and leadership changes - then ranks them by likelihood to convert right now.',
    tags: ['Intent signals', 'Funding data', 'Technographics', 'Job change alerts'],
  },
  {
    n: '02', icon: Send,
    title: 'Launches personalized multi-channel sequences',
    desc: 'Buddy writes hyper-personalized outreach using Claude AI - referencing the prospect\'s recent blog post, LinkedIn activity, or company news. Sequences run across email, LinkedIn, and phone. Every message feels hand-crafted, every send is perfectly timed.',
    tags: ['Email sequences', 'LinkedIn outreach', 'Native dialer', 'Send-time optimization'],
  },
  {
    n: '03', icon: SlidersHorizontal,
    title: 'Tests and optimizes messaging automatically',
    desc: 'Buddy runs dozens of message variations per campaign simultaneously - testing subject lines, opening hooks, CTAs, tone, and length. She reads the results in real time and shifts volume toward what\'s working, so performance compounds over time.',
    tags: ['A/B testing', 'Subject line testing', 'Auto-optimization', 'Performance analytics'],
  },
  {
    n: '04', icon: Calendar,
    title: 'Handles replies and books meetings autonomously',
    desc: 'Buddy reads every inbound reply with AI, classifies intent, handles common objections with pre-approved responses, and books meetings directly on your reps\' calendars. You define the escalation rules - Buddy executes them flawlessly every time.',
    tags: ['Reply classification', 'Objection handling', 'Calendar integration', 'Escalation rules'],
  },
];

const FEATURES = [
  { icon: BrainCircuit, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/25 border-violet-100 dark:border-violet-900/40', title: 'AI Lead Scoring',           desc: 'Every contact in your database gets a real-time score from 0–100 based on ICP fit, buying intent, engagement signals, and historical conversion patterns from companies like yours.' },
  { icon: Workflow,     color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/25 border-blue-100 dark:border-blue-900/40',         title: 'Multi-Channel Sequences',  desc: 'Orchestrate email, LinkedIn, and phone touchpoints in a single sequence. Buddy decides the best channel for each prospect based on their engagement history and profile.' },
  { icon: Target,       color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-950/25 border-rose-100 dark:border-rose-900/40',         title: 'Deal Intelligence',        desc: 'AI-powered probability scores, next-step recommendations, and risk flags on every open deal. Know exactly which deals need attention before they slip.' },
  { icon: FileSignature,color: 'text-emerald-600 dark:text-emerald-400',bg:'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-100 dark:border-emerald-900/40',title: 'AI Proposal Generator',   desc: 'Generate beautiful, fully personalized proposals in under 60 seconds. Track opens, time on page, and section engagement. Get notified the moment a prospect re-opens.' },
  { icon: Activity,     color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/25 border-amber-100 dark:border-amber-900/40',     title: 'Revenue Forecasting',      desc: 'Claude AI analyzes your pipeline, rep history, and market signals to predict monthly revenue with tight confidence intervals. Know where you\'ll land before the quarter ends.' },
  { icon: MessageSquare,color: 'text-cyan-600 dark:text-cyan-400',     bg: 'bg-cyan-50 dark:bg-cyan-950/25 border-cyan-100 dark:border-cyan-900/40',         title: 'Call Intelligence',        desc: 'Every sales call transcribed, summarized, and scored. BANT/MEDDIC fields extracted automatically. Action items assigned. Coaching insights surfaced - without listening to a single recording.' },
];

const USE_CASES = [
  {
    tag: 'Cold Outbound',
    tagColor: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40',
    icon: Flame,
    title: 'Intent-driven cold outbound that converts',
    desc: 'Buddy monitors real-time buying signals - new funding rounds, leadership hires, tech stack changes, G2 reviews, job postings - and triggers personalized campaigns the moment a prospect enters a buying window. No more spray and pray.',
    bullets: [
      'Signal-triggered campaigns launch automatically',
      'Multi-channel: email, LinkedIn, phone in one sequence',
      'Continuous A/B testing compounds reply rates over time',
      'Send-time AI ensures delivery at peak engagement windows',
    ],
  },
  {
    tag: 'CRM Reactivation',
    tagColor: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40',
    icon: Network,
    title: 'Turn your CRM into a revenue machine',
    desc: 'Your CRM is full of gold - MQLs who went cold, conference leads who never converted, closed-lost deals from 6 months ago. Buddy re-engages every single one with fresh, contextually aware outreach that references their history and has moved on from stale pitches.',
    bullets: [
      'Works every MQL, event lead, and trial signup automatically',
      'Reactivates closed-lost with new angles and updated messaging',
      'Context-aware personalization pulls from CRM notes and history',
      'No manual segmentation - Buddy figures it out from your data',
    ],
  },
  {
    tag: 'Account Expansion',
    tagColor: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40',
    icon: TrendingUp,
    title: 'Grow the accounts you already have',
    desc: 'Buddy analyzes product usage data, support tickets, and CRM context to identify expansion opportunities before your AMs even know they exist. She runs upsell, cross-sell, and renewal campaigns on behalf of each account owner with perfect personalization.',
    bullets: [
      'Usage-based triggers identify expansion opportunities automatically',
      'Runs upsell, expand, and add-on campaigns per account',
      'Sends on behalf of each account owner for authenticity',
      'Renewal outreach starts 90 days before contract end date',
    ],
  },
];

const TESTIMONIALS = [
  {
    company: 'SaaStr', companyColor: 'text-blue-600 dark:text-blue-400',
    quote: 'We shut down our entire outbound SDR team and replaced them with SalesBuddy in one quarter. Open rates doubled overnight and we\'re now closing $100K+ deals on autopilot daily. The ROI is genuinely insane.',
    name: 'Jason Lemkin', title: 'Founder & CEO, SaaStr',
    initials: 'JL', bg: 'bg-blue-600', stars: 5,
    metric: '2× open rates', metricLabel: 'in 30 days',
  },
  {
    company: 'SumUp', companyColor: 'text-emerald-600 dark:text-emerald-400',
    quote: 'We\'re achieving a $52 cost per lead and have sent hundreds of thousands of highly personalized emails through SalesBuddy. The AI personalization is the real differentiator - prospects genuinely think a human wrote it.',
    name: 'Karlo Biuk', title: 'Growth Lead, SumUp',
    initials: 'KB', bg: 'bg-emerald-600', stars: 5,
    metric: '$52', metricLabel: 'cost per lead',
  },
  {
    company: 'CookUnity', companyColor: 'text-orange-600 dark:text-orange-400',
    quote: 'Buddy runs highly targeted outreach at a scale we could never reach with a human-only team. She booked 127 qualified meetings in our first month without a single manual touchpoint from our side.',
    name: 'Bruno Didier', title: 'Head of B2B, CookUnity',
    initials: 'BD', bg: 'bg-orange-600', stars: 5,
    metric: '127', metricLabel: 'meetings in month 1',
  },
];

const INTEGRATIONS = [
  { name: 'HubSpot',    icon: Database,      color: 'text-orange-500' },
  { name: 'Salesforce', icon: CloudIcon,     color: 'text-blue-500' },
  { name: 'Google',     icon: Globe,         color: 'text-red-500' },
  { name: 'LinkedIn',   icon: Linkedin,      color: 'text-blue-700 dark:text-blue-500' },
  { name: 'Slack',      icon: MessageSquare, color: 'text-purple-500' },
  { name: 'Apollo',     icon: Radar,         color: 'text-indigo-500' },
  { name: 'Calendly',   icon: Calendar,      color: 'text-teal-500' },
  { name: 'ZoomInfo',   icon: Database,      color: 'text-blue-600' },
  { name: 'Outreach',   icon: Send,          color: 'text-blue-500' },
  { name: 'Clay',       icon: Layers,        color: 'text-violet-500' },
];

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Users,           label: 'Leads',     active: true },
  { icon: Briefcase,       label: 'Deals' },
  { icon: Mail,            label: 'Outreach' },
  { icon: FileText,        label: 'Proposals' },
  { icon: BarChart2,       label: 'Analytics' },
  { icon: Settings,        label: 'Settings' },
];

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M5 12l7 7M5 12l7-7" />
    </svg>
  );
}

export function LandingPage() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-background" />
            </div>
            <span className="font-bold text-[16px] text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              SalesBuddy
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 flex-1">
            {['Product', 'Solutions', 'Customers', 'Pricing'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium">
                {l}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />
              }
            </button>
            <Link to="/login" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium px-2">
              Log in
            </Link>
            <Link to="/login" className="hidden md:inline-flex text-[13px] text-foreground border border-border px-4 py-1.5 rounded-lg hover:bg-secondary transition-colors font-medium">
              Book a demo
            </Link>
            <Link to="/login" className="text-[13px] font-semibold bg-foreground text-background px-4 py-1.5 rounded-lg hover:bg-foreground/90 transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="pt-20 pb-0 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-full px-4 py-1.5 mb-10">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[12px] font-medium text-muted-foreground">Powered by Claude AI · Replaces your entire sales team</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          </div>

          {/* Headline */}
          <h1
            className="text-[60px] md:text-[76px] font-extrabold tracking-tight leading-[1.05] text-foreground"
            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            Replace your sales team
            <br />
            <span className="text-foreground/25">with one AI rep.</span>
          </h1>

          {/* Sub - Playfair italic */}
          <p
            className="mt-6 text-[19px] text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
          >
            SalesBuddy finds your best leads, writes personalized outreach, handles objections,
            and books meetings - completely on autopilot, at a fraction of the cost.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 mt-10">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-[14px] hover:bg-foreground/90 transition-colors shadow-lg shadow-black/10"
            >
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-xl text-[14px] hover:bg-secondary transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-muted-foreground" />
              Watch 2-min demo
            </a>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground font-medium tracking-wide" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            No credit card · 14-day free trial · Cancel anytime
          </p>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mt-8 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {['bg-blue-400','bg-emerald-400','bg-violet-400','bg-orange-400','bg-pink-400'].map((c,i) => (
                  <div key={i} className={`w-6 h-6 rounded-full ${c} border-2 border-background`} />
                ))}
              </div>
              <span className="text-[12px] text-muted-foreground ml-1">1,000+ sales teams</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              <span className="text-[12px] text-muted-foreground ml-1">4.9 / 5 on G2</span>
            </div>
          </div>
        </div>

        {/* ─── Dashboard Preview - theme-aware ─── */}
        <div className="max-w-7xl mx-auto mt-14">
          <div className="rounded-t-2xl border border-border dark:border-white/10 border-b-0 shadow-[0_-16px_80px_rgba(0,0,0,0.14)] dark:shadow-[0_-16px_80px_rgba(255,255,255,0.04)] overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2.5 px-5 py-3 bg-secondary border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center gap-2 flex-1 mx-6 bg-background rounded-lg px-3 py-1.5 border border-border max-w-sm">
                <Lock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">app.salesbuddy.ai/leads</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-5 h-5 rounded bg-secondary border border-border flex items-center justify-center">
                  <ArrowLeft className="w-2.5 h-2.5 text-muted-foreground" />
                </div>
                <div className="w-5 h-5 rounded bg-secondary border border-border flex items-center justify-center">
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* App UI */}
            <div className="flex bg-background" style={{ height: 540 }}>
              {/* Sidebar */}
              <div className="w-52 flex-shrink-0 bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] flex flex-col">
                <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[hsl(var(--sidebar-border))]">
                  <div className="w-6 h-6 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-background" />
                  </div>
                  <span className="text-[13px] font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    SalesBuddy
                  </span>
                </div>
                <div className="px-2.5 py-2.5 border-b border-[hsl(var(--sidebar-border))]">
                  <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
                    <Search className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground flex-1">Search</span>
                    <span className="text-[10px] text-muted-foreground/40 font-mono border border-border rounded px-1 bg-secondary">⌘K</span>
                  </div>
                </div>
                <nav className="flex-1 p-2 space-y-0.5 overflow-hidden">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 pt-2 pb-1">Workspace</p>
                  {SIDEBAR_ITEMS.map(({ icon: Icon, label, active }) => (
                    <div key={label} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] cursor-default select-none transition-colors ${
                      active
                        ? 'bg-foreground text-background font-semibold shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary'
                    }`}>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      {label}
                      {label === 'Leads' && (
                        <span className="ml-auto text-[10px] opacity-50 px-1.5 rounded-full">2.4k</span>
                      )}
                    </div>
                  ))}
                </nav>
                <div className="p-2.5 border-t border-[hsl(var(--sidebar-border))]">
                  <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary cursor-default">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-white">JR</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">Jeel R.</p>
                      <p className="text-[10px] text-muted-foreground truncate">Admin</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-border">
                  <div>
                    <h2 className="text-[14px] font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Leads</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">2,418 contacts · AI-scored · Updated 2m ago</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 text-[11px] border border-border rounded-lg px-2.5 py-1.5 text-muted-foreground bg-card shadow-sm">
                      <Filter className="w-3 h-3" /> Filter
                    </button>
                    <button className="flex items-center gap-1.5 text-[11px] border border-border rounded-lg px-2.5 py-1.5 text-muted-foreground bg-card shadow-sm">
                      <Sparkles className="w-3 h-3 text-violet-500" /> AI Enrich
                    </button>
                    <button className="flex items-center gap-1.5 text-[11px] bg-foreground text-background rounded-lg px-3 py-1.5 font-semibold shadow-sm">
                      <Zap className="w-3 h-3" /> Add Lead
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border bg-secondary/60">
                        {['Company','Domain','Owner','ICP Fit','ARR','Industry','Employees','AI Score','Status'].map(h => (
                          <th key={h} className={`text-left py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] ${h === 'Company' ? 'pl-6 pr-3' : 'px-3'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPANIES.map((c, i) => {
                        const meta = COMPANY_COLORS[c.name] || { bg: 'bg-secondary', text: 'text-muted-foreground', icon: Building2 };
                        const Icon = meta.icon;
                        return (
                          <tr key={c.name} className={`border-b border-border/40 hover:bg-secondary/40 transition-colors cursor-pointer ${i === 0 ? 'bg-secondary/25' : ''}`}>
                            <td className="pl-6 pr-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-6 h-6 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className={`w-3.5 h-3.5 ${meta.text}`} />
                                </div>
                                <span className="font-semibold text-foreground">{c.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{c.domain}</td>
                            <td className="px-3 py-2.5">
                              <div className={`w-5 h-5 rounded-full ${c.ownerColor} text-[9px] font-bold flex items-center justify-center`}>
                                {c.owner}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                c.icp
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-900/50'
                                  : 'bg-secondary text-muted-foreground ring-1 ring-border'
                              }`}>
                                {c.icp ? 'Strong' : 'Weak'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{c.arr}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{c.industry}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{c.employees}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full rounded-full bg-foreground" style={{ width: `${c.score}%` }} />
                                </div>
                                <span className="font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.score}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[c.status]}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Ticker ─── */}
      <section className="border-y border-border py-6 overflow-hidden bg-secondary">
        <p className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-5">
          Trusted by fast-growing sales teams at
        </p>
        <div className="flex gap-12 whitespace-nowrap" style={{ animation: 'ticker 25s linear infinite' }}>
          {[...TICKER_COMPANIES, ...TICKER_COMPANIES, ...TICKER_COMPANIES].map((c, i) => (
            <span key={i} className="text-[13px] font-bold text-muted-foreground/30 flex-shrink-0 hover:text-muted-foreground transition-colors cursor-default">
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-20 border-b border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label, sub, icon: Icon }) => (
              <div key={label} className="text-center p-6 rounded-2xl border border-border hover:border-border/60 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-4xl font-extrabold text-foreground" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                  {value}
                </p>
                <p className="text-[13px] font-semibold text-foreground/80 mt-1">{label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how" className="py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Set your strategy once.
              <br />
              <span className="text-foreground/25">Buddy runs it forever.</span>
            </h2>
            <p className="text-muted-foreground mt-5 text-[15px] max-w-xl mx-auto leading-relaxed">
              From first touch to booked meeting - fully automated, continuously improving, always-on.
            </p>
          </div>

          <div className="space-y-4">
            {HOW_STEPS.map(({ n, icon: Icon, title, desc, tags }) => (
              <div key={n} className="group flex gap-6 p-7 border border-border rounded-2xl hover:border-border/60 hover:shadow-md transition-all">
                <div className="flex-shrink-0 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                    <Icon className="w-5 h-5 text-background" />
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground/40" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{n}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-bold text-foreground mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">{desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(t => (
                      <span key={t} className="inline-flex items-center bg-secondary border border-border rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="product" className="py-24 bg-secondary border-b border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Platform</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Every outbound motion. One platform.
            </h2>
            <p className="text-muted-foreground mt-5 text-[15px] max-w-xl mx-auto">
              Stop duct-taping 12 different tools together. Everything Buddy needs to run your sales pipeline lives in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className={`p-6 border ${bg} rounded-2xl hover:shadow-md transition-all`}>
                <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mb-5 shadow-sm">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="text-[15px] font-bold text-foreground mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use Cases ─── */}
      <section id="solutions" className="py-24 border-b border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Use cases</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              One AI BDR.<br />
              <span className="text-foreground/25">Every outbound motion.</span>
            </h2>
          </div>
          <div className="space-y-5">
            {USE_CASES.map(({ tag, tagColor, icon: Icon, title, desc, bullets }) => (
              <div key={tag} className="border border-border rounded-2xl p-8 hover:border-border/60 transition-all">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${tagColor} mb-6`}>
                  <Icon className="w-3 h-3" /> {tag}
                </span>
                <div className="grid md:grid-cols-2 gap-10">
                  <div>
                    <h3 className="text-[20px] font-bold text-foreground mb-3" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{title}</h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                  <ul className="space-y-3 self-center">
                    {bullets.map(b => (
                      <li key={b} className="flex items-start gap-3 text-[13px] text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="customers" className="py-24 bg-secondary border-b border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Customers</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Trusted by 1,000s of BDRs,<br />AEs, and AMs globally
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ company, companyColor, quote, name, title, initials, bg, stars, metric, metricLabel }) => (
              <div key={name} className="bg-card border border-border rounded-2xl p-7 flex flex-col gap-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <p className={`text-[13px] font-bold ${companyColor}`}>{company}</p>
                  <div className="flex gap-0.5">
                    {Array.from({ length: stars }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
                <p
                  className="text-[14px] text-muted-foreground leading-relaxed flex-1"
                  style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
                >
                  "{quote}"
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${bg} text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-foreground">{name}</p>
                      <p className="text-[11px] text-muted-foreground">{title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-extrabold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{metric}</p>
                    <p className="text-[10px] text-muted-foreground">{metricLabel}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Integrations ─── */}
      <section className="py-20 border-b border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Integrations</p>
          <h2 className="text-3xl font-extrabold text-foreground mb-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Run Buddy alongside your GTM stack
          </h2>
          <p className="text-[13px] text-muted-foreground mb-10 max-w-md mx-auto">
            Connects with your CRM, calendar, and data enrichment tools in under 5 minutes. No migration. No rip-and-replace.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {INTEGRATIONS.map(({ name, icon: Icon, color }) => (
              <div key={name} className="flex items-center gap-2 border border-border rounded-xl px-4 py-2.5 bg-card hover:border-border/60 hover:shadow-sm transition-all">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-[13px] font-semibold text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Simple, honest pricing
            </h2>
            <p className="text-muted-foreground mt-4 text-[15px]">Start free. Upgrade only when you're ready. No hidden fees.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: 'Starter', price: '$49', period: '/mo',
                desc: 'Perfect for solo founders and early-stage startups getting their first outbound motion running.',
                features: ['500 AI-scored leads/month','3 active sequences','Email outreach only','Basic CRM pipeline','AI proposals (5/mo)','Email support'],
                highlight: false,
              },
              {
                name: 'Growth', price: '$149', period: '/mo',
                desc: 'For teams that are serious about scaling outbound and replacing manual SDR work with AI.',
                features: ['5,000 AI-scored leads/month','Unlimited sequences','Email + LinkedIn + phone','Full CRM + deal pipeline','Unlimited AI proposals','Call intelligence + transcription','Revenue forecasting','Priority support'],
                highlight: true,
                badge: 'Most popular',
              },
              {
                name: 'Enterprise', price: 'Custom', period: '',
                desc: 'For large sales organizations that need custom integrations, compliance, and dedicated support.',
                features: ['Unlimited leads','Unlimited everything','SSO + SAML 2.0','White-label option','Custom integrations','Dedicated CSM','SLA guarantee','Security review'],
                highlight: false,
              },
            ].map(({ name, price, period, desc, features, highlight, badge }) => (
              <div
                key={name}
                className={`relative p-7 rounded-2xl border flex flex-col gap-6 ${
                  highlight
                    ? 'bg-foreground border-foreground shadow-2xl shadow-black/20'
                    : 'bg-card border-border hover:border-border/60 hover:shadow-md transition-all'
                }`}
              >
                {badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                    {badge}
                  </span>
                )}
                <div>
                  <p
                    className={`text-[11px] font-bold uppercase tracking-widest ${highlight ? 'text-background/50' : 'text-muted-foreground'}`}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >{name}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span
                      className={`text-4xl font-extrabold ${highlight ? 'text-background' : 'text-foreground'}`}
                      style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >{price}</span>
                    <span className={`text-sm ${highlight ? 'text-background/50' : 'text-muted-foreground'}`}>{period}</span>
                  </div>
                  <p className={`text-[12px] mt-2 leading-relaxed ${highlight ? 'text-background/60' : 'text-muted-foreground'}`}>{desc}</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {features.map(f => (
                    <li key={f} className={`flex items-start gap-2.5 text-[13px] ${highlight ? 'text-background/80' : 'text-muted-foreground'}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${highlight ? 'text-background' : 'text-foreground'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`text-center text-[13px] font-semibold py-2.5 rounded-xl transition-colors ${
                    highlight
                      ? 'bg-background text-foreground hover:bg-background/90'
                      : 'border-2 border-foreground text-foreground hover:bg-foreground hover:text-background'
                  }`}
                >
                  {price === 'Custom' ? 'Talk to sales' : 'Start free trial'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center mx-auto mb-8 shadow-xl shadow-black/20">
            <Zap className="w-7 h-7 text-background" />
          </div>
          <h2 className="text-5xl font-extrabold tracking-tight text-foreground leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Your AI sales team
            <br />
            <span className="text-foreground/25">starts today.</span>
          </h2>
          <p
            className="mt-6 text-[17px] text-muted-foreground leading-relaxed"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
          >
            Join hundreds of companies that have replaced manual outbound with
            SalesBuddy - and never looked back.
          </p>
          <div className="flex items-center justify-center gap-3 mt-10">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-foreground text-background font-semibold px-7 py-3.5 rounded-xl text-[14px] hover:bg-foreground/90 transition-colors shadow-lg shadow-black/10"
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#" className="inline-flex items-center gap-2 text-[14px] text-muted-foreground border border-border px-7 py-3.5 rounded-xl hover:bg-secondary transition-colors font-medium">
              Book a demo <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Free 14-day trial · No credit card · Setup in 5 minutes
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-10 border-b border-border">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
                  <Zap className="w-4 h-4 text-background" />
                </div>
                <span className="font-bold text-[15px] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>SalesBuddy</span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                The autonomous AI sales platform for modern teams. Powered by Claude AI.
              </p>
            </div>
            {[
              { title: 'Product',   links: ['Buddy, the AI BDR','Lead scoring','Outreach sequences','Deal pipeline','Proposals','Pricing'] },
              { title: 'Solutions', links: ['Startups','SMBs','Enterprise','Agencies'] },
              { title: 'Resources', links: ['Documentation','Help center','Blog','Community','Status'] },
              { title: 'Company',   links: ['About','Careers','Contact','Newsroom','Legal'] },
            ].map(({ title, links }) => (
              <div key={title}>
                <p
                  className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >{title}</p>
                <ul className="space-y-2">
                  {links.map(l => (
                    <li key={l}>
                      <a href="#" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              {['Terms of use','Privacy policy','Cookie settings','Do not sell my data'].map(l => (
                <a key={l} href="#" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">{l}</a>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              © 2026 SalesBuddy AI Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-33.33%)} }
      `}</style>
    </div>
  );
}
