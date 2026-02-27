import { Github, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-8 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo-transparent.png"
            alt="Pistol Shrimp"
            className="w-6 h-6 object-contain"
          />
          <span className="text-muted-foreground text-sm">
            Pistol Shrimp — MIT License
          </span>
        </div>
        <a
          href="https://github.com/noahhaufer/pistolshrimp"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground text-sm hover:text-white transition-colors"
        >
          <Github className="w-4 h-4" />
          View Source
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </footer>
  );
}
