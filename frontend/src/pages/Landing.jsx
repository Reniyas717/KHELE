import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import PixelSnow from '../components/ui/PixelSnow';
import {
  IoFlashSharp,
  IoGlobeOutline,
  IoTrophySharp,
  IoSunnyOutline,
  IoMoonOutline,
  IoArrowForward,
  IoGameController,
  IoPeopleSharp,
  IoBrushSharp,
  IoColorPaletteSharp,
  IoSparklesSharp,
  IoTimerOutline,
  IoHomeSharp,
  IoRibbonSharp,
  IoSpeedometerSharp,
  IoShieldCheckmarkSharp,
  IoEarthSharp,
  IoLocateSharp,
  IoChatbubblesSharp,
  IoStarSharp,
  IoRocketSharp,
  IoDocumentTextSharp,
  IoCheckmarkCircleSharp
} from 'react-icons/io5';
import { FaIdCard } from 'react-icons/fa6';
import { MdSmartToy } from 'react-icons/md';

const Landing = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [currentWord, setCurrentWord] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const navigate = useNavigate();
  const { theme, toggleTheme, colors } = useTheme();

  const introWords = ['KHELE', 'Where Gaming', 'Meets Excellence'];

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!showIntro) return;

    const wordInterval = setInterval(() => {
      setCurrentWord(prev => {
        if (prev >= introWords.length - 1) {
          clearInterval(wordInterval);
          setTimeout(() => setShowIntro(false), 600);
          return prev;
        }
        return prev + 1;
      });
    }, 700);

    return () => clearInterval(wordInterval);
  }, [showIntro]);

  // Intro Animation
  if (showIntro) {
    return (
      <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${colors.bg} transition-all duration-500`}>
        <div className="text-center animate-fade-in">
          <h1 className={`font-display text-6xl md:text-8xl font-black ${colors.primary}`}>
            {introWords[currentWord]}
          </h1>
        </div>
      </div>
    );
  }

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#00d9ff' : '#10b981';
  const snowDensity = theme === 'dark' ? 0.15 : 0.1;
  const snowBrightness = theme === 'dark' ? 0.6 : 0.4;

  return (
    <div className={`relative w-full min-h-screen ${colors.bg} transition-colors duration-300`}>
      {/* Animated PixelSnow Background with Parallax */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          transform: `translateY(${scrollY * 0.5}px)`,
          opacity: 0.6
        }}
      >
        <PixelSnow
          color={snowColor}
          flakeSize={0.008}
          minFlakeSize={1.5}
          pixelResolution={180}
          speed={0.8}
          density={snowDensity}
          brightness={snowBrightness}
          direction={135}
          variant="round"
        />
      </div>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b ${colors.border} ${colors.bgSecondary}/80`}>
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <h2 className={`font-display text-2xl md:text-3xl font-black ${colors.primary}`}>
            KHELE
          </h2>

          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl text-xl hover:scale-110 transition-all duration-300 border ${colors.border} ${colors.surface}`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <IoSunnyOutline className="w-5 h-5" /> : <IoMoonOutline className="w-5 h-5" />}
            </button>

            <button
              onClick={() => navigate('/login')}
              className={`font-accent font-bold px-4 md:px-6 py-2 rounded-xl text-sm ${colors.primaryBg} ${colors.primaryHover} text-white hover:scale-105 hover:shadow-xl transition-all duration-300`}
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 pt-20">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-4 md:px-6 py-12 md:py-20">
          <div
            className="container mx-auto max-w-6xl text-center"
            style={{
              transform: `translateY(${scrollY * 0.2}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border ${colors.border} ${colors.surface} backdrop-blur-xl animate-fade-in`}>
              <IoFlashSharp className="w-4 h-4 md:w-5 md:h-5" />
              <span className={`font-accent text-xs font-bold tracking-wider ${colors.primary}`}>
                NEXT-GEN GAMING PLATFORM
              </span>
            </div>

            {/* Main Title */}
            <h1 className={`font-display text-5xl md:text-7xl lg:text-9xl font-black mb-6 leading-none ${colors.primary} animate-fade-in`}>
              KHELE
            </h1>

            {/* Subtitle */}
            <p className={`font-body text-lg md:text-2xl mb-8 font-light ${colors.textSecondary} animate-fade-in`}>
              Where Champions Are Born
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-10 animate-fade-in">
              {[
                { icon: IoFlashSharp, label: 'Lightning Fast' },
                { icon: IoGlobeOutline, label: 'Global Play' },
                { icon: IoTrophySharp, label: 'Real Rewards' }
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-4 md:px-5 py-2 md:py-3 rounded-xl border ${colors.border} ${colors.surface} backdrop-blur-xl hover:scale-105 transition-all duration-300`}
                >
                  <item.icon className="w-5 h-5 md:w-6 md:h-6" />
                  <span className={`font-accent text-xs md:text-sm font-semibold ${colors.text}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <button
              onClick={() => navigate('/login')}
              className={`group font-accent font-black px-8 md:px-12 py-3 md:py-4 rounded-2xl text-base md:text-lg ${colors.primaryBg} ${colors.primaryHover} text-white hover:scale-105 hover:shadow-2xl transition-all duration-300 animate-fade-in`}
            >
              <span className="flex items-center gap-3">
                Start Playing Free
                <IoArrowForward className="group-hover:translate-x-2 transition-transform duration-300 w-5 h-5" />
              </span>
            </button>
          </div>
        </section>

        {/* Games Section */}
        <section
          className="py-12 md:py-20 px-4 md:px-6"
          style={{
            transform: `translateY(${scrollY * 0.15}px)`,
            transition: 'transform 0.1s ease-out'
          }}
        >
          <div className="container mx-auto max-w-7xl">
            <h2 className={`font-display text-3xl md:text-5xl lg:text-6xl font-black text-center mb-12 md:mb-16 ${colors.text}`}>
              Featured Games
            </h2>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              {/* UNO Card */}
              <div className={`group relative p-6 md:p-8 rounded-3xl border ${colors.border} ${colors.surface} backdrop-blur-xl hover:scale-[1.02] transition-all duration-500`}>
                <div className={`text-5xl md:text-6xl mb-6 p-4 md:p-6 rounded-2xl inline-block border ${colors.border} ${colors.bgSecondary}`}>
                  <FaIdCard className="w-12 h-12 md:w-16 md:h-16" />
                </div>

                <div className={`inline-block px-3 py-1 rounded-full mb-4 text-xs font-bold ${colors.primaryBg} text-white`}>
                  MOST POPULAR
                </div>

                <h3 className={`font-display text-2xl md:text-3xl lg:text-4xl font-black mb-4 ${colors.text}`}>
                  UNO REVOLUTION
                </h3>

                <p className={`font-body text-sm md:text-base mb-6 ${colors.textSecondary}`}>
                  Classic card game reimagined with stunning 3D animations and multiplayer action
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: IoPeopleSharp, text: 'Up to 8 Players' },
                    { icon: IoFlashSharp, text: 'Power Cards' },
                    { icon: IoColorPaletteSharp, text: 'Custom Decks' },
                    { icon: IoTrophySharp, text: 'Tournaments' }
                  ].map((feat, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${colors.borderLight} ${colors.bgSecondary}`}
                    >
                      <feat.icon className="w-4 h-4 md:w-5 md:h-5" />
                      <span className={`font-accent text-xs font-semibold ${colors.text}`}>
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/login')}
                  className={`font-accent font-bold px-6 md:px-8 py-2 md:py-3 rounded-xl text-sm ${colors.primaryBg} ${colors.primaryHover} text-white hover:scale-105 transition-all duration-300 w-full`}
                >
                  Play UNO Now
                </button>
              </div>

              {/* Scribble Card */}
              <div className={`group relative p-6 md:p-8 rounded-3xl border ${colors.border} ${colors.surface} backdrop-blur-xl hover:scale-[1.02] transition-all duration-500`}>
                <div className={`text-5xl md:text-6xl mb-6 p-4 md:p-6 rounded-2xl inline-block border ${colors.border} ${colors.bgSecondary}`}>
                  <IoBrushSharp className="w-12 h-12 md:w-16 md:h-16" />
                </div>

                <div className={`inline-block px-3 py-1 rounded-full mb-4 text-xs font-bold ${colors.secondaryBg} text-white`}>
                  CREATIVITY UNLEASHED
                </div>

                <h3 className={`font-display text-2xl md:text-3xl lg:text-4xl font-black mb-4 ${colors.secondary}`}>
                  SCRIBBLE PRO
                </h3>

                <p className={`font-body text-sm md:text-base mb-6 ${colors.textSecondary}`}>
                  Draw, guess, and compete with friends using AI-powered features
                </p>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { icon: IoColorPaletteSharp, text: 'HD Canvas' },
                    { icon: MdSmartToy, text: 'AI Hints' },
                    { icon: IoSparklesSharp, text: 'Custom Words' },
                    { icon: IoTimerOutline, text: 'Speed Mode' },
                    { icon: IoHomeSharp, text: 'Private Rooms' },
                    { icon: IoRibbonSharp, text: 'Achievements' }
                  ].map((feat, i) => (
                    <div
                      key={i}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border ${colors.borderLight} ${colors.bgSecondary}`}
                    >
                      <feat.icon className="w-5 h-5 md:w-6 md:h-6" />
                      <span className={`font-accent text-[10px] font-semibold text-center ${colors.text}`}>
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/login')}
                  className={`font-accent font-bold px-6 md:px-8 py-2 md:py-3 rounded-xl text-sm ${colors.secondaryBg} ${colors.secondaryHover} text-white hover:scale-105 transition-all duration-300 w-full`}
                >
                  Start Drawing
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          className="py-12 md:py-20 px-4 md:px-6"
          style={{
            transform: `translateY(${scrollY * 0.1}px)`,
            transition: 'transform 0.1s ease-out'
          }}
        >
          <div className="container mx-auto max-w-7xl">
            <h2 className={`font-display text-3xl md:text-5xl lg:text-6xl font-black text-center mb-12 md:mb-16 ${colors.text}`}>
              Revolutionary Features
            </h2>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {[
                { icon: IoSpeedometerSharp, title: 'Quantum Speed', stat: '<10ms', colorClass: 'primaryBg' },
                { icon: IoShieldCheckmarkSharp, title: 'Military Security', stat: '256-bit', colorClass: 'secondaryBg' },
                { icon: IoEarthSharp, title: 'Global Network', stat: '180+', colorClass: 'accentBg' },
                { icon: IoLocateSharp, title: 'Anti-Cheat AI', stat: '99.9%', colorClass: 'primaryBg' },
                { icon: IoTrophySharp, title: 'Real Rewards', stat: '$1M+', colorClass: 'secondaryBg' },
                { icon: IoChatbubblesSharp, title: 'Voice & Video', stat: 'HD', colorClass: 'accentBg' }
              ].map((feat, i) => (
                <div
                  key={i}
                  className={`group relative p-4 md:p-6 rounded-2xl border ${colors.border} ${colors.surface} backdrop-blur-xl hover:scale-105 transition-all duration-300`}
                >
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <feat.icon className="w-10 h-10 md:w-12 md:h-12" />
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${colors[feat.colorClass]} text-white`}>
                      {feat.stat}
                    </div>
                    <h3 className={`font-accent text-sm md:text-base font-bold text-center ${colors.text}`}>
                      {feat.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section
          className="py-12 md:py-20 px-4 md:px-6"
          style={{
            transform: `translateY(${scrollY * 0.08}px)`,
            transition: 'transform 0.1s ease-out'
          }}
        >
          <div className="container mx-auto max-w-6xl">
            <h2 className={`font-display text-3xl md:text-5xl lg:text-6xl font-black text-center mb-12 md:mb-16 ${colors.primary}`}>
              Join The Revolution
            </h2>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: IoPeopleSharp, value: '50K+', label: 'Active Players', live: true },
                { icon: IoGameController, value: '2.4M+', label: 'Games Today' },
                { icon: IoStarSharp, value: '4.9/5', label: 'User Rating' }
              ].map((stat, i) => (
                <div
                  key={i}
                  className={`relative p-6 md:p-8 rounded-2xl border ${colors.border} ${colors.surface} backdrop-blur-xl text-center`}
                >
                  {stat.live && (
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-accent text-xs font-bold text-green-500">LIVE</span>
                    </div>
                  )}
                  <stat.icon className="w-10 h-10 md:w-12 md:h-12 mb-4 mx-auto" />
                  <div className={`font-display text-3xl md:text-4xl font-black mb-2 ${colors.primary}`}>
                    {stat.value}
                  </div>
                  <div className={`font-body text-sm ${colors.textSecondary}`}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <button
                onClick={() => navigate('/login')}
                className={`font-accent font-black px-8 md:px-12 py-3 md:py-4 rounded-2xl text-base md:text-lg ${colors.primaryBg} ${colors.primaryHover} text-white hover:scale-105 hover:shadow-2xl transition-all duration-300`}
              >
                Join Community
              </button>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-12 md:py-20 px-4 md:px-6"
          style={{
            transform: `translateY(${scrollY * 0.05}px)`,
            transition: 'transform 0.1s ease-out'
          }}
        >
          <div className="container mx-auto max-w-5xl text-center">
            <IoRocketSharp className="w-12 h-12 md:w-16 md:h-16 mb-8 mx-auto" />

            <h2 className={`font-display text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight ${colors.primary}`}>
              Your Journey
              <br />
              Starts Now
            </h2>

            <p className={`font-body text-base md:text-lg mb-12 ${colors.textSecondary}`}>
              Join thousands experiencing next-gen gaming
            </p>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-12">
              {[
                { num: '01', icon: IoDocumentTextSharp, text: 'Sign Up Free' },
                { num: '02', icon: IoGameController, text: 'Choose Game' },
                { num: '03', icon: IoCheckmarkCircleSharp, text: 'Start Winning' }
              ].map((step, i) => (
                <div
                  key={i}
                  className={`relative p-4 md:p-6 rounded-2xl border ${colors.border} ${colors.surface} backdrop-blur-xl`}
                >
                  <div className={`absolute -top-3 -left-3 w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center font-accent text-xs md:text-sm font-black ${colors.primaryBg} text-white`}>
                    {step.num}
                  </div>
                  <step.icon className="w-8 h-8 md:w-10 md:h-10 mb-3 mx-auto mt-2" />
                  <span className={`font-accent text-sm font-semibold ${colors.text}`}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className={`font-accent font-black px-8 md:px-12 py-3 md:py-4 rounded-2xl text-base md:text-lg ${colors.primaryBg} ${colors.primaryHover} text-white hover:scale-105 hover:shadow-2xl transition-all duration-300`}
              >
                START PLAYING FREE
              </button>

              <button
                className={`font-accent font-bold px-6 md:px-8 py-3 md:py-4 rounded-2xl text-sm md:text-base border ${colors.border} ${colors.surface} ${colors.primary} hover:scale-105 transition-all duration-300 backdrop-blur-xl`}
              >
                Watch Demo
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={`relative z-10 py-6 md:py-8 border-t ${colors.border} ${colors.bgSecondary}/80 backdrop-blur-xl`}>
        <div className="container mx-auto px-4 md:px-6 text-center">
          <p className={`font-body text-xs md:text-sm ${colors.textMuted}`}>
            © 2025 KHELE. All rights reserved. Made with <IoTrophySharp className="inline w-4 h-4 text-green-500" /> for gamers worldwide.
          </p>
        </div>
      </footer>

      {/* Custom Animations */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }

        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
};

export default Landing;