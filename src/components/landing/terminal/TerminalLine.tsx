import { useCurrentFrame } from 'remotion';
import type { LineColor, TerminalLine as TLine } from './constants';

const colorMap: Record<LineColor, string> = {
  white: '#e4e4e7',
  muted: '#71717a',
  success: '#00e59b',
  warning: '#ffb020',
  danger: '#ff3b5c',
  info: '#3b82f6',
  cyan: '#00d4ff',
};

export function TerminalLine({ line }: { line: TLine }) {
  const frame = useCurrentFrame();
  const elapsed = frame - line.startFrame;

  if (elapsed < 0) return null;

  const typeSpeed = line.typeSpeed ?? 2;
  const charsToShow = Math.min(
    Math.floor(elapsed * typeSpeed),
    line.text.length
  );
  const displayText = line.text.slice(0, charsToShow);
  const isTyping = charsToShow < line.text.length;

  if (line.text === '') {
    return <div style={{ height: '1.4em' }} />;
  }

  return (
    <div
      style={{
        color: colorMap[line.color],
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 13,
        lineHeight: '1.6',
        whiteSpace: 'pre',
        minHeight: '1.4em',
      }}
    >
      {displayText}
      {isTyping && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 15,
            backgroundColor: colorMap[line.color],
            marginLeft: 1,
            opacity: frame % 20 < 10 ? 1 : 0,
            verticalAlign: 'text-bottom',
          }}
        />
      )}
    </div>
  );
}
