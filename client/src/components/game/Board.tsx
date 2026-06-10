import { useMemo } from 'react';
import { CellState } from '@naval-war/types';
import { Cell } from './Cell';

interface BoardProps {
  size: number;
  cells: CellState[][];
  label?: string;
  lastAttackCoord?: { row: number; col: number } | null;
  previewCoord?: { row: number; col: number } | null;
  previewValid?: boolean;
  previewCells?: Array<{ row: number; col: number }>;
  sunkShipCells?: Array<{ row: number; col: number }>;
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  onCellLeave?: () => void;
  onCellDragOver?: (row: number, col: number, e: React.DragEvent) => void;
  onCellDrop?: (row: number, col: number, e: React.DragEvent) => void;
  interactive?: boolean;
  dimmed?: boolean;
}

export function Board({
  size,
  cells,
  label,
  lastAttackCoord,
  previewCoord,
  previewValid = true,
  previewCells,
  sunkShipCells,
  onCellClick,
  onCellHover,
  onCellLeave,
  onCellDragOver,
  onCellDrop,
  interactive = false,
  dimmed = false,
}: BoardProps) {
  const previewSet = useMemo(() => {
    if (!previewCells) return new Set<string>();
    return new Set(previewCells.map((c) => `${c.row},${c.col}`));
  }, [previewCells]);

  const sunkSet = useMemo(() => {
    if (!sunkShipCells) return new Set<string>();
    return new Set(sunkShipCells.map((c) => `${c.row},${c.col}`));
  }, [sunkShipCells]);

  // Responsive cell size: clamp between 20px and 36px based on available width
  const cellSizeStyle = {
    gridTemplateColumns: `repeat(${size}, 1fr)`,
    aspectRatio: '1',
  };

  const containerStyle = {
    width: `min(clamp(${size * 20}px, calc(100vw - 2rem), ${size * 36}px), calc(100vh - 16rem))`,
  };

  return (
    <div className={`flex flex-col gap-1 ${dimmed ? 'opacity-50' : ''}`}>
      {label && (
        <p className="text-xs font-medium text-ocean-400 uppercase tracking-wider text-center mb-1">
          {label}
        </p>
      )}

      {/* Column headers */}
      <div style={containerStyle}>
        <div
          className="grid mb-0.5"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {Array.from({ length: size }, (_, i) => (
            <span
              key={i}
              className="text-[9px] text-ocean-600 text-center font-mono select-none"
            >
              {i + 1}
            </span>
          ))}
        </div>

        {/* Main grid */}
        <div
          className="grid border-l border-t border-ocean-700/40 rounded-sm overflow-hidden"
          style={cellSizeStyle}
          onMouseLeave={onCellLeave}
        >
          {cells.map((row, r) =>
            row.map((cellState, c) => {
              const key = `${r},${c}`;
              const isLatestAttack =
                lastAttackCoord?.row === r && lastAttackCoord?.col === c;
              const inPreview = previewSet.has(key);
              const inSunk = sunkSet.has(key);

              return (
                <Cell
                  key={key}
                  row={r}
                  col={c}
                  state={cellState}
                  isLatestAttack={isLatestAttack}
                  isPreview={inPreview}
                  isValidPreview={previewValid}
                  isShipHighlight={inSunk}
                  onClick={interactive && onCellClick ? () => onCellClick(r, c) : undefined}
                  onMouseEnter={
                    interactive && onCellHover ? () => onCellHover(r, c) : undefined
                  }
                  onDragOver={
                    onCellDragOver ? (e) => onCellDragOver(r, c, e) : undefined
                  }
                  onDrop={onCellDrop ? (e) => onCellDrop(r, c, e) : undefined}
                />
              );
            }),
          )}
        </div>

        {/* Row labels */}
        <div className="sr-only">
          {cells.map((_, r) => (
            <span key={r}>{String.fromCharCode(65 + r)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
