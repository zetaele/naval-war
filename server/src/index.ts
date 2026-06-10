import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env['PORT'] ?? 3001);
const CLIENT_URL = process.env['CLIENT_URL'] ?? 'http://localhost:5173';

const app = express();
app.use(express.json());
app.use(cors({ origin: CLIENT_URL, credentials: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress ?? 'unknown';
  console.log(`[ws] client connected from ${ip}`);

  ws.on('message', (data) => {
    console.log(`[ws] message: ${data.toString()}`);
  });

  ws.on('close', () => {
    console.log(`[ws] client disconnected`);
  });

  ws.on('error', (err) => {
    console.error(`[ws] error:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
