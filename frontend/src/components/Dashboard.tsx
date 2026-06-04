import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useApi } from '../hooks/useApi';
import { ConceptConfidence, ReadinessData, DailyPlan, Company } from '../types';

const COMPANY_NAMES: Record<Company, string> = {
  hubspot: 'HubSpot',
  klaviyo: 'Klaviyo',
  atlassian: 'Atlassian',
  capital_one: 'Capital One',
};

const MODULES = [
  { id: 1, name: 'React Hooks', status: 'complete' },
  { id: 2, name: 'Data Fetching', status: 'complete' },
  { id: 3, name: 'Routing', status: 'complete' },
  { id: 4, name: 'Forms', status: 'complete' },
  { id: 5, name: 'Role-Based UI', status: 'complete' },
  { id: 6, name: 'Styling', status: 'complete' },
  { id: 7, name: 'Advanced Patterns', status: 'complete' },
  { id: 8, name: 'Spring Boot', status: 'current' },
  { id: 9, name: 'PostgreSQL & JPA', status: 'upcoming' },
  { id: 10, name: 'Redis & Caching', status: 'upcoming' },
  { id: 11, name: 'Auth Deep Dive', status: 'upcoming' },
  { id: 12, name: 'API Design', status: 'upcoming' },
  { id: 13, name: 'Testing', status: 'upcoming' },
  { id: 14, name: 'AWS', status: 'upcoming' },
  { id: 15, name: 'System Design', status: 'upcoming' },
  { id: 16, name: 'Performance', status: 'upcoming' },
  { id: 17, name: 'Full Stack', status: 'upcoming' },
];

