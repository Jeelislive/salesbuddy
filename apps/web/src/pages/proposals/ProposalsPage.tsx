import { useState, useEffect } from 'react';
import { Plus, Sparkles, Eye, Send, CheckCircle, FileText, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/Toast';

interface Proposal {
  id: string; title: string; company_name: string | null; contact_name: string | null;
  total_amount: number | null; status: string; view_count: number;
  viewed_at: string | null; sent_at: string | null; content?: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  viewed:   <Eye className="w-3.5 h-3.5" />,
  accepted: <CheckCircle className="w-3.5 h-3.5" />,
  sent:     <Send className="w-3.5 h-3.5" />,
  draft:    <FileText className="w-3.5 h-3.5" />,
};
const STATUS_BADGE: Record<string, 'success' | 'primary' | 'warning' | 'muted'> = {
  accepted: 'success', viewed: 'primary', sent: 'warning', draft: 'muted',
};

function relTime(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── New Proposal Modal ─── */
function NewProposalModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (p: Proposal) => void;
}) {
  const { session } = useAuthStore();
  const [form, setForm] = useState({ title: '', total_amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setForm({ title: '', total_amount: '' }); setError(''); } }, [open]);

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true); setError('');
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        title: form.title.trim(),
        ...(form.total_amount ? { total_amount: parseFloat(form.total_amount) } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed to create'); setSaving(false); return; }
    onCreated({ id: data.id, title: data.title, company_name: null, contact_name: null,
      total_amount: data.total_amount ?? null, status: 'draft', view_count: 0,
      viewed_at: null, sent_at: null, content: data.content ?? '' });
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Proposal" size="md" noPadding>
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Title *</label>
          <input value={form.title} placeholder="e.g. SalesBuddy Pro — Acme Inc."
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Amount ($)</label>
          <input type="number" value={form.total_amount} placeholder="0"
            onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))}
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving || !form.title.trim()} className="flex-1"
            icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}>
            {saving ? 'Creating…' : 'Create Draft'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ─── AI Generate Modal ─── */
function AIGenerateModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (p: Proposal) => void;
}) {
  const { session } = useAuthStore();
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [form, setForm] = useState({
    deal_title: '', deal_value: '', deal_notes: '',
    contact_first: '', contact_last: '', contact_title: '', contact_company: '',
    product_name: '', product_desc: '', product_benefits: '', product_pricing: '',
  });
  const [generatedContent, setGeneratedContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep('form');
      setForm({ deal_title: '', deal_value: '', deal_notes: '', contact_first: '', contact_last: '',
        contact_title: '', contact_company: '', product_name: '', product_desc: '',
        product_benefits: '', product_pricing: '' });
      setGeneratedContent(''); setError('');
    }
  }, [open]);

  async function generate() {
    if (!form.deal_title || !form.contact_first || !form.contact_last || !form.product_name || !form.product_desc) return;
    setGenerating(true); setError('');
    const body = {
      deal: { title: form.deal_title, ...(form.deal_value ? { value: parseFloat(form.deal_value) } : {}), ...(form.deal_notes ? { notes: form.deal_notes } : {}) },
      contact: { first_name: form.contact_first, last_name: form.contact_last, ...(form.contact_title ? { title: form.contact_title } : {}), ...(form.contact_company ? { company_name: form.contact_company } : {}) },
      product: { name: form.product_name, description: form.product_desc,
        ...(form.product_benefits ? { key_benefits: form.product_benefits.split('\n').filter(Boolean) } : {}),
        ...(form.product_pricing ? { pricing_model: form.product_pricing } : {}) },
    };
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/proposals/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Generation failed'); setGenerating(false); return; }
    setGeneratedContent(data.content);
    setStep('preview');
    setGenerating(false);
  }

  async function saveProposal() {
    setSaving(true); setError('');
    const title = `${form.product_name} Proposal — ${form.contact_company || form.contact_first + ' ' + form.contact_last}`;
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        title,
        content: generatedContent,
        ...(form.deal_value ? { total_amount: parseFloat(form.deal_value) } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Save failed'); setSaving(false); return; }
    onCreated({ id: data.id, title: data.title, company_name: form.contact_company || null,
      contact_name: `${form.contact_first} ${form.contact_last}`.trim(),
      total_amount: data.total_amount ?? null, status: 'draft', view_count: 0,
      viewed_at: null, sent_at: null, content: generatedContent });
    setSaving(false);
    onClose();
  }

  const inp = (label: string, key: keyof typeof form, ph = '', type = 'text') => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={form[key]} placeholder={ph}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
    </div>
  );

  const canGenerate = form.deal_title && form.contact_first && form.contact_last && form.product_name && form.product_desc;

  return (
    <Dialog open={open} onClose={onClose} title="AI Generate Proposal"
      description={step === 'form' ? 'Fill in the details — AI writes the full proposal' : 'Review the AI-generated proposal'}
      size="xl" noPadding>
      <div className="flex flex-col overflow-hidden" style={{ maxHeight: '70vh' }}>
        {step === 'form' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deal</p>
              <div className="grid grid-cols-2 gap-3">
                {inp('Deal Title *', 'deal_title', 'e.g. SalesBuddy Pro License')}
                {inp('Value ($)', 'deal_value', '0', 'number')}
              </div>
              <div className="mt-3 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea value={form.deal_notes} placeholder="Any context about this deal…" rows={2}
                  onChange={e => setForm(p => ({ ...p, deal_notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                {inp('First Name *', 'contact_first', 'John')}
                {inp('Last Name *', 'contact_last', 'Doe')}
                {inp('Job Title', 'contact_title', 'CTO')}
                {inp('Company', 'contact_company', 'Acme Inc.')}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Product</p>
              <div className="grid grid-cols-2 gap-3">
                {inp('Product Name *', 'product_name', 'SalesBuddy')}
                {inp('Pricing Model', 'product_pricing', 'e.g. $99/mo per seat')}
              </div>
              <div className="mt-3 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Description *</label>
                <textarea value={form.product_desc} placeholder="What does your product do?" rows={2}
                  onChange={e => setForm(p => ({ ...p, product_desc: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors" />
              </div>
              <div className="mt-3 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Key Benefits (one per line)</label>
                <textarea value={form.product_benefits} placeholder={"Automates lead outreach\nAI-powered scoring\n..."} rows={3}
                  onChange={e => setForm(p => ({ ...p, product_benefits: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors" />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">{generatedContent}</pre>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          </div>
        )}

        <div className="p-4 border-t border-border flex items-center justify-between gap-3">
          {step === 'preview' && (
            <Button variant="outline" size="sm" onClick={() => setStep('form')}>← Back</Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            {step === 'form' ? (
              <Button size="sm" onClick={generate} disabled={generating || !canGenerate}
                icon={generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}>
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            ) : (
              <Button size="sm" onClick={saveProposal} disabled={saving}
                icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}>
                {saving ? 'Saving…' : 'Save as Draft'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/* ─── View Proposal Modal ─── */
function ViewProposalModal({ proposal, onClose }: { proposal: Proposal | null; onClose: () => void }) {
  return (
    <Dialog open={!!proposal} onClose={onClose} title={proposal?.title ?? ''} size="xl" noPadding>
      <div className="overflow-y-auto p-6" style={{ maxHeight: '70vh' }}>
        {proposal?.content
          ? <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">{proposal.content}</pre>
          : <p className="text-sm text-muted-foreground">This proposal has no content yet.</p>}
      </div>
    </Dialog>
  );
}

/* ─── Main Page ─── */
export function ProposalsPage() {
  const { workspaceId }  = useWorkspaceStore();
  const { session }      = useAuthStore();
  const { toast }        = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [newOpen, setNewOpen]     = useState(false);
  const [aiOpen, setAiOpen]       = useState(false);
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from('proposals')
      .select(`id, title, total_amount, status, view_count, viewed_at, sent_at, content, leads(first_name, last_name, company_name)`)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProposals(
          (data ?? []).map((p: any) => ({
            id: p.id, title: p.title, total_amount: p.total_amount, status: p.status,
            view_count: p.view_count ?? 0, viewed_at: p.viewed_at, sent_at: p.sent_at,
            content: p.content ?? '',
            company_name: p.leads?.company_name ?? null,
            contact_name: p.leads ? `${p.leads.first_name} ${p.leads.last_name}`.trim() || null : null,
          }))
        );
        setLoading(false);
      });
  }, [workspaceId]);

  async function handleSend(id: string) {
    setSendingId(id);
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/proposals/${id}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      const now = new Date().toISOString();
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'sent', sent_at: now } : p));
      toast('Proposal marked as sent', 'success');
    } else {
      toast('Failed to send proposal', 'error');
    }
    setSendingId(null);
  }

  function handleCreated(p: Proposal) {
    setProposals(prev => [p, ...prev]);
    toast('Proposal created', 'success');
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Proposals"
        description="AI-generated proposals with engagement tracking"
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => setAiOpen(true)}>AI Generate</Button>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setNewOpen(true)}>New Proposal</Button>
          </>
        }
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <FileText className="w-10 h-10 opacity-20" />
          <p className="text-sm font-medium">No proposals yet</p>
          <p className="text-xs">Create an AI-generated proposal to send to your leads</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => setAiOpen(true)}>AI Generate</Button>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setNewOpen(true)}>New Proposal</Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr className="text-xxs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-6 py-2.5 font-medium">Proposal</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Views</th>
                <th className="text-left px-4 py-2.5 font-medium">Last Viewed</th>
                <th className="text-left px-4 py-2.5 font-medium">Sent</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proposals.map(p => (
                <tr key={p.id} className="hover:bg-accent/50 transition-colors cursor-pointer group">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium">{p.title}</p>
                    {p.company_name && <p className="text-xxs text-muted-foreground">{p.company_name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {p.contact_name ? (
                      <div className="flex items-center gap-2">
                        <Avatar fallback={p.contact_name[0].toUpperCase()} size="xs" />
                        <span className="text-sm">{p.contact_name}</span>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {p.total_amount != null ? `$${p.total_amount.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[p.status] ?? 'muted'}>
                      <span className="flex items-center gap-1">{STATUS_ICON[p.status]}{p.status}</span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{p.view_count}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{relTime(p.viewed_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{relTime(p.sent_at)}</td>
                  <td className="px-4 py-3">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setViewProposal(p); }}>
                        View
                      </Button>
                      {p.status === 'draft' && (
                        <Button variant="ghost" size="sm"
                          disabled={sendingId === p.id}
                          icon={sendingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : undefined}
                          onClick={e => { e.stopPropagation(); handleSend(p.id); }}>
                          Send
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewProposalModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={handleCreated} />
      <AIGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} onCreated={handleCreated} />
      <ViewProposalModal proposal={viewProposal} onClose={() => setViewProposal(null)} />
    </div>
  );
}
