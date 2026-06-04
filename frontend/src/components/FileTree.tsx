import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useApi } from '../hooks/useApi';
import { RepoFile, Repo, Mode } from '../types';

function buildTree(files: RepoFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: {}, file: null };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.children[part]) {
        node.children[part] = { name: part, path: parts.slice(0, i + 1).join('/'), children: {}, file: null };
      }
      node = node.children[part];
      if (i === parts.length - 1) node.file = f;
    }
  }
  return root;
}

interface TreeNode {
  name: string;
  path: string;
  children: Record<string, TreeNode>;
  file: RepoFile | null;
}

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  repo: Repo;
  activeFile: RepoFile | null;
  onSelect: (file: RepoFile, repo: Repo) => void;
}

function TreeNodeView({ node, depth, repo, activeFile, onSelect }: TreeNodeProps) {
  const isDir = Object.keys(node.children).length > 0;
  const [open, setOpen] = useState(depth < 2);
  const isActive = activeFile?.path === node.file?.path;

  if (node.file) {
    const ext = node.name.split('.').pop() ?? '';
    const extColor: Record<string, string> = {
      tsx: 'text-blue-400', jsx: 'text-blue-400',
      ts: 'text-accent-blue', js: 'text-yellow-400',
      java: 'text-orange-400', py: 'text-green-400',
    };
    return (
      <div
        onClick={() => onSelect(node.file!, repo)}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer text-sm transition-colors
          ${isActive ? 'bg-accent-blue/20 text-accent-blue' : 'text-gray-400 hover:bg-surface-2 hover:text-gray-200'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className={`text-xs font-mono font-bold ${extColor[ext] ?? 'text-gray-500'}`}>{ext}</span>
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  if (!isDir) return null;

  const sortedChildren = Object.values(node.children).sort((a, b) => {
    const aDir = Object.keys(a.children).length > 0;
    const bDir = Object.keys(b.children).length > 0;
    if (aDir && !bDir) return -1;
    if (!aDir && bDir) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {node.name && (
        <div
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer text-sm text-gray-500 hover:text-gray-300 hover:bg-surface-2 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-xs">{open ? '▾' : '▸'}</span>
          <span>{node.name}</span>
        </div>
      )}
      {open && sortedChildren.map(child => (
        <TreeNodeView key={child.path} node={child} depth={depth + 1} repo={repo} activeFile={activeFile} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface Props {
  onFileSelect: (file: RepoFile, repo: Repo) => void;
}

export function FileTree({ onFileSelect }: Props) {
  const { repos, activeFile, mode, setMode } = useStore(s => ({
    repos: s.repos, activeFile: s.activeFile, mode: s.mode, setMode: s.setMode
  }));
  const { get } = useApi();
  const [repoFiles, setRepoFiles] = useState<Record<string, RepoFile[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [addUrl, setAddUrl] = useState('');
  const [addingRepo, setAddingRepo] = useState(false);
  const setRepos = useStore(s => s.setRepos);

  useEffect(() => {
    repos.forEach(repo => {
      if (!repoFiles[repo.url]) loadRepo(repo);
    });
  }, [repos]);

  async function loadRepo(repo: Repo) {
    setLoading(l => ({ ...l, [repo.url]: true }));
    try {
      const data = await get<{ files: RepoFile[] }>('/github/tree', { url: repo.url, branch: repo.branch });
      setRepoFiles(r => ({ ...r, [repo.url]: data.files }));
    } catch (err: any) {
      console.error('Failed to load repo:', err.message);
    } finally {
      setLoading(l => ({ ...l, [repo.url]: false }));
    }
  }

  async function handleAddRepo() {
    if (!addUrl.trim()) return;
    setAddingRepo(true);
    const newRepo: Repo = { name: addUrl.split('/').pop() ?? 'repo', url: addUrl.trim(), branch: 'main' };
    try {
      const data = await get<{ files: RepoFile[] }>('/github/tree', { url: newRepo.url, branch: 'main' });
      setRepoFiles(r => ({ ...r, [newRepo.url]: data.files }));
      setRepos([...repos, newRepo]);
      setAddUrl('');
    } catch (err: any) {
      alert(`Failed to load repo: ${err.message}`);
    } finally {
      setAddingRepo(false);
    }
  }

  const modes: { id: Mode; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '◉' },
    { id: 'blankit', label: 'BlankIt', icon: '◻' },
    { id: 'tutor', label: 'TutorMode', icon: '⬡' },
    { id: 'mock', label: 'Mock Interview', icon: '◈' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector */}
      <div className="p-3 border-b border-border">
        <div className="space-y-0.5">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors text-left
                ${mode === m.id ? 'bg-accent-blue/20 text-accent-blue' : 'text-gray-400 hover:bg-surface-2 hover:text-gray-200'}`}
            >
              <span className="text-xs w-4">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* File trees */}
      <div className="flex-1 overflow-y-auto py-2">
        {repos.map(repo => {
          const files = repoFiles[repo.url] ?? [];
          const isLoading = loading[repo.url];
          const tree = buildTree(files);

          return (
            <div key={repo.url} className="mb-2">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{repo.name}</span>
                {isLoading ? (
                  <span className="text-xs text-gray-600">loading…</span>
                ) : (
                  <span className="text-xs text-gray-600">{files.length} files</span>
                )}
              </div>
              {isLoading ? (
                <div className="px-4 py-2 text-xs text-gray-600">Fetching file tree…</div>
              ) : (
                Object.values(tree.children).sort((a, b) => {
                  const aDir = Object.keys(a.children).length > 0;
                  const bDir = Object.keys(b.children).length > 0;
                  if (aDir && !bDir) return -1;
                  if (!aDir && bDir) return 1;
                  return a.name.localeCompare(b.name);
                }).map(child => (
                  <TreeNodeView key={child.path} node={child} depth={0} repo={repo} activeFile={activeFile} onSelect={onFileSelect} />
                ))
              )}
            </div>
          );
        })}

        {/* Add repo */}
        <div className="px-3 pt-3 border-t border-border mt-2">
          <div className="flex gap-1">
            <input
              value={addUrl}
              onChange={e => setAddUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddRepo()}
              placeholder="github.com/owner/repo"
              className="flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-accent-blue"
            />
            <button
              onClick={handleAddRepo}
              disabled={addingRepo || !addUrl.trim()}
              className="btn-primary text-xs px-2"
            >
              {addingRepo ? '…' : '+'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
