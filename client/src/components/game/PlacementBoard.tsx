import { useState, useCallback, useEffect, useRef } from 'react';
import { CellState, Orientation, DIFFICULTY_CONFIGS, type Difficulty } from '@naval-war/types';
import type { PlacementShip } from '../../utils/board';
import {
  getShipCells,
  isValidPlacement,
  rotateShip,
  allShipsPlaced,
  toPlacedShipInputs,
  buildInitialFleet,
  randomizeFleet,
} from '../../utils/board';
import { Board } from './Board';
import { Button } from '../ui/Button';

interface PlacementBoardProps {
  difficulty: Difficulty;
  onConfirm: (ships: ReturnType<typeof toPlacedShipInputs>) => void;
  loading?: boolean;
}

function buildEmptyBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array<CellState>(size).fill(CellState.EMPTY));
}

function boardWithShips(size: number, ships: PlacementShip[]): CellState[][] {
  const cells = buildEmptyBoard(size);
  for (const ship of ships) {
    if (!ship.origin) continue;
    for (const c of getShipCells(ship.origin, ship.size, ship.orientation)) {
      const row = cells[c.row];
      if (row) row[c.col] = CellState.SHIP;
    }
  }
  return cells;
}

export function PlacementBoard({ difficulty, onConfirm, loading = false }: PlacementBoardProps) {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const boardSize = config.boardSize;

  const [ships, setShips] = useState<PlacementShip[]>(() => buildInitialFleet(difficulty));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ row: number; col: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetIdx, setDragOffsetIdx] = useState(0);

  // Detect touch/hover capability
  const isTouch = window.matchMedia('(hover: none)').matches;

  const cells = buildWithShips();

  function buildWithShips(): CellState[][] {
    return boardWithShips(boardSize, ships);
  }

  // ─── Keyboard rotate ─────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toUpperCase() !== 'R' && e.key !== 'Scroll') return;
      if (!selectedId) return;
      setShips((prev) => prev.map((s) => s.id === selectedId ? rotateShip(s, boardSize, prev) : s));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, boardSize]);

  // ─── Scroll-wheel rotate ──────────────────────────────────────────────────────
  function handleBoardWheel(e: React.WheelEvent) {
    if (!selectedId) return;
    e.preventDefault();
    setShips((prev) => prev.map((s) => s.id === selectedId ? rotateShip(s, boardSize, prev) : s));
  }

  // ─── Desktop drag-and-drop ───────────────────────────────────────────────────
  function handleShipDragStart(id: string, offsetIdx: number) {
    setDraggingId(id);
    setDragOffsetIdx(offsetIdx);
    setSelectedId(id);
  }

  function handleCellDragOver(row: number, col: number, e: React.DragEvent) {
    e.preventDefault();
    setHoverCoord({ row, col });
  }

  function handleCellDrop(row: number, col: number, _e: React.DragEvent) {
    if (!draggingId) return;
    const ship = ships.find((s) => s.id === draggingId);
    if (!ship) return;

    const origin = ship.orientation === Orientation.HORIZONTAL
      ? { row, col: col - dragOffsetIdx }
      : { row: row - dragOffsetIdx, col };

    if (isValidPlacement(origin, ship.size, ship.orientation, boardSize, ships, draggingId)) {
      setShips((prev) => prev.map((s) => s.id === draggingId ? { ...s, origin } : s));
    }
    setDraggingId(null);
    setHoverCoord(null);
  }

  // ─── Mobile tap-to-place ─────────────────────────────────────────────────────
  function handleCellTap(row: number, col: number) {
    if (!selectedId) return;
    const ship = ships.find((s) => s.id === selectedId);
    if (!ship) return;

    const origin = { row, col };
    if (isValidPlacement(origin, ship.size, ship.orientation, boardSize, ships, selectedId)) {
      setShips((prev) => prev.map((s) => s.id === selectedId ? { ...s, origin } : s));
      setSelectedId(null);
    }
  }

  // ─── Preview calculation ─────────────────────────────────────────────────────
  const previewShip = draggingId
    ? ships.find((s) => s.id === draggingId)
    : isTouch && selectedId
    ? ships.find((s) => s.id === selectedId)
    : null;

  const previewOrigin = hoverCoord && previewShip
    ? previewShip.orientation === Orientation.HORIZONTAL
      ? { row: hoverCoord.row, col: hoverCoord.col - (draggingId ? dragOffsetIdx : 0) }
      : { row: hoverCoord.row - (draggingId ? dragOffsetIdx : 0), col: hoverCoord.col }
    : null;

  const previewCells = previewOrigin && previewShip
    ? getShipCells(previewOrigin, previewShip.size, previewShip.orientation)
    : [];

  const previewValid = previewOrigin && previewShip
    ? isValidPlacement(previewOrigin, previewShip.size, previewShip.orientation, boardSize, ships, previewShip.id)
    : true;

  const allPlaced = allShipsPlaced(ships);

  // Unplaced ships list
  const unplacedShips = ships.filter((s) => s.origin === null);

  return (
    <div className="flex flex-col items-center gap-4">
      <div onWheel={handleBoardWheel}>
        <Board
          size={boardSize}
          cells={cells}
          label="Your Board — Place Ships"
          previewCells={previewCells}
          previewValid={previewValid}
          onCellClick={isTouch ? handleCellTap : undefined}
          onCellHover={!isTouch ? (r, c) => setHoverCoord({ row: r, col: c }) : undefined}
          onCellLeave={() => setHoverCoord(null)}
          onCellDragOver={handleCellDragOver}
          onCellDrop={handleCellDrop}
          interactive
        />
      </div>

      {/* Ship tray */}
      <div className="flex flex-wrap gap-2 justify-center max-w-sm">
        {ships.map((ship) => (
          <ShipTile
            key={ship.id}
            ship={ship}
            isSelected={selectedId === ship.id}
            onClick={() => setSelectedId(ship.id === selectedId ? null : ship.id)}
            onRotate={() =>
              setShips((prev) => prev.map((s) => s.id === ship.id ? rotateShip(s, boardSize, prev) : s))
            }
            onDragStart={(offsetIdx) => handleShipDragStart(ship.id, offsetIdx)}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap justify-center">
        {selectedId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const ship = ships.find((s) => s.id === selectedId);
              if (ship) setShips((prev) => prev.map((s) => s.id === selectedId ? rotateShip(s, boardSize, prev) : s));
            }}
          >
            Rotate (R)
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setShips(randomizeFleet(difficulty));
            setSelectedId(null);
          }}
        >
          Random
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setShips(buildInitialFleet(difficulty));
            setSelectedId(null);
          }}
        >
          Reset
        </Button>
        <Button
          size="sm"
          disabled={!allPlaced}
          loading={loading}
          onClick={() => onConfirm(toPlacedShipInputs(ships))}
        >
          Confirm Placement
        </Button>
      </div>

      {!allPlaced && (
        <p className="text-xs text-ocean-400">
          {unplacedShips.length} ship{unplacedShips.length !== 1 ? 's' : ''} left to place
        </p>
      )}
    </div>
  );
}

