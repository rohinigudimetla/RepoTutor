import { Router } from 'express';
import { getSetting, getWeakConcepts, updateConceptConfidence } from '../db';
import { LEARNER_PROFILE, TARGET_COMPANIES, CURRICULUM, getRelevantConcepts } from '../curriculum';

const router = Router();

async function callAnthropic(apiKey: string, messages: any[], system?: string, maxTokens = 2000): Promise<string> {
  const body: any = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = await response.json() as any;
  return data.content[0].text;
}

function buildLearnerContext(targetCompany?: string) {
  const currentModule = parseInt(getSetting('current_module') ?? '8');
  const company = targetCompany ?? getSetting('target_company') ?? 'hubspot';
  const companyInfo = TARGET_COMPANIES[company as keyof typeof TARGET_COMPANIES];
  const relevantConcepts = getRelevantConcepts(currentModule);

  return `
LEARNER PROFILE:
- CS grad student targeting mid-level full stack roles (Spring Boot, React, TypeScript, PostgreSQL, Redis, AWS)
- Current curriculum module: ${currentModule} — ${CURRICULUM.modules.find(m => m.id === currentModule)?.name}
- Completed modules: ${CURRICULUM.modules.filter(m => m.status === 'complete').map(m => m.name).join(', ')}
- Learning style: ${LEARNER_PROFILE.learning_style}
- Known weak spot: ${LEARNER_PROFILE.known_weak_spots.join('; ')}
- Feedback requirement: ${LEARNER_PROFILE.feedback_style}
- Scaffolding rule: ${LEARNER_PROFILE.known_weak_spots[1]}
- Key project decisions: ${LEARNER_PROFILE.project_context.known_decisions.join('; ')}

TARGET COMPANY: ${companyInfo?.name ?? company}
Interview style: ${companyInfo?.interview_style ?? ''}
Strong signals they want to see: ${companyInfo?.strong_signals?.join(', ') ?? ''}
Weak signals to avoid: ${companyInfo?.weak_signals?.join(', ') ?? ''}
Question framing style: ${companyInfo?.question_framing ?? ''}

CURRENTLY RELEVANT CONCEPTS (weight questions toward these): ${relevantConcepts.join(', ')}
`;
}

