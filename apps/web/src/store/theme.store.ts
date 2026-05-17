import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () =>
        set((s) => {
          const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          return { theme: next };
        }),
    }),
    {
      name: 'salesbuddy-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);