export function Dashboard() {
  const { apiKey, targetCompany, currentModule, setMode, setTargetCompany, setCurrentModule } = useStore(s => ({
    apiKey: s.apiKey, targetCompany: s.targetCompany, currentModule: s.currentModule,
    setMode: s.setMode, setTargetCompany: s.setTargetCompany, setCurrentModule: s.setCurrentModule,
  }));
  const { get, post } = useApi();

  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [concepts, setConcepts] = useState<ConceptConfidence[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        get<ReadinessData>('/progress/readiness'),
        get<ConceptConfidence[]>('/progress/concepts'),
      ]);
      setReadiness(r);
      setConcepts(c);
    } finally {
      setLoading(false);
    }
  }

  async function generateDailyPlan() {
    if (!apiKey) { alert('API key required'); return; }
    setPlanLoading(true);
    try {
      const plan = await post<DailyPlan>('/ai/daily-plan', {});
      setDailyPlan(plan);
    } finally {
      setPlanLoading(false);
    }
  }

  function confidenceColor(c: number) {
    if (c >= 0.7) return 'text-green-400';
    if (c >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  }

  function confidenceBg(c: number) {
    if (c >= 0.7) return 'bg-green-500';
    if (c >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function companyReadinessColor(score: number) {
    if (score >= 70) return 'text-green-400';
    if (score >= 45) return 'text-yellow-400';
    return 'text-red-400';
  }

  const daysRemaining = readiness?.days_remaining ?? 60;
  const streak = readiness?.streak ?? 0;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Interview Readiness</h1>
          <p className="text-xs text-gray-500">{daysRemaining} days to interviews · module {currentModule}/17 · {streak > 0 ? `${streak}-day streak 🔥` : 'no streak yet'}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-accent-blue">{readiness?.overall_score ?? 0}%</div>
          <div className="text-xs text-gray-500">overall readiness</div>
        </div>
      </div>

      {/* Company readiness */}
      <div className="card p-4">
        <div className="text-xs text-gray-500 font-medium mb-3">Company readiness</div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(COMPANY_NAMES).map(([id, name]) => {
            const score = readiness?.company_readiness?.[id as Company] ?? 30;
            return (
              <div
                key={id}
                onClick={() => setTargetCompany(id as Company)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  targetCompany === id ? 'border-accent-blue/50 bg-accent-blue/5' : 'border-border hover:border-surface-3'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">{name}</span>
                  <span className={`text-lg font-bold ${companyReadinessColor(score)}`}>{score}%</span>
                </div>
                <div className="w-full bg-surface-3 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 ${companyReadinessColor(score).replace('text-', 'bg-')}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily plan */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500 font-medium">Today's study plan</div>
          <button onClick={generateDailyPlan} disabled={planLoading} className="btn-ghost text-xs">
            {planLoading ? 'Generating…' : dailyPlan ? 'Regenerate' : 'Generate plan'}
          </button>
        </div>
        {dailyPlan ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-300 italic">{dailyPlan.date_plan}</p>
            <div className="space-y-2">
              {dailyPlan.blocks.map((block, i) => (
                <div key={i} className="flex gap-3 p-2 bg-surface-2 rounded">
                  <div className="text-xs text-gray-500 w-12 flex-shrink-0 pt-0.5">{block.duration_minutes}min</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-accent-blue">{block.mode}</span>
                      <span className="text-sm text-gray-200 truncate">{block.focus}</span>
                    </div>
                    <div className="text-xs text-gray-500">{block.why}</div>
                    <div className="text-xs text-gray-600">{block.company_relevance}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-2">
              <div className="text-xs text-gray-500 mb-1">Priority concept today:</div>
              <div className="text-sm font-medium text-accent-orange">{dailyPlan.priority_concept}</div>
              <div className="text-xs text-gray-400 mt-1">{dailyPlan.readiness_tip}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 text-center py-4">
            {apiKey ? 'Click "Generate plan" for your personalized daily plan' : 'Add your API key to generate a daily plan'}
          </div>
        )}
      </div>

      {/* Concept confidence */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500 font-medium">Concept confidence</div>
          <div className="flex gap-3 text-xs text-gray-600">
            <span className="text-green-400">● owned</span>
            <span className="text-yellow-400">● developing</span>
            <span className="text-red-400">● gap</span>
          </div>
        </div>
        <div className="space-y-2">
          {concepts.map(c => (
            <div key={c.concept} className="flex items-center gap-2">
              <div className="w-32 flex-shrink-0 text-xs text-gray-400 truncate">{c.concept}</div>
              <div className="flex-1 bg-surface-3 rounded-full h-1.5">
                <div
                  className={`confidence-bar ${confidenceBg(c.confidence)}`}
                  style={{ width: `${c.confidence * 100}%` }}
                />
              </div>
              <div className={`text-xs w-8 text-right ${confidenceColor(c.confidence)}`}>
                {(c.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-700 w-12 text-right">
                {c.attempts > 0 ? `${c.attempts}×` : '—'}
              </div>
            </div>
          ))}
          {concepts.length === 0 && !loading && (
            <div className="text-sm text-gray-600 text-center py-2">
              Start studying to track concept confidence
            </div>
          )}
        </div>
      </div>

      {/* Curriculum progress */}
      <div className="card p-4">
        <div className="text-xs text-gray-500 font-medium mb-3">Curriculum progress</div>
        <div className="flex gap-1 flex-wrap">
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => m.status !== 'upcoming' && setCurrentModule(m.id)}
              title={m.name}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                m.status === 'complete' ? 'bg-green-900/40 text-green-400'
                : m.status === 'current' ? 'bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue'
                : 'bg-surface-2 text-gray-600'
              }`}
            >
              {m.id}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Module {currentModule}: {MODULES.find(m => m.id === currentModule)?.name}
          {' · '}
          <button onClick={() => setCurrentModule(Math.min(currentModule + 1, 17))} className="text-accent-blue hover:underline">advance →</button>
        </div>
      </div>

      {/* Red flags */}
      {readiness?.weak_concepts && readiness.weak_concepts.length > 0 && (
        <div className="card p-4 border-red-900/40">
          <div className="text-xs text-red-400 font-medium mb-2">⚠ Active gaps — study these first</div>
          <div className="space-y-1">
            {readiness.weak_concepts.map((c: any) => (
              <div key={c.concept} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{c.concept}</span>
                <span className="text-red-400 font-mono text-xs">{(c.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
