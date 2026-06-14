import {
  Orientation,
  DIFFICULTY_CONFIGS,
  type Difficulty,
  type PlacedShipInput,
  type ShipSpec,
} from '@naval-war/types';
import { v4 as uuidv4 } from 'uuid';

export interface PlacementShip {
  id: string;
  size: number;
  orientation: Orientation;
  origin: { row: number; col: number } | null;
}

export function buildInitialFleet(difficulty: Difficulty): PlacementShip[] {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const ships: PlacementShip[] = [];
  for (const spec of config.fleet) {
    for (let i = 0; i < spec.count; i++) {
      ships.push({
        id: uuidv4(),
        size: spec.size,
        orientation: Orientation.HORIZONTAL,
        origin: null,
      });
    }
  }
  return ships;
}

export function getShipCells(
  origin: { row: number; col: number },
  size: number,
  orientation: Orientation,
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < size; i++) {
    cells.push({
      row: orientation === Orientation.VERTICAL ? origin.row + i : origin.row,
      col: orientation === Orientation.HORIZONTAL ? origin.col + i : origin.col,
    });
  }
  return cells;
}

export function isValidPlacement(
  origin: { row: number; col: number },
  size: number,
  orientation: Orientation,
  boardSize: number,
  placedShips: PlacementShip[],
  excludeId?: string,
): boolean {
  const cells = getShipCells(origin, size, orientation);

  // Check bounds
  for (const c of cells) {
    if (c.row < 0 || c.row >= boardSize || c.col < 0 || c.col >= boardSize) return false;
  }

  // Check overlap with other placed ships
  for (const ship of placedShips) {
    if (!ship.origin || ship.id === excludeId) continue;
    const shipCells = getShipCells(ship.origin, ship.size, ship.orientation);
    for (const sc of shipCells) {
      for (const c of cells) {
        if (sc.row === c.row && sc.col === c.col) return false;
      }
    }
  }

  return true;
}

export function toPlacedShipInputs(ships: PlacementShip[]): PlacedShipInput[] {
  return ships
    .filter((s): s is PlacementShip & { origin: { row: number; col: number } } => s.origin !== null)
    .map((s) => ({
      id: s.id,
      size: s.size,
      orientation: s.orientation,
      origin: s.origin,
    }));
}

export function allShipsPlaced(ships: PlacementShip[]): boolean {
  return ships.every((s) => s.origin !== null);
}

export function rotateShip(ship: PlacementShip, boardSize: number, placedShips: PlacementShip[]): PlacementShip {
  const newOrientation =
    ship.orientation === Orientation.HORIZONTAL ? Orientation.VERTICAL : Orientation.HORIZONTAL;

  if (!ship.origin) return { ...ship, orientation: newOrientation };

  if (isValidPlacement(ship.origin, ship.size, newOrientation, boardSize, placedShips, ship.id)) {
    return { ...ship, orientation: newOrientation };
  }

  // Try to adjust origin to keep ship in bounds
  const adjusted = { ...ship.origin };
  if (newOrientation === Orientation.VERTICAL) {
    adjusted.row = Math.min(adjusted.row, boardSize - ship.size);
  } else {
    adjusted.col = Math.min(adjusted.col, boardSize - ship.size);
  }

  if (isValidPlacement(adjusted, ship.size, newOrientation, boardSize, placedShips, ship.id)) {
    return { ...ship, orientation: newOrientation, origin: adjusted };
  }

  return ship; // Can't rotate, keep as is
}

export function randomizeFleet(difficulty: Difficulty): PlacementShip[] {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const boardSize = config.boardSize;
  const placed: PlacementShip[] = [];

  // Place largest ships first to avoid impossible situations
  const specs = [...config.fleet].sort((a, b) => b.size - a.size);

  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      const ship = placeShipRandomly(uuidv4(), spec.size, boardSize, placed);
      if (ship) placed.push(ship);
    }
  }

  return placed;
}

function placeShipRandomly(
  id: string,
  size: number,
  boardSize: number,
  placedSoFar: PlacementShip[],
): PlacementShip | null {
  const orientations = [Orientation.HORIZONTAL, Orientation.VERTICAL];
  // Shuffle attempts: up to boardSize² × 2 tries
  const maxAttempts = boardSize * boardSize * 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orientation = orientations[Math.floor(Math.random() * 2)] as Orientation;
    const maxRow = orientation === Orientation.VERTICAL ? boardSize - size : boardSize - 1;
    const maxCol = orientation === Orientation.HORIZONTAL ? boardSize - size : boardSize - 1;
    const origin = {
      row: Math.floor(Math.random() * (maxRow + 1)),
      col: Math.floor(Math.random() * (maxCol + 1)),
    };

    if (isValidPlacement(origin, size, orientation, boardSize, placedSoFar)) {
      return { id, size, orientation, origin };
    }
  }

  return null; // extremely unlikely with valid fleet configs
}
