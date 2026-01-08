import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      // Dark mode colors
      root.style.setProperty('--color-primary', '#00d9ff');
      root.style.setProperty('--color-secondary', '#a855f7');
      root.style.setProperty('--color-accent', '#ec4899');
      root.style.setProperty('--color-bg', '#0a0e27');
      root.style.setProperty('--color-bg-secondary', '#1a1f3a');
      root.style.setProperty('--color-surface', '#252b4a');
      root.style.setProperty('--color-text', '#f8fafc');
      root.style.setProperty('--color-text-secondary', '#cbd5e1');
      root.style.setProperty('--color-border', 'rgba(0, 217, 255, 0.2)');
    } else {
      root.classList.remove('dark');
      // Light mode colors - Emerald/Orange/Slate theme
      root.style.setProperty('--color-primary', '#10b981'); // Emerald
      root.style.setProperty('--color-secondary', '#f97316'); // Orange
      root.style.setProperty('--color-accent', '#64748b'); // Slate
      root.style.setProperty('--color-bg', '#faf8f5'); // Warm cream
      root.style.setProperty('--color-bg-secondary', '#f5f2ed'); // Light beige
      root.style.setProperty('--color-surface', '#ebe8e3'); // Soft beige
      root.style.setProperty('--color-text', '#0f172a');
      root.style.setProperty('--color-text-secondary', '#475569');
      root.style.setProperty('--color-border', 'rgba(16, 185, 129, 0.2)');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Tailwind-compatible color classes
  const colors = {
    dark: {
      // Tailwind classes for dark mode
      primary: 'text-cyan-400',
      primaryBg: 'bg-cyan-400',
      primaryBorder: 'border-cyan-400',
      primaryHover: 'hover:bg-cyan-500',

      secondary: 'text-purple-500',
      secondaryBg: 'bg-purple-500',
      secondaryBorder: 'border-purple-500',
      secondaryHover: 'hover:bg-purple-600',

      accent: 'text-pink-500',
      accentBg: 'bg-pink-500',
      accentBorder: 'border-pink-500',
      accentHover: 'hover:bg-pink-600',

      bg: 'bg-slate-950',
      bgSecondary: 'bg-slate-900',
      surface: 'bg-slate-800',

      text: 'text-slate-50',
      textSecondary: 'text-slate-300',
      textMuted: 'text-slate-500',

      border: 'border-cyan-400/20',
      borderLight: 'border-cyan-400/10',

      // Hex values for dynamic use
      primaryHex: '#00d9ff',
      secondaryHex: '#a855f7',
      accentHex: '#ec4899',
      bgHex: '#0a0e27',
      textHex: '#f8fafc',
    },
    light: {
      // Tailwind classes for light mode - Emerald/Orange/Slate
      primary: 'text-emerald-600',
      primaryBg: 'bg-emerald-500',
      primaryBorder: 'border-emerald-500',
      primaryHover: 'hover:bg-emerald-600',

      secondary: 'text-orange-600',
      secondaryBg: 'bg-orange-500',
      secondaryBorder: 'border-orange-500',
      secondaryHover: 'hover:bg-orange-600',

      accent: 'text-slate-700',
      accentBg: 'bg-slate-600',
      accentBorder: 'border-slate-600',
      accentHover: 'hover:bg-slate-700',

      bg: 'bg-[#faf8f5]', // Warm cream
      bgSecondary: 'bg-[#f5f2ed]', // Light beige
      surface: 'bg-[#ebe8e3]', // Soft beige

      text: 'text-slate-900',
      textSecondary: 'text-slate-700',
      textMuted: 'text-slate-500',

      border: 'border-emerald-500/20',
      borderLight: 'border-emerald-500/10',

      // Hex values for dynamic use
      primaryHex: '#10b981',
      secondaryHex: '#f97316',
      accentHex: '#64748b',
      bgHex: '#faf8f5',
      textHex: '#0f172a',
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: colors[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};