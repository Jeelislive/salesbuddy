import { useState, useEffect } from 'react';
import {
  Plus, Play, Pause, Sparkles, Mail, Linkedin, Phone,
  Loader2, Trash2, ChevronDown, ChevronUp, Users, Check,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/Toast';

interface Sequence {
  id: string; name: string; status: string;
  steps: number; enrolled: number; replied: number; channels: string[];
}
interface Step { subject: string; body: string; delay_days: number }

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="w-3 h-3" />,
  linkedin: <Linkedin className="w-3 h-3" />,
  phone: <Phone className="w-3 h-3" />,
};
const STATUS_BADGE: Record<string, 'success' | 'warning' | 'muted'> = {
  active: 'success', paused: 'warning', draft: 'muted',
};

const API = import.meta.env.VITE_API_URL;

/* ─── New Sequence Modal ─────────────────────────────────────── */
function NewSequenceModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { session } = useAuthStore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<Step[]>([{ subject: '', body: '', delay_days: 0 }]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number>(0);

  function addStep() {
    setSteps(prev => [...prev, { subject: '', body: '', delay_days: 3 }]);
    setExpanded(steps.length);
  }
  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateStep(i: number, field: keyof Step, val: string | number) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  async function save() {
    if (!name.trim()) { toast('Sequence name is required', 'error'); return; }
    if (steps.some(s => !s.body.trim())) { toast('All steps must have a body', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/sequences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          name: name.trim(),
          steps: steps.map((s, i) => ({
            step_number: i + 1, type: 'email',
            subject: s.subject, body: s.body, delay_days: s.delay_days,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast('Sequence created!', 'success');
      onCreated(); onClose();
      setName(''); setSteps([{ subject: '', body: '', delay_days: 0 }]);
    } catch (e: any) { toast(e.message || 'Failed to create', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Sequence" size="lg">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Sequence Name</label>
          <Input className="mt-1" placeholder="e.g. Cold Outreach — SaaS Founders" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Steps</label>
          {steps.map((step, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === i ? -1 : i)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 text-sm font-medium"
              >
                <span>Step {i + 1} {i === 0 ? '(immediate)' : `(+${step.delay_days}d)`} {step.subject ? `— ${step.subject.slice(0, 40)}` : ''}</span>
                <div className="flex items-center gap-2">
                  {steps.length > 1 && (
                    <span onClick={e => { e.stopPropagation(); removeStep(i); }} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {expanded === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {expanded === i && (
                <div className="p-4 space-y-3">
                  {i > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Send after (days)</label>
                      <Input type="number" min={0} className="mt-1 w-24" value={step.delay_days}
                        onChange={e => updateStep(i, 'delay_days', parseInt(e.target.value) || 0)} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Subject</label>
                    <Input className="mt-1" placeholder="e.g. Quick question about {{first_name}}'s workflow"
                      value={step.subject} onChange={e => updateStep(i, 'subject', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Body — use {'{{first_name}}'} for personalization</label>
                    <textarea
                      className="mt-1 w-full h-32 px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Hi {{first_name}}, I noticed you're building a SaaS product..."
                      value={step.body} onChange={e => updateStep(i, 'body', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addStep}>Add Step</Button>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Create Sequence
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ─── AI Generate Modal ──────────────────────────────────────── */
function AIGenerateModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { session } = useAuthStore();
  const { toast } = useToast();
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sequenceName, setSequenceName] = useState('');
  const [generatedSteps, setGeneratedSteps] = useState<any[]>([]);
  const [form, setForm] = useState({
    productName: '', valueProp: '', targetRole: '', industry: '',
    steps: 5, tone: 'professional' as 'professional' | 'conversational' | 'direct',
  });

  function update(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function generate() {
    if (!form.productName.trim() || !form.valueProp.trim()) {
      toast('Product name and value proposition are required', 'error'); return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/v1/sequences/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          product: { name: form.productName, value_proposition: form.valueProp },
          icp: { role: form.targetRole, industry: form.industry },
          steps: form.steps, tone: form.tone,
        }),
      });
      if (!res.ok) throw new Error('AI generation failed');
      const { steps } = await res.json();
      setGeneratedSteps(steps);
      setSequenceName(`AI — ${form.productName} Outreach`);
      setStep('preview');
    } catch (e: any) { toast(e.message || 'Generation failed', 'error'); }
    finally { setGenerating(false); }
  }

  async function saveSequence() {
    if (!sequenceName.trim()) { toast('Name required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/sequences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ name: sequenceName, steps: generatedSteps }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast('AI sequence created!', 'success');
      onCreated(); onClose();
      setStep('form'); setGeneratedSteps([]);
    } catch (e: any) { toast(e.message || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="AI Generate Sequence" size="xl">
      {step === 'form' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Product Name *</label>
              <Input className="mt-1" placeholder="e.g. SalesBuddy" value={form.productName} onChange={e => update('productName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Target Role</label>
              <Input className="mt-1" placeholder="e.g. Head of Sales, Founder" value={form.targetRole} onChange={e => update('targetRole', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Value Proposition *</label>
            <textarea
              className="mt-1 w-full h-20 px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Replace your entire SDR team with AI — find leads, enrich, and send personalized emails automatically"
              value={form.valueProp} onChange={e => update('valueProp', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Industry</label>
              <Input className="mt-1" placeholder="e.g. B2B SaaS" value={form.industry} onChange={e => update('industry', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Number of Steps</label>
              <select className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.steps} onChange={e => update('steps', parseInt(e.target.value))}>
                {[2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} steps</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tone</label>
              <select className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.tone} onChange={e => update('tone', e.target.value as any)}>
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="direct">Direct</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={generate} disabled={generating}>
              {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Generating...</> : 'Generate with AI'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sequence Name</label>
            <Input className="mt-1" value={sequenceName} onChange={e => setSequenceName(e.target.value)} />
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {generatedSteps.map((s: any, i: number) => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Step {i + 1} {i === 0 ? '(Day 0)' : `(+${s.delay_days || s.delay_hours ? `${s.delay_days}d` : '3d'})`}</span>
                </div>
                {s.subject && <p className="text-sm font-medium">{s.subject}</p>}
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{s.body?.slice(0, 200)}{s.body?.length > 200 ? '…' : ''}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setStep('form')}>← Back</Button>
            <Button size="sm" onClick={saveSequence} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save Sequence
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ─── Enroll Leads Modal ─────────────────────────────────────── */
function EnrollLeadsModal({ open, onClose, sequence, onEnrolled }: {
  open: boolean; onClose: () => void;
  sequence: Sequence | null; onEnrolled: () => void;
}) {
  const { session } = useAuthStore();
  const { workspaceId } = useWorkspaceStore();
  const { toast } = useToast();
  const [leads, setLeads] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoadingLeads(true);
    setSelected(new Set());
    supabase
      .from('leads')
      .select('id, name, email, email_status')
      .eq('workspace_id', workspaceId)
      .eq('email_status', 'valid')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLeads((data ?? []).map((l: any) => ({ id: l.id, name: l.name || 'Unknown', email: l.email })));
        setLoadingLeads(false);
      });
  }, [open, workspaceId]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function enroll() {
    if (!sequence || selected.size === 0) return;
    setEnrolling(true);
    try {
      const res = await fetch(`${API}/api/v1/sequences/${sequence.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ contact_ids: [...selected] }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { enrolled, skipped } = await res.json();
      toast(`Enrolled ${enrolled} lead${enrolled !== 1 ? 's' : ''}${skipped ? ` (${skipped} already enrolled)` : ''}`, 'success');
      onEnrolled(); onClose();
    } catch (e: any) { toast(e.message || 'Failed to enroll', 'error'); }
    finally { setEnrolling(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Enroll Leads — ${sequence?.name ?? ''}`} size="lg" noPadding>
      <div className="flex flex-col h-full">
        <div className="px-6 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setSelected(leads.size === selected.size ? new Set() : new Set(leads.map(l => l.id)))}
          >
            {selected.size === leads.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loadingLeads ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">No verified leads found.</p>
              <p className="text-xs text-muted-foreground">Run email verification first to validate lead emails.</p>
            </div>
          ) : leads.map(lead => (
            <button
              key={lead.id}
              onClick={() => toggle(lead.id)}
              className="w-full flex items-center gap-3 px-6 py-3 hover:bg-muted/30 text-left"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected.has(lead.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                {selected.has(lead.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lead.name}</p>
                {lead.email && <p className="text-xs text-muted-foreground truncate">{lead.email}</p>}
              </div>
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={<Users className="w-3.5 h-3.5" />} onClick={enroll} disabled={selected.size === 0 || enrolling}>
            {enrolling ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Enroll {selected.size > 0 ? selected.size : ''} Lead{selected.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export function OutreachPage() {
  const { workspaceId } = useWorkspaceStore();
  const { session } = useAuthStore();
  const { toast } = useToast();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<Sequence | null>(null);

  async function loadSequences() {
    if (!workspaceId) return;
    const { data } = await supabase
      .from('sequences')
      .select('id, name, status, sequence_steps(id, channel), sequence_enrollments(id, status)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    setSequences(
      (data ?? []).map((s: any) => {
        const steps: any[] = s.sequence_steps ?? [];
        const enrollments: any[] = s.sequence_enrollments ?? [];
        const channels = [...new Set(steps.map((st: any) => st.channel as string).filter(Boolean))];
        return {
          id: s.id, name: s.name, status: s.status,
          steps: steps.length, enrolled: enrollments.length,
          replied: enrollments.filter((e: any) => e.status === 'replied').length,
          channels: channels.length > 0 ? channels : ['email'],
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => { loadSequences(); }, [workspaceId]);

  async function updateStatus(id: string, status: 'active' | 'paused' | 'archived') {
    try {
      const res = await fetch(`${API}/api/v1/sequences/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast(`Sequence ${status}`, 'success');
      loadSequences();
    } catch { toast('Failed to update status', 'error'); }
  }

  const totalEnrolled = sequences.reduce((s, q) => s + q.enrolled, 0);
  const totalReplied = sequences.reduce((s, q) => s + q.replied, 0);
  const avgReplyRate = totalEnrolled > 0 ? Math.round(totalReplied / totalEnrolled * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Outreach"
        description="AI-powered email sequences"
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={() => setShowAI(true)}>AI Generate</Button>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>New Sequence</Button>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-px bg-border border-b border-border">
        {[
          { label: 'Total Enrolled', value: totalEnrolled.toLocaleString() },
          { label: 'Avg Reply Rate', value: `${avgReplyRate}%` },
          { label: 'Active Sequences', value: String(sequences.filter(s => s.status === 'active').length) },
          { label: 'Total Sequences', value: String(sequences.length) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-background px-6 py-3">
            <p className="text-xxs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold mt-0.5">{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sequences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Mail className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No sequences yet</p>
            <p className="text-xs">Create your first outreach sequence to start engaging leads</p>
            <div className="flex gap-2 mt-1">
              <Button variant="outline" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={() => setShowAI(true)}>AI Generate</Button>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>New Sequence</Button>
            </div>
          </div>
        ) : (
          sequences.map((seq) => (
            <Card key={seq.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{seq.name}</h3>
                      <Badge variant={STATUS_BADGE[seq.status] ?? 'muted'}>{seq.status}</Badge>
                      <div className="flex items-center gap-1">
                        {seq.channels.map(ch => (
                          <span key={ch} className="text-muted-foreground">{CHANNEL_ICON[ch]}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{seq.steps} steps</p>
                    <div className="flex items-center gap-6 mt-3">
                      {[
                        { label: 'Enrolled', value: seq.enrolled },
                        { label: 'Replied', value: seq.replied, pct: seq.enrolled ? `${Math.round(seq.replied / seq.enrolled * 100)}%` : '—' },
                      ].map(({ label, value, pct }) => (
                        <div key={label}>
                          <p className="text-xxs text-muted-foreground uppercase tracking-wider">{label}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-semibold">{value}</span>
                            {pct && <span className="text-xxs text-muted-foreground">{pct}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {seq.status === 'active' && (
                      <Button variant="outline" size="sm" icon={<Users className="w-3.5 h-3.5" />} onClick={() => setEnrollTarget(seq)}>Enroll Leads</Button>
                    )}
                    {seq.status === 'active' ? (
                      <Button variant="outline" size="sm" icon={<Pause className="w-3.5 h-3.5" />} onClick={() => updateStatus(seq.id, 'paused')}>Pause</Button>
                    ) : seq.status === 'paused' ? (
                      <Button variant="outline" size="sm" icon={<Play className="w-3.5 h-3.5" />} onClick={() => updateStatus(seq.id, 'active')}>Resume</Button>
                    ) : (
                      <Button size="sm" icon={<Play className="w-3.5 h-3.5" />} onClick={() => updateStatus(seq.id, 'active')}>Launch</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <NewSequenceModal open={showNew} onClose={() => setShowNew(false)} onCreated={loadSequences} />
      <AIGenerateModal open={showAI} onClose={() => setShowAI(false)} onCreated={loadSequences} />
      <EnrollLeadsModal open={!!enrollTarget} onClose={() => setEnrollTarget(null)} sequence={enrollTarget} onEnrolled={loadSequences} />
    </div>
  );
}
