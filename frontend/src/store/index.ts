import { create } from 'zustand';
import { Mode, Repo, RepoFile, Company, ConceptConfidence, ReadinessData, DailyPlan } from '../types';

interface AppState {
  // Settings
  apiKey: string;
  currentModule: number;
  targetCompany: Company;
  repos: Repo[];

  // Navigation
  mode: Mode;
  activeFile: RepoFile | null;
  activeRepo: Repo | null;

  // Code panel
  fileContent: string;
  highlightedLines: number[];

  // Progress data
  conceptConfidence: ConceptConfidence[];
  readiness: ReadinessData | null;
  dailyPlan: DailyPlan | null;
  streak: number;

  // UI state
  settingsOpen: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  setApiKey: (key: string) => void;
  setMode: (mode: Mode) => void;
  setActiveFile: (file: RepoFile, repo: Repo) => void;
  setFileContent: (content: string) => void;
  setHighlightedLines: (lines: number[]) => void;
  setTargetCompany: (company: Company) => void;
  setCurrentModule: (module: number) => void;
  setRepos: (repos: Repo[]) => void;
  setConceptConfidence: (concepts: ConceptConfidence[]) => void;
  setReadiness: (data: ReadinessData) => void;
  setDailyPlan: (plan: DailyPlan) => void;
  setSettingsOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  apiKey: localStorage.getItem('rt_api_key') ?? '',
  currentModule: parseInt(localStorage.getItem('rt_module') ?? '8'),
  targetCompany: (localStorage.getItem('rt_company') ?? 'hubspot') as Company,
  repos: [{ name: 'Pocket-Library', url: 'https://github.com/rohinigudimetla/Pocket-Library', branch: 'main' }],

  mode: 'dashboard',
  activeFile: null,
  activeRepo: null,
  fileContent: '',
  highlightedLines: [],

  conceptConfidence: [],
  readiness: null,
  dailyPlan: null,
  streak: 0,

  settingsOpen: false,
  loading: false,
  error: null,

  setApiKey: (key) => {
    localStorage.setItem('rt_api_key', key);
    set({ apiKey: key });
  },
  setMode: (mode) => set({ mode, highlightedLines: [] }),
  setActiveFile: (file, repo) => set({ activeFile: file, activeRepo: repo }),
  setFileContent: (content) => set({ fileContent: content }),
  setHighlightedLines: (lines) => set({ highlightedLines: lines }),
  setTargetCompany: (company) => {
    localStorage.setItem('rt_company', company);
    set({ targetCompany: company });
  },
  setCurrentModule: (module) => {
    localStorage.setItem('rt_module', String(module));
    set({ currentModule: module });
  },
  setRepos: (repos) => set({ repos }),
  setConceptConfidence: (concepts) => set({ conceptConfidence: concepts }),
  setReadiness: (data) => set({ readiness: data }),
  setDailyPlan: (plan) => set({ dailyPlan: plan }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
