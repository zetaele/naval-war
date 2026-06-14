import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import authRouter from './auth/routes';
import rankingRouter from './ranking/routes';
import { initDb } from './db/client';
import { attachWebSocketServer } from './ws/server';

const PORT = Number(process.env['PORT'] ?? 3001);
const ALLOWED_ORIGINS = (process.env['CLIENT_URL'] ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

async function main() {
  await initDb();

  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, mobile apps, same-origin)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/ranking', rankingRouter);

  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  attachWebSocketServer(wss);

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch(console.error);
