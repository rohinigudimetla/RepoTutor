# RepoTutor

AI-powered code mastery and interview prep tool built for one specific person: a CS grad student targeting mid-level full stack roles at HubSpot, Klaviyo, Atlassian, and Capital One.

## What it does

**BlankIt** — Fill-in-the-blank across any file in your repos. Seeded random so blanks differ every session. 3 difficulty levels. Spaced repetition tracks which lines you miss and weights them higher next time. Difficulty auto-escalates when you score above 85% consistently.

**TutorMode** — 3-layer questioning (comprehension → reasoning → stress test). Every question shows a "pain hook" first (what breaks if this line is removed), then a scaffold/pattern per your learning profile, then asks for your answer. AI evaluation references specific lines and tells you exactly how your answer lands in a HubSpot/Atlassian/etc. interview.

**Mock Interview** — 4 round types: coding problem, system design, backend deep dive (file-based), behavioral STAR (pulls from your actual project decisions). All tailored to the selected company's interview style.

**Dashboard** — Live concept confidence bars (red/yellow/green), per-company readiness scores, AI daily study plan, curriculum progress tracker, active gap alerts.

## Setup

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start backend (port 3001)

```bash
cd backend && npm run dev
```

### 3. Start frontend (port 5173)

```bash
cd frontend && npm run dev
```

Open http://localhost:5173

### 4. Configure in Settings (⚙ top right)

- **Anthropic API key** — required for TutorMode, Mock Interview, Daily Plan
- **GitHub token** — optional but strongly recommended. Without it: 60 req/hour rate limit. With it: 5,000/hour. Create at github.com/settings/tokens — no scopes needed for public repos.
- **Target company** — frames questions and feedback for all AI interactions
- **Current module** — tells the tutor what to weight. Update as you progress.

## Stack

```
backend/
  src/
    index.ts          — Express server (port 3001)
    db.ts             — SQLite, concept confidence (EMA), spaced repetition
    curriculum.ts     — 17-module curriculum + company profiles + learner profile
    routes/
      github.ts       — GitHub API proxy (file tree, file content)
      ai.ts           — Anthropic API (questions, evaluation, mock interview, daily plan)
      progress.ts     — Session history, concept confidence CRUD, readiness scoring

frontend/
  src/
    App.tsx                  — Layout: topbar + sidebar + code panel + mode panel
    store/index.ts           — Zustand global state
    hooks/useApi.ts          — Typed fetch wrapper
    components/
      FileTree.tsx           — Repo file tree with mode selector + add repo
      CodePanel.tsx          — Syntax highlighted code with line highlighting
      BlankIt.tsx            — Fill-in-the-blank with spaced repetition
      TutorMode.tsx          — 3-layer AI interview questioning
      MockInterview.tsx      — 4-round mock interview (per company)
      Dashboard.tsx          — Readiness + daily plan + concept confidence
      Settings.tsx           — API key, GitHub token, company, module
```

## Key design decisions

**Pain before solution** — every TutorMode question shows a pain_hook first before asking. This is baked into the learner profile: you understand what's at stake before you're asked to explain it.

**Scaffold before question** — the relevant code pattern is always shown before the question. You never write from a blank slate. Scaffold density decreases as confidence grows.

**Spaced repetition** — blank_results are stored per-line. Lines where accuracy < 0.6 are 3× more likely to be blanked next session. Happens automatically.

**Auto-difficulty escalation** — avg score >85% on a file bumps difficulty easy→medium→hard next session. Tracked in file_progress table.

**Company context is always on** — the learner profile and company interview style are injected into every AI call. Not a toggle. Every question, every piece of feedback is already framed for your specific target.