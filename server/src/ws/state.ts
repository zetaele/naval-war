import type WebSocket from 'ws';
import type { AuthenticatedClient, Room, QueueEntry } from './types';

// Global server state — single process, in-memory
export const clients = new Map<WebSocket, AuthenticatedClient>();
export const rooms = new Map<string, Room>();
export const codeToRoomId = new Map<string, string>();
export const queue: QueueEntry[] = [];

// Persists userId → roomId even after the WS socket closes, so reconnecting
// players can be routed back to their room within the 30-second window.
export const userRooms = new Map<string, string>();
