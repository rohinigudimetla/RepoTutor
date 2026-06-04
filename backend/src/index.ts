import express from 'express';
import cors from 'cors';
import { githubRouter } from './routes/github';
import { aiRouter } from './routes/ai';
import { progressRouter } from './routes/progress';
import { initDB } from './db';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/github', githubRouter);
app.use('/api/ai', aiRouter);
app.use('/api/progress', progressRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

initDB();

app.listen(PORT, () => {
  console.log(`\n🎓 RepoTutor API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
