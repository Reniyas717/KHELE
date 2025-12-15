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
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const colors = {
    dark: {
      primary: '#00ff88',
      secondary: '#FF9FFC',
      accent: '#00d4ff',
      background: '#000000',
      surface: 'rgba(0, 0, 0, 0.6)',
      text: '#ffffff',
      textSecondary: '#a0a0b0',
      glow: '#00ff88',
      gridColor: '#00ff88',
      scanColor: '#FF9FFC',
    },
    light: {
      primary: '#00cc70',
      secondary: '#cc00ff',
      accent: '#0099cc',
      background: '#f5f5f7',
      surface: 'rgba(255, 255, 255, 0.9)',
      text: '#1a1a2e',
      textSecondary: '#666677',
      glow: '#00cc70',
      gridColor: '#00cc70',
      scanColor: '#cc00ff',
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: colors[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};