import React, { useEffect, useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { coordToSquareNumber, isKingPiece, isPlayableSquare, pieceOwner } from '../engine/rules.ts';
import type { Coord, DraughtsMove, PieceCode, PlayerSide } from '../engine/types.ts';
import { BOARD_THEMES } from '../services/localStore.ts';

export interface BoardLastMove {
  from: Coord;
  to: Coord;
  path?: Coord[];
  captured?: Coord[];
  promoted?: boolean;
  ply?: number;
}

interface DraughtsBoardProps {
  boardSize: 8 | 10;
  board: PieceCode[][];
  turn: PlayerSide;
  interactive: boolean;
  allowedSide?: PlayerSide;
  legalMoves: DraughtsMove[];
  flipped?: boolean;
  boardThemeId?: string;
  pieceThemeId?: string;
  showSquareNumbers?: boolean;
  highlightSquares?: Coord[];
  lastMove?: BoardLastMove | null;
  maxWidthClass?: string;
  onExecuteMove: (move: DraughtsMove) => void;
}

function triggerHaptic(ms: number) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // ignore unsupported browsers
  }
}

export const DraughtsBoard: React.FC<DraughtsBoardProps> = ({
  boardSize,
  board,
  turn,
  interactive,
  allowedSide,
  legalMoves,
  flipped = false,
  boardThemeId = 'walnut',
  pieceThemeId = 'obsidian_ivory',
  showSquareNumbers = true,
  highlightSquares = [],
  lastMove = null,
  maxWidthClass = 'max-w-[min(92vw,600px)]',
  onExecuteMove,
}) => {
  const [selected, setSelected] = useState<Coord | null>(null);
  const [partialPath, setPartialPath] = useState<Coord[]>([]);
  const [animating, setAnimating] = useState<{
    key: string;
    from: Coord;
    to: Coord;
    piece: Exclude<PieceCode, null>;
    captured: Coord[];
    promoted: boolean;
  } | null>(null);

  const theme = useMemo(
    () => BOARD_THEMES.find((t) => t.id === boardThemeId) ?? BOARD_THEMES[0],
    [boardThemeId]
  );

  const lastMoveSig = lastMove
    ? `${lastMove.ply ?? ''}:${lastMove.from.row},${lastMove.from.col}->${lastMove.to.row},${lastMove.to.col}`
    : '';

  // Trigger smooth piece glide & capture burst when lastMove updates
  useEffect(() => {
    if (!lastMove) {
      setAnimating(null);
      return;
    }
    const piece = board[lastMove.to.row]?.[lastMove.to.col];
    if (!piece) return;

    setAnimating({
      key: lastMoveSig,
      from: lastMove.from,
      to: lastMove.to,
      piece,
      captured: lastMove.captured ?? [],
      promoted: Boolean(lastMove.promoted),
    });

    const timer = setTimeout(() => {
      setAnimating(null);
    }, 240);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMoveSig]);

  // Filter moves matching currently selected origin + partialPath prefix
  const activeMoves = useMemo(() => {
    if (!selected) return [];
    return legalMoves.filter((m) => {
      if (m.from.row !== selected.row || m.from.col !== selected.col) return false;
      if (partialPath.length > m.path.length) return false;
      return partialPath.every((p, idx) => m.path[idx].row === p.row && m.path[idx].col === p.col);
    });
  }, [legalMoves, selected, partialPath]);

  // Next clickable landing squares from current step
  const nextStepCoords = useMemo(() => {
    const stepIdx = partialPath.length;
    const map = new Map<string, { coord: Coord; isCapture: boolean; completesMove?: DraughtsMove }>();
    for (const m of activeMoves) {
      const target = m.path[stepIdx];
      if (!target) continue;
      const key = `${target.row},${target.col}`;
      const isFinalStep = m.path.length === stepIdx + 1;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          coord: target,
          isCapture: m.isCapture,
          completesMove: isFinalStep ? m : undefined,
        });
      }
    }
    return map;
  }, [activeMoves, partialPath.length]);

  // Direct final destination clicks when unambiguous
  const directFinalMoves = useMemo(() => {
    const map = new Map<string, DraughtsMove[]>();
    for (const m of activeMoves) {
      const key = `${m.to.row},${m.to.col}`;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [activeMoves]);

  // Which squares have movable pieces this turn?
  const movableOriginKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) {
      set.add(`${m.from.row},${m.from.col}`);
    }
    return set;
  }, [legalMoves]);

  const rows = useMemo(() => {
    const arr = Array.from({ length: boardSize }, (_, i) => i);
    return flipped ? arr.slice().reverse() : arr;
  }, [boardSize, flipped]);

  const cols = useMemo(() => {
    const arr = Array.from({ length: boardSize }, (_, i) => i);
    return flipped ? arr.slice().reverse() : arr;
  }, [boardSize, flipped]);

  const currentPiecePos = partialPath.length > 0 ? partialPath[partialPath.length - 1] : selected;

  function toDisplayIndex(r: number, c: number) {
    return {
      dispRow: flipped ? boardSize - 1 - r : r,
      dispCol: flipped ? boardSize - 1 - c : c,
    };
  }

  function handleSquareClick(r: number, c: number) {
    if (!interactive) return;
    if (allowedSide && allowedSide !== turn) return;

    const key = `${r},${c}`;
    const stepTarget = nextStepCoords.get(key);

    if (selected && stepTarget) {
      const newPath = [...partialPath, { row: r, col: c }];
      const matchingMoves = activeMoves.filter(
        (m) =>
          m.path.length >= newPath.length &&
          newPath.every((p, idx) => m.path[idx].row === p.row && m.path[idx].col === p.col)
      );

      if (matchingMoves.length === 1 && matchingMoves[0].path.length === newPath.length) {
        triggerHaptic(matchingMoves[0].isCapture ? 20 : 10);
        setSelected(null);
        setPartialPath([]);
        onExecuteMove(matchingMoves[0]);
        return;
      }

      const completedHere = matchingMoves.find((m) => m.path.length === newPath.length);
      const longerExists = matchingMoves.some((m) => m.path.length > newPath.length);
      if (completedHere && !longerExists) {
        triggerHaptic(completedHere.isCapture ? 20 : 10);
        setSelected(null);
        setPartialPath([]);
        onExecuteMove(completedHere);
        return;
      }

      triggerHaptic(14);
      setPartialPath(newPath);
      return;
    }

    if (selected && partialPath.length === 0) {
      const finals = directFinalMoves.get(key);
      if (finals && finals.length === 1) {
        triggerHaptic(finals[0].isCapture ? 20 : 10);
        setSelected(null);
        setPartialPath([]);
        onExecuteMove(finals[0]);
        return;
      }
    }

    const piece = board[r][c];
    if (piece && pieceOwner(piece) === turn && movableOriginKeys.has(key)) {
      if (selected && selected.row === r && selected.col === c && partialPath.length === 0) {
        setSelected(null);
      } else {
        triggerHaptic(8);
        setSelected({ row: r, col: c });
        setPartialPath([]);
      }
      return;
    }

    setSelected(null);
    setPartialPath([]);
  }

  function getPieceClasses(piece: Exclude<PieceCode, null>) {
    const isWhite = piece === 'w' || piece === 'W';
    if (pieceThemeId === 'crimson_pearl') {
      return isWhite
        ? 'bg-gradient-to-b from-stone-50 to-stone-300 border-stone-400 text-stone-800 shadow-[0_4px_8px_rgba(0,0,0,0.45)]'
        : 'bg-gradient-to-b from-rose-700 to-rose-950 border-rose-500/50 text-rose-100 shadow-[0_4px_8px_rgba(0,0,0,0.55)]';
    }
    if (pieceThemeId === 'royal_amber') {
      return isWhite
        ? 'bg-gradient-to-b from-amber-200 to-amber-500 border-amber-600 text-amber-950 shadow-[0_4px_8px_rgba(0,0,0,0.45)]'
        : 'bg-gradient-to-b from-zinc-700 to-zinc-950 border-zinc-500/40 text-amber-300 shadow-[0_4px_8px_rgba(0,0,0,0.6)]';
    }
    return isWhite
      ? 'bg-gradient-to-b from-[#FAF6EE] to-[#D8CBB4] border-[#B4A184] text-stone-800 shadow-[0_4px_8px_rgba(0,0,0,0.45)]'
      : 'bg-gradient-to-b from-[#333945] to-[#11151D] border-[#4B5563]/60 text-amber-400 shadow-[0_4px_8px_rgba(0,0,0,0.6)]';
  }

  const fromDisp = animating ? toDisplayIndex(animating.from.row, animating.from.col) : null;
  const toDisp = animating ? toDisplayIndex(animating.to.row, animating.to.col) : null;

  return (
    <div
      className={`w-full ${maxWidthClass} mx-auto select-none`}
      role="grid"
      aria-label={`${boardSize} by ${boardSize} Draughts Board`}
    >
      <div
        className="rounded-xl p-2 sm:p-2.5 shadow-2xl border border-black/35"
        style={{ backgroundColor: theme.frame }}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md border border-black/45">
          <div
            className="grid w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`,
            }}
          >
            {rows.map((r) =>
              cols.map((c) => {
                const playable = isPlayableSquare(r, c, boardSize);
                const piece = board[r][c];
                const key = `${r},${c}`;
                const isSelected = selected?.row === r && selected?.col === c;
                const isCurrentStep = currentPiecePos?.row === r && currentPiecePos?.col === c;
                const stepInfo = nextStepCoords.get(key);
                const isDirectFinal =
                  !stepInfo && selected && partialPath.length === 0 && directFinalMoves.has(key);
                const isLastFrom = lastMove?.from.row === r && lastMove?.from.col === c;
                const isLastTo = lastMove?.to.row === r && lastMove?.to.col === c;
                const isHighlighted = highlightSquares.some((h) => h.row === r && h.col === c);
                const isCapturedBurst =
                  animating?.captured.some((cap) => cap.row === r && cap.col === c) ?? false;
                const hideStaticForGlide =
                  animating !== null && animating.to.row === r && animating.to.col === c;
                const isMovableOrigin =
                  interactive &&
                  (!allowedSide || allowedSide === turn) &&
                  movableOriginKeys.has(key);
                const sqNumber = playable ? coordToSquareNumber({ row: r, col: c }, boardSize) : null;

                let overlayBg = 'transparent';
                if (isLastFrom || isLastTo) {
                  overlayBg = 'rgba(245, 158, 11, 0.22)';
                }
                if (isHighlighted) {
                  overlayBg = 'rgba(16, 185, 129, 0.28)';
                }
                if (isSelected || isCurrentStep) {
                  overlayBg = 'rgba(245, 158, 11, 0.38)';
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSquareClick(r, c)}
                    disabled={!playable}
                    aria-label={
                      playable
                        ? `Square ${sqNumber}${piece ? `, ${pieceOwner(piece)} ${isKingPiece(piece) ? 'king' : 'man'}` : ', empty'}`
                        : undefined
                    }
                    className={`relative flex items-center justify-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      playable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    style={{
                      backgroundColor: playable ? theme.darkSquare : theme.lightSquare,
                    }}
                  >
                    {overlayBg !== 'transparent' && (
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundColor: overlayBg }}
                      />
                    )}

                    {isHighlighted && (
                      <span className="absolute inset-1 rounded-md border-2 border-emerald-400 pointer-events-none" />
                    )}

                    {showSquareNumbers && sqNumber !== null && (
                      <span className="absolute top-0.5 left-1 text-[9px] sm:text-[10px] font-mono tabular-nums text-white/45 leading-none pointer-events-none">
                        {sqNumber}
                      </span>
                    )}

                    {/* Capture Burst Ring */}
                    {isCapturedBurst && (
                      <span className="absolute w-[74%] h-[74%] rounded-full border-[3px] border-amber-400 capture-burst pointer-events-none z-20" />
                    )}

                    {/* Piece rendering */}
                    {piece && !hideStaticForGlide && (
                      <div
                        className={`relative z-10 w-[76%] h-[76%] rounded-full border-2 flex items-center justify-center transition-transform duration-150 ${getPieceClasses(
                          piece
                        )} ${isSelected ? 'scale-105 ring-2 ring-amber-400' : ''} ${
                          isMovableOrigin && !selected ? 'hover:scale-105' : ''
                        }`}
                      >
                        <div className="w-[72%] h-[72%] rounded-full border border-current/25 flex items-center justify-center">
                          {isKingPiece(piece) && (
                            <Crown
                              className={`w-[62%] h-[62%] stroke-[2.2] ${
                                isLastTo && lastMove?.promoted ? 'crown-pop' : ''
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legal move destination marker */}
                    {(stepInfo || isDirectFinal) && (
                      <span
                        className={`relative z-20 pointer-events-none rounded-full transition-transform ${
                          stepInfo?.isCapture || isDirectFinal
                            ? 'w-[42%] h-[42%] border-[3px] border-amber-400 bg-amber-400/20 capture-ring'
                            : 'w-[30%] h-[30%] bg-emerald-400/80 shadow-sm'
                        }`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Animated Moving Piece Overlay */}
          {animating && fromDisp && toDisp && (
            <motion.div
              key={animating.key}
              initial={{
                left: `${(fromDisp.dispCol / boardSize) * 100}%`,
                top: `${(fromDisp.dispRow / boardSize) * 100}%`,
                scale: 1,
              }}
              animate={{
                left: `${(toDisp.dispCol / boardSize) * 100}%`,
                top: `${(toDisp.dispRow / boardSize) * 100}%`,
                scale: [1, 1.12, 1],
              }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="absolute pointer-events-none z-30 flex items-center justify-center"
              style={{
                width: `${100 / boardSize}%`,
                height: `${100 / boardSize}%`,
              }}
            >
              <div
                className={`w-[76%] h-[76%] rounded-full border-2 flex items-center justify-center ${getPieceClasses(
                  animating.piece
                )}`}
              >
                <div className="w-[72%] h-[72%] rounded-full border border-current/25 flex items-center justify-center">
                  {isKingPiece(animating.piece) && (
                    <Crown
                      className={`w-[62%] h-[62%] stroke-[2.2] ${
                        animating.promoted ? 'crown-pop' : ''
                      }`}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
