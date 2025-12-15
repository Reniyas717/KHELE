import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { FullScreenScrollFX } from '../components/ui/full-screen-scroll-fx';
import { GridScan } from '../components/ui/GridScan';

const Landing = () => {
  const [showIntro, setShowIntro] = useState(true);
  const navigate = useNavigate();
  const { theme, toggleTheme, colors } = useTheme();
  
  const particleCanvasRef = useRef(null);
  const particlesRef = useRef([]);

  // Particle class
  class Particle {
    constructor() {
      this.pos = { x: 0, y: 0 };
      this.vel = { x: 0, y: 0 };
      this.acc = { x: 0, y: 0 };
      this.target = { x: 0, y: 0 };
      this.maxSpeed = Math.random() * 4 + 3;
      this.maxForce = this.maxSpeed * 0.05;
      this.particleSize = Math.random() * 4 + 3;
      this.color = { r: 0, g: 0, b: 0 };
      this.targetColor = { r: 0, g: 0, b: 0 };
      this.colorWeight = 0;
      this.colorBlendRate = Math.random() * 0.02 + 0.01;
      this.isKilled = false;
    }

    move() {
      const distance = Math.sqrt(
        Math.pow(this.pos.x - this.target.x, 2) + 
        Math.pow(this.pos.y - this.target.y, 2)
      );
      
      let proximityMult = distance < 100 ? distance / 100 : 1;
      
      const towardsTarget = {
        x: this.target.x - this.pos.x,
        y: this.target.y - this.pos.y
      };
      
      const magnitude = Math.sqrt(towardsTarget.x ** 2 + towardsTarget.y ** 2);
      if (magnitude > 0) {
        towardsTarget.x = (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult;
        towardsTarget.y = (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult;
      }
      
      const steer = {
        x: towardsTarget.x - this.vel.x,
        y: towardsTarget.y - this.vel.y
      };
      
      const steerMag = Math.sqrt(steer.x ** 2 + steer.y ** 2);
      if (steerMag > 0) {
        steer.x = (steer.x / steerMag) * this.maxForce;
        steer.y = (steer.y / steerMag) * this.maxForce;
      }
      
      this.acc.x += steer.x;
      this.acc.y += steer.y;
      this.vel.x += this.acc.x;
      this.vel.y += this.acc.y;
      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;
      this.acc.x = 0;
      this.acc.y = 0;
    }

    draw(ctx) {
      if (this.colorWeight < 1.0) {
        this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0);
      }
      
      const currentColor = {
        r: Math.round(this.color.r + (this.targetColor.r - this.color.r) * this.colorWeight),
        g: Math.round(this.color.g + (this.targetColor.g - this.color.g) * this.colorWeight),
        b: Math.round(this.color.b + (this.targetColor.b - this.color.b) * this.colorWeight)
      };
      
      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.particleSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    kill(width, height) {
      if (!this.isKilled) {
        const angle = Math.random() * Math.PI * 2;
        const mag = (width + height) / 2;
        this.target.x = width / 2 + Math.cos(angle) * mag;
        this.target.y = height / 2 + Math.sin(angle) * mag;
        this.color = {
          r: this.color.r + (this.targetColor.r - this.color.r) * this.colorWeight,
          g: this.color.g + (this.targetColor.g - this.color.g) * this.colorWeight,
          b: this.color.b + (this.targetColor.b - this.color.b) * this.colorWeight
        };
        this.targetColor = { r: 0, g: 0, b: 0 };
        this.colorWeight = 0;
        this.isKilled = true;
      }
    }
  }

  // Initialize Particle Text
  useEffect(() => {
    if (!showIntro) return;
    
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const words = ['KHELE', 'Where Gaming', 'Meets Excellence'];
    let wordIndex = 0;
    let animationFrame;
    let wordChangeCount = 0;
    
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 255, b: 136 };
    };
    
    const generateText = (word) => {
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext('2d');
      
      offCtx.fillStyle = 'white';
      offCtx.font = 'bold 120px Orbitron, sans-serif';
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText(word, canvas.width / 2, canvas.height / 2);
      
      const imageData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      const newColor = hexToRgb(colors.primary);
      const particles = particlesRef.current;
      let particleIndex = 0;
      
      const coords = [];
      for (let i = 0; i < pixels.length; i += 24) {
        coords.push(i);
      }
      
      coords.sort(() => Math.random() - 0.5);
      
      for (const coordIndex of coords) {
        const alpha = pixels[coordIndex + 3];
        if (alpha > 0) {
          const x = (coordIndex / 4) % canvas.width;
          const y = Math.floor(coordIndex / 4 / canvas.width);
          
          let particle;
          if (particleIndex < particles.length) {
            particle = particles[particleIndex];
            particle.isKilled = false;
            particleIndex++;
          } else {
            particle = new Particle();
            const angle = Math.random() * Math.PI * 2;
            const mag = (canvas.width + canvas.height) / 2;
            particle.pos.x = canvas.width / 2 + Math.cos(angle) * mag;
            particle.pos.y = canvas.height / 2 + Math.sin(angle) * mag;
            particles.push(particle);
          }
          
          particle.color = {
            r: particle.color.r + (particle.targetColor.r - particle.color.r) * particle.colorWeight,
            g: particle.color.g + (particle.targetColor.g - particle.color.g) * particle.colorWeight,
            b: particle.color.b + (particle.targetColor.b - particle.color.b) * particle.colorWeight
          };
          particle.targetColor = newColor;
          particle.colorWeight = 0;
          particle.target.x = x;
          particle.target.y = y;
        }
      }
      
      for (let i = particleIndex; i < particles.length; i++) {
        particles[i].kill(canvas.width, canvas.height);
      }
    };

    const killAllParticles = () => {
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        particles[i].kill(canvas.width, canvas.height);
      }
    };
    
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.move();
        particle.draw(ctx);
        
        if (particle.isKilled) {
          if (
            particle.pos.x < -50 || particle.pos.x > canvas.width + 50 ||
            particle.pos.y < -50 || particle.pos.y > canvas.height + 50
          ) {
            particles.splice(i, 1);
          }
        }
      }
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    generateText(words[wordIndex]);
    animate();
    
    const wordInterval = setInterval(() => {
      wordChangeCount++;
      
      if (wordChangeCount >= words.length) {
        killAllParticles();
        clearInterval(wordInterval);
        return;
      }
      
      wordIndex = (wordIndex + 1) % words.length;
      generateText(words[wordIndex]);
    }, 2500);
    
    return () => {
      cancelAnimationFrame(animationFrame);
      clearInterval(wordInterval);
    };
  }, [showIntro, colors.primary]);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 9000);
    return () => clearTimeout(timer);
  }, []);

  // PROPERLY SIZED SECTIONS
  const sections = [
    {
      leftLabel: "GAMING",
      title: (
        <div className="flex flex-col items-center justify-center w-full h-full px-4">
          {/* Hero Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 border"
            style={{
              background: `rgba(0, 0, 0, 0.6)`,
              borderColor: colors.primary,
              backdropFilter: 'blur(10px)'
            }}
          >
            <span className="text-sm">⚡</span>
            <span className="font-poppins text-[10px] font-bold tracking-wider" style={{ color: colors.primary }}>
              NEXT-GEN PLATFORM
            </span>
          </div>

          {/* Main Title */}
          <h1
            className="font-orbitron text-5xl md:text-6xl font-black mb-3 text-center leading-none"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: `0 0 80px ${colors.glow}80`
            }}
          >
            KHELE
          </h1>

          {/* Subtitle */}
          <p 
            className="font-poppins text-base md:text-lg mb-6 font-light text-center"
            style={{ color: colors.text }}
          >
            Where Champions Are Born
          </p>

          {/* Quick Stats */}
          <div className="flex gap-4 mb-6">
            {[
              { icon: '⚡', label: 'Lightning Fast' },
              { icon: '🌍', label: 'Global Play' },
              { icon: '🏆', label: 'Real Rewards' }
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border"
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderColor: `${colors.primary}40`,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-raleway text-[10px] font-semibold" style={{ color: colors.primary }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={() => navigate('/login')}
            className="group relative font-raleway font-bold px-8 py-2.5 rounded-lg text-sm overflow-hidden transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: '#000',
              boxShadow: `0 0 40px ${colors.glow}60`
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Playing
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </button>
        </div>
      ),
      rightLabel: "EXCELLENCE",
    },

    {
      leftLabel: "CLASSIC",
      title: (
        <div className="flex flex-col items-center justify-center w-full h-full px-4">
          {/* Game Icon */}
          <div
            className="text-5xl mb-4 p-4 rounded-2xl border"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              borderColor: `${colors.primary}40`,
              backdropFilter: 'blur(10px)',
              boxShadow: `0 0 40px ${colors.glow}40`
            }}
          >
            🎴
          </div>

          {/* Badge */}
          <div
            className="inline-block px-3 py-0.5 rounded-full mb-3 border text-[10px] font-bold"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              borderColor: colors.primary,
              color: colors.primary
            }}
          >
            MOST POPULAR
          </div>

          {/* Title */}
          <h2 
            className="font-orbitron text-4xl md:text-5xl font-black mb-3 text-center"
            style={{ color: colors.text }}
          >
            UNO REVOLUTION
          </h2>

          <p className="font-poppins text-sm mb-6 text-center max-w-xl" style={{ color: colors.textSecondary }}>
            Timeless card game reimagined with stunning 3D animations
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6 max-w-lg">
            {[
              { icon: '👥', text: 'Up to 8 Players' },
              { icon: '⚡', text: 'Power Cards' },
              { icon: '🎨', text: 'Custom Decks' },
              { icon: '🏆', text: 'Tournaments' }
            ].map((feat, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderColor: `${colors.primary}30`,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <span className="text-xl">{feat.icon}</span>
                <span className="font-raleway text-xs font-semibold" style={{ color: colors.text }}>
                  {feat.text}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="font-raleway font-bold px-8 py-2.5 rounded-lg text-sm hover:scale-105 transition-all"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: '#000',
              boxShadow: `0 0 40px ${colors.glow}60`
            }}
          >
            Play UNO Now
          </button>
        </div>
      ),
      rightLabel: "CARDS",
    },

    {
      leftLabel: "CREATIVE",
      title: (
        <div className="flex flex-col items-center justify-center w-full h-full px-4">
          {/* Game Icon */}
          <div
            className="text-5xl mb-4 p-4 rounded-2xl border"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              borderColor: `${colors.secondary}40`,
              backdropFilter: 'blur(10px)',
              boxShadow: `0 0 40px ${colors.secondary}40`
            }}
          >
            🎨
          </div>

          <div
            className="inline-block px-3 py-0.5 rounded-full mb-3 border text-[10px] font-bold"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              borderColor: colors.secondary,
              color: colors.secondary
            }}
          >
            CREATIVITY UNLEASHED
          </div>

          <h2 
            className="font-orbitron text-4xl md:text-5xl font-black mb-3 text-center"
            style={{
              background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            SCRIBBLE PRO
          </h2>

          <p className="font-poppins text-sm mb-6 text-center max-w-xl" style={{ color: colors.textSecondary }}>
            Draw, guess, compete with AI-powered features
          </p>

          <div className="grid grid-cols-3 gap-2 mb-6 max-w-2xl">
            {[
              { icon: '🎨', text: 'HD Canvas' },
              { icon: '🤖', text: 'AI Hints' },
              { icon: '🎭', text: 'Custom Words' },
              { icon: '⏱️', text: 'Speed Mode' },
              { icon: '🎪', text: 'Private Rooms' },
              { icon: '🏅', text: 'Achievements' }
            ].map((feat, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border"
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderColor: `${colors.secondary}30`,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <span className="text-2xl">{feat.icon}</span>
                <span className="font-raleway text-[10px] font-semibold text-center" style={{ color: colors.text }}>
                  {feat.text}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="font-raleway font-bold px-8 py-2.5 rounded-lg text-sm hover:scale-105 transition-all"
            style={{
              background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
              color: '#000',
              boxShadow: `0 0 40px ${colors.secondary}60`
            }}
          >
            Start Drawing
          </button>
        </div>
      ),
      rightLabel: "ART",
    },

    {
      leftLabel: "FEATURES",
      title: (
        <div className="flex flex-col items-center justify-center w-full h-full px-4">
          <h2 
            className="font-orbitron text-3xl md:text-4xl font-black mb-6 text-center"
            style={{ color: colors.text }}
          >
            REVOLUTIONARY FEATURES
          </h2>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl">
            {[
              { icon: '⚡', title: 'Quantum Speed', stat: '<10ms' },
              { icon: '🔒', title: 'Military Security', stat: '256-bit' },
              { icon: '🌍', title: 'Global Network', stat: '180+' },
              { icon: '🎯', title: 'Anti-Cheat AI', stat: '99.9%' },
              { icon: '🏆', title: 'Real Rewards', stat: '$1M+' },
              { icon: '💬', title: 'Voice & Video', stat: 'HD' }
            ].map((feat, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl border hover:scale-105 transition-all"
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderColor: `${colors.primary}40`,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <span className="text-3xl">{feat.icon}</span>
                <div
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: colors.primary,
                    color: '#000'
                  }}
                >
                  {feat.stat}
                </div>
                <h3 className="font-orbitron text-sm font-bold text-center" style={{ color: colors.primary }}>
                  {feat.title}
                </h3>
              </div>
            ))}
          </div>
        </div>
      ),
      rightLabel: "POWER",
    },

    {
      leftLabel: "COMMUNITY",
      title: (
        <div className="flex flex-col items-center justify-center w-full h-full px-4">
          <h2 
            className="font-orbitron text-4xl md:text-5xl font-black mb-6 text-center"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            JOIN THE REVOLUTION
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-6 max-w-3xl">
            {[
              { icon: '👥', value: '50K+', label: 'Active Players', live: true },
              { icon: '🎮', value: '2.4M+', label: 'Games Today' },
              { icon: '⭐', value: '4.9/5', label: 'User Rating' }
            ].map((stat, i) => (
              <div
                key={i}
                className="relative flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border"
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderColor: `${colors.primary}40`,
                  backdropFilter: 'blur(10px)'
                }}
              >
                {stat.live && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  </div>
                )}
                <span className="text-3xl">{stat.icon}</span>
                <div className="font-orbitron text-2xl font-black" style={{ color: colors.primary }}>
                  {stat.value}
                </div>
                <div className="font-poppins text-xs" style={{ color: colors.textSecondary }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="font-raleway font-bold px-10 py-3 rounded-lg text-sm hover:scale-105 transition-all"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: '#000',
              boxShadow: `0 0 50px ${colors.glow}70`
            }}
          >
            Join Community
          </button>
        </div>
      ),
      rightLabel: "TOGETHER",
    },

    {
      leftLabel: "READY",
      title: (
        <div className="flex flex-col items-center justify-center w-full h-full px-4">
          <div className="text-5xl mb-6">🚀</div>
          
          <h2 
            className="font-orbitron text-4xl md:text-5xl font-black mb-4 text-center leading-tight"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            YOUR JOURNEY
            <br />
            STARTS NOW
          </h2>

          <p className="font-poppins text-base mb-6 text-center max-w-xl" style={{ color: colors.textSecondary }}>
            Join thousands experiencing next-gen gaming
          </p>

          <div className="grid grid-cols-3 gap-4 mb-6 max-w-3xl">
            {[
              { num: '01', icon: '📝', text: 'Sign Up Free' },
              { num: '02', icon: '🎮', text: 'Choose Game' },
              { num: '03', icon: '🏆', text: 'Start Winning' }
            ].map((step, i) => (
              <div
                key={i}
                className="relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border"
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderColor: `${colors.primary}40`,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div
                  className="absolute -top-3 -left-3 w-8 h-8 rounded-lg flex items-center justify-center font-orbitron text-xs font-black"
                  style={{
                    background: colors.primary,
                    color: '#000'
                  }}
                >
                  {step.num}
                </div>
                <span className="text-3xl mt-1">{step.icon}</span>
                <span className="font-raleway text-xs font-semibold text-center" style={{ color: colors.text }}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/login')}
              className="font-raleway font-black px-10 py-3 rounded-lg text-base hover:scale-105 transition-all"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                color: '#000',
                boxShadow: `0 0 60px ${colors.glow}80`
              }}
            >
              START PLAYING FREE
            </button>

            <button
              className="font-raleway font-bold px-6 py-3 rounded-lg text-sm border hover:scale-105 transition-all"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                borderColor: colors.primary,
                color: colors.primary,
                backdropFilter: 'blur(10px)'
              }}
            >
              Watch Demo
            </button>
          </div>
        </div>
      ),
      rightLabel: "JOIN",
    },
  ];

  const header = (
    <div 
      className="w-full px-4 py-3 flex items-center justify-between border-b"
      style={{ 
        background: 'rgba(0, 0, 0, 0.6)',
        borderColor: `${colors.primary}30`,
        backdropFilter: 'blur(20px)'
      }}
    >
      <h2 
        className="font-orbitron text-xl font-black"
        style={{ 
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        KHELE
      </h2>
      
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-lg hover:scale-110 transition-all border"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(10px)'
          }}
        >
          {theme === 'dark' ? '🌞' : '🌙'}
        </button>
        
        <button
          onClick={() => navigate('/login')}
          className="font-raleway font-bold px-5 py-1.5 rounded-lg text-sm hover:scale-105 transition-all"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            color: '#000'
          }}
        >
          Login
        </button>
      </div>
    </div>
  );

  const footer = (
    <div 
      className="text-center py-3 border-t"
      style={{ 
        background: 'rgba(0, 0, 0, 0.6)',
        borderColor: `${colors.primary}30`,
        backdropFilter: 'blur(20px)'
      }}
    >
      <p className="font-raleway text-[10px]" style={{ color: colors.textSecondary }}>
        © 2025 KHELE. All rights reserved. Made with 💚 for gamers worldwide.
      </p>
    </div>
  );

  if (showIntro) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden">
        <canvas ref={particleCanvasRef} className="absolute inset-0" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: '#000' }}>
      {/* GridScan Background - ENHANCED */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GridScan
          sensitivity={0.7}
          lineThickness={2}
          linesColor={colors.primary}
          gridScale={0.15}
          scanColor={colors.secondary}
          scanOpacity={0.9}
          enablePost={true}
          bloomIntensity={1.5}
          bloomThreshold={0.2}
          bloomSmoothing={0.9}
          chromaticAberration={0.008}
          noiseIntensity={0.025}
          scanGlow={1.5}
          scanSoftness={3.5}
          scanPhaseTaper={0.2}
          scanDuration={2.5}
          scanDelay={1.5}
          lineStyle="solid"
          lineJitter={0.2}
          scanDirection="pingpong"
          className="w-full h-full"
          style={{ opacity: 1 }}
        />
      </div>

      {/* Content Layer - PERFECTLY BLENDED */}
      <div className="relative z-10 pointer-events-auto">
        <FullScreenScrollFX
          sections={sections}
          header={header}
          footer={footer}
          showProgress
          durations={{ change: 0.8, snap: 900 }}
          colors={{
            text: colors.text,
            overlay: 'transparent',
            pageBg: 'transparent',
            stageBg: 'transparent',
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }

        /* Perfect Grid Blending */
        .fx-fixed {
          background: transparent !important;
        }

        .fx-grid {
          background: transparent !important;
        }

        .fx-bgs {
          display: none !important;
        }

        /* Enhanced Text Shadows for Grid */
        .font-orbitron,
        .font-poppins,
        .font-raleway {
          text-shadow: 0 2px 20px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.8);
        }

        /* Smooth Backdrop Filters */
        [style*="backdrop-filter"] {
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
        }

        /* Grid-Matched Borders */
        [style*="border"] {
          border-style: solid;
          border-width: 1px;
        }
      `}</style>
    </div>
  );
};

export default Landing;