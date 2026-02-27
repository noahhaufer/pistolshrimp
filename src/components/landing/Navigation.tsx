import { useEffect, useState } from 'react';
import { Github } from 'lucide-react';

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-md border-b border-border' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img
              src="/logo-transparent.png"
              alt="Pistol Shrimp"
              className="w-10 h-10 object-contain"
            />
            <span className="font-bold text-lg text-white">Pistol Shrimp</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#architecture" className="text-sm text-muted-foreground hover:text-white transition-colors">Architecture</a>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-white transition-colors">Demo</a>
            <a
              href="https://github.com/noahhaufer/pistolshrimp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:border-muted-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
