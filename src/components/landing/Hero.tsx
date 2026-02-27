import { Github, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

function ShockwaveBlast({ fired }: { fired: boolean }) {
  if (!fired) return null;

  return (
    <div className="absolute top-1/2 -right-2 -translate-y-1/2 pointer-events-none">
      {/* Shockwave ring expanding outward */}
      <motion.div
        className="absolute rounded-full border-2 border-warning/80"
        style={{ width: 12, height: 12, top: -6, left: -6 }}
        initial={{ scale: 0, opacity: 0.9 }}
        animate={{ scale: 8, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      {/* Second ring, slightly delayed */}
      <motion.div
        className="absolute rounded-full border border-warning/50"
        style={{ width: 10, height: 10, top: -5, left: -5 }}
        initial={{ scale: 0, opacity: 0.7 }}
        animate={{ scale: 6, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
      />
      {/* Core flash */}
      <motion.div
        className="absolute rounded-full bg-warning"
        style={{ width: 8, height: 8, top: -4, left: -4 }}
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
      />
      {/* Particle streaks shooting right */}
      {[
        { angle: -20, length: 60, delay: 0 },
        { angle: 0, length: 80, delay: 0.02 },
        { angle: 15, length: 55, delay: 0.04 },
        { angle: -8, length: 70, delay: 0.01 },
        { angle: 8, length: 50, delay: 0.03 },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute h-[2px] bg-gradient-to-r from-warning via-warning/60 to-transparent origin-left"
          style={{
            width: p.length,
            top: 0,
            left: 0,
            rotate: `${p.angle}deg`,
          }}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0], x: [0, 0, p.length * 0.4] }}
          transition={{
            duration: 0.45,
            delay: p.delay,
            ease: 'easeOut',
            times: [0, 0.4, 1],
          }}
        />
      ))}
    </div>
  );
}

export function Hero() {
  const [fireCount, setFireCount] = useState(0);
  const fired = fireCount > 0;

  useEffect(() => {
    const initial = setTimeout(() => setFireCount(1), 1000);
    const interval = setInterval(() => setFireCount((c) => c + 1), 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="relative pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="relative">
            <motion.img
              key={`recoil-${fireCount}`}
              src="/logo-transparent.png"
              alt="Pistol Shrimp"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
              animate={
                fired
                  ? {
                      rotate: [0, -10, 3, -1, 0],
                      x: [0, -8, 3, -1, 0],
                      scale: [1, 0.95, 1.03, 1],
                    }
                  : {}
              }
              transition={{
                duration: 0.5,
                ease: [0.22, 1.2, 0.36, 1],
              }}
            />
            <ShockwaveBlast key={`blast-${fireCount}`} fired={fired} />
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white flex">
            {'Pistol Shrimp'.split('').map((char, i) => (
              <motion.span
                key={`${fireCount}-${i}`}
                animate={
                  fired
                    ? {
                        y: [0, -6, 0, 3, 0],
                        opacity: [1, 1, 1, 1, 1],
                      }
                    : {}
                }
                transition={{
                  duration: 0.5,
                  delay: 0.1 + i * 0.03,
                  ease: 'easeOut',
                }}
                className={char === ' ' ? 'w-[0.3em]' : ''}
              >
                {char === ' ' ? '\u00A0' : char}
              </motion.span>
            ))}
          </h1>
        </div>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Security middleware that protects AI agents from
          prompt injection, malicious skills, and <span className="text-destructive">unauthorized wallet signatures</span>.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#architecture"
            className="flex items-center gap-2 px-6 py-3 bg-white text-background font-semibold rounded-lg hover:bg-white/90 transition-colors"
          >
            How It Works
            <ArrowDown className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/noahhaufer/pistolshrimp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-card border border-border text-white font-semibold rounded-lg hover:border-muted-foreground transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
        </div>
      </div>

      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      </div>
    </section>
  );
}
