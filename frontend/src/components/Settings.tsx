import React, { useState } from 'react';
import { useStore } from '../store';
import { Company } from '../types';

const COMPANIES: { id: Company; name: string }[] = [
  { id: 'hubspot', name: 'HubSpot' },
  { id: 'klaviyo', name: 'Klaviyo' },
  { id: 'atlassian', name: 'Atlassian' },
  { id: 'capital_one', name: 'Capital One' },
];

export function Settings() {
  const { apiKey, targetCompany, currentModule, settingsOpen, setApiKey, setTargetCompany, setCurrentModule, setSettingsOpen } = useStore(s => ({
    apiKey: s.apiKey, targetCompany: s.targetCompany, currentModule: s.currentModule,
    settingsOpen: s.settingsOpen, setApiKey: s.setApiKey, setTargetCompany: s.setTargetCompany,
    setCurrentModule: s.setCurrentModule, setSettingsOpen: s.setSettingsOpen,
  }));

  const [keyInput, setKeyInput] = useState(apiKey);
  const [ghToken, setGhToken] = useState(localStorage.getItem('rt_gh_token') ?? '');
  const [saved, setSaved] = useState(false);

  function saveKey() {
    setApiKey(keyInput);
    if (ghToken.trim()) {
      localStorage.setItem('rt_gh_token', ghToken);
      fetch('/api/progress/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'github_token', value: ghToken }),
      });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setSettingsOpen(false)}>
      <div className="bg-surface-1 border border-border rounded-xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-100">Settings</h2>
          <button onClick={() => setSettingsOpen(false)} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium block">Anthropic API Key</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              placeholder="sk-ant-..."
              className="flex-1 bg-surface-2 border border-border rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-accent-blue font-mono"
            />
            <button onClick={saveKey} className={`btn-primary ${saved ? 'bg-green-600' : ''}`}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-gray-600">Stored in localStorage. Used for TutorMode, Mock Interviews, and Daily Plans.</p>
        </div>

        {/* GitHub Token */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium block">GitHub Token (optional but recommended)</label>
          <input
            type="password"
            value={ghToken}
            onChange={e => setGhToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full bg-surface-2 border border-border rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-accent-blue font-mono"
          />
          <p className="text-xs text-gray-600">Without a token, GitHub rate-limits to 60 requests/hour. A token gives you 5,000/hour. Create one at github.com/settings/tokens (no scopes needed for public repos).</p>
        </div>

        {/* Target company */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium block">Target Company</label>
          <div className="grid grid-cols-2 gap-2">
            {COMPANIES.map(c => (
              <button
                key={c.id}
                onClick={() => setTargetCompany(c.id)}
                className={`p-2 rounded border text-sm transition-colors ${
                  targetCompany === c.id ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-border text-gray-400 hover:text-gray-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">Frames questions and feedback in that company's interview style.</p>
        </div>

        {/* Current module */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium block">Current Curriculum Module</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentModule(Math.max(1, currentModule - 1))}
              className="btn-ghost px-2 py-1"
            >
              −
            </button>
            <span className="text-2xl font-bold text-accent-blue w-8 text-center">{currentModule}</span>
            <button
              onClick={() => setCurrentModule(Math.min(17, currentModule + 1))}
              className="btn-ghost px-2 py-1"
            >
              +
            </button>
            <span className="text-sm text-gray-400">of 17</span>
          </div>
          <p className="text-xs text-gray-600">Tool focuses questions on current and recent modules. Updates question weighting immediately.</p>
        </div>
      </div>
    </div>
  );
}
