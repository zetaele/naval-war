# Naval War — Multiplayer Battleship

A real-time 1v1 multiplayer Battleship game built with React, Node.js, WebSockets, and SQLite.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite, Framer Motion |
| Backend | Node.js, TypeScript, Express, ws (WebSockets) |
| Database | SQLite via better-sqlite3 |
| Auth | JWT (access + refresh tokens) |
| Shared Types | `@naval-war/types` monorepo package |

## Project Structure

```
naval-war/
├── packages/
│   └── types/          # Shared TypeScript types (WS messages, game state, API)
├── client/             # React + Vite frontend
└── server/             # Node.js + Express + WebSocket backend
```

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
# Install all workspace dependencies
npm install

# Set up server environment variables
cp server/.env.example server/.env
# Edit server/.env and set your JWT_SECRET and REFRESH_TOKEN_SECRET
```

## Development

Run both client and server in parallel:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:client   # React app → http://localhost:5173
npm run dev:server   # API + WebSocket server → http://localhost:3001
```

## Production Build

```bash
npm run build
# Builds types → server → client in order
```

## Game Modes

| Difficulty | Board | Fleet |
|------------|-------|-------|
| Easy | 12×12 | 1×5, 2×4, 2×3, 2×2 |
| Medium | 16×16 | 1×6, 1×5, 2×4, 3×3, 3×2, 2×1 |
| Hard | 20×20 | 1×6, 2×5, 3×4, 4×3, 4×2, 4×1 |

## Features

- Register / login with username + password (bcrypt + JWT)
- Create private rooms with a 6-character invite code
- Auto-matchmaking queue per difficulty
- Drag-and-drop ship placement (desktop) / tap-to-place (mobile)
- Responsive layout — desktop side-by-side, mobile stacked
- Real-time gameplay via WebSockets
- Hit / miss / sunk animations (Framer Motion + CSS)
- 30-second reconnection window for dropped players
- Ranking leaderboard (top 20 by win rate)
