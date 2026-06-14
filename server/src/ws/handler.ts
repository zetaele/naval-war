import type WebSocket from 'ws';
import { MessageType, type ClientMessage } from '@naval-war/types';
import { clients } from './state';
import { send } from './send';
import { createRoom, joinRoom, joinQueue, leaveQueue, startSoloGame } from './rooms';
import { handlePlaceShips, handleAttack } from '../game/engine';

export function handleMessage(ws: WebSocket, raw: string): void {
  const client = clients.get(ws);
  if (!client) return;

  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    return;
  }

  switch (msg.type) {
    case MessageType.PING:
      send(ws, { type: MessageType.PONG, payload: {} });
      break;

    case MessageType.CREATE_ROOM:
      createRoom(ws, msg.payload.difficulty);
      break;

    case MessageType.JOIN_ROOM:
      joinRoom(ws, msg.payload.code);
      break;

    case MessageType.JOIN_QUEUE:
      joinQueue(ws, msg.payload.difficulty);
      break;

    case MessageType.LEAVE_QUEUE:
      leaveQueue(ws);
      break;

    case MessageType.START_SOLO:
      startSoloGame(ws, msg.payload.difficulty);
      break;

    case MessageType.PLACE_SHIPS:
      handlePlaceShips(ws, msg.payload.ships);
      break;

    case MessageType.ATTACK:
      handleAttack(ws, msg.payload.row, msg.payload.col);
      break;
  }
}
