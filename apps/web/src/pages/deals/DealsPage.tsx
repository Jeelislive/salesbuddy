import { useState, useEffect, useRef } from 'react';
import { Plus, MoreHorizontal, Briefcase, Loader2, Trash2, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/Toast';

interface Stage { id: string; name: string; position: number; probability: number }
interface Deal {
  id: string; name: string; company_name: string | null;
  amount: number; stage_id: string | null; probability: number;
  contact_id: string | null;
}

const STAGE_COLORS: Record<string, string> = {
  'Lead In':     'bg-gray-500/10 text-gray-500',
  'Qualified':   'bg-blue-500/10 text-blue-500',
  'Demo':        'bg-violet-500/10 text-violet-500',
  'Proposal':    'bg-amber-500/10 text-amber-600',
  'Negotiation': 'bg-orange-500/10 text-orange-500',
  'Closed Won':  'bg-emerald-500/10 text-emerald-500',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

/* ─── Deal Form Modal ─── */
function DealFormModal({ open, onClose, stages, defaultStageId, onCreated }: {
  open: boolean; onClose: () => void; stages: Stage[];
  defaultStageId: string | null; onCreated: (deal: Deal) => void;
}) {
  const { workspaceId } = useWorkspaceStore();
  const [form, setForm] = useState({ name: '', company_name: '', amount: '', stage_id: '', probability: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const sid = defaultStageId || stages[0]?.id || '';
      const prob = stages.find(s => s.id === sid)?.probability ?? 0;
      setForm({ name: '', company_name: '', amount: '', stage_id: sid, probability: String(prob) });
      setError('');
    }
  }, [open, defaultStageId, stages]);

  async function save() {
    if (!form.name.trim() || !form.stage_id || !workspaceId) return;
    setSaving(true); setError('');
    const { data, error: err } = await supabase.from('deals').insert({
      workspace_id: workspaceId,
      name: form.name.trim(),
      company_name: form.company_name.trim() || null,
      amount: parseFloat(form.amount) || 0,
      stage_id: form.stage_id,
      probability: parseInt(form.probability) || 0,
    }).select('id, name, company_name, amount, stage_id, probability, contact_id').single();
    if (err) { setError(err.message); setSaving(false); return; }
    if (data) onCreated({ ...data, amount: Number(data.amount) || 0 });
    setSaving(false);
    onClose();
  }

  const inp = (label: string, key: keyof typeof form, type = 'text', ph = '') => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={form[key]} placeholder={ph}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} title="New Deal" size="md" noPadding>
      <div className="p-6 space-y-4">
        {inp('Deal Name *', 'name', 'text', 'e.g. Acme Pro License')}
        {inp('Company', 'company_name', 'text', 'Acme Inc.')}
        {inp('Value ($)', 'amount', 'number', '0')}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Stage *</label>
            <select value={form.stage_id} onChange={e => {
              const s = stages.find(st => st.id === e.target.value);
              setForm(p => ({ ...p, stage_id: e.target.value, probability: s ? String(s.probability) : p.probability }));
            }} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {inp('Probability (%)', 'probability', 'number', '0')}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving || !form.name.trim()} className="flex-1"
            icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}>
            {saving ? 'Creating…' : 'Create Deal'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ─── Main Page ─── */
export function DealsPage() {
  const { workspaceId }    = useWorkspaceStore();
  const { session }        = useAuthStore();
  const { toast }          = useToast();
  const [view, setView]    = useState<'kanban' | 'list'>('kanban');
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals]  = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      supabase.from('pipeline_stages').select('id, name, position, probability')
        .eq('workspace_id', workspaceId).order('position'),
      supabase.from('deals').select('id, name, company_name, amount, stage_id, probability, contact_id')
        .eq('workspace_id', workspaceId).is('deleted_at', null),
    ]).then(([stagesRes, dealsRes]) => {
      setStages(stagesRes.data ?? []);
      setDeals((dealsRes.data ?? []).map(d => ({ ...d, amount: Number(d.amount) || 0 })));
      setLoading(false);
    });
  }, [workspaceId]);

  function openNewDeal(stageId: string | null = null) {
    setDefaultStageId(stageId);
    setDealModalOpen(true);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('deals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id).eq('workspace_id', workspaceId!);
    if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
    setDeals(prev => prev.filter(d => d.id !== id));
    toast('Deal deleted', 'success');
  }

  async function handleMarkWon(id: string) {
    const wonStage = stages.find(s => s.name === 'Closed Won');
    if (!wonStage) {
      // fall back to API
      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/deals/${id}/won`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
    } else {
      await supabase.from('deals').update({ stage_id: wonStage.id, probability: 100 })
        .eq('id', id).eq('workspace_id', workspaceId!);
    }
    setDeals(prev => prev.map(d => d.id === id
      ? { ...d, stage_id: wonStage?.id ?? d.stage_id, probability: 100 }
      : d));
    toast('Deal marked as won', 'success');
  }

  const openDeals = deals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.name !== 'Closed Won';
  });
  const totalPipeline = openDeals.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Deals"
        description={loading ? 'Loading…' : `${fmt(totalPipeline)} in pipeline`}
        actions={
          <>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-accent' : 'hover:bg-accent/50'}`}>Kanban</button>
              <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-accent' : 'hover:bg-accent/50'}`}>List</button>
            </div>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openNewDeal()}>New Deal</Button>
          </>
        }
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : deals.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Briefcase className="w-10 h-10 opacity-20" />
          <p className="text-sm font-medium">No deals yet</p>
          <p className="text-xs">Create your first deal to start tracking your pipeline</p>
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openNewDeal()}>New Deal</Button>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-3 h-full min-w-max">
            {stages.map((stage) => {
              const stageDeals = deals.filter(d => d.stage_id === stage.id);
              const stageValue = stageDeals.reduce((s, d) => s + d.amount, 0);
              return (
                <div key={stage.id} className="w-64 flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{stage.name}</span>
                      <span className="text-xxs text-muted-foreground bg-muted rounded-full px-1.5">{stageDeals.length}</span>
                    </div>
                    <span className="text-xxs text-muted-foreground">{fmt(stageValue)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stageDeals.map((deal) => (
                      <div key={deal.id} className="bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition-colors cursor-pointer group">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium leading-snug">{deal.name}</p>
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === deal.id ? null : deal.id); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent">
                              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            {openMenuId === deal.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-lg shadow-xl z-20 py-1">
                                  <button onClick={() => { handleMarkWon(deal.id); setOpenMenuId(null); }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-1.5">
                                    <CheckCircle className="w-3 h-3 text-emerald-500" /> Mark Won
                                  </button>
                                  <button onClick={() => { handleDelete(deal.id); setOpenMenuId(null); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1.5">
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {deal.company_name && <p className="text-xs text-muted-foreground mt-1">{deal.company_name}</p>}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-sm font-bold">{fmt(deal.amount)}</span>
                          {deal.contact_id && <Avatar fallback="?" size="xs" />}
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xxs text-muted-foreground mb-1">
                            <span>Probability</span>
                            <span>{deal.probability}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${deal.probability}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => openNewDeal(stage.id)}
                      className="w-full border border-dashed border-border rounded-lg p-2.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1.5">
                      <Plus className="w-3 h-3" /> Add deal
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr className="text-xxs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-6 py-2.5 font-medium">Deal</th>
                <th className="text-left px-4 py-2.5 font-medium">Value</th>
                <th className="text-left px-4 py-2.5 font-medium">Stage</th>
                <th className="text-left px-4 py-2.5 font-medium">Probability</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deals.map(deal => {
                const stage = stages.find(s => s.id === deal.stage_id);
                return (
                  <tr key={deal.id} className="hover:bg-accent/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium">{deal.name}</p>
                      {deal.company_name && <p className="text-xxs text-muted-foreground">{deal.company_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{fmt(deal.amount)}</td>
                    <td className="px-4 py-3">
                      {stage && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium ${STAGE_COLORS[stage.name] ?? 'bg-muted text-muted-foreground'}`}>
                          {stage.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${deal.probability}%` }} />
                        </div>
                        <span className="text-xs">{deal.probability}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); handleDelete(deal.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DealFormModal
        open={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        stages={stages}
        defaultStageId={defaultStageId}
        onCreated={deal => { setDeals(prev => [deal, ...prev]); toast('Deal created', 'success'); }}
      />
    </div>
  );
}
