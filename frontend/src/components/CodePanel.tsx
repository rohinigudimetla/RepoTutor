import React, { useEffect, useRef, useMemo } from 'react';
import hljs from 'highlight.js';
import { useStore } from '../store';

interface Props {
  content: string;
  language?: string;
  highlightedLines?: number[];
  renderLine?: (lineIndex: number, lineContent: string) => React.ReactNode;
}

export function CodePanel({ content, language = 'typescript', highlightedLines = [], renderLine }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => content.split('\n'), [content]);

  const highlightedContent = useMemo(() => {
    if (!content) return [];
    try {
      const lang = hljs.getLanguage(language) ? language : 'plaintext';
      const result = hljs.highlight(content, { language: lang });
      return result.value.split('\n');
    } catch {
      return lines.map(l => escapeHtml(l));
    }
  }, [content, language]);

  const isHighlighted = (lineIdx: number) => highlightedLines.includes(lineIdx + 1);

  return (
    <div ref={containerRef} className="h-full overflow-auto font-mono text-sm leading-6">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={`code-line ${isHighlighted(i) ? 'highlighted' : ''}`}
            >
              <td className="line-number">{i + 1}</td>
              <td className="pr-4 w-full">
                {renderLine ? (
                  renderLine(i, line)
                ) : (
                  <span
                    dangerouslySetInnerHTML={{ __html: highlightedContent[i] ?? '' }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
