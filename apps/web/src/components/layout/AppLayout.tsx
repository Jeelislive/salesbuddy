import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '@/components/common/CommandPalette';
import { useCommandStore } from '@/store/command.store';

export function AppLayout() {
  const { open } = useCommandStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
      {open && <CommandPalette />}
    </div>
  );
}
