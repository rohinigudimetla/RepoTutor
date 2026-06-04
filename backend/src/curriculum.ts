export const CURRICULUM = {
  modules: [
    { id: 1, name: 'React Hooks', status: 'complete', concepts: ['useState', 'useEffect', 'useContext', 'useReducer'] },
    { id: 2, name: 'Data Fetching', status: 'complete', concepts: ['fetch', 'axios', 'loading states', 'error handling', 'async/await'] },
    { id: 3, name: 'Routing', status: 'complete', concepts: ['React Router', 'nested routes', 'protected routes', 'useNavigate', 'useParams'] },
    { id: 4, name: 'Forms', status: 'complete', concepts: ['controlled inputs', 'form validation', 'form state', 'onSubmit'] },
    { id: 5, name: 'Role-Based UI', status: 'complete', concepts: ['auth context', 'JWT', 'role-based UI', 'conditional rendering', 'permissions'] },
    { id: 6, name: 'Styling', status: 'complete', concepts: ['CSS modules', 'Tailwind', 'responsive design', 'dark mode'] },
    { id: 7, name: 'Advanced Patterns', status: 'complete', concepts: ['custom hooks', 'composition', 'memoization', 'useCallback', 'useMemo', 'Redux', 'TypeScript generics'] },
    { id: 8, name: 'Spring Boot Fundamentals', status: 'current', concepts: ['REST controllers', 'service layer', 'JPA', 'Spring Security', '@RestController', '@Service', '@Repository', 'dependency injection', 'Spring annotations'] },
    { id: 9, name: 'PostgreSQL & JPA', status: 'upcoming', concepts: ['entities', 'repositories', 'JPQL', 'transactions', 'relationships'] },
    { id: 10, name: 'Redis & Caching', status: 'upcoming', concepts: ['Redis', 'caching strategy', 'cache invalidation', 'TTL', 'session storage'] },
    { id: 11, name: 'Authentication Deep Dive', status: 'upcoming', concepts: ['OAuth', 'JWT blacklisting', 'refresh tokens', 'Spring Security config'] },
    { id: 12, name: 'API Design', status: 'upcoming', concepts: ['REST best practices', 'versioning', 'pagination', 'error responses', 'OpenAPI'] },
    { id: 13, name: 'Testing', status: 'upcoming', concepts: ['JUnit', 'Mockito', 'Jest', 'integration tests', 'TDD'] },
    { id: 14, name: 'AWS Fundamentals', status: 'upcoming', concepts: ['EC2', 'S3', 'RDS', 'IAM', 'VPC', 'ECS'] },
    { id: 15, name: 'System Design', status: 'upcoming', concepts: ['load balancing', 'horizontal scaling', 'database sharding', 'microservices', 'event-driven'] },
    { id: 16, name: 'Performance & Observability', status: 'upcoming', concepts: ['query optimization', 'connection pooling', 'logging', 'metrics', 'tracing'] },
    { id: 17, name: 'Full Stack Integration', status: 'upcoming', concepts: ['CORS', 'deployment pipeline', 'CI/CD', 'Docker', 'environment config'] },
  ]
};

export const TARGET_COMPANIES = {
  hubspot: {
    name: 'HubSpot',
    focus: ['end-to-end feature ownership', 'Java backend depth', 'React component reasoning', 'system design at product scale'],
    interview_style: 'They care about ownership. They want engineers who can own a feature from DB schema to UI. Questions will trace a request end-to-end. Behavioral questions emphasize autonomy and shipping.',
    question_framing: 'Frame questions as: "You are implementing X feature for HubSpot CRM. Walk me through..." — emphasize product thinking alongside technical depth.',
    strong_signals: ['full-stack thinking', 'Java proficiency', 'product intuition', 'shipping velocity'],
    weak_signals: ['overly academic answers', 'ignoring user impact', 'no ownership language'],
  },
  klaviyo: {
    name: 'Klaviyo',
    focus: ['scale questions', 'growth engineering patterns', 'backend performance', 'visibility of individual contribution'],
    interview_style: 'They care about scale and speed. Questions test how you think about 10x and 100x traffic. Individual impact must be demonstrable. They want to see you reason about bottlenecks before they happen.',
    question_framing: 'Frame questions as scale stress tests: "This works for 1000 users — what breaks at 1 million? What would you change first?"',
    strong_signals: ['performance intuition', 'data structure choices', 'profiling knowledge', 'concrete metrics'],
    weak_signals: ['premature optimization', 'no capacity estimation', 'vague scaling answers'],
  },
  atlassian: {
    name: 'Atlassian',
    focus: ['Java and Spring Boot depth', 'distributed systems concepts', 'craft and code quality reasoning'],
    interview_style: 'They care about craft. Code quality, maintainability, and design patterns are as important as correctness. Expect deep Java questions. Expect questions about tradeoffs, not just solutions.',
    question_framing: 'Frame questions to probe depth: "Why did you choose this approach? What are the three things you would refactor if you had another week? What design pattern does this implement?"',
    strong_signals: ['SOLID principles', 'design patterns', 'code smell awareness', 'refactoring instincts'],
    weak_signals: ['hacky solutions', 'no tradeoff reasoning', 'inability to critique own code'],
  },
  capital_one: {
    name: 'Capital One',
    focus: ['Java platform depth', 'security awareness', 'financial data handling patterns', 'reliability'],
    interview_style: 'They care about safety and correctness above everything. Security is table stakes. Financial data handling requires explicit discussion of consistency, auditability, and failure modes.',
    question_framing: 'Frame questions with failure modes in mind: "What happens if this fails halfway through? How would you audit this? What are the security implications?"',
    strong_signals: ['security-first thinking', 'transaction awareness', 'audit logging', 'idempotency', 'failure mode analysis'],
    weak_signals: ['ignoring security', 'no consistency discussion', 'optimistic failure assumptions'],
  },
};

export const LEARNER_PROFILE = {
  learning_modes: ['pattern recognition — always show the pattern before asking about it'],
  known_weak_spots: [
    'reproducibility — can recognize code but struggles to write from memory',
    'cold writing — always scaffold, never ask to write from nothing',
  ],
  learning_style: 'pain before solution — show what breaks without it, then explain what it does',
  feedback_style: 'maximum specificity — every piece of feedback must reference a specific line, concept, or interview implication',
  scaffold_reduction: 'gradual — as confidence on a concept grows, reduce scaffolding incrementally',
  project_context: {
    known_decisions: [
      'Built a 9-table schema for Pocket-Library',
      'Chose Redis for JWT blacklisting',
      'Designed brief status history as a separate table for auditability',
      'Implemented role-based UI with auth context in React',
    ],
  },
};

export function getModuleStatus(moduleId: number) {
  const module = CURRICULUM.modules.find(m => m.id === moduleId);
  return module?.status ?? 'unknown';
}

export function getRelevantConcepts(currentModule: number): string[] {
  // Current module + 3 most recent completed = heavy focus
  // Modules 1-4 = occasional review
  const heavy = CURRICULUM.modules
    .filter(m => m.id >= Math.max(1, currentModule - 3) && m.id <= currentModule)
    .flatMap(m => m.concepts);
  return [...new Set(heavy)];
}
