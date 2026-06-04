import React, { useState } from 'react';
import { useStore } from '../store';
import { useApi } from '../hooks/useApi';
import { Company, MockRound } from '../types';

const COMPANIES: { id: Company; name: string }[] = [
  { id: 'hubspot', name: 'HubSpot' },
  { id: 'klaviyo', name: 'Klaviyo' },
  { id: 'atlassian', name: 'Atlassian' },
  { id: 'capital_one', name: 'Capital One' },
];

const ROUNDS: { id: MockRound; label: string; desc: string }[] = [
  { id: 'coding', label: 'Coding', desc: 'LeetCode-style problem in their style' },
  { id: 'system_design', label: 'System Design', desc: 'Design a system scoped to your stack' },
  { id: 'backend_deep_dive', label: 'Backend Deep Dive', desc: 'File-based deep questioning' },
  { id: 'behavioral', label: 'Behavioral', desc: 'STAR stories from your actual projects' },
];

interface Props {
  fileContent?: string;
  filePath?: string;
}

export function MockInterview({ fileContent, filePath }: Props) {
  const { apiKey, targetCompany, setTargetCompany } = useStore(s => ({
    apiKey: s.apiKey, targetCompany: s.targetCompany, setTargetCompany: s.setTargetCompany,
  }));
  const { post } = useApi();

  const [selectedRound, setSelectedRound] = useState<MockRound | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [startTime, setStartTime] = useState<number | null>(null);

  async function startRound(round: MockRound) {
    if (!apiKey) { setError('API key required'); return; }
    setSelectedRound(round);
    setLoading(true);
    setError(null);
    setSessionData(null);
    setCurrentQIdx(0);
    setUserAnswers({});
    setSubmitted({});
    setStartTime(Date.now());

    try {
      const data = await post('/ai/mock-interview', {
        roundType: round,
        targetCompany,
        fileContent: round === 'backend_deep_dive' ? fileContent : undefined,
        filePath: round === 'backend_deep_dive' ? filePath : undefined,
      });
      setSessionData(data);
    } catch (err: any) {
      setError(err.message);
      setSelectedRound(null);
    } finally {
      setLoading(false);
    }
  }

  function elapsed() {
    if (!startTime) return '0:00';
    const s = Math.floor((Date.now() - startTime) / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  function renderCodingRound(data: any) {
    return (
      <div className="space-y-4">
        <div className="card p-4 space-y-3">
          <h3 className="font-medium text-gray-200">{data.problem}</h3>
          {data.examples?.map((ex: any, i: number) => (
            <div key={i} className="bg-surface-2 rounded p-3 font-mono text-sm space-y-1">
              <div><span className="text-gray-500">Input:</span> <span className="text-gray-200">{ex.input}</span></div>
              <div><span className="text-gray-500">Output:</span> <span className="text-gray-200">{ex.output}</span></div>
              {ex.explanation && <div className="text-xs text-gray-500">{ex.explanation}</div>}
            </div>
          ))}
          {data.constraints?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Constraints:</div>
              <ul className="text-sm text-gray-400 space-y-0.5">
                {data.constraints.map((c: string, i: number) => <li key={i} className="flex gap-2"><span>·</span>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div>
          <textarea
            value={userAnswers[0] ?? ''}
            onChange={e => setUserAnswers(a => ({ ...a, 0: e.target.value }))}
            placeholder="Write your solution here..."
            className="w-full h-64 bg-surface-2 border border-border rounded p-3 font-mono text-sm text-gray-200 outline-none focus:border-accent-blue resize-none"
          />
        </div>
        {!submitted[0] ? (
          <div className="flex gap-2">
            <button
              onClick={() => setSubmitted(s => ({ ...s, 0: true }))}
              disabled={!userAnswers[0]?.trim()}
              className="btn-primary"
            >
              Submit solution
            </button>
            <button
              onClick={() => setUserAnswers(a => ({ ...a, 0: (a[0] ?? '') + '\n// Hint: ' + (data.hints?.[0] ?? '') }))}
              className="btn-ghost"
            >
              Hint
            </button>
          </div>
        ) : (
          <div className="card p-4 space-y-3 bg-surface-2">
            <div className="text-sm font-medium text-gray-300">Optimal approach:</div>
            <p className="text-sm text-gray-400">{data.optimal_approach}</p>
            <div className="flex gap-6 text-sm">
              <span>Time: <span className="text-accent-blue font-mono">{data.time_complexity}</span></span>
              <span>Space: <span className="text-accent-blue font-mono">{data.space_complexity}</span></span>
            </div>
            {data.follow_ups?.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Follow-up questions:</div>
                <ul className="text-sm text-gray-400 space-y-1">
                  {data.follow_ups.map((f: string, i: number) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderSystemDesign(data: any) {
    return (
      <div className="space-y-4">
        <div className="card p-4 space-y-3">
          <p className="text-gray-200 leading-relaxed">{data.scenario}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Functional requirements:</div>
              <ul className="text-sm text-gray-400 space-y-0.5">
                {data.requirements?.functional?.map((r: string, i: number) => <li key={i} className="flex gap-2"><span className="text-green-400">·</span>{r}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Non-functional:</div>
              <ul className="text-sm text-gray-400 space-y-0.5">
                {data.requirements?.non_functional?.map((r: string, i: number) => <li key={i} className="flex gap-2"><span className="text-yellow-400">·</span>{r}</li>)}
              </ul>
            </div>
          </div>
          {data.scale_parameters && (
            <div className="bg-surface-2 rounded p-3 font-mono text-xs text-gray-400 space-y-0.5">
              {Object.entries(data.scale_parameters).map(([k, v]) => (
                <div key={k}><span className="text-gray-500">{k}:</span> {v as string}</div>
              ))}
            </div>
          )}
          {data.starting_point && (
            <div className="border-l-2 border-accent-blue pl-3 text-sm text-gray-300">
              <span className="text-xs text-gray-500 block mb-1">Start from what you built:</span>
              {data.starting_point}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Evaluation areas: {data.evaluation_areas?.join(' · ')}</div>
          <textarea
            value={userAnswers[0] ?? ''}
            onChange={e => setUserAnswers(a => ({ ...a, 0: e.target.value }))}
            placeholder="Walk through your design: schema, caching, API, tradeoffs..."
            className="w-full h-48 bg-surface-2 border border-border rounded p-3 text-sm text-gray-200 outline-none focus:border-accent-blue resize-none"
          />
        </div>
        {data.follow_ups?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">Be ready for:</div>
            <ul className="text-sm text-gray-400 space-y-1">
              {data.follow_ups.map((f: string, i: number) => <li key={i} className="flex gap-2"><span>→</span>{f}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function renderDeepDive(data: any) {
    const questions = data.questions ?? [];
    const q = questions[currentQIdx];
    return (
      <div className="space-y-4">
        {data.opening && (
          <div className="text-sm text-gray-400 italic border-l-2 border-surface-3 pl-3">{data.opening}</div>
        )}
        {q && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${q.layer === 1 ? 'bg-blue-900/40 text-blue-400' : q.layer === 2 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'}`}>
                Layer {q.layer}
              </span>
              <span className="text-xs text-gray-600">{currentQIdx + 1}/{questions.length}</span>
            </div>
            <p className="text-gray-200">{q.question}</p>
            <textarea
              value={userAnswers[currentQIdx] ?? ''}
              onChange={e => setUserAnswers(a => ({ ...a, [currentQIdx]: e.target.value }))}
              placeholder="Answer..."
              className="w-full h-32 bg-surface-2 border border-border rounded p-3 text-sm text-gray-200 outline-none focus:border-accent-blue resize-none"
            />
            <div className="flex gap-2">
              {currentQIdx < questions.length - 1 && (
                <button onClick={() => setCurrentQIdx(i => i + 1)} className="btn-primary">Next →</button>
              )}
              {q.follow_up && submitted[currentQIdx] && (
                <p className="text-sm text-gray-400 italic">{q.follow_up}</p>
              )}
            </div>
          </div>
        )}
        {data.trap_questions?.length > 0 && currentQIdx >= questions.length - 1 && (
          <div className="card p-4 space-y-2">
            <div className="text-xs text-orange-400 font-medium">Trap questions — know these:</div>
            {data.trap_questions.map((t: string, i: number) => <p key={i} className="text-sm text-gray-300">{t}</p>)}
          </div>
        )}
        {data.strong_close && currentQIdx >= questions.length - 1 && (
          <div className="border border-purple-800 bg-purple-900/20 rounded p-4">
            <div className="text-xs text-purple-400 font-medium mb-1">The separating question:</div>
            <p className="text-sm text-purple-200">{data.strong_close}</p>
          </div>
        )}
      </div>
    );
  }

  function renderBehavioral(data: any) {
    const questions = data.questions ?? [];
    const q = questions[currentQIdx];
    return (
      <div className="space-y-4">
        {q && (
          <div className="space-y-3">
            <p className="text-gray-200 text-lg">{q.question}</p>
            {q.story_hook && (
              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded p-3 text-sm text-accent-blue">
                <span className="text-xs text-blue-500 block mb-1">Use this story →</span>
                {q.story_hook}
              </div>
            )}
            {q.star_guide && (
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                {Object.entries(q.star_guide).map(([key, val]) => (
                  <div key={key} className="bg-surface-2 rounded p-2">
                    <span className="font-medium text-gray-400 capitalize">{key}:</span> {val as string}
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={userAnswers[currentQIdx] ?? ''}
              onChange={e => setUserAnswers(a => ({ ...a, [currentQIdx]: e.target.value }))}
              placeholder="Tell your story..."
              className="w-full h-40 bg-surface-2 border border-border rounded p-3 text-sm text-gray-200 outline-none focus:border-accent-blue resize-none"
            />
            {q.what_company_wants_to_hear && (
              <div className="text-xs text-gray-500 border-l-2 border-surface-3 pl-3">
                {COMPANIES.find(c => c.id === targetCompany)?.name} wants to hear: {q.what_company_wants_to_hear}
              </div>
            )}
            <div className="flex gap-2">
              <button
                disabled={currentQIdx >= questions.length - 1}
                onClick={() => setCurrentQIdx(i => i + 1)}
                className="btn-primary"
              >
                {currentQIdx >= questions.length - 1 ? 'Done' : 'Next →'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Selection screen
  if (!selectedRound || (!loading && !sessionData && !error)) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <div className="text-xs text-gray-500 font-medium mb-2">Target company</div>
          <div className="flex gap-2">
            {COMPANIES.map(c => (
              <button
                key={c.id}
                onClick={() => setTargetCompany(c.id)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  targetCompany === c.id ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30' : 'bg-surface-2 text-gray-400 hover:text-gray-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 font-medium mb-2">Interview round</div>
          <div className="grid grid-cols-2 gap-3">
            {ROUNDS.map(r => (
              <button
                key={r.id}
                onClick={() => startRound(r.id)}
                disabled={r.id === 'backend_deep_dive' && !fileContent}
                className="card p-4 text-left hover:border-accent-blue/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-gray-200 mb-1">{r.label}</div>
                <div className="text-xs text-gray-500">{r.desc}</div>
                {r.id === 'backend_deep_dive' && !fileContent && (
                  <div className="text-xs text-yellow-500 mt-1">Select a file first</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-gray-400">Setting up your interview…</div>
          <div className="text-xs text-gray-600">Tailoring for {COMPANIES.find(c => c.id === targetCompany)?.name}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-1">
        <span className="text-sm font-medium">{COMPANIES.find(c => c.id === targetCompany)?.name} — {ROUNDS.find(r => r.id === selectedRound)?.label}</span>
        <span className="text-xs text-gray-600 ml-auto font-mono">{elapsed()}</span>
        <button onClick={() => { setSelectedRound(null); setSessionData(null); }} className="btn-ghost text-xs">↩ Back</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {selectedRound === 'coding' && renderCodingRound(sessionData)}
        {selectedRound === 'system_design' && renderSystemDesign(sessionData)}
        {selectedRound === 'backend_deep_dive' && renderDeepDive(sessionData)}
        {selectedRound === 'behavioral' && renderBehavioral(sessionData)}
      </div>
    </div>
  );
}
