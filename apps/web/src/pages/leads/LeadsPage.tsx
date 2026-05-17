import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, Filter, Download, Sparkles, MoreHorizontal,
  Loader2, UserPlus, CheckCircle, X, ChevronDown, Trash2,
  Upload, FileText, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/Toast';

/* ── Types ── */
interface Lead {
  id: string; name: string; email: string; company: string;
  title: string; score: number;
  status: 'qualified' | 'contacted' | 'new' | 'disqualified';
  source: string; createdAt: string; avatar?: string;
}

interface ApiLead {
  businessName: string; email?: string; website?: string; score: number;
  rawData: { avatar?: string; company?: string; bio?: string; login?: string; twitter?: string; producthuntUrl?: string; redditUrl?: string };
  socialLinks?: Record<string, string>;
}

interface CsvRow { first_name: string; last_name: string; email: string; company_name: string; title: string; source: string }

/* ── Constants ── */
const STATUS_BADGE: Record<string, 'success' | 'primary' | 'muted' | 'danger'> = {
  qualified: 'success', contacted: 'primary', new: 'muted', disqualified: 'danger',
};
const ALL_STATUSES = ['all', 'new', 'qualified', 'contacted', 'disqualified'];

/* ── CSV helpers ── */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').replace(/^["']|["']$/g, ''); });
    return row;
  }).filter(r => Object.values(r).some(v => v.trim()));
}

function mapCSVRow(row: Record<string, string>): CsvRow {
  const full = row.name ?? row.full_name ?? row.contact ?? '';
  const parts = full.split(' ');
  return {
    first_name: row.first_name ?? parts[0] ?? '',
    last_name:  row.last_name  ?? parts.slice(1).join(' ') ?? '',
    email:       row.email ?? row.email_address ?? '',
    company_name: row.company ?? row.company_name ?? row.organization ?? '',
    title:       row.title ?? row.job_title ?? row.position ?? row.role ?? '',
    source:      row.source ?? 'CSV Import',
  };
}

function toCSV(leads: Lead[]) {
  const h = 'Name,Email,Company,Title,Score,Status,Source,Date';
  const rows = leads.map(l =>
    [l.name, l.email, l.company, l.title, l.score, l.status, l.source, l.createdAt]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  );
  return [h, ...rows].join('\n');
}

function downloadCSV(content: string, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  a.download = name; a.click();
}

function apiLeadToName(l: ApiLead) { return l.businessName || l.rawData.login || 'Unknown'; }
function apiLeadToCompany(l: ApiLead) { return (l.rawData.company || '').replace(/^@/, ''); }
function apiLeadToTitle(l: ApiLead) {
  return (l.rawData.bio ?? '').split(/[\n|•·]/)[0].trim().slice(0, 70);
}

