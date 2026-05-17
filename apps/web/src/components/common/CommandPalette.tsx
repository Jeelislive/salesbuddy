import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Users, Briefcase, Mail, FileText, BarChart2, Settings, Plus } from 'lucide-react';
import { useCommandStore } from '@/store/command.store';

const COMMANDS = [
  { group: 'Navigate', items: [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard', shortcut: 'G D' },
    { icon: Users, label: 'Leads', to: '/leads', shortcut: 'G L' },
    { icon: Briefcase, label: 'Deals', to: '/deals', shortcut: 'G E' },
    { icon: Mail, label: 'Outreach', to: '/outreach', shortcut: 'G O' },
    { icon: FileText, label: 'Proposals', to: '/proposals', shortcut: 'G P' },
    { icon: BarChart2, label: 'Analytics', to: '/analytics', shortcut: 'G A' },
    { icon: Settings, label: 'Settings', to: '/settings', shortcut: 'G S' },
  ]},
  { group: 'Create', items: [
    { icon: Plus, label: 'New Lead', to: '/leads?new=true', shortcut: 'C L' },
    { icon: Plus, label: 'New Deal', to: '/deals?new=true', shortcut: 'C D' },
    { icon: Plus, label: 'New Sequence', to: '/outreach?new=true', shortcut: 'C S' },
  ]},
];

export function CommandPalette() {
  const { setOpen } = useCommandStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search or jump to..."
          />
          <kbd className="text-xxs border border-border rounded px-1.5 py-0.5 text-muted-foreground">ESC</kbd>
        </div>

        {/* Commands */}
        <div className="max-h-80 overflow-y-auto py-2">
          {COMMANDS.map(({ group, items }) => (
            <div key={group}>
              <p className="text-xxs font-medium text-muted-foreground px-4 py-1.5 uppercase tracking-wider">{group}</p>
              {items.map(({ icon: Icon, label, to, shortcut }) => (
                <button
                  key={to}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-accent transition-colors text-left"
                  onClick={() => { navigate(to); setOpen(false); }}
                >
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">{label}</span>
                  <kbd className="text-xxs text-muted-foreground">{shortcut}</kbd>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
