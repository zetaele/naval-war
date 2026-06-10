import type WebSocket from 'ws';
import type { AuthenticatedClient, Room, QueueEntry } from './types';

// Global server state — single process, in-memory
export const clients = new Map<WebSocket, AuthenticatedClient>();
export const rooms = new Map<string, Room>();
export const codeToRoomId = new Map<string, string>();
export const queue: QueueEntry[] = [];
