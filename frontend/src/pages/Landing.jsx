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

  // Particle class and intro logic
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

  // Define sections with PROPER STYLING
  const sections = [
    {
      leftLabel: "GAMING",
      title: (
        <div className="flex flex-col items-center px-4">
          <div
            className="inline-block mb-4 px-4 py-2 rounded-full font-poppins font-medium text-sm"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}20)`,
              border: `1px solid ${colors.primary}60`,
              color: colors.primary
            }}
          >
            🎮 Next-Gen Gaming Platform
          </div>
          <h1
            className="font-orbitron text-6xl md:text-8xl font-black mb-4"
            style={{
              background: `linear-gradient(45deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: `0 0 60px ${colors.glow}40`
            }}
          >
            KHELE
          </h1>
          <p className="font-poppins text-2xl md:text-3xl mb-3 font-light" style={{ color: colors.text }}>
            Where Champions Are Born
          </p>
          <p className="font-raleway text-base md:text-lg max-w-xl mx-auto mb-6 opacity-80" style={{ color: colors.textSecondary }}>
            Experience the future of online gaming with stunning visuals
          </p>
          <button
            onClick={() => navigate('/login')}
            className="font-raleway font-bold px-8 py-4 rounded-xl hover:scale-105 transition-all text-lg"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: theme === 'dark' ? '#000' : '#fff',
              boxShadow: `0 0 30px ${colors.glow}60`
            }}
          >
            Start Playing
          </button>
        </div>
      ),
      rightLabel: "EXCELLENCE",
    },

    {
      leftLabel: "CLASSIC",
      title: (
        <div className="flex flex-col items-center px-4">
          <div className="text-7xl mb-6">🎴</div>
          <h2 className="font-orbitron text-5xl md:text-6xl font-bold mb-4" style={{ color: colors.text }}>
            UNO
          </h2>
          <p className="font-poppins text-lg md:text-xl mb-6 max-w-lg text-center" style={{ color: colors.textSecondary }}>
            Classic card game with stunning animations
          </p>
          <button
            onClick={() => navigate('/login')}
            className="font-raleway font-bold px-6 py-3 rounded-xl hover:scale-110 transition-all"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: theme === 'dark' ? '#000' : '#fff'
            }}
          >
            Play UNO
          </button>
        </div>
      ),
      rightLabel: "CARDS",
    },

    {
      leftLabel: "CREATIVE",
      title: (
        <div className="flex flex-col items-center px-4">
          <div className="text-7xl mb-6">🎨</div>
          <h2 className="font-orbitron text-5xl md:text-6xl font-bold mb-4" style={{ color: colors.text }}>
            Scribble
          </h2>
          <p className="font-poppins text-lg md:text-xl mb-6 max-w-lg text-center" style={{ color: colors.textSecondary }}>
            Draw, guess, and have fun with friends
          </p>
          <button
            onClick={() => navigate('/login')}
            className="font-raleway font-bold px-6 py-3 rounded-xl hover:scale-110 transition-all"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: theme === 'dark' ? '#000' : '#fff'
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
        <div className="flex flex-col items-center max-w-5xl px-4">
          <h2 className="font-orbitron text-4xl md:text-5xl font-bold mb-10" style={{ color: colors.text }}>
            Why Choose KHELE?
          </h2>
          <div className="grid md:grid-cols-3 gap-6 w-full">
            {[
              { icon: '⚡', title: 'Lightning Fast', description: 'Zero lag gameplay' },
              { icon: '🔒', title: 'Secure & Safe', description: 'Enterprise security' },
              { icon: '🌍', title: 'Global Community', description: 'Play worldwide' },
              { icon: '🎯', title: 'Fair Play', description: 'Anti-cheat systems' },
              { icon: '🏆', title: 'Leaderboards', description: 'Compete globally' },
              { icon: '💬', title: 'Live Chat', description: 'Real-time talk' }
            ].map((feature, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl backdrop-blur-xl hover:scale-105 transition-all"
                style={{
                  background: `${colors.surface}60`,
                  border: `1px solid ${colors.primary}30`
                }}
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-orbitron text-lg font-bold mb-2" style={{ color: colors.primary }}>
                  {feature.title}
                </h3>
                <p className="font-raleway text-sm" style={{ color: colors.textSecondary }}>
                  {feature.description}
                </p>
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
        <div className="flex flex-col items-center px-4">
          <h2 className="font-orbitron text-4xl md:text-5xl font-bold mb-10" style={{ color: colors.text }}>
            Join Our Community
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl">
            {[
              { value: '10K+', label: 'Active Players', icon: '👥' },
              { value: '50K+', label: 'Games Played', icon: '🎮' },
              { value: '4.9★', label: 'User Rating', icon: '⭐' }
            ].map((stat, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl backdrop-blur-xl hover:scale-110 transition-all"
                style={{
                  background: `${colors.surface}60`,
                  border: `2px solid ${colors.primary}40`
                }}
              >
                <div className="text-5xl mb-3">{stat.icon}</div>
                <div className="font-orbitron text-4xl font-bold mb-2" style={{ color: colors.primary }}>
                  {stat.value}
                </div>
                <div className="font-raleway text-base" style={{ color: colors.textSecondary }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      rightLabel: "TOGETHER",
    },

    {
      leftLabel: "READY",
      title: (
        <div className="flex flex-col items-center px-4">
          <h2 className="font-orbitron text-5xl md:text-6xl font-bold mb-6" style={{ color: colors.text }}>
            Ready to Play?
          </h2>
          <p className="font-poppins text-2xl mb-10 max-w-xl text-center" style={{ color: colors.textSecondary }}>
            Join thousands of players worldwide
          </p>
          <button
            onClick={() => navigate('/login')}
            className="font-raleway font-bold px-12 py-5 rounded-2xl text-xl hover:scale-110 transition-all"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              color: theme === 'dark' ? '#000' : '#fff',
              boxShadow: `0 0 50px ${colors.glow}80`
            }}
          >
            Start Your Journey
          </button>
          
          <div className="mt-16 flex gap-6 flex-wrap justify-center">
            {['Twitter', 'Discord', 'Instagram', 'YouTube'].map((social) => (
              <a
                key={social}
                href="#"
                className="font-poppins text-base hover:scale-110 transition-transform"
                style={{ color: colors.textSecondary }}
              >
                {social}
              </a>
            ))}
          </div>
        </div>
      ),
      rightLabel: "JOIN",
    },
  ];

  const header = (
    <div 
      className="w-full px-6 py-4 backdrop-blur-md flex items-center justify-between" 
      style={{ background: `${colors.surface}30` }}
    >
      <h2 className="font-orbitron text-2xl font-bold" style={{ color: colors.primary }}>
        KHELE
      </h2>
      
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:scale-110 transition-all text-xl"
          style={{ backgroundColor: colors.surface }}
        >
          {theme === 'dark' ? '🌞' : '🌙'}
        </button>
        
        <button
          onClick={() => navigate('/login')}
          className="font-raleway font-semibold px-5 py-2 rounded-lg hover:scale-105 transition-all text-sm"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            color: theme === 'dark' ? '#000' : '#fff'
          }}
        >
          Login
        </button>
      </div>
    </div>
  );

  const footer = (
    <div className="text-center py-3 backdrop-blur-md" style={{ background: `${colors.surface}30` }}>
      <p className="font-raleway text-xs" style={{ color: colors.textSecondary }}>
        © 2025 KHELE. All rights reserved.
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
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: colors.background }}>
      {/* GridScan Background */}
      <div className="fixed inset-0 z-0">
        <GridScan
          sensitivity={0.55}
          lineThickness={1.5}
          linesColor={colors.primary}
          gridScale={0.12}
          scanColor={colors.secondary}
          scanOpacity={0.6}
          enablePost={true}
          bloomIntensity={0.8}
          chromaticAberration={0.003}
          noiseIntensity={0.015}
          scanGlow={0.8}
          scanSoftness={2.5}
          scanDuration={3.0}
          scanDelay={2.0}
          lineStyle="solid"
          className="w-full h-full"
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-10">
        <FullScreenScrollFX
          sections={sections}
          header={header}
          footer={footer}
          showProgress
          durations={{ change: 0.7, snap: 800 }}
        />
      </div>
    </div>
  );
};

export default Landing;