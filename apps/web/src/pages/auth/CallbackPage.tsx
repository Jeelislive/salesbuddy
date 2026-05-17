import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function CallbackPage() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    const redirect = (session: import('@supabase/supabase-js').Session | null) => {
      if (handled.current) return;
      handled.current = true;
      if (session) {
        setSession(session);
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    };

    // detectSessionInUrl auto-exchanges the PKCE code; wait for the event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') redirect(session);
    });

    // Fast path: exchange may have already completed before this effect ran.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirect(session);
    });

    // Timeout: if nothing resolves in 10s, bail to login.
    const timer = setTimeout(() => redirect(null), 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate, setSession]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
