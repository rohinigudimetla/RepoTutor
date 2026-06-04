import { Router } from 'express';
import { getSetting, getWeakConcepts, updateConceptConfidence } from '../db';
import { LEARNER_PROFILE, TARGET_COMPANIES, CURRICULUM, getRelevantConcepts } from '../curriculum';
import { callBestModel } from '../services/modelRouter';

const router = Router();

function getKeys(body: any) {
  return {
    anthropicKey: body.apiKey as string | undefined,
    geminiKey: body.geminiKey as string | undefined,
  };
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

router.post('/questions', async (req, res) => {
  const { fileContent, filePath, targetCompany, layer = 1 } = req.body;
  if (!fileContent) return res.status(400).json({ error: 'fileContent required' });

  const system = `You are a senior software engineer conducting a technical interview. You are rigorous, specific, and pedagogically aware.

${buildLearnerContext(targetCompany)}

QUESTIONING RULES:
- Layer ${layer} focus: ${layer === 1 ? 'comprehension — what does this code do and how' : layer === 2 ? 'reasoning — why was this written this way, what are the tradeoffs' : 'stress test — what breaks at scale, what would you change, architectural critique'}
- Always reference specific line numbers in questions
- Never ask the learner to write code from memory — always show the relevant lines first
- Apply pain-before-solution: phrase questions as "what happens if this line is removed/changed"
- ${layer >= 2 ? 'Include cross-concept connections — how does this relate to other parts of the system' : ''}

RESPONSE FORMAT: Return only valid JSON, no preamble, no markdown fences:
{
  "questions": [
    {
      "question": "string",
      "difficulty": "easy" | "medium" | "hard",
      "relevant_lines": [number, ...],
      "concept": "string",
      "answer_guide": "string",
      "scaffold": "string",
      "follow_up": "string",
      "pain_hook": "string"
    }
  ]
}

Generate 5-8 questions. Mix difficulty. Cover: what it does, why this approach, what breaks without it, what changes at scale.`;

  try {
    const result = await callBestModel({
      ...getKeys(req.body),
      task: 'generate_questions',
      messages: [{ role: 'user', content: `Here is the file ${filePath}:\n\n\`\`\`\n${fileContent}\n\`\`\`` }],
      system,
      maxTokens: 3000,
    });
    const parsed = JSON.parse(result.text);
    parsed._meta = { provider: result.provider, model: result.model };
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/evaluate', async (req, res) => {
  const { question, answerGuide, userAnswer, concept, targetCompany, codeSnippet } = req.body;
  if (!question || !userAnswer) return res.status(400).json({ error: 'question and userAnswer required' });

  const company = targetCompany ?? getSetting('target_company') ?? 'hubspot';
  const companyInfo = TARGET_COMPANIES[company as keyof typeof TARGET_COMPANIES];

  const system = `You are evaluating a technical interview answer. Be direct, specific, and pedagogically useful.

${buildLearnerContext(targetCompany)}

EVALUATION RULES:
- Reference specific lines or code elements in your feedback
- Tell them EXACTLY what a ${companyInfo?.name ?? 'senior'} interviewer would think hearing this answer
- If something is correct: name it and say why it lands well at this company
- If something is missing: be precise about what's absent and why it matters
- Never give generic praise — every piece of feedback must reference something specific
- Scaffold the gap: show the code pattern that reveals the miss rather than just naming it
- Score honestly: if they would not pass this in a real interview, say so

RESPONSE FORMAT: Return only valid JSON:
{
  "score": 0-100,
  "verdict": "strong" | "adequate" | "weak" | "incorrect",
  "what_was_correct": ["specific thing 1", ...],
  "what_was_missing": ["specific missing point with line reference", ...],
  "senior_engineer_addition": "what a senior engineer would have added",
  "company_specific_feedback": "how this answer would land at ${companyInfo?.name ?? 'this company'}",
  "concept_confidence": "high" | "medium" | "low"
}`;

  try {
    const result = await callBestModel({
      ...getKeys(req.body),
      task: 'evaluate_answer',
      messages: [{ role: 'user', content: `Question: ${question}\n\nCode context:\n\`\`\`\n${codeSnippet ?? ''}\n\`\`\`\n\nExpected coverage: ${answerGuide}\n\nCandidate's answer: ${userAnswer}` }],
      system,
      maxTokens: 1500,
    });

    const parsed = JSON.parse(result.text);
    if (concept && parsed.concept_confidence) {
      updateConceptConfidence(concept, parsed.concept_confidence === 'high' || parsed.score >= 70);
    }
    parsed._meta = { provider: result.provider, model: result.model };
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mock-interview', async (req, res) => {
  const { roundType, targetCompany, fileContent } = req.body;
  if (!roundType || !targetCompany) return res.status(400).json({ error: 'roundType and targetCompany required' });

  const company = TARGET_COMPANIES[targetCompany as keyof typeof TARGET_COMPANIES];
  const learnerContext = buildLearnerContext(targetCompany);

  const roundPrompts: Record<string, string> = {
    coding: `Generate a coding problem in the style ${company.name} uses. Medium difficulty. Related to the learner's stack (Java/Spring Boot/TypeScript/React). Return:
{"problem":"...","examples":[{"input":"...","output":"...","explanation":"..."}],"constraints":["..."],"hints":["..."],"optimal_approach":"...","time_complexity":"O(?)","space_complexity":"O(?)","follow_ups":["..."]}`,
    system_design: `Generate a system design question using this learner's project context as the starting point. Return:
{"scenario":"...","requirements":{"functional":["..."],"non_functional":["..."]},"starting_point":"...","evaluation_areas":["..."],"scale_parameters":{"users":"...","requests_per_second":"...","data_volume":"..."},"follow_ups":["..."]}`,
    backend_deep_dive: `Generate a backend deep dive interview based on this file. Layer 1→2→3. Return:
{"opening":"...","questions":[{"question":"...","layer":1,"expected_depth":"...","follow_up":"..."}],"trap_questions":["..."],"strong_close":"..."}`,
    behavioral: `Generate behavioral interview questions using this learner's known project decisions. Return:
{"questions":[{"question":"Tell me about...","story_hook":"...","star_guide":{"situation":"...","task":"...","action":"...","result":"..."},"what_company_wants_to_hear":"..."}]}`,
  };

  const taskMap: Record<string, any> = {
    coding: 'generate_mock_coding',
    system_design: 'generate_mock_system_design',
    backend_deep_dive: 'generate_mock_backend_dive',
    behavioral: 'generate_mock_behavioral',
  };

  const system = `You are conducting a ${roundType.replace(/_/g, ' ')} interview at ${company.name}.
${learnerContext}
${roundPrompts[roundType] ?? ''}
Return only valid JSON. No preamble.`;

  try {
    const userContent = fileContent
      ? `File context:\n\`\`\`\n${fileContent}\n\`\`\``
      : 'Use the learner profile and project context above.';

    const result = await callBestModel({
      ...getKeys(req.body),
      task: taskMap[roundType] ?? 'generate_mock_coding',
      messages: [{ role: 'user', content: userContent }],
      system,
      maxTokens: 3000,
    });
    const parsed = JSON.parse(result.text);
    parsed._meta = { provider: result.provider, model: result.model };
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/daily-plan', async (req, res) => {
  const weakConcepts = getWeakConcepts(5);
  const targetCompany = getSetting('target_company') ?? 'hubspot';
  const company = TARGET_COMPANIES[targetCompany as keyof typeof TARGET_COMPANIES];

  const system = `You are a personalized study planner for a CS student with 2 months until interviews.
${buildLearnerContext()}
WEAK CONCEPTS RIGHT NOW: ${weakConcepts.map((c: any) => `${c.concept} (confidence: ${(c.confidence * 100).toFixed(0)}%)`).join(', ')}
Generate a focused daily study plan. Return JSON:
{"date_plan":"...","blocks":[{"duration_minutes":20,"mode":"BlankIt"|"TutorMode"|"MockInterview"|"LeetCode","focus":"...","why":"...","company_relevance":"..."}],"total_minutes":60,"priority_concept":"...","readiness_tip":"..."}`;

  try {
    const result = await callBestModel({
      ...getKeys(req.body),
      task: 'generate_daily_plan',
      messages: [{ role: 'user', content: 'Generate my study plan for today.' }],
      system,
      maxTokens: 1500,
    });
    const parsed = JSON.parse(result.text);
    parsed._meta = { provider: result.provider, model: result.model };
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as aiRouter };