/* ─────────────────────── Find Leads Modal ─────────────────────── */
function FindLeadsModal({ open, onClose, onImport, workspaceId, session }: {
  open: boolean; onClose: () => void; onImport: (l: Lead) => void;
  workspaceId: string | null; session: import('@supabase/supabase-js').Session | null;
}) {
  const [prompt, setPrompt]   = useState('');
  const [limit, setLimit]     = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ApiLead[]>([]);
  const [aiQuery, setAiQuery] = useState('');
  const [error, setError]     = useState('');
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [importingAll, setImportingAll] = useState(false);

  async function search() {
    if (!prompt.trim()) return;
    if (!session?.access_token) { setError('You must be signed in to search for leads.'); return; }
    setLoading(true); setError(''); setResults([]); setAiQuery('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/leads/ai-discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt, limit }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const d = await res.json();
      setAiQuery(d.query ?? prompt.trim());
      setResults(d.leads ?? []);
    } catch (e: any) { setError(e.message || 'Search failed'); }
    finally { setLoading(false); }
  }

  async function importLead(l: ApiLead) {
    const key = l.rawData.login || l.businessName;
    if (imported.has(key) || !workspaceId) return;
    const nameParts = apiLeadToName(l).split(' ');
    const { data } = await supabase.from('leads').insert({
      workspace_id: workspaceId,
      first_name: nameParts[0] ?? '', last_name: nameParts.slice(1).join(' ') ?? '',
      email: l.email ?? null, company_name: apiLeadToCompany(l) || null,
      title: apiLeadToTitle(l) || null, score: l.score,
      status: l.score >= 80 ? 'qualified' : 'new', source: 'AI Discovery',
      metadata: { avatar: l.rawData.avatar, website: l.website },
    }).select('id, first_name, last_name, email, company_name, title, score, status, source, created_at').single();
    if (data) {
      setImported(prev => new Set([...prev, key]));
      onImport({ id: data.id, name: `${data.first_name} ${data.last_name}`.trim(),
        email: data.email ?? '', company: data.company_name ?? '', title: data.title ?? '',
        score: data.score, status: (data.status ?? 'new') as Lead['status'],
        source: 'AI Discovery', createdAt: data.created_at, avatar: l.rawData.avatar });
    }
  }

  async function importAll() {
    setImportingAll(true);
    for (const l of results) await importLead(l);
    setImportingAll(false);
  }

  const notImported = results.filter(l => !imported.has(l.rawData.login || l.businessName));

  return (
    <Dialog open={open} onClose={onClose} title="Find Leads with AI"
      description="Describe who you're looking for — AI optimizes and searches" size="xl" noPadding>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="p-6 space-y-3 border-b border-border">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) search(); }}
            placeholder={'e.g. "SaaS founders raising Series A"\nor "CTOs at B2B fintech startups"'}
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              AI refines your prompt to find best-match contacts
              {aiQuery && aiQuery !== prompt && <span className="text-primary font-medium">· "{aiQuery}"</span>}
            </div>
            <div className="flex items-center gap-2">
              <select value={limit} onChange={e => setLimit(Number(e.target.value))}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
                {[10, 20, 50].map(n => <option key={n} value={n}>{n} results</option>)}
              </select>
              <Button onClick={search} disabled={loading || !prompt.trim()} size="sm"
                icon={loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}>
                {loading ? 'Searching…' : 'Search'}
              </Button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Searching for matching leads…</p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <>
              {notImported.length > 0 && (
                <div className="sticky top-0 bg-card border-b border-border px-6 py-2.5 flex items-center justify-between z-10">
                  <p className="text-xs text-muted-foreground">{results.length} leads found</p>
                  <Button variant="secondary" size="sm" onClick={importAll} disabled={importingAll}
                    icon={importingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}>
                    {importingAll ? 'Importing…' : `Import all (${notImported.length})`}
                  </Button>
                </div>
              )}
              <div className="divide-y divide-border">
                {results.map((l, i) => {
                  const key = l.rawData.login || l.businessName;
                  const done = imported.has(key);
                  return (
                    <div key={i} className="flex items-center gap-4 px-6 py-3.5 hover:bg-accent/40 transition-colors">
                      {l.rawData.avatar
                        ? <img src={l.rawData.avatar} className="w-9 h-9 rounded-full flex-shrink-0 object-cover" alt="" />
                        : <Avatar fallback={(apiLeadToName(l)[0] || '?').toUpperCase()} size="sm" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{apiLeadToName(l)}</p>
                          {l.email && <span className="text-xs text-muted-foreground">{l.email}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          {apiLeadToCompany(l) && <span>{apiLeadToCompany(l)}</span>}
                          {apiLeadToTitle(l) && <><span>·</span><span className="truncate max-w-xs">{apiLeadToTitle(l)}</span></>}
                          {l.website && <><span>·</span>
                            <a href={l.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              className="text-primary hover:underline truncate max-w-[200px]">
                              {l.website.replace(/^https?:\/\//, '').split('/')[0]}
                            </a></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${l.score}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums w-6">{l.score}</span>
                      </div>
                      <button onClick={() => importLead(l)} disabled={done || !workspaceId}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex-shrink-0 ${
                          done ? 'text-emerald-500 bg-emerald-500/10 cursor-default'
                               : 'text-foreground bg-secondary hover:bg-border border border-border'}`}>
                        {done ? <><CheckCircle className="w-3 h-3" />Imported</> : <>+ Import</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Sparkles className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">Describe your ideal lead above</p>
              <p className="text-xs text-center max-w-xs">
                Try "startup founders in fintech", "CTOs at Series B companies", or "growth marketers in SaaS"
              </p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/* ─────────────────────── Add Lead Modal (manual + CSV) ─────────────────────── */
function AddLeadModal({ open, onClose, onAdd, workspaceId }: {
  open: boolean; onClose: () => void;
  onAdd: (leads: Lead[]) => void; workspaceId: string | null;
}) {
  const [tab, setTab]     = useState<'manual' | 'csv'>('manual');
  const [form, setForm]   = useState({ first_name: '', last_name: '', email: '', company_name: '', title: '', status: 'new' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // CSV state
  const [csvRows, setCsvRows]     = useState<CsvRow[]>([]);
  const [csvFile, setCsvFile]     = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setForm({ first_name: '', last_name: '', email: '', company_name: '', title: '', status: 'new' });
    setCsvRows([]); setCsvFile(null); setError('');
  }

  async function saveManual() {
    if (!form.first_name.trim() || !workspaceId) return;
    setSaving(true); setError('');
    const { data, error: err } = await supabase.from('leads').insert({
      workspace_id: workspaceId, first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      email: form.email.trim() || null, company_name: form.company_name.trim() || null,
      title: form.title.trim() || null, status: form.status, source: 'Manual', score: 0,
    }).select('id, first_name, last_name, email, company_name, title, score, status, source, created_at').single();
    if (err) { setError(err.message); setSaving(false); return; }
    if (data) {
      onAdd([{ id: data.id, name: `${data.first_name} ${data.last_name}`.trim(),
        email: data.email ?? '', company: data.company_name ?? '', title: data.title ?? '',
        score: 0, status: (data.status ?? 'new') as Lead['status'], source: 'Manual', createdAt: data.created_at }]);
      reset(); onClose();
    }
    setSaving(false);
  }

  function handleFile(file: File) {
    setCsvFile(file); setError('');
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseCSV(e.target?.result as string).map(mapCSVRow);
        if (rows.length === 0) { setError('No valid rows found in CSV'); return; }
        setCsvRows(rows);
      } catch { setError('Failed to parse CSV file'); }
    };
    reader.readAsText(file);
  }

  async function importCSV() {
    if (!csvRows.length || !workspaceId) return;
    setImporting(true); setError('');
    const batch = csvRows.map(r => ({
      workspace_id: workspaceId,
      first_name: r.first_name || r.email.split('@')[0] || 'Unknown',
      last_name: r.last_name || '',
      email: r.email || null,
      company_name: r.company_name || null,
      title: r.title || null,
      source: r.source || 'CSV Import',
      score: 0, status: 'new',
    }));

    const { data, error: err } = await supabase.from('leads').insert(batch)
      .select('id, first_name, last_name, email, company_name, title, score, status, source, created_at');
    if (err) { setError(err.message); setImporting(false); return; }
    const imported: Lead[] = (data ?? []).map(l => ({
      id: l.id, name: `${l.first_name} ${l.last_name}`.trim(),
      email: l.email ?? '', company: l.company_name ?? '', title: l.title ?? '',
      score: 0, status: (l.status ?? 'new') as Lead['status'],
      source: l.source, createdAt: l.created_at,
    }));
    onAdd(imported); reset(); onClose(); setImporting(false);
  }

  const field = (label: string, key: keyof typeof form, type = 'text', ph = '') => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={form[key]} placeholder={ph}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
    </div>
  );

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} title="Add Leads" size="md" noPadding>
      {/* Tabs */}
      <div className="flex border-b border-border px-6">
        {(['manual', 'csv'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-2.5 px-1 mr-4 text-xs font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'manual' ? 'Manual Entry' : 'Import CSV'}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'manual' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {field('First Name *', 'first_name', 'text', 'John')}
              {field('Last Name', 'last_name', 'text', 'Doe')}
            </div>
            {field('Email', 'email', 'email', 'john@company.com')}
            {field('Company', 'company_name', 'text', 'Acme Inc.')}
            {field('Job Title', 'title', 'text', 'VP Engineering')}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="new">New</option>
                <option value="qualified">Qualified</option>
                <option value="contacted">Contacted</option>
                <option value="disqualified">Disqualified</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={saveManual} disabled={saving || !form.first_name.trim()} className="flex-1">
                {saving ? 'Adding…' : 'Add Lead'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              {csvFile
                ? <p className="text-sm font-medium">{csvFile.name}</p>
                : <p className="text-sm text-muted-foreground">Drop a CSV file or click to browse</p>}
              <p className="text-xs text-muted-foreground mt-1">Supports: name, email, company, title, source columns</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {/* Preview */}
            {csvRows.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Preview — {csvRows.length} rows detected
                </p>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Name', 'Email', 'Company', 'Title'].map(h => (
                          <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {csvRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-accent/30">
                          <td className="px-3 py-1.5">{`${r.first_name} ${r.last_name}`.trim() || '—'}</td>
                          <td className="px-3 py-1.5">{r.email || '—'}</td>
                          <td className="px-3 py-1.5">{r.company_name || '—'}</td>
                          <td className="px-3 py-1.5">{r.title || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground py-2 bg-muted/30">
                      +{csvRows.length - 5} more rows
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-500">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={importCSV} disabled={importing || csvRows.length === 0} className="flex-1"
                icon={importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}>
                {importing ? 'Importing…' : `Import ${csvRows.length} Leads`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/* ─────────────────────── Main Page ─────────────────────── */
export function LeadsPage() {
  const { workspaceId }   = useWorkspaceStore();
  const { session }       = useAuthStore();
  const { toast }         = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [findOpen, setFindOpen]   = useState(false);
  const [addOpen, setAddOpen]     = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [deleting, setDeleting]   = useState(false);

  const loadLeads = useCallback(async () => {
    if (!workspaceId) return;
    setDbLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('id, first_name, last_name, email, company_name, title, score, status, source, created_at, metadata')
      .eq('workspace_id', workspaceId).is('deleted_at', null)
      .order('created_at', { ascending: false });
    setLeads((data ?? []).map(l => ({
      id: l.id, name: `${l.first_name} ${l.last_name}`.trim() || '—',
      email: l.email ?? '', company: l.company_name ?? '—', title: l.title ?? '',
      score: l.score ?? 0, status: (l.status ?? 'new') as Lead['status'],
      source: l.source ?? 'Manual', createdAt: l.created_at,
      avatar: (l.metadata as any)?.avatar,
    })));
    setDbLoading(false);
  }, [workspaceId]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const filtered = leads.filter(l => {
    const s = search.toLowerCase();
    const matchSearch = !s || l.name.toLowerCase().includes(s) || l.company.toLowerCase().includes(s) || l.email.toLowerCase().includes(s);
    return matchSearch && (statusFilter === 'all' || l.status === statusFilter);
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id));

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  }

  async function handleDeleteSelected(ids: string[]) {
    if (!ids.length || !workspaceId) return;
    setDeleting(true);
    const { error } = await supabase.from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids).eq('workspace_id', workspaceId);
    if (!error) {
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
      setSelected(new Set());
      toast(`Deleted ${ids.length} lead${ids.length !== 1 ? 's' : ''}`, 'success');
    } else {
      toast('Delete failed: ' + error.message, 'error');
    }
    setDeleting(false);
  }

  function handleExport() {
    if (!filtered.length) return;
    downloadCSV(toCSV(filtered), `leads-${new Date().toISOString().split('T')[0]}.csv`);
  }

  async function handleEnrich() {
    if (enriching || !session?.access_token || !filtered.length) return;
    setEnriching(true);
    toast(`Enriching ${Math.min(filtered.length, 20)} leads with AI…`, 'info');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/leads/enrich-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ lead_ids: filtered.slice(0, 20).map(l => l.id) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as any).code === 'NO_AI_KEY'
          ? 'Add ANTHROPIC_API_KEY to apps/api/.env'
          : 'Enrichment failed — is the API server running?', 'error');
        return;
      }
      const { enriched } = await res.json();
      toast(`Enriched ${enriched} leads`, 'success');
      await loadLeads();
    } finally { setEnriching(false); }
  }

  return (
    <div className="h-full flex flex-col relative">
      <PageHeader
        title="Leads"
        description={dbLoading ? 'Loading…' : `${leads.length} contacts in your workspace`}
        actions={
          <>
            <div className="relative">
              <Button variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />}
                onClick={() => setFilterOpen(o => !o)}>
                {statusFilter === 'all' ? 'Filter' : statusFilter}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
              {filterOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-xl z-20 py-1">
                  {ALL_STATUSES.map(s => (
                    <button key={s} onClick={() => { setStatus(s); setFilterOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-accent transition-colors ${statusFilter === s ? 'text-primary font-medium' : ''}`}>
                      {s === 'all' ? 'All statuses' : s}
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <button onClick={() => { handleDeleteSelected(filtered.map(l => l.id)); setFilterOpen(false); }}
                      disabled={filtered.length === 0}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-40">
                      <Trash2 className="w-3 h-3" /> Delete all visible ({filtered.length})
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExport} disabled={filtered.length === 0}>Export</Button>

            <Button variant="secondary" size="sm" disabled={enriching || filtered.length === 0}
              icon={enriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              onClick={handleEnrich}>
              {enriching ? 'Enriching…' : 'AI Enrich'}
            </Button>

            <Button variant="outline" size="sm" icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={() => setFindOpen(true)}>Find Leads</Button>

            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setAddOpen(true)}>Add Lead</Button>
          </>
        }
      />

      {/* Search */}
      <div className="px-6 py-3 border-b border-border">
        <Input placeholder="Search by name, company, or email…" icon={<Search className="w-3.5 h-3.5" />}
          className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {dbLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            {leads.length === 0 ? (
              <>
                <UserPlus className="w-10 h-10 opacity-20" />
                <p className="text-sm font-medium">No leads yet</p>
                <p className="text-xs">Find contacts with AI or add them manually / via CSV</p>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setFindOpen(true)}>Find Leads</Button>
                  <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAddOpen(true)}>Add Lead</Button>
                </div>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 opacity-20" />
                <p className="text-sm">No leads match your filters</p>
                <button className="text-xs text-primary hover:underline" onClick={() => { setSearch(''); setStatus('all'); }}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b border-border z-10">
              <tr className="text-xxs text-muted-foreground uppercase tracking-wider">
                <th className="w-10 pl-4 py-2.5">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium">Company</th>
                <th className="text-left px-4 py-2.5 font-medium">Title</th>
                <th className="text-left px-4 py-2.5 font-medium">AI Score</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Source</th>
                <th className="text-left px-4 py-2.5 font-medium">Added</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(lead => (
                <tr key={lead.id}
                  className={`hover:bg-accent/50 transition-colors cursor-pointer group ${selected.has(lead.id) ? 'bg-primary/5' : ''}`}>
                  <td className="w-10 pl-4 py-3">
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {lead.avatar
                        ? <img src={lead.avatar} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                        : <Avatar fallback={(lead.name[0] || '?').toUpperCase()} size="sm" />}
                      <div>
                        <p className="text-sm font-medium">{lead.name}</p>
                        {lead.email && <p className="text-xxs text-muted-foreground">{lead.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{lead.company}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px] truncate">{lead.title || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${lead.score}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[lead.status] ?? 'muted'}>{lead.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{lead.source}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteSelected([lead.id]); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card border border-border rounded-xl shadow-xl px-4 py-2.5 z-30">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="w-px h-4 bg-border" />
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Deselect all
          </button>
          <Button variant="outline" size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={() => downloadCSV(toCSV(leads.filter(l => selected.has(l.id))), 'selected-leads.csv')}>
            Export
          </Button>
          <Button size="sm"
            icon={deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            className="bg-red-500 hover:bg-red-600 text-white border-red-500"
            onClick={() => handleDeleteSelected([...selected])}
            disabled={deleting}>
            Delete {selected.size}
          </Button>
        </div>
      )}

      {/* Modals */}
      <FindLeadsModal open={findOpen} onClose={() => setFindOpen(false)}
        onImport={l => setLeads(prev => [l, ...prev])} workspaceId={workspaceId} session={session} />
      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)}
        onAdd={newLeads => setLeads(prev => [...newLeads, ...prev])} workspaceId={workspaceId} />
    </div>
  );
}
