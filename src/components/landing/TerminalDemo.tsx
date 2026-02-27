import { Player } from '@remotion/player';
import { TerminalComposition } from './terminal/TerminalComposition';
import { FPS, DURATION_SECONDS } from './terminal/constants';
import { FadeIn } from './FadeIn';

export function TerminalDemo() {
  return (
    <section id="demo" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            See It In Action
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            A legitimate swap passes all 5 gates. A compromised agent gets <span className="text-destructive">blocked</span>.
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="rounded-xl overflow-hidden border border-border shadow-2xl shadow-black/40">
            <Player
              component={TerminalComposition}
              compositionWidth={900}
              compositionHeight={540}
              durationInFrames={FPS * DURATION_SECONDS}
              fps={FPS}
              autoPlay
              loop
              style={{
                width: '100%',
                aspectRatio: '900 / 540',
              }}
              controls={false}
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
