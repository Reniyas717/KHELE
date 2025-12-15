import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { login, register } from '../utils/api';

export default function Login({ onLogin }) {
  const { colors, theme, toggleTheme } = useTheme();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = isRegister 
        ? await register(username, password)
        : await login(username, password);
      
      localStorage.setItem('username', response.user.username);
      onLogin({ username: response.user.username });
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ backgroundColor: colors.background }}
    >
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-3 rounded-xl border transition-all hover:scale-110 z-10"
        style={{
          background: colors.surface,
          borderColor: `${colors.primary}40`,
          backdropFilter: 'blur(10px)'
        }}
      >
        <span className="text-2xl">{theme === 'dark' ? '🌞' : '🌙'}</span>
      </button>

      <div 
        className="rounded-3xl shadow-2xl p-8 w-full max-w-md border"
        style={{
          background: colors.surface,
          borderColor: `${colors.primary}30`,
          backdropFilter: 'blur(20px)'
        }}
      >
        <div className="text-center mb-8">
          <h1 
            className="text-4xl font-orbitron font-black mb-2"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            KHELE
          </h1>
          <p className="font-poppins" style={{ color: colors.textSecondary }}>
            {isRegister ? 'Create your account' : 'Welcome back!'}
          </p>
        </div>

        {error && (
          <div 
            className="px-4 py-3 rounded-lg mb-4 border"
            style={{
              background: 'rgba(220, 38, 38, 0.1)',
              borderColor: 'rgba(220, 38, 38, 0.5)',
              color: '#ef4444'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              className="block font-raleway font-semibold mb-2"
              style={{ color: colors.text }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none font-poppins"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderColor: `${colors.primary}40`,
                color: colors.text
              }}
              required
              minLength={3}
            />
          </div>

          <div>
            <label 
              className="block font-raleway font-semibold mb-2"
              style={{ color: colors.text }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none font-poppins"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderColor: `${colors.primary}40`,
                color: colors.text
              }}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg font-raleway font-bold transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: '#000',
              boxShadow: `0 0 40px ${colors.glow}60`
            }}
          >
            {isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="font-raleway font-semibold hover:underline"
            style={{ color: colors.primary }}
          >
            {isRegister 
              ? 'Already have an account? Login' 
              : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}