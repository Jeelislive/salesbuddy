import { Outlet } from 'react-router-dom';
import { Zap } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[hsl(var(--sidebar-bg))] border-r border-border flex-col p-12 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold">SalesBuddy</span>
        </div>
        <div>
          <blockquote className="space-y-3">
            <p className="text-xl font-medium leading-relaxed">
              "SalesBuddy replaced our entire 5-person SDR team. We now close more deals with zero manual outreach."
            </p>
            <footer className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                AK
              </div>
              <div>
                <p className="text-sm font-semibold">Alex Kumar</p>
                <p className="text-xs text-muted-foreground">Head of Revenue, TechCorp</p>
              </div>
            </footer>
          </blockquote>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 SalesBuddy. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Outlet />
      </div>
    </div>
  );
}
