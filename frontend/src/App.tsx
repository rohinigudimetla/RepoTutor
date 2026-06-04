import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import { useApi } from './hooks/useApi';
import { FileTree } from './components/FileTree';
import { CodePanel } from './components/CodePanel';
import { BlankIt } from './components/BlankIt';
import { TutorMode } from './components/TutorMode';
import { MockInterview } from './components/MockInterview';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { RepoFile, Repo } from './types';

export default function App() {
  const {
    mode, apiKey, targetCompany, currentModule, activeFile, activeRepo,
    fileContent, highlightedLines, setActiveFile, setFileContent, setHighlightedLines,
    setSettingsOpen, settingsOpen, setMode,
  } = useStore(s => ({
    mode: s.mode, apiKey: s.apiKey, targetCompany: s.targetCompany, currentModule: s.currentModule,
    activeFile: s.activeFile, activeRepo: s.activeRepo, fileContent: s.fileContent,
    highlightedLines: s.highlightedLines, setActiveFile: s.setActiveFile, setFileContent: s.setFileContent,
    setHighlightedLines: s.setHighlightedLines, setSettingsOpen: s.setSettingsOpen,
    settingsOpen: s.settingsOpen, setMode: s.setMode,
  }));
  const { get } = useApi();
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState('typescript');

  async function handleFileSelect(file: RepoFile, repo: Repo) {
    setActiveFile(file, repo);
    setFileContent('');
    setHighlightedLines([]);
    setFileLoading(true);
    setFileError(null);
    try {
      const data = await get<{ content: string; language: string }>(
        '/github/file',
        { url: repo.url, filepath: file.path, branch: repo.branch }
      );
      setFileContent(data.content);
      setDetectedLanguage(data.language);
      if (mode === 'dashboard') setMode('blankit');
    } catch (err: any) {
      setFileError(err.message);
    } finally {
      setFileLoading(false);
    }
  }

  const COMPANY_LABELS: Record<string, string> = {
    hubspot: 'HubSpot', klaviyo: 'Klaviyo', atlassian: 'Atlassian', capital_one: 'Capital One',
  };

  const hasFile = !!activeFile && !!fileContent;

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-surface-1 z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-accent-blue font-bold text-sm">RepoTutor</span>
          <span className="text-xs text-gray-600 bg-surface-2 px-2 py-0.5 rounded">mod {currentModule}/17</span>
        </div>

        {activeFile && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-surface-2 px-2 py-1 rounded min-w-0">
            <span className="text-gray-600 flex-shrink-0">{activeRepo?.name}</span>
            <span className="text-gray-700">/</span>
            <span className="text-gray-400 truncate max-w-xs">{activeFile.path}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-600">target: <span className="text-gray-400">{COMPANY_LABELS[targetCompany]}</span></span>

          {!apiKey && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 px-2 py-1 rounded hover:bg-yellow-900/40 transition-colors"
            >
              Add API key
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="text-xs text-gray-500 hover:text-gray-300 p-1.5 hover:bg-surface-2 rounded transition-colors"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — file tree */}
        <div className="w-56 flex-shrink-0 border-r border-border bg-surface-1 overflow-hidden flex flex-col">
          <FileTree onFileSelect={handleFileSelect} />
        </div>

        {/* Center — code panel */}
        {mode !== 'dashboard' && mode !== 'mock' && (
          <div className="flex flex-col border-r border-border" style={{ width: '45%', minWidth: 300, flexShrink: 0 }}>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface-1 flex-shrink-0">
              <span className="text-xs text-gray-500">
                {activeFile ? activeFile.path.split('/').pop() : 'No file selected'}
              </span>
              {fileLoading && <span className="text-xs text-gray-600">Loading…</span>}
            </div>
            <div className="flex-1 overflow-hidden">
              {fileError ? (
                <div className="p-4 text-red-400 text-sm">{fileError}</div>
              ) : fileLoading ? (
                <div className="p-4 text-gray-600 text-sm">Loading file content…</div>
              ) : fileContent ? (
                <CodePanel
                  content={fileContent}
                  language={detectedLanguage}
                  highlightedLines={highlightedLines}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                  Select a file from the tree to begin
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right panel — mode content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mode === 'dashboard' && <Dashboard />}

          {mode === 'blankit' && (
            hasFile ? (
              <BlankIt
                fileContent={fileContent}
                filePath={activeFile!.path}
                language={detectedLanguage}
                repoUrl={activeRepo!.url}
              />
            ) : (
              <EmptyState message="Select a file from the left tree to start BlankIt mode" />
            )
          )}

          {mode === 'tutor' && (
            hasFile ? (
              <TutorMode
                fileContent={fileContent}
                filePath={activeFile!.path}
                language={detectedLanguage}
                repoUrl={activeRepo!.url}
              />
            ) : (
              <EmptyState message="Select a file from the left tree to start TutorMode" />
            )
          )}

          {mode === 'mock' && (
            <MockInterview
              fileContent={fileContent || undefined}
              filePath={activeFile?.path}
            />
          )}
        </div>
      </div>

      <Settings />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-gray-600 text-sm">
      {message}
    </div>
  );
}
