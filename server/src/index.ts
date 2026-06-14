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
const CLIENT_URL = process.env['CLIENT_URL'] ?? 'http://localhost:5173';

async function main() {
  await initDb();

  const app = express();
  app.use(express.json());
  app.use(cors({ origin: CLIENT_URL, credentials: true }));

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
