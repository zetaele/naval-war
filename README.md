# Naval War — Multiplayer Battleship

A real-time 1v1 Battleship game with a solo bot mode, live matchmaking, leaderboards, and sound effects.

**Live demo → [naval-war-client.vercel.app](https://naval-war-client.vercel.app)**

---

## How to Play

### Solo mode (vs bot)
1. Register or log in.
2. In the Lobby, stay on the **Solo** tab and pick a difficulty.
3. Place your ships on the board — drag to rotate, or hit **Random** to auto-place.
4. Click **Ready**. The bot places its ships instantly and the match starts.
5. Take turns attacking the enemy grid. The bot responds after ~600 ms.
6. First to sink all enemy ships wins. Solo games don't count toward the leaderboard.

### Multiplayer (1v1)
1. **Quick match** — join the matchmaking queue for your chosen difficulty. You'll be paired automatically with the next player who joins the same queue.
2. **Private room** — one player creates a room and shares the 6-character invite code; the other joins with that code.
3. Both players place ships, then click **Ready**. The game starts when both are ready.
4. Wins and losses are recorded. Check the **Rankings** tab for the top 20 leaderboard.

### Difficulties

| Difficulty | Board | Fleet |
|------------|-------|-------|
| Easy | 8×8 | 1×4, 2×3, 2×2 |
| Medium | 16×16 | 1×6, 1×5, 2×4, 3×3, 3×2, 2×1 |
| Hard | 20×20 | 1×6, 2×5, 3×4, 4×3, 4×2, 4×1 |

### Controls
- **Click** a cell on the enemy board to attack.
- **Drag** a ship to move it; **right-click** (or the rotate button) to rotate it.
- **Random** button auto-places the full fleet randomly.

### Sound effects
Three synthesized sounds play automatically (Web Audio API — no audio files):
- **Miss** — bomb hits water.
- **Hit** — bomb hits a ship.
- **Sunk** — a ship is fully destroyed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite, Framer Motion |
| Backend | Node.js, TypeScript, Express, `ws` (WebSockets), `tsx` |
| Database | [Turso](https://turso.tech) (cloud SQLite via `@libsql/client`) |
| Auth | JWT access tokens (15 min) + refresh tokens (7 days, httpOnly cookie) |
| Shared types | `@naval-war/types` — internal npm workspace package |

---

## Architecture & Deployment

```
Browser ──HTTPS──► Vercel (React SPA)
                        │
                        ├─ REST (fetch) ──► Render (Node.js)
                        └─ WebSocket ─────► Render (Node.js)
                                                │
                                           Turso (SQLite)
```

### Frontend — Vercel
- Static SPA built by Vite, deployed to Vercel's global CDN.
- `client/vercel.json` contains a catch-all rewrite (`/*` → `/index.html`) so React Router handles all paths.
- Environment variables set in the Vercel dashboard:
  - `VITE_API_URL` — full URL of the Render server (e.g. `https://naval-war-o06b.onrender.com`)
  - `VITE_WS_URL` — WebSocket URL of the Render server (e.g. `wss://naval-war-o06b.onrender.com`)

### Backend — Render (Web Service)
- Node.js server run via `tsx src/index.ts` — no TypeScript compilation step in production.
- Render's free tier spins down after 15 minutes of inactivity. A keep-alive ping to `/health` every 10 minutes prevents this (set up via [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com)).
- CORS is configured with `origin: true` (reflects the request origin) so any Vercel preview URL works automatically while still supporting `credentials: true` for refresh-token cookies.
- Environment variables set in the Render dashboard:
  - `JWT_SECRET`
  - `REFRESH_TOKEN_SECRET`
  - `JWT_EXPIRES_IN` (`15m`)
  - `REFRESH_TOKEN_EXPIRES_IN` (`7d`)
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`

### Database — Turso
- Cloud SQLite hosted on Turso's free tier (9 GB storage, 1 billion row reads/month).
- Uses `@libsql/client` (async API) instead of `better-sqlite3` (sync), required for remote connections.
- Schema is initialized automatically on server startup via `initDb()`.

---

## Technical Decisions

**`tsx` instead of compiling TypeScript**
Render's build step previously failed trying to run `tsc` across all workspaces. We removed compilation entirely — `tsx` transpiles TypeScript on the fly at runtime, which is fast enough for this workload and eliminates build configuration complexity.

**Turso instead of `better-sqlite3`**
`better-sqlite3` only works with a local file. Render's free tier has an ephemeral filesystem — any local SQLite file is wiped on every deploy. Turso provides a persistent cloud SQLite database with the same SQL dialect and a free tier that covers this project entirely.

**WebSocket game state — server authoritative**
All game logic (ship validation, attack processing, turn management, win detection) runs on the server. The client only renders what the server sends. This prevents cheating and keeps client code simple.

**Solo bot — fake user, same code path**
The bot is implemented as a fake `userId` (`bot-<roomId>`). It reuses the exact same room, placement, and attack code paths as a real player. `scheduleBotAttack()` fires automatically after 600 ms when it's the bot's turn. Solo games are excluded from the leaderboard via a `botUserId` field on the `Room` object.

**Sound effects via Web Audio API**
No audio files. All three sounds (miss, hit, sunk) are synthesized in real time using oscillators and noise buffers. Bundle size impact: zero.

**Monorepo with npm workspaces**
`packages/types` is shared between client and server — both import `@naval-war/types` and get compile-time guarantees that WebSocket message shapes match on both ends.

**JWT + refresh token auth**
Access tokens expire in 15 minutes and are stored in memory (not localStorage). Refresh tokens live in an httpOnly cookie and are rotated on every use, limiting exposure if a token is leaked.

---

## Project Structure

```
naval-war/
├── packages/
│   └── types/              # Shared TS types: WS messages, game state, API shapes
├── client/                 # React + Vite SPA
│   ├── src/
│   │   ├── components/     # UI primitives and game-specific components
│   │   ├── hooks/          # useWebSocket, useAuth
│   │   ├── pages/          # AuthPage, LobbyPage, GamePage, RankingPage
│   │   ├── utils/          # board helpers, sounds, api client
│   │   └── context/        # AuthContext
│   ├── .env.development    # Local env vars (VITE_WS_URL=ws://localhost:3001)
│   └── vercel.json         # SPA catch-all rewrite rule
└── server/                 # Express + WebSocket server
    └── src/
        ├── auth/           # Register, login, refresh, logout routes
        ├── db/             # Turso client, schema init
        ├── game/           # Board generation, game engine (attacks, turns, win)
        ├── ranking/        # Leaderboard route
        └── ws/             # WebSocket server, room manager, message handler
```

---

## Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create the server environment file
cp server/.env.example server/.env
# Edit server/.env — at minimum set JWT_SECRET and REFRESH_TOKEN_SECRET
# Turso vars are optional locally; the server falls back to a local SQLite file
```

### Run

```bash
npm run dev          # Starts both client and server in parallel

npm run dev:client   # React app only  → http://localhost:5173
npm run dev:server   # API + WS only   → http://localhost:3001
```

### Environment variables (server)

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret for signing access tokens | Yes |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh tokens | Yes |
| `JWT_EXPIRES_IN` | Access token TTL | No (default `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL | No (default `7d`) |
| `TURSO_DATABASE_URL` | Turso DB URL (`libsql://...`) | No (falls back to local file) |
| `TURSO_AUTH_TOKEN` | Turso auth token | No (only needed with Turso URL) |
| `PORT` | HTTP port | No (default `3001`) |