interface ShipTileProps {
  ship: PlacementShip;
  isSelected: boolean;
  onClick: () => void;
  onRotate: () => void;
  onDragStart: (offsetIdx: number) => void;
}

function ShipTile({ ship, isSelected, onClick, onRotate, onDragStart }: ShipTileProps) {
  const placed = ship.origin !== null;

  return (
    <div
      className={`
        flex items-center gap-1 rounded-lg border px-2 py-1.5 cursor-pointer transition-all select-none
        ${isSelected ? 'border-ocean-400 bg-ocean-700 shadow-lg shadow-ocean-400/20' : placed ? 'border-ocean-700 bg-ocean-800/50 opacity-60' : 'border-ocean-600 bg-ocean-800 hover:border-ocean-400'}
      `}
      onClick={onClick}
    >
      {/* Ship cells visualization */}
      <div className={`flex ${ship.orientation === Orientation.VERTICAL ? 'flex-col' : 'flex-row'} gap-0.5`}>
        {Array.from({ length: ship.size }, (_, i) => (
          <div
            key={i}
            draggable={!window.matchMedia('(hover: none)').matches}
            onDragStart={() => onDragStart(i)}
            className={`w-4 h-4 rounded-sm ${placed ? 'bg-ocean-500/60' : 'bg-ocean-400'}`}
          />
        ))}
      </div>
      <span className="text-xs text-ocean-300 ml-1">×{ship.size}</span>
    </div>
  );
}
