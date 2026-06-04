import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { githubRouter } from './routes/github';
import { aiRouter } from './routes/ai';
import { progressRouter } from './routes/progress';
import { initDB } from './db';

const app = express();
const PORT = process.env.PORT ?? 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors({ origin: IS_PROD ? false : ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/github', githubRouter);
app.use('/api/ai', aiRouter);
app.use('/api/progress', progressRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve frontend in production
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (IS_PROD && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

initDB();

app.listen(PORT, () => {
  console.log(`\n🎓 RepoTutor running on http://localhost:${PORT}`);
  if (IS_PROD) console.log(`   Serving frontend from ${frontendDist}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
