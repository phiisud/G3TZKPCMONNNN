import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

const themes: Record<string, Theme> = {
  g3tzkp: {
    id: 'g3tzkp',
    name: 'G3ZKP',
    colors: {
      primary: '#00f3ff',
      secondary: '#4caf50',
      background: '#000000',
      surface: '#010401',
      text: '#00f3ff',
      textSecondary: '#4caf50',
      border: '#4caf50',
      error: '#ff0055',
      success: '#4caf50',
      warning: '#ffaa00'
    }
  },
  'manifold-blue': {
    id: 'manifold-blue',
    name: 'Manifold Blue',
    colors: {
      primary: '#1e90ff',
      secondary: '#00ced1',
      background: '#000428',
      surface: 'rgba(30, 144, 255, 0.1)',
      text: '#1e90ff',
      textSecondary: '#00ced1',
      border: '#00ced1',
      error: '#ff0055',
      success: '#00ced1',
      warning: '#9370db'
    }
  },
  multivectoral: {
    id: 'multivectoral',
    name: 'MultiVectoral',
    colors: {
      primary: '#8a2be2',
      secondary: '#00bfff',
      background: '#0a0a12',
      surface: 'rgba(138, 43, 226, 0.05)',
      text: '#00bfff',
      textSecondary: '#32cd32',
      border: '#8a2be2',
      error: '#ff4500',
      success: '#32cd32',
      warning: '#ff4500'
    }
  },
  'neon-pink': {
    id: 'neon-pink',
    name: 'Neon Pink',
    colors: {
      primary: '#ff00ff',
      secondary: '#ff69b4',
      background: '#0d0d0d',
      surface: 'rgba(255, 0, 255, 0.05)',
      text: '#ff00ff',
      textSecondary: '#ff69b4',
      border: '#ff69b4',
      error: '#ff0000',
      success: '#00ff00',
      warning: '#ffff00'
    }
  },
  'phi-gold': {
    id: 'phi-gold',
    name: 'PHI GOLD',
    colors: {
      primary: '#ffd700',
      secondary: '#20b2aa',
      background: '#0a0808',
      surface: 'rgba(255, 215, 0, 0.05)',
      text: '#ffd700',
      textSecondary: '#20b2aa',
      border: '#20b2aa',
      error: '#ff4444',
      success: '#20b2aa',
      warning: '#ff8c00'
    }
  }
};

interface ThemeState {
  currentTheme: string;
  themes: Record<string, Theme>;
  setTheme: (themeId: string) => void;
  getCurrentTheme: () => Theme;
  applyTheme: (themeId?: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      currentTheme: 'g3tzkp',
      themes,

      setTheme: (themeId: string) => {
        if (themes[themeId]) {
          set({ currentTheme: themeId });
          get().applyTheme(themeId);
        }
      },

      getCurrentTheme: () => {
        const themeId = get().currentTheme;
        return themes[themeId] || themes.g3tzkp;
      },

      applyTheme: (themeId?: string) => {
        const theme = themeId ? themes[themeId] : get().getCurrentTheme();
        if (!theme) return;

        const root = document.documentElement;
        
        Object.entries(theme.colors).forEach(([key, value]) => {
          root.style.setProperty(`--color-${key}`, value);
        });

        root.style.backgroundColor = theme.colors.background;
        root.style.color = theme.colors.text;

        document.body.style.backgroundColor = theme.colors.background;
        document.body.style.color = theme.colors.text;
        
        const appElement = document.getElementById('root');
        if (appElement) {
          appElement.style.backgroundColor = theme.colors.background;
          appElement.style.color = theme.colors.text;
        }

        const existingStyle = document.getElementById('g3tzkp-theme-dynamic');
        if (existingStyle) existingStyle.remove();
        
        const styleEl = document.createElement('style');
        styleEl.id = 'g3tzkp-theme-dynamic';
        styleEl.textContent = `
          :root {
            --color-primary: ${theme.colors.primary} !important;
            --color-secondary: ${theme.colors.secondary} !important;
            --color-background: ${theme.colors.background} !important;
            --color-surface: ${theme.colors.surface} !important;
            --color-text: ${theme.colors.text} !important;
            --color-textSecondary: ${theme.colors.textSecondary} !important;
            --color-border: ${theme.colors.border} !important;
            --color-error: ${theme.colors.error} !important;
            --color-success: ${theme.colors.success} !important;
            --color-warning: ${theme.colors.warning} !important;
          }
          
          body, #root {
            background-color: ${theme.colors.background} !important;
            color: ${theme.colors.text} !important;
          }
          
          .theme-primary { color: ${theme.colors.primary} !important; }
          .theme-secondary { color: ${theme.colors.secondary} !important; }
          .theme-bg { background-color: ${theme.colors.background} !important; }
          .theme-surface { background-color: ${theme.colors.surface} !important; }
          .theme-border { border-color: ${theme.colors.border} !important; }
        `;
        document.head.appendChild(styleEl);

        console.log(`[Theme] Applied theme: ${theme.name}`, theme.colors);
      }
    }),
    {
      name: 'g3zkp-theme-storage'
    }
  )
);

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const state = useThemeStore.getState();
    
    if (state.currentTheme === 'cyber-gold') {
      state.setTheme('phi-gold');
    } else if (state.currentTheme === 'tensor-blue') {
      state.setTheme('manifold-blue');
    } else {
      state.applyTheme();
    }
  }, 0);
}
