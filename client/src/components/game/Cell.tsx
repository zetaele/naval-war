import { motion, AnimatePresence } from 'framer-motion';
import { CellState } from '@naval-war/types';

interface CellProps {
  state: CellState;
  row: number;
  col: number;
  isLatestAttack?: boolean;
  isPreview?: boolean;
  isValidPreview?: boolean;
  isShipHighlight?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const BASE =
  'relative w-full h-full border-r border-b border-ocean-700/40 flex items-center justify-center transition-colors duration-100 select-none';

function cellColor(
  state: CellState,
  isLatestAttack: boolean,
  isPreview: boolean,
  isValidPreview: boolean,
  isShipHighlight: boolean,
): string {
  if (isPreview) {
    return isValidPreview
      ? 'bg-ocean-400/30 cursor-pointer'
      : 'bg-red-500/20 cursor-not-allowed';
  }
  if (isShipHighlight) return 'bg-orange-400/40';

  switch (state) {
    case CellState.SHIP:
      return 'bg-ocean-600/70';
    case CellState.HIT:
      return isLatestAttack ? 'bg-orange-500' : 'bg-orange-700';
    case CellState.MISS:
      return isLatestAttack ? 'bg-blue-400' : 'bg-blue-900/70';
    case CellState.SUNK:
      return 'bg-red-900';
    default:
      return 'bg-ocean-950 hover:bg-ocean-800/60';
  }
}

export function Cell({
  state,
  isLatestAttack = false,
  isPreview = false,
  isValidPreview = true,
  isShipHighlight = false,
  onClick,
  onMouseEnter,
  onDragOver,
  onDrop,
}: CellProps) {
  const colorClass = cellColor(state, isLatestAttack, isPreview, isValidPreview, isShipHighlight);

  return (
    <div
      className={`${BASE} ${colorClass} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <AnimatePresence>
        {state === CellState.MISS && isLatestAttack && (
          <motion.span
            key="ripple"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 rounded-full bg-blue-400/50 pointer-events-none"
          />
        )}
        {(state === CellState.HIT || state === CellState.SUNK) && isLatestAttack && (
          <motion.span
            key="explosion"
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 1.4, opacity: 0.9 }}
            exit={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 rounded-sm bg-orange-400/60 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {state === CellState.MISS && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-300/70" />
      )}
      {(state === CellState.HIT) && (
        <span className="text-[10px]">💥</span>
      )}
    </div>
  );
}
