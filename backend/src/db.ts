import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'repotutor.db'));

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      repo TEXT NOT NULL,
      mode TEXT NOT NULL,
      difficulty TEXT,
      score INTEGER,
      total INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blank_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      line_number INTEGER,
      original TEXT,
      user_answer TEXT,
      correct INTEGER,
      concept TEXT
    );

    CREATE TABLE IF NOT EXISTS concept_confidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept TEXT NOT NULL UNIQUE,
      confidence REAL DEFAULT 0.5,
      attempts INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      last_seen TEXT DEFAULT (datetime('now')),
      module_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS file_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      repo TEXT NOT NULL,
      difficulty TEXT DEFAULT 'easy',
      sessions INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      last_seen TEXT,
      UNIQUE(file_path, repo)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE,
      plan TEXT
    );
  `);

  // Seed default settings
  const upsert = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  upsert.run('current_module', '8');
  upsert.run('target_company', 'hubspot');
  upsert.run('repos', JSON.stringify([
    { name: 'Pocket-Library', url: 'https://github.com/rohinigudimetla/Pocket-Library', branch: 'main' }
  ]));

  // Seed known concepts from completed modules
  const seedConcept = db.prepare(`INSERT OR IGNORE INTO concept_confidence (concept, confidence, module_id) VALUES (?, ?, ?)`);
  const concepts = [
    ['useState', 0.7, 1], ['useEffect', 0.5, 1], ['useContext', 0.5, 1], ['useReducer', 0.4, 1],
    ['custom hooks', 0.4, 7], ['data fetching', 0.6, 2], ['loading states', 0.6, 2],
    ['React Router', 0.7, 3], ['protected routes', 0.5, 3],
    ['controlled inputs', 0.6, 4], ['form validation', 0.5, 4],
    ['auth context', 0.4, 5], ['role-based UI', 0.4, 5],
    ['REST controllers', 0.3, 8], ['service layer', 0.3, 8], ['JPA', 0.2, 8], ['Spring Security', 0.2, 8],
    ['JWT', 0.4, 5], ['Redux', 0.3, 7], ['TypeScript generics', 0.4, 7],
  ];
  concepts.forEach(([concept, confidence, module_id]) => {
    seedConcept.run(concept, confidence, module_id);
  });
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getConceptConfidence() {
  return db.prepare('SELECT * FROM concept_confidence ORDER BY confidence ASC').all();
}

export function updateConceptConfidence(concept: string, correct: boolean, moduleId?: number) {
  const existing = db.prepare('SELECT * FROM concept_confidence WHERE concept = ?').get(concept) as any;
  if (existing) {
    const newAttempts = existing.attempts + 1;
    const newCorrect = existing.correct + (correct ? 1 : 0);
    // Exponential moving average toward measured rate
    const measuredRate = newCorrect / newAttempts;
    const newConfidence = existing.confidence * 0.7 + measuredRate * 0.3;
    db.prepare(`UPDATE concept_confidence SET confidence = ?, attempts = ?, correct = ?, last_seen = datetime('now') WHERE concept = ?`)
      .run(newConfidence, newAttempts, newCorrect, concept);
  } else {
    db.prepare(`INSERT INTO concept_confidence (concept, confidence, attempts, correct, module_id) VALUES (?, ?, 1, ?, ?)`)
      .run(concept, correct ? 0.6 : 0.3, correct ? 1 : 0, moduleId ?? null);
  }
}

export function recordSession(data: {
  filePath: string; repo: string; mode: string;
  difficulty?: string; score?: number; total?: number;
}) {
  const result = db.prepare(`
    INSERT INTO sessions (file_path, repo, mode, difficulty, score, total)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.filePath, data.repo, data.mode, data.difficulty ?? null, data.score ?? null, data.total ?? null);
  return result.lastInsertRowid;
}

export function getFileProgress(filePath: string, repo: string) {
  return db.prepare('SELECT * FROM file_progress WHERE file_path = ? AND repo = ?').get(filePath, repo) as any;
}

export function updateFileProgress(filePath: string, repo: string, score: number, total: number) {
  const existing = db.prepare('SELECT * FROM file_progress WHERE file_path = ? AND repo = ?').get(filePath, repo) as any;
  if (existing) {
    const newSessions = existing.sessions + 1;
    const newAvg = (existing.avg_score * existing.sessions + (score / total)) / newSessions;
    const newDifficulty = newAvg > 0.85 && existing.difficulty === 'easy' ? 'medium'
      : newAvg > 0.85 && existing.difficulty === 'medium' ? 'hard'
      : existing.difficulty;
    db.prepare(`UPDATE file_progress SET sessions = ?, avg_score = ?, difficulty = ?, last_seen = datetime('now') WHERE file_path = ? AND repo = ?`)
      .run(newSessions, newAvg, newDifficulty, filePath, repo);
  } else {
    db.prepare(`INSERT INTO file_progress (file_path, repo, sessions, avg_score, last_seen) VALUES (?, ?, 1, ?, datetime('now'))`)
      .run(filePath, repo, score / total);
  }
}

export function getSessionHistory(limit = 50) {
  return db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?').all(limit);
}

export function getWeakConcepts(limit = 5) {
  return db.prepare('SELECT * FROM concept_confidence WHERE confidence < 0.6 ORDER BY confidence ASC LIMIT ?').all(limit) as any[];
}
