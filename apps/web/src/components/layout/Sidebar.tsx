import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, Mail, FileText,
  BarChart2, Settings, Search, Plus,
  Zap, LogOut, ChevronsUpDown, Sun, Moon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/auth.store';
import { useCommandStore } from '@/store/command.store';
import { useThemeStore } from '@/store/theme.store';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: Users, label: 'Leads', to: '/leads', badge: '2.4k' },
  { icon: Briefcase, label: 'Deals', to: '/deals' },
  { icon: Mail, label: 'Outreach', to: '/outreach' },
  { icon: FileText, label: 'Proposals', to: '/proposals' },
  { icon: BarChart2, label: 'Analytics', to: '/analytics' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { setOpen } = useCommandStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-full overflow-hidden bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]">
      {/* Workspace Switcher */}
      <div className="p-2">
        <button
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[hsl(var(--sidebar-item-hover))] transition-colors"
        >
          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="flex-1 text-left text-sm font-semibold text-[hsl(var(--sidebar-foreground))] truncate">
            SalesBuddy
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-[hsl(var(--sidebar-foreground-muted))]" />
        </button>
      </div>

      {/* Search / Command */}
      <div className="px-2 pb-2">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-[hsl(var(--sidebar-item-hover))] hover:bg-[hsl(var(--sidebar-item-active))] transition-colors text-[hsl(var(--sidebar-foreground-muted))]"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left text-xs">Search...</span>
          <kbd className="text-xxs border border-border rounded px-1">⌘K</kbd>
        </button>
      </div>

      <div className="px-2 pb-1">
        <p className="text-xxs font-medium text-[hsl(var(--sidebar-foreground-muted))] px-2 pb-1 uppercase tracking-wider">
          Workspace
        </p>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ icon: Icon, label, to, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx('sidebar-item group', isActive && 'active')
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-sm">{label}</span>
            {badge && (
              <span className="text-xxs text-[hsl(var(--sidebar-foreground-muted))]">
                {badge}
              </span>
            )}
          </NavLink>
        ))}

        <div className="pt-2 pb-1">
          <p className="text-xxs font-medium text-[hsl(var(--sidebar-foreground-muted))] px-2 pb-1 uppercase tracking-wider">
            Quick Add
          </p>
        </div>

        <button className="sidebar-item w-full">
          <Plus className="w-4 h-4 text-[hsl(var(--sidebar-foreground-muted))]" />
          <span className="text-sm text-[hsl(var(--sidebar-foreground-muted))]">New Lead</span>
        </button>
        <button className="sidebar-item w-full">
          <Plus className="w-4 h-4 text-[hsl(var(--sidebar-foreground-muted))]" />
          <span className="text-sm text-[hsl(var(--sidebar-foreground-muted))]">New Deal</span>
        </button>
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-[hsl(var(--sidebar-border))] space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx('sidebar-item', isActive && 'active')
          }
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </NavLink>

        <button onClick={toggleTheme} className="sidebar-item w-full">
          {theme === 'dark'
            ? <Sun className="w-4 h-4 text-[hsl(var(--sidebar-foreground-muted))]" />
            : <Moon className="w-4 h-4 text-[hsl(var(--sidebar-foreground-muted))]" />
          }
          <span className="text-sm text-[hsl(var(--sidebar-foreground-muted))]">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

        {/* User */}
        <button
          onClick={async () => { await logout(); navigate('/login'); }}
          className="sidebar-item w-full"
        >
          <Avatar
            src={user?.user_metadata?.['avatar_url']}
            fallback={(user?.user_metadata?.['name'] ?? user?.email ?? 'U')[0].toUpperCase()}
            size="xs"
          />
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-medium text-[hsl(var(--sidebar-foreground))] truncate">
              {user?.user_metadata?.['name'] ?? user?.email ?? 'User'}
            </p>
            <p className="text-xxs text-[hsl(var(--sidebar-foreground-muted))] truncate">
              {user?.email ?? ''}
            </p>
          </div>
          <LogOut className="w-3.5 h-3.5 text-[hsl(var(--sidebar-foreground-muted))] flex-shrink-0" />
        </button>
      </div>
    </aside>
  );
}
