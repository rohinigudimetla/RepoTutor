// Task types map to providers based on what they need:
// - Generation (questions, plans, problems) → Gemini Flash (free, fast, structured JSON)
// - Evaluation (grading answers, feedback) → Claude Sonnet (quality matters here — wrong feedback hurts learning)
// - Deep analysis (behavioral, architectural) → Claude Sonnet (needs project context reasoning)
// Fallback: if one key missing, uses whichever is configured.

export type TaskType =
  | 'generate_questions'
  | 'evaluate_answer'
  | 'generate_mock_coding'
  | 'generate_mock_system_design'
  | 'generate_mock_backend_dive'
  | 'generate_mock_behavioral'
  | 'generate_daily_plan';

interface ModelConfig {
  provider: 'anthropic' | 'gemini';
  model: string;
  reason: string;
}

const ROUTING_TABLE: Record<TaskType, ModelConfig> = {
  generate_questions:         { provider: 'gemini',    model: 'gemini-2.0-flash', reason: 'structured JSON generation, high volume' },
  evaluate_answer:            { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: 'evaluation quality directly affects learning — no shortcuts here' },
  generate_mock_coding:       { provider: 'gemini',    model: 'gemini-2.0-flash', reason: 'problem generation is templated, Gemini handles it well' },
  generate_mock_system_design:{ provider: 'gemini',    model: 'gemini-2.0-flash', reason: 'scenario generation, structured output' },
  generate_mock_backend_dive: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: 'needs deep file analysis and layered questioning — use best model' },
  generate_mock_behavioral:   { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: 'pulls from specific project decisions, needs context reasoning' },
  generate_daily_plan:        { provider: 'gemini',    model: 'gemini-2.0-flash', reason: 'planning is templated and data-driven, free model works well' },
};

export interface CallOptions {
  anthropicKey?: string;
  geminiKey?: string;
  task: TaskType;
  messages: Array<{ role: 'user' | 'model'; content: string }>;
  system?: string;
  maxTokens?: number;
}

export interface ModelCallResult {
  text: string;
  provider: 'anthropic' | 'gemini';
  model: string;
  reason: string;
}

export async function callBestModel(opts: CallOptions): Promise<ModelCallResult> {
  const { anthropicKey, geminiKey, task, messages, system, maxTokens = 2000 } = opts;
  const config = ROUTING_TABLE[task];

  const hasAnthropic = !!anthropicKey?.trim();
  const hasGemini = !!geminiKey?.trim();

  // Pick provider, falling back if key not available
  let chosenProvider = config.provider;
  if (chosenProvider === 'gemini' && !hasGemini) {
    if (!hasAnthropic) throw new Error('No API keys configured. Add an Anthropic or Gemini key in settings.');
    chosenProvider = 'anthropic';
  } else if (chosenProvider === 'anthropic' && !hasAnthropic) {
    if (!hasGemini) throw new Error('No API keys configured. Add an Anthropic or Gemini key in settings.');
    chosenProvider = 'gemini';
  }

  const model = chosenProvider === config.provider ? config.model
    : chosenProvider === 'anthropic' ? 'claude-sonnet-4-20250514'
    : 'gemini-2.0-flash';

  if (chosenProvider === 'anthropic') {
    const text = await callAnthropic(anthropicKey!, messages, system, maxTokens, model);
    return { text, provider: 'anthropic', model, reason: config.reason };
  } else {
    const text = await callGemini(geminiKey!, messages, system, maxTokens, model);
    return { text, provider: 'gemini', model, reason: config.reason };
  }
}

async function callAnthropic(
  apiKey: string,
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  system: string | undefined,
  maxTokens: number,
  model: string
): Promise<string> {
  const body: any = {
    model,
    max_tokens: maxTokens,
    messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
  };
  if (system) body.system = system;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  return data.content[0].text;
}

async function callGemini(
  apiKey: string,
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  system: string | undefined,
  maxTokens: number,
  model: string
): Promise<string> {
  const body: any = {
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return text;
}
