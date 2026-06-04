import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useApi } from '../hooks/useApi';
import { TutorQuestion, EvaluationResult, Difficulty } from '../types';
import { CodePanel } from './CodePanel';

interface Props {
  fileContent: string;
  filePath: string;
  language: string;
  repoUrl: string;
}

type Phase = 'loading' | 'question' | 'answering' | 'evaluating' | 'feedback' | 'complete';

export function TutorMode({ fileContent, filePath, language, repoUrl }: Props) {
  const { apiKey, targetCompany, setHighlightedLines } = useStore(s => ({
    apiKey: s.apiKey, targetCompany: s.targetCompany, setHighlightedLines: s.setHighlightedLines,
  }));
  const { post } = useApi();

  const [questions, setQuestions] = useState<TutorQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [layer, setLayer] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showScaffold, setShowScaffold] = useState(true);
  const [sessionScore, setSessionScore] = useState({ strong: 0, adequate: 0, weak: 0, total: 0 });

  useEffect(() => {
    if (fileContent && apiKey) loadQuestions();
    else if (!apiKey) setError('Enter your Anthropic API key in settings to use TutorMode.');
  }, [fileContent, apiKey]);

  async function loadQuestions() {
    setPhase('loading');
    setError(null);
    try {
      const data = await post<{ questions: TutorQuestion[] }>('/ai/questions', {
        fileContent, filePath, targetCompany, layer,
      });
      if (!data.questions?.length) throw new Error('No questions returned');
      setQuestions(data.questions);
      setCurrentIndex(0);
      setPhase('question');
      setHighlightedLines(data.questions[0]?.relevant_lines ?? []);
    } catch (err: any) {
      setError(err.message);
      setPhase('loading');
    }
  }

  const currentQ = questions[currentIndex];

  function startAnswering() {
    setPhase('answering');
    setAnswer('');
    setShowScaffold(true);
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setPhase('evaluating');

    const lines = fileContent.split('\n');
    const snippetLines = (currentQ.relevant_lines ?? []).map(n => `${n}: ${lines[n - 1] ?? ''}`);
    const codeSnippet = snippetLines.join('\n');

    try {
      const result = await post<EvaluationResult>('/ai/evaluate', {
        question: currentQ.question,
        answerGuide: currentQ.answer_guide,
        userAnswer: answer,
        concept: currentQ.concept,
        filePath,
        targetCompany,
        codeSnippet,
      });
      setEvaluation(result);
      setPhase('feedback');
      setSessionScore(s => ({
        ...s,
        total: s.total + 1,
        strong: s.strong + (result.verdict === 'strong' ? 1 : 0),
        adequate: s.adequate + (result.verdict === 'adequate' ? 1 : 0),
        weak: s.weak + (result.verdict === 'weak' || result.verdict === 'incorrect' ? 1 : 0),
      }));

      // Auto-advance layer if consistently strong
      if (result.verdict === 'strong' && sessionScore.total >= 2) {
        setLayer(l => Math.min(l + 1, 3));
      }
    } catch (err: any) {
      setError(err.message);
      setPhase('answering');
    }
  }

  function nextQuestion() {
    if (currentIndex >= questions.length - 1) {
      setPhase('complete');
      setHighlightedLines([]);
      return;
    }
    const next = questions[currentIndex + 1];
    setCurrentIndex(i => i + 1);
    setPhase('question');
    setEvaluation(null);
    setAnswer('');
    setHighlightedLines(next?.relevant_lines ?? []);
  }

  const difficultyTag = (d: string) => (
    <span className={`tag-${d}`}>{d}</span>
  );

  const verdictColor: Record<string, string> = {
    strong: 'text-green-400 bg-green-900/20 border-green-800',
    adequate: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
    weak: 'text-orange-400 bg-orange-900/20 border-orange-800',
    incorrect: 'text-red-400 bg-red-900/20 border-red-800',
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3 max-w-md">
          <p className="text-red-400">{error}</p>
          {apiKey && (
            <button onClick={loadQuestions} className="btn-primary">Retry</button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-gray-400">Generating questions for this file…</div>
          <div className="text-xs text-gray-600">Reading through {filePath.split('/').pop()} at layer {layer}</div>
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 space-y-6">
        <div className="text-2xl font-medium">Session complete</div>
        <div className="flex gap-6 text-center">
          <div><div className="text-3xl font-bold text-green-400">{sessionScore.strong}</div><div className="text-xs text-gray-500">strong</div></div>
          <div><div className="text-3xl font-bold text-yellow-400">{sessionScore.adequate}</div><div className="text-xs text-gray-500">adequate</div></div>
          <div><div className="text-3xl font-bold text-red-400">{sessionScore.weak}</div><div className="text-xs text-gray-500">needs work</div></div>
        </div>
        <div className="space-y-2 text-center">
          <button onClick={() => { setLayer(l => Math.min(l + 1, 3)); loadQuestions(); }} className="btn-primary block w-full">
            Layer {Math.min(layer + 1, 3)} questions — go deeper
          </button>
          <button onClick={loadQuestions} className="btn-ghost block w-full">Regenerate same layer</button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-1">
        <div className="flex gap-1">
          {questions.map((q, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < currentIndex
                  ? 'bg-accent-blue'
                  : i === currentIndex
                  ? 'bg-white'
                  : 'bg-surface-3'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-600">{currentIndex + 1}/{questions.length}</span>
        <span className="text-xs text-gray-600">Layer {layer}/3: {layer === 1 ? 'comprehension' : layer === 2 ? 'reasoning' : 'stress test'}</span>
        <div className="ml-auto flex gap-2 text-xs text-gray-600">
          <span className="text-green-400">{sessionScore.strong}✓</span>
          <span className="text-red-400">{sessionScore.weak}✗</span>
        </div>
      </div>

      {/* Question */}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          {difficultyTag(currentQ.difficulty)}
          <span className="text-xs bg-surface-2 text-gray-400 px-2 py-0.5 rounded">{currentQ.concept}</span>
        </div>

        {/* Pain hook — shown first, per learner profile */}
        {currentQ.pain_hook && (
          <div className="bg-red-900/10 border border-red-900/30 rounded p-3 text-sm text-red-300">
            <span className="text-xs text-red-500 font-medium block mb-1">Before you answer →</span>
            {currentQ.pain_hook}
          </div>
        )}

        <p className="text-gray-100 leading-relaxed">{currentQ.question}</p>

        {/* Scaffold — show pattern before asking */}
        {showScaffold && currentQ.scaffold && phase === 'question' && (
          <div className="bg-surface-2 rounded p-3 text-sm text-gray-300 border border-border">
            <span className="text-xs text-gray-500 font-medium block mb-1">Pattern to reference →</span>
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{currentQ.scaffold}</pre>
          </div>
        )}

        {/* Highlighted lines reference */}
        {currentQ.relevant_lines?.length > 0 && (
          <div className="text-xs text-gray-500">
            Relevant lines: {currentQ.relevant_lines.join(', ')} — highlighted in code panel above
          </div>
        )}

        {phase === 'question' && (
          <button onClick={startAnswering} className="btn-primary">
            I'm ready to answer
          </button>
        )}

        {phase === 'answering' && (
          <div className="space-y-2">
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Type your answer here. Be specific — reference the actual code."
              className="w-full bg-surface-2 border border-border rounded p-3 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-accent-blue resize-none min-h-[120px]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={submitAnswer}
                disabled={!answer.trim()}
                className="btn-primary"
              >
                Submit answer
              </button>
              <button
                onClick={() => setShowScaffold(s => !s)}
                className="btn-ghost text-xs"
              >
                {showScaffold ? 'Hide' : 'Show'} scaffold
              </button>
            </div>
          </div>
        )}

        {phase === 'evaluating' && (
          <div className="text-sm text-gray-400">Evaluating your answer…</div>
        )}

        {phase === 'feedback' && evaluation && (
          <div className={`rounded-lg border p-4 space-y-3 slide-in ${verdictColor[evaluation.verdict]}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{evaluation.verdict}</span>
              <span className="text-2xl font-bold">{evaluation.score}/100</span>
            </div>

            {evaluation.what_was_correct.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">What landed:</div>
                <ul className="space-y-0.5">
                  {evaluation.what_was_correct.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-green-400 flex-shrink-0">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.what_was_missing.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">What was missing:</div>
                <ul className="space-y-0.5">
                  {evaluation.what_was_missing.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-red-400 flex-shrink-0">✗</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.senior_engineer_addition && (
              <div className="border-t border-white/10 pt-3">
                <div className="text-xs text-gray-400 font-medium mb-1">What a senior would add:</div>
                <p className="text-sm text-gray-200">{evaluation.senior_engineer_addition}</p>
              </div>
            )}

            {evaluation.company_specific_feedback && (
              <div className="bg-black/20 rounded p-3">
                <div className="text-xs text-gray-500 font-medium mb-1">Company-specific read:</div>
                <p className="text-sm">{evaluation.company_specific_feedback}</p>
              </div>
            )}

            {/* Follow-up question if they did well */}
            {evaluation.verdict === 'strong' && currentQ.follow_up && (
              <div className="border-t border-white/10 pt-3">
                <div className="text-xs text-gray-400 mb-1">Follow-up (since you got it):</div>
                <p className="text-sm text-gray-200 italic">{currentQ.follow_up}</p>
              </div>
            )}

            <button onClick={nextQuestion} className="btn-primary w-full mt-2">
              {currentIndex >= questions.length - 1 ? 'See session results' : 'Next question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
