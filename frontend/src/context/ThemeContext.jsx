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
      secondary: '#00d4ff',
      accent: '#ff00ff',
      background: '#0a0a0f',
      surface: '#1a1a2e',
      text: '#ffffff',
      textSecondary: '#a0a0b0',
      glow: 'rgba(0, 255, 136, 0.3)',
    },
    light: {
      primary: '#00cc70',
      secondary: '#0099cc',
      accent: '#cc00cc',
      background: '#f5f5f7',
      surface: '#ffffff',
      text: '#1a1a2e',
      textSecondary: '#666677',
      glow: 'rgba(0, 204, 112, 0.2)',
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: colors[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};