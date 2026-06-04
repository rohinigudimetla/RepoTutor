import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import { useApi } from '../hooks/useApi';
import { Difficulty, Blank } from '../types';
import { CodePanel } from './CodePanel';

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

type LineType = 'value' | 'expression' | 'body' | 'none';

function classifyLine(line: string, difficulty: Difficulty): LineType {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) return 'none';

  if (difficulty === 'easy') {
    // Blank: string literals, variable values (RHS of assignments), simple return values
    const hasStringLiteral = /['"`].*['"`]/.test(trimmed);
    const hasSimpleAssign = /(?:const|let|var)\s+\w+\s*=\s*(?:['"`\d\[{(]|true|false|null|undefined)/.test(trimmed);
    const hasSimpleReturn = /^return\s+(?:['"`\d]|true|false|null)/.test(trimmed);
    if (hasStringLiteral || hasSimpleAssign || hasSimpleReturn) return 'value';
  } else if (difficulty === 'medium') {
    // Blank: entire expressions, hook args, conditionals, return statements
    const hasHook = /use[A-Z]\w+\(/.test(trimmed);
    const hasConditional = /if\s*\(|&&|\|\||ternary|\?.*:/.test(trimmed);
    const hasReturn = /^return\s/.test(trimmed);
    const hasExpression = /=\s*\w+\s*[+\-*/%]/.test(trimmed);
    if (hasHook || hasConditional || hasReturn || hasExpression) return 'expression';
  } else if (difficulty === 'hard') {
    // Blank: function bodies (keep signature only)
    const isFuncBody = !/(?:function\s+\w+|=>\s*{|async\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+)/.test(trimmed);
    const isBodyLine = trimmed.length > 5 && !trimmed.endsWith('{') && !trimmed.endsWith('}') && !trimmed.endsWith('(');
    if (isFuncBody && isBodyLine) return 'body';
  }

  return 'none';
}

function extractBlankValue(line: string, type: LineType): string {
  if (type === 'value') {
    // Extract string literal
    const strMatch = line.match(/(['"`])([^'"`]*)\1/);
    if (strMatch) return strMatch[2] || strMatch[1] + strMatch[1];
    // Extract RHS value
    const assignMatch = line.match(/=\s*([^;,\n]+)/);
    return assignMatch?.[1]?.trim() ?? line.trim();
  } else if (type === 'expression') {
    // Return the whole trimmed line content
    return line.trim();
  } else {
    return line.trim();
  }
}

function applyBlank(line: string, type: LineType): { before: string; blanked: string; after: string } {
  if (type === 'value') {
    const strMatch = line.match(/(['"`])([^'"`]*)\1/);
    if (strMatch) {
      const idx = line.indexOf(strMatch[0]);
      return {
        before: line.slice(0, idx),
        blanked: strMatch[0],
        after: line.slice(idx + strMatch[0].length),
      };
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      return {
        before: line.slice(0, eqIdx + 1) + ' ',
        blanked: line.slice(eqIdx + 1).trim().replace(/;$/, ''),
        after: line.endsWith(';') ? ';' : '',
      };
    }
  }
  // Fall back: blank entire trimmed content
  const indent = line.match(/^(\s*)/)?.[1] ?? '';
  return { before: indent, blanked: line.trim(), after: '' };
}

interface Props {
  fileContent: string;
  filePath: string;
  language: string;
  repoUrl: string;
}

export function BlankIt({ fileContent, filePath, language, repoUrl }: Props) {
  const { apiKey, targetCompany } = useStore(s => ({ apiKey: s.apiKey, targetCompany: s.targetCompany }));
  const { get, post } = useApi();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [checked, setChecked] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [fileProgress, setFileProgress] = useState<any>(null);
  const [spacedLines, setSpacedLines] = useState<Set<number>>(new Set());

  const lines = useMemo(() => fileContent.split('\n'), [fileContent]);

  useEffect(() => {
    loadProgress();
  }, [filePath, repoUrl]);

  async function loadProgress() {
    try {
      const fp = await get<any>('/progress/file', { path: filePath, repo: repoUrl });
      setFileProgress(fp);
      if (fp?.difficulty) setDifficulty(fp.difficulty as Difficulty);

      // Load spaced repetition priorities
      const sr = await get<any[]>(`/progress/spaced-repetition/${encodeURIComponent(repoUrl)}/${encodeURIComponent(filePath)}`);
      const weakLines = new Set(sr.filter((r: any) => r.accuracy < 0.6).map((r: any) => r.line_number));
      setSpacedLines(weakLines);
    } catch { /* first time */ }
  }

  const generateBlanks = useCallback(() => {
    const seed = Date.now();
    const rand = mulberry32(seed);
    const newBlanks: Blank[] = [];

    lines.forEach((line, lineIndex) => {
      const type = classifyLine(line, difficulty);
      if (type === 'none') return;

      // Spaced repetition: 3x more likely to blank weak lines
      const priority = spacedLines.has(lineIndex + 1) ? 3 : 1;
      const threshold = difficulty === 'easy' ? 0.35 : difficulty === 'medium' ? 0.45 : 0.55;
      if (rand() > threshold * priority) return;

      const { blanked } = applyBlank(line, type);
      if (!blanked || blanked.length < 2) return;

      newBlanks.push({
        lineIndex,
        blankIndex: newBlanks.length,
        original: blanked,
        userAnswer: '',
        revealed: false,
        correct: null,
        width: Math.max(80, blanked.length * 8),
      });
    });

    setBlanks(newBlanks.slice(0, 20)); // cap at 20 blanks per session
    setChecked(false);
  }, [lines, difficulty, spacedLines]);

  useEffect(() => {
    if (fileContent) generateBlanks();
  }, [fileContent, difficulty]);

  async function startSession() {
    try {
      const data = await post<{ id: number }>('/progress/session', {
        filePath, repo: repoUrl, mode: 'blankit', difficulty,
      });
      setSessionId(data.id);
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    if (blanks.length > 0) startSession();
  }, [blanks]);

  function updateAnswer(blankIndex: number, value: string) {
    setBlanks(bs => bs.map(b => b.blankIndex === blankIndex ? { ...b, userAnswer: value } : b));
  }

  function checkAnswers() {
    setBlanks(bs => bs.map(b => {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/['"`;]/g, '');
      return { ...b, correct: norm(b.userAnswer) === norm(b.original) };
    }));
    setChecked(true);
    submitResults();
  }

  async function submitResults() {
    if (!sessionId) return;
    const results = blanks.map(b => ({
      lineNumber: b.lineIndex + 1,
      original: b.original,
      userAnswer: b.userAnswer,
      correct: b.correct ?? false,
    }));
    const score = blanks.filter(b => b.correct).length;
    try {
      await post('/progress/blank-results', { sessionId, results });
      await post('/progress/session', {
        filePath, repo: repoUrl, mode: 'blankit', difficulty, score, total: blanks.length
      });
    } catch { /* non-critical */ }
  }

  function revealBlank(blankIndex: number) {
    setBlanks(bs => bs.map(b => b.blankIndex === blankIndex ? { ...b, revealed: true, userAnswer: b.original } : b));
  }

  const score = blanks.filter(b => b.correct === true).length;
  const total = blanks.length;

  function renderLine(lineIndex: number, lineContent: string): React.ReactNode {
    const blank = blanks.find(b => b.lineIndex === lineIndex);
    if (!blank) {
      return <span className="text-gray-400">{lineContent}</span>;
    }

    const { before, blanked, after } = applyBlank(lineContent, classifyLine(lineContent, difficulty));
    const status = blank.revealed ? 'revealed' : blank.correct === true ? 'correct' : blank.correct === false ? 'incorrect' : '';

    return (
      <span>
        <span className="text-gray-400" dangerouslySetInnerHTML={{ __html: before }} />
        <span className="inline-flex items-center gap-1">
          <input
            className={`blank-input ${status} ${!checked && !blank.revealed ? 'blank-active' : ''}`}
            style={{ width: `${blank.width}px` }}
            value={blank.userAnswer}
            onChange={e => updateAnswer(blank.blankIndex, e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkAnswers()}
            disabled={checked || blank.revealed}
            placeholder="___"
            spellCheck={false}
          />
          {checked && !blank.revealed && blank.correct === false && (
            <button
              onClick={() => revealBlank(blank.blankIndex)}
              className="text-xs text-purple-400 hover:text-purple-300 ml-1"
              title="Reveal answer"
            >
              show
            </button>
          )}
          {(blank.revealed) && (
            <span className="text-xs text-gray-600 ml-1">→ {blank.original}</span>
          )}
        </span>
        <span className="text-gray-400" dangerouslySetInnerHTML={{ __html: after }} />
      </span>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-surface-1">
        <div className="flex gap-1">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors
                ${difficulty === d
                  ? d === 'easy' ? 'bg-green-800 text-green-200' : d === 'medium' ? 'bg-yellow-800 text-yellow-200' : 'bg-red-800 text-red-200'
                  : 'text-gray-500 hover:text-gray-300'}`}
            >
              {d}
            </button>
          ))}
        </div>

        {fileProgress && (
          <span className="text-xs text-gray-600">
            {fileProgress.sessions} sessions · avg {(fileProgress.avg_score * 100).toFixed(0)}%
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {checked && (
            <span className={`text-sm font-medium ${score / total >= 0.8 ? 'text-green-400' : score / total >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
              {score}/{total} correct
            </span>
          )}
          <button onClick={generateBlanks} className="btn-ghost text-xs">Regenerate</button>
          {!checked ? (
            <button onClick={checkAnswers} className="btn-primary" disabled={blanks.length === 0}>
              Check answers
            </button>
          ) : (
            <button onClick={() => { generateBlanks(); setChecked(false); }} className="btn-primary">
              New session
            </button>
          )}
        </div>
      </div>

      {/* Info bar */}
      {checked && (
        <div className={`px-4 py-2 text-sm border-b border-border slide-in
          ${score / total >= 0.8 ? 'bg-green-900/20 text-green-400' : score / total >= 0.5 ? 'bg-yellow-900/20 text-yellow-400' : 'bg-red-900/20 text-red-400'}`}>
          {score / total >= 0.8
            ? `Strong. ${score}/${total} — difficulty will auto-increase next session.`
            : score / total >= 0.5
            ? `Getting there. ${score}/${total} — missed items will appear more in future sessions.`
            : `Needs work. ${score}/${total} — click "show" on misses to reveal, then regenerate.`}
        </div>
      )}

      {/* Code with blanks */}
      <div className="flex-1 overflow-auto">
        <CodePanel
          content={fileContent}
          language={language}
          renderLine={renderLine}
        />
      </div>

      {/* Blank legend */}
      <div className="px-4 py-2 border-t border-border bg-surface-1 flex items-center gap-4 text-xs text-gray-600">
        <span>{blanks.length} blanks generated</span>
        {spacedLines.size > 0 && <span>· {spacedLines.size} spaced repetition priority lines</span>}
        <span className="ml-auto">Tab through fields · Enter to check</span>
      </div>
    </div>
  );
}
