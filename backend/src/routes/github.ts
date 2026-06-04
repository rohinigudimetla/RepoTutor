import { Router } from 'express';
import { getSetting } from '../db';

const router = Router();

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? getSetting('github_token');
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'RepoTutor',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.java', '.py'];
const SKIP_DIRS = ['node_modules', 'dist', '.git', '.next', 'build', '__pycache__', '.gradle', 'target'];

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

function shouldInclude(filePath: string): boolean {
  if (SKIP_DIRS.some(d => filePath.includes(`/${d}/`) || filePath.startsWith(`${d}/`))) return false;
  return ALLOWED_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

router.get('/tree', async (req, res) => {
  const { url, branch = 'main' } = req.query as { url: string; branch?: string };
  if (!url) return res.status(400).json({ error: 'url required' });

  const parsed = parseRepoUrl(url);
  if (!parsed) return res.status(400).json({ error: 'invalid GitHub URL' });

  const { owner, repo } = parsed;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  try {
    const response = await fetch(apiUrl, { headers: githubHeaders() });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `GitHub API error: ${text}` });
    }

    const data = await response.json() as { tree: Array<{ path: string; type: string; sha: string }> };
    const files = data.tree
      .filter(item => item.type === 'blob' && shouldInclude(item.path))
      .map(item => ({ path: item.path, sha: item.sha }));

    res.json({ files, owner, repo, branch });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/file', async (req, res) => {
  const { url, filepath, branch = 'main' } = req.query as { url: string; filepath: string; branch?: string };
  if (!url || !filepath) return res.status(400).json({ error: 'url and filepath required' });

  const parsed = parseRepoUrl(url);
  if (!parsed) return res.status(400).json({ error: 'invalid GitHub URL' });

  const { owner, repo } = parsed;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filepath}`;

  try {
    const response = await fetch(rawUrl, { headers: { 'User-Agent': 'RepoTutor', ...(process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } });
    if (!response.ok) return res.status(response.status).json({ error: 'file not found' });
    const content = await response.text();
    res.json({ content, filepath, language: detectLanguage(filepath) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function detectLanguage(filepath: string): string {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.jsx')) return 'jsx';
  if (filepath.endsWith('.ts')) return 'typescript';
  if (filepath.endsWith('.js')) return 'javascript';
  if (filepath.endsWith('.java')) return 'java';
  if (filepath.endsWith('.py')) return 'python';
  return 'plaintext';
}

export { router as githubRouter };
