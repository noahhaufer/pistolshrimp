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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(187 85% 53% / 0.03), transparent)' }}>
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
