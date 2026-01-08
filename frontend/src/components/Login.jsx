import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { login, register } from '../utils/api';
import { IoSunnyOutline, IoMoonOutline, IoArrowBack } from 'react-icons/io5';
import PixelSnow from './ui/PixelSnow';

export default function Login({ onLogin }) {
  const { colors, theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
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
      navigate('/lobby');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#00d9ff' : '#10b981';
  const snowDensity = theme === 'dark' ? 0.1 : 0.08;
  const snowBrightness = theme === 'dark' ? 0.5 : 0.3;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative ${colors.bg} transition-colors duration-300`}>
      {/* PixelSnow Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
        <PixelSnow
          color={snowColor}
          flakeSize={0.008}
          minFlakeSize={1.5}
          pixelResolution={180}
          speed={0.6}
          density={snowDensity}
          brightness={snowBrightness}
          direction={135}
          variant="round"
        />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className={`absolute top-4 left-4 p-3 rounded-xl border transition-all hover:scale-110 z-10 backdrop-blur-xl ${colors.surface} ${colors.border}`}
        aria-label="Back to landing"
      >
        <IoArrowBack className={`w-5 h-5 ${colors.primary}`} />
      </button>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-4 right-4 p-3 rounded-xl border transition-all hover:scale-110 z-10 backdrop-blur-xl ${colors.surface} ${colors.border}`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <IoSunnyOutline className="w-5 h-5" />
        ) : (
          <IoMoonOutline className="w-5 h-5" />
        )}
      </button>

      <div className={`relative z-10 rounded-3xl shadow-2xl p-8 w-full max-w-md border backdrop-blur-xl ${colors.surface} ${colors.border}`}>
        <div className="text-center mb-8">
          <h1 className={`font-display text-4xl md:text-5xl font-black mb-2 ${colors.primary}`}>
            KHELE
          </h1>
          <p className={`font-body ${colors.textSecondary}`}>
            {isRegister ? 'Create your account' : 'Welcome back!'}
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg mb-4 border bg-red-500/10 border-red-500/50 text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block font-accent font-semibold mb-2 ${colors.text}`}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border-2 focus:outline-none font-body ${colors.bgSecondary} ${colors.border} ${colors.text} focus:${colors.primaryBorder}`}
              required
              minLength={3}
            />
          </div>

          <div>
            <label className={`block font-accent font-semibold mb-2 ${colors.text}`}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border-2 focus:outline-none font-body ${colors.bgSecondary} ${colors.border} ${colors.text} focus:${colors.primaryBorder}`}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className={`w-full py-3 rounded-lg font-accent font-bold transition-all hover:scale-105 ${colors.primaryBg} ${colors.primaryHover} text-white shadow-xl`}
          >
            {isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className={`font-accent font-semibold hover:underline ${colors.primary}`}
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