import { Navigation } from '@/components/landing/Navigation';
import { Hero } from '@/components/landing/Hero';
import { SecurityBreaches } from '@/components/landing/SecurityBreaches';
import { Architecture } from '@/components/landing/Architecture';
import { Quickstart } from '@/components/landing/Quickstart';
import { TerminalDemo } from '@/components/landing/TerminalDemo';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';

const Divider = () => (
  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
);

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden" style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(187 85% 53% / 0.03), transparent)' }}>
      {/* Scattered shrimp logo outlines */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {[
          { top: '2%', left: '2%', size: 35, rotate: -15, opacity: 0.05 },
          { top: '6%', left: '45%', size: 28, rotate: 40, opacity: 0.035 },
          { top: '8%', right: '5%', size: 32, rotate: 20, opacity: 0.04 },
          { top: '15%', left: '18%', size: 40, rotate: -35, opacity: 0.04 },
          { top: '18%', right: '22%', size: 30, rotate: 55, opacity: 0.045 },
          { top: '25%', left: '70%', size: 36, rotate: -10, opacity: 0.035 },
          { top: '28%', left: '5%', size: 42, rotate: 25, opacity: 0.04 },
          { top: '33%', right: '8%', size: 28, rotate: -45, opacity: 0.05 },
          { top: '38%', left: '35%', size: 34, rotate: 15, opacity: 0.035 },
          { top: '42%', right: '30%', size: 38, rotate: -20, opacity: 0.04 },
          { top: '48%', left: '12%', size: 30, rotate: 60, opacity: 0.045 },
          { top: '52%', right: '3%', size: 36, rotate: -30, opacity: 0.035 },
          { top: '55%', left: '55%', size: 32, rotate: 10, opacity: 0.05 },
          { top: '62%', left: '3%', size: 40, rotate: -50, opacity: 0.04 },
          { top: '65%', right: '18%', size: 28, rotate: 35, opacity: 0.035 },
          { top: '72%', left: '25%', size: 34, rotate: -15, opacity: 0.045 },
          { top: '75%', right: '6%', size: 38, rotate: 45, opacity: 0.04 },
          { top: '80%', left: '60%', size: 30, rotate: -25, opacity: 0.05 },
          { top: '85%', left: '8%', size: 36, rotate: 30, opacity: 0.035 },
          { top: '88%', right: '40%', size: 32, rotate: -40, opacity: 0.04 },
          { top: '93%', left: '42%', size: 28, rotate: 20, opacity: 0.045 },
          { top: '96%', right: '10%', size: 35, rotate: -55, opacity: 0.035 },
        ].map((pos, i) => (
          <img
            key={i}
            src="/logo-transparent.png"
            alt=""
            className="absolute brightness-[10] grayscale"
            style={{
              top: pos.top,
              left: 'left' in pos ? pos.left : undefined,
              right: 'right' in pos ? pos.right : undefined,
              width: pos.size,
              height: pos.size,
              transform: `rotate(${pos.rotate}deg)`,
              opacity: pos.opacity,
            }}
          />
        ))}
      </div>
      <Navigation />
      <Hero />
      <Divider />
      <Quickstart />
      <Divider />
      <SecurityBreaches />
      <Divider />
      <Architecture />
      <Divider />
      <TerminalDemo />
      <Divider />
      <CTASection />
      <Footer />
    </div>
  );
}
