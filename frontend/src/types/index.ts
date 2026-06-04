export type Mode = 'dashboard' | 'blankit' | 'tutor' | 'mock';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Company = 'hubspot' | 'klaviyo' | 'atlassian' | 'capital_one';
export type MockRound = 'coding' | 'system_design' | 'backend_deep_dive' | 'behavioral';

export interface RepoFile {
  path: string;
  sha: string;
}

export interface Repo {
  name: string;
  url: string;
  branch: string;
  files?: RepoFile[];
}

export interface TutorQuestion {
  question: string;
  difficulty: Difficulty;
  relevant_lines: number[];
  concept: string;
  answer_guide: string;
  scaffold: string;
  follow_up: string;
  pain_hook: string;
}

export interface EvaluationResult {
  score: number;
  verdict: 'strong' | 'adequate' | 'weak' | 'incorrect';
  what_was_correct: string[];
  what_was_missing: string[];
  senior_engineer_addition: string;
  company_specific_feedback: string;
  concept_confidence: 'high' | 'medium' | 'low';
}

export interface Blank {
  lineIndex: number;
  blankIndex: number;
  original: string;
  userAnswer: string;
  revealed: boolean;
  correct: boolean | null;
  concept?: string;
  width: number;
}

export interface ConceptConfidence {
  concept: string;
  confidence: number;
  attempts: number;
  correct: number;
  last_seen: string;
  module_id: number;
}

export interface ReadinessData {
  overall_score: number;
  concept_breakdown: { red: number; yellow: number; green: number; total: number };
  company_readiness: Record<Company, number>;
  streak: number;
  days_remaining: number;
  weak_concepts: ConceptConfidence[];
}

export interface DailyPlan {
  date_plan: string;
  blocks: Array<{
    duration_minutes: number;
    mode: string;
    focus: string;
    why: string;
    company_relevance: string;
  }>;
  total_minutes: number;
  priority_concept: string;
  readiness_tip: string;
}
