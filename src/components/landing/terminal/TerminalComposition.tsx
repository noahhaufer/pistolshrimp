import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SCRIPT } from './constants';
import { TerminalLine } from './TerminalLine';

export function TerminalComposition() {
  const frame = useCurrentFrame();

  // Only show lines that have started
  const visibleLines = SCRIPT.filter((line) => frame >= line.startFrame);

  // Auto-scroll: calculate how many lines to skip to keep the view
  const maxVisibleLines = 18;
  const skipLines = Math.max(0, visibleLines.length - maxVisibleLines);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0b0f',
        padding: 0,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Terminal chrome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: '#12141a',
          borderBottom: '1px solid #27272a',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff3b5c' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffb020' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#00e59b' }} />
        </div>
        <span style={{ color: '#71717a', fontSize: 12, marginLeft: 8 }}>
          pistolshrimp — security pipeline
        </span>
      </div>

      {/* Terminal body */}
      <div
        style={{
          flex: 1,
          padding: '12px 16px',
          overflow: 'hidden',
        }}
      >
        {visibleLines.slice(skipLines).map((line, i) => (
          <TerminalLine key={`${line.startFrame}-${i}`} line={line} />
        ))}
      </div>
    </AbsoluteFill>
  );
}
