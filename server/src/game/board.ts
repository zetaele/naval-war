import {
  CellState,
  Orientation,
  DIFFICULTY_CONFIGS,
  type Ship,
  type Coordinate,
  type PlacedShipInput,
  type Difficulty,
} from '@naval-war/types';
import { v4 as uuidv4 } from 'uuid';

export type BoardValidationResult =
  | { valid: true; ships: Ship[]; cells: CellState[][] }
  | { valid: false; error: string };

export function validateAndBuildBoard(
  inputs: PlacedShipInput[],
  difficulty: Difficulty,
): BoardValidationResult {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const size = config.boardSize;

  // Verify fleet composition
  const requiredCounts = new Map<number, number>();
  for (const spec of config.fleet) {
    requiredCounts.set(spec.size, spec.count);
  }

  const providedCounts = new Map<number, number>();
  for (const input of inputs) {
    providedCounts.set(input.size, (providedCounts.get(input.size) ?? 0) + 1);
  }

  for (const [size, count] of requiredCounts) {
    if ((providedCounts.get(size) ?? 0) !== count) {
      return { valid: false, error: `Fleet mismatch: need ${count}×(size ${size})` };
    }
  }

  for (const [size] of providedCounts) {
    if (!requiredCounts.has(size)) {
      return { valid: false, error: `Unknown ship size: ${size}` };
    }
  }

  // Build cells grid
  const cells: CellState[][] = Array.from({ length: size }, () =>
    Array(size).fill(CellState.EMPTY) as CellState[],
  );

  const ships: Ship[] = [];

  for (const input of inputs) {
    const shipCells = expandShip(input, size);
    if (!shipCells) {
      return { valid: false, error: `Ship out of bounds (size ${input.size})` };
    }

    for (const cell of shipCells) {
      const row = cells[cell.row];
      if (!row) return { valid: false, error: 'Invalid coordinate' };
      if (row[cell.col] !== CellState.EMPTY) {
        return { valid: false, error: 'Ships overlap' };
      }
    }

    for (const cell of shipCells) {
      const row = cells[cell.row];
      if (row) row[cell.col] = CellState.SHIP;
    }

    ships.push({
      id: input.id,
      size: input.size,
      orientation: input.orientation,
      cells: shipCells,
      hits: 0,
      sunk: false,
    });
  }

  return { valid: true, ships, cells };
}

function expandShip(
  input: PlacedShipInput,
  boardSize: number,
): Coordinate[] | null {
  const cells: Coordinate[] = [];
  for (let i = 0; i < input.size; i++) {
    const row =
      input.orientation === Orientation.VERTICAL
        ? input.origin.row + i
        : input.origin.row;
    const col =
      input.orientation === Orientation.HORIZONTAL
        ? input.origin.col + i
        : input.origin.col;

    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) {
      return null;
    }
    cells.push({ row, col });
  }
  return cells;
}

export function applyAttack(
  cells: CellState[][],
  ships: Ship[],
  row: number,
  col: number,
): { result: 'HIT' | 'MISS' | 'SUNK'; sunkShip?: Ship } {
  const boardRow = cells[row];
  if (!boardRow) return { result: 'MISS' };

  const cellState = boardRow[col];

  if (cellState === CellState.EMPTY) {
    boardRow[col] = CellState.MISS;
    return { result: 'MISS' };
  }

  if (cellState === CellState.SHIP) {
    boardRow[col] = CellState.HIT;

    // Find which ship was hit
    const ship = ships.find((s) =>
      s.cells.some((c) => c.row === row && c.col === col),
    );

    if (!ship) return { result: 'HIT' };

    ship.hits += 1;

    if (ship.hits >= ship.size) {
      ship.sunk = true;
      // Mark all cells as SUNK
      for (const cell of ship.cells) {
        const r = cells[cell.row];
        if (r) r[cell.col] = CellState.SUNK;
      }
      return { result: 'SUNK', sunkShip: ship };
    }

    return { result: 'HIT' };
  }

  // Already attacked (HIT, MISS, SUNK) — not a valid target
  return { result: 'MISS' };
}

export function allShipsSunk(ships: Ship[]): boolean {
  return ships.length > 0 && ships.every((s) => s.sunk);
}

// Build the opponent's board view (hide SHIP cells as EMPTY)
export function maskBoard(
  cells: CellState[][],
): CellState[][] {
  return cells.map((row) =>
    row.map((cell) =>
      cell === CellState.SHIP ? CellState.EMPTY : cell,
    ),
  );
}