// Generate TutorMode questions for a file
router.post('/questions', async (req, res) => {
  const { apiKey, fileContent, filePath, targetCompany, layer = 1 } = req.body;
  if (!apiKey || !fileContent) return res.status(400).json({ error: 'apiKey and fileContent required' });

  const learnerContext = buildLearnerContext(targetCompany);

  const system = `You are a senior software engineer conducting a technical interview. You are rigorous, specific, and pedagogically aware.

${learnerContext}

QUESTIONING RULES:
- Layer ${layer} focus: ${layer === 1 ? 'comprehension — what does this code do and how' : layer === 2 ? 'reasoning — why was this written this way, what are the tradeoffs' : 'stress test — what breaks at scale, what would you change, architectural critique'}
- Always reference specific line numbers in questions
- Never ask the learner to write code from memory — always show the relevant lines first
- Apply pain-before-solution: when a concept appears, phrase the question as "what happens if this line is removed/changed"
- ${layer >= 2 ? 'Include cross-concept connections — how does this relate to other parts of the system' : ''}

RESPONSE FORMAT: Return only valid JSON, no preamble, no markdown fences:
{
  "questions": [
    {
      "question": "string — specific, references lines, framed per company style",
      "difficulty": "easy" | "medium" | "hard",
      "relevant_lines": [number, ...],
      "concept": "string — the core concept being tested",
      "answer_guide": "string — what a strong answer covers, what signals good understanding",
      "scaffold": "string — the pattern or hint to show before asking (per learner profile: always show pattern first)",
      "follow_up": "string — a harder follow-up if they answer well",
      "pain_hook": "string — what breaks if this code didn't exist or was wrong"
    }
  ]
}

Generate 5-8 questions. Mix difficulty. Cover: what it does, why this approach, what breaks without it, what changes at scale.`;

  try {
    const text = await callAnthropic(apiKey, [
      { role: 'user', content: `Here is the file ${filePath}:\n\n\`\`\`\n${fileContent}\n\`\`\`` }
    ], system, 3000);

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Evaluate a learner answer
router.post('/evaluate', async (req, res) => {
  const { apiKey, question, answerGuide, userAnswer, concept, filePath, targetCompany, codeSnippet } = req.body;
  if (!apiKey || !question || !userAnswer) return res.status(400).json({ error: 'apiKey, question, userAnswer required' });

  const learnerContext = buildLearnerContext(targetCompany);
  const company = targetCompany ?? getSetting('target_company') ?? 'hubspot';
  const companyInfo = TARGET_COMPANIES[company as keyof typeof TARGET_COMPANIES];

  const system = `You are evaluating a technical interview answer. Be direct, specific, and pedagogically useful.

${learnerContext}

EVALUATION RULES:
- Reference specific lines or code elements in your feedback
- Tell them EXACTLY what a ${companyInfo?.name ?? 'senior'} interviewer would think hearing this answer
- If something is correct: name the specific thing and say why it lands well in this company's interview
- If something is missing: be precise about what's absent and why it matters
- Never give generic praise. "Good answer" alone is useless.
- Scaffold the gap: if they missed something, show them the code pattern that reveals it rather than just telling them
- Score honestly: if they would not pass this question in a real interview, say so

RESPONSE FORMAT: Return only valid JSON:
{
  "score": 0-100,
  "verdict": "strong" | "adequate" | "weak" | "incorrect",
  "what_was_correct": ["specific thing 1", ...],
  "what_was_missing": ["specific missing point with line reference", ...],
  "senior_engineer_addition": "what a senior engineer would have added that demonstrates deeper knowledge",
  "company_specific_feedback": "how this answer would land specifically at ${companyInfo?.name ?? 'this company'} — what the interviewer would think",
  "concept_confidence": "high" | "medium" | "low"
}`;

  try {
    const text = await callAnthropic(apiKey, [
      { role: 'user', content: `Question: ${question}\n\nCode context:\n\`\`\`\n${codeSnippet ?? ''}\n\`\`\`\n\nExpected coverage (answer guide): ${answerGuide}\n\nCandidate's answer: ${userAnswer}` }
    ], system, 1500);

    const parsed = JSON.parse(text);

    // Update concept confidence based on evaluation
    if (concept && parsed.concept_confidence) {
      const correct = parsed.concept_confidence === 'high' || parsed.score >= 70;
      updateConceptConfidence(concept, correct);
    }

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate mock interview session
router.post('/mock-interview', async (req, res) => {
  const { apiKey, roundType, targetCompany, fileContent, filePath } = req.body;
  if (!apiKey || !roundType || !targetCompany) return res.status(400).json({ error: 'apiKey, roundType, targetCompany required' });

  const learnerContext = buildLearnerContext(targetCompany);
  const company = TARGET_COMPANIES[targetCompany as keyof typeof TARGET_COMPANIES];

  const roundPrompts: Record<string, string> = {
    coding: `Generate a coding problem in the style ${company.name} uses. Medium difficulty. Related to the learner's stack (Java/Spring Boot/TypeScript/React). Return:
{
  "problem": "full problem statement",
  "examples": [{"input": "...", "output": "...", "explanation": "..."}],
  "constraints": ["constraint 1", ...],
  "hints": ["hint if stuck", ...],
  "optimal_approach": "brief description of optimal solution",
  "time_complexity": "O(?)",
  "space_complexity": "O(?)",
  "follow_ups": ["what if the input is sorted?", ...]
}`,
    system_design: `Generate a system design question scoped to this learner's project context. Use their actual project decisions as the starting point. Return:
{
  "scenario": "full scenario description",
  "requirements": { "functional": [...], "non_functional": [...] },
  "starting_point": "what they already built that's relevant",
  "evaluation_areas": ["schema design", "caching strategy", "API design", "tradeoff reasoning"],
  "scale_parameters": { "users": "...", "requests_per_second": "...", "data_volume": "..." },
  "follow_ups": ["what if users go from 1k to 100k overnight?", ...]
}`,
    backend_deep_dive: `Generate a backend deep dive interview based on this file. Start at comprehension, move to reasoning, end at architectural critique. Return:
{
  "opening": "how you'd open this interview segment",
  "questions": [
    { "question": "...", "layer": 1|2|3, "expected_depth": "...", "follow_up": "..." }
  ],
  "trap_questions": ["a question designed to expose shallow understanding", ...],
  "strong_close": "the final question that separates good candidates from great ones"
}`,
    behavioral: `Generate behavioral interview questions using this learner's known project context. Pull from their real decisions. Return:
{
  "questions": [
    {
      "question": "Tell me about...",
      "story_hook": "the specific project decision they should use as their story",
      "star_guide": { "situation": "...", "task": "...", "action": "...", "result": "..." },
      "what_company_wants_to_hear": "..."
    }
  ]
}`,
  };

  const system = `You are conducting a ${roundType.replace('_', ' ')} interview at ${company.name}.

${learnerContext}

${roundPrompts[roundType] ?? ''}

Return only valid JSON. No preamble.`;

  try {
    const userContent = fileContent
      ? `File context:\n\`\`\`\n${fileContent}\n\`\`\``
      : 'Use the learner profile and project context above.';

    const text = await callAnthropic(apiKey, [{ role: 'user', content: userContent }], system, 3000);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate daily study plan
router.post('/daily-plan', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'apiKey required' });

  const weakConcepts = getWeakConcepts(5);
  const currentModule = parseInt(getSetting('current_module') ?? '8');
  const targetCompany = getSetting('target_company') ?? 'hubspot';
  const company = TARGET_COMPANIES[targetCompany as keyof typeof TARGET_COMPANIES];

  const system = `You are a personalized study planner for a CS student with 2 months until interviews.

${buildLearnerContext()}

WEAK CONCEPTS RIGHT NOW: ${weakConcepts.map((c: any) => `${c.concept} (confidence: ${(c.confidence * 100).toFixed(0)}%)`).join(', ')}

Generate a focused daily study plan. Return JSON:
{
  "date_plan": "brief motivational opener",
  "blocks": [
    {
      "duration_minutes": 20,
      "mode": "BlankIt" | "TutorMode" | "MockInterview" | "LeetCode",
      "focus": "specific file or concept",
      "why": "why this is the highest leverage thing right now",
      "company_relevance": "how this maps to ${company.name} interviews"
    }
  ],
  "total_minutes": 60,
  "priority_concept": "the single most important thing to nail today",
  "readiness_tip": "one specific thing that will move the needle most"
}`;

  try {
    const text = await callAnthropic(apiKey, [
      { role: 'user', content: 'Generate my study plan for today.' }
    ], system, 1500);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as aiRouter };
