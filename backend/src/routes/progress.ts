import { Router } from 'express';
import {
  getConceptConfidence, updateConceptConfidence, recordSession,
  getFileProgress, updateFileProgress, getSessionHistory,
  getSetting, setSetting, getWeakConcepts, db
} from '../db';

const router = Router();

router.get('/concepts', (_req, res) => {
  res.json(getConceptConfidence());
});

router.post('/concepts/:concept', (req, res) => {
  const { concept } = req.params;
  const { correct, moduleId } = req.body;
  updateConceptConfidence(concept, correct, moduleId);
  res.json({ ok: true });
});

router.get('/file', (req, res) => {
  const { path, repo } = req.query as { path: string; repo: string };
  if (!path || !repo) return res.status(400).json({ error: 'path and repo required' });
  const progress = getFileProgress(path, repo);
  res.json(progress ?? { file_path: path, repo, difficulty: 'easy', sessions: 0, avg_score: 0 });
});

router.post('/session', (req, res) => {
  const { filePath, repo, mode, difficulty, score, total } = req.body;
  const id = recordSession({ filePath, repo, mode, difficulty, score, total });
  if (score !== undefined && total !== undefined) {
    updateFileProgress(filePath, repo, score, total);
  }
  res.json({ id });
});

router.get('/history', (_req, res) => {
  res.json(getSessionHistory(50));
});

router.get('/weak-concepts', (_req, res) => {
  res.json(getWeakConcepts(8));
});

router.get('/settings', (_req, res) => {
  const keys = ['current_module', 'target_company', 'repos', 'api_key_hint'];
  const result: Record<string, string | null> = {};
  keys.forEach(k => { result[k] = getSetting(k); });
  res.json(result);
});

router.post('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  setSetting(key, value);
  res.json({ ok: true });
});

router.get('/readiness', (_req, res) => {
  const concepts = getConceptConfidence() as any[];
  const total = concepts.length;
  const red = concepts.filter(c => c.confidence < 0.4).length;
  const yellow = concepts.filter(c => c.confidence >= 0.4 && c.confidence < 0.7).length;
  const green = concepts.filter(c => c.confidence >= 0.7).length;

  const overallScore = total > 0 ? concepts.reduce((sum, c) => sum + c.confidence, 0) / total : 0;

  // Per-company readiness based on their focus areas
  const companyReadiness = {
    hubspot: calcCompanyReadiness(concepts, ['useState', 'useEffect', 'auth context', 'REST controllers', 'service layer']),
    klaviyo: calcCompanyReadiness(concepts, ['data fetching', 'loading states', 'async/await', 'caching strategy']),
    atlassian: calcCompanyReadiness(concepts, ['REST controllers', 'JPA', 'Spring Security', 'dependency injection', 'design patterns']),
    capital_one: calcCompanyReadiness(concepts, ['JWT', 'Spring Security', 'auth context', 'service layer', 'JPA']),
  };

  // Session streak
  const history = getSessionHistory(30) as any[];
  const streak = calcStreak(history);

  res.json({
    overall_score: Math.round(overallScore * 100),
    concept_breakdown: { red, yellow, green, total },
    company_readiness: companyReadiness,
    streak,
    days_remaining: 60, // hardcoded, could be dynamic
    weak_concepts: getWeakConcepts(5),
  });
});

function calcCompanyReadiness(concepts: any[], relevantConcepts: string[]): number {
  const relevant = concepts.filter(c => relevantConcepts.some(rc => c.concept.toLowerCase().includes(rc.toLowerCase())));
  if (relevant.length === 0) return 30; // default low
  return Math.round(relevant.reduce((sum, c) => sum + c.confidence, 0) / relevant.length * 100);
}

function calcStreak(history: any[]): number {
  if (history.length === 0) return 0;
  const dates = [...new Set(history.map(h => h.created_at.split('T')[0] || h.created_at.split(' ')[0]))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];
    if (dates[i] === expectedStr) streak++;
    else break;
  }
  return streak;
}

// Blank-it spaced repetition: which lines to prioritize re-blanking
router.get('/spaced-repetition/:repo/:filepath', (req, res) => {
  const { repo, filepath } = req.params;
  const rows = db.prepare(`
    SELECT br.line_number, br.concept, AVG(br.correct) as accuracy, COUNT(*) as attempts
    FROM blank_results br
    JOIN sessions s ON s.id = br.session_id
    WHERE s.repo = ? AND s.file_path = ?
    GROUP BY br.line_number
    ORDER BY accuracy ASC
  `).all(repo, decodeURIComponent(filepath)) as any[];
  res.json(rows);
});

router.post('/blank-results', (req, res) => {
  const { sessionId, results } = req.body;
  const insert = db.prepare(`INSERT INTO blank_results (session_id, line_number, original, user_answer, correct, concept) VALUES (?, ?, ?, ?, ?, ?)`);
  results.forEach((r: any) => {
    insert.run(sessionId, r.lineNumber, r.original, r.userAnswer, r.correct ? 1 : 0, r.concept ?? null);
    if (r.concept) updateConceptConfidence(r.concept, r.correct);
  });
  res.json({ ok: true });
});

export { router as progressRouter };
