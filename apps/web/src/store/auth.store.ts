import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthStore {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  session: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
