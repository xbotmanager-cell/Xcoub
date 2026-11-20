import { DRAFT_MASTER_8X8_RULES } from './presets.ts';
import type {
  Coord,
  DraughtsMove,
  GameState,
  MoveRecord,
  PieceCode,
  PlayerSide,
  RuleConfig,
} from './types.ts';

const DIRS: readonly Coord[] = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
];

export function isPlayableSquare(row: number, col: number, boardSize: number): boolean {
  return row >= 0 && row < boardSize && col >= 0 && col < boardSize && (row + col) % 2 === 1;
}

export function coordToSquareNumber(coord: Coord, boardSize: 8 | 10): number {
  const squaresPerRow = boardSize / 2;
  return coord.row * squaresPerRow + Math.floor(coord.col / 2) + 1;
}

export function squareNumberToCoord(squareNum: number, boardSize: 8 | 10): Coord {
  const squaresPerRow = boardSize / 2;
  const zeroBased = squareNum - 1;
  const row = Math.floor(zeroBased / squaresPerRow);
  const idxInRow = zeroBased % squaresPerRow;
  const col = row % 2 === 0 ? idxInRow * 2 + 1 : idxInRow * 2;
  return { row, col };
}

export function pieceOwner(piece: PieceCode): PlayerSide | null {
  if (piece === 'w' || piece === 'W') return 'white';
  if (piece === 'b' || piece === 'B') return 'black';
  return null;
}

export function isKingPiece(piece: PieceCode): boolean {
  return piece === 'W' || piece === 'B';
}

export function oppositeSide(side: PlayerSide): PlayerSide {
  return side === 'white' ? 'black' : 'white';
}

export function cloneBoard(board: PieceCode[][]): PieceCode[][] {
  return board.map((row) => row.slice());
}

export function createInitialBoard(rules: RuleConfig): PieceCode[][] {
  const size = rules.boardSize;
  const board: PieceCode[][] = Array.from({ length: size }, () => Array<PieceCode>(size).fill(null));
  const rows = rules.startingRows;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isPlayableSquare(r, c, size)) continue;
      if (r < rows) {
        board[r][c] = 'b';
      } else if (r >= size - rows) {
        board[r][c] = 'w';
      }
    }
  }
  return board;
}

export function compressBoard(board: PieceCode[][], boardSize: 8 | 10): string {
  let chars = '';
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (isPlayableSquare(r, c, boardSize)) {
        chars += board[r][c] ?? '.';
      }
    }
  }
  return `${boardSize}:${chars}`;
}

export function decompressBoard(compressed: string): { boardSize: 8 | 10; board: PieceCode[][] } {
  const [sizePart, dataPart] = compressed.split(':');
  const boardSize: 8 | 10 = sizePart === '10' ? 10 : 8;
  const board: PieceCode[][] = Array.from({ length: boardSize }, () => Array<PieceCode>(boardSize).fill(null));
  let idx = 0;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (isPlayableSquare(r, c, boardSize)) {
        const ch = dataPart?.[idx++] ?? '.';
        board[r][c] = ch === 'w' || ch === 'W' || ch === 'b' || ch === 'B' ? ch : null;
      }
    }
  }
  return { boardSize, board };
}

export function createInitialGameState(rules: RuleConfig = DRAFT_MASTER_8X8_RULES): GameState {
  const board = createInitialBoard(rules);
  const compressed = compressBoard(board, rules.boardSize);
  const posKey = `${rules.firstPlayer}:${compressed}`;
  return {
    boardSize: rules.boardSize,
    board,
    initialBoardCompressed: compressed,
    initialTurn: rules.firstPlayer,
    turn: rules.firstPlayer,
    rules: { ...rules },
    moveCount: 0,
    noProgressCount: 0,
    positionCounts: { [posKey]: 1 },
    status: 'playing',
    history: [],
  };
}

export function isPromotionRow(row: number, side: PlayerSide, boardSize: 8 | 10): boolean {
  return side === 'white' ? row === 0 : row === boardSize - 1;
}

function forwardRowDelta(side: PlayerSide): number {
  return side === 'white' ? -1 : 1;
}

function formatMoveNotation(from: Coord, path: Coord[], isCapture: boolean, boardSize: 8 | 10): string {
  const startSq = coordToSquareNumber(from, boardSize);
  const sep = isCapture ? 'x' : '-';
  const pathSqs = path.map((c) => coordToSquareNumber(c, boardSize));
  return `${startSq}${sep}${pathSqs.join(sep)}`;
}

/**
 * Generates all legal moves for `side` under `rules`.
 */
export function generateLegalMoves(
  board: PieceCode[][],
  side: PlayerSide,
  rules: RuleConfig
): DraughtsMove[] {
  const captures: DraughtsMove[] = [];
  const quietMoves: DraughtsMove[] = [];
  const size = rules.boardSize;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (!piece || pieceOwner(piece) !== side) continue;

      const from: Coord = { row: r, col: c };
      const isKing = isKingPiece(piece);

      // Generate captures
      const pieceCaptures = generateCapturesFromSquare(board, from, side, isKing, rules);
      for (const cap of pieceCaptures) {
        captures.push(cap);
      }

      // Generate quiet moves (even if mandatory capture is on, we filter below if needed)
      if (!rules.mandatoryCapture || captures.length === 0) {
        const pieceQuiet = generateQuietMovesFromSquare(board, from, side, isKing, rules);
        for (const qm of pieceQuiet) {
          quietMoves.push(qm);
        }
      }
    }
  }

  if (captures.length > 0 && rules.mandatoryCapture) {
    if (rules.maximumCapture) {
      let maxCap = 0;
      for (const m of captures) {
        if (m.captured.length > maxCap) maxCap = m.captured.length;
      }
      return captures.filter((m) => m.captured.length === maxCap);
    }
    return captures;
  }

  if (captures.length > 0 && !rules.mandatoryCapture) {
    if (rules.maximumCapture) {
      let maxCap = 0;
      for (const m of captures) {
        if (m.captured.length > maxCap) maxCap = m.captured.length;
      }
      return [...captures.filter((m) => m.captured.length === maxCap), ...quietMoves];
    }
    return [...captures, ...quietMoves];
  }

  return quietMoves;
}

function generateQuietMovesFromSquare(
  board: PieceCode[][],
  from: Coord,
  side: PlayerSide,
  isKing: boolean,
  rules: RuleConfig
): DraughtsMove[] {
  const moves: DraughtsMove[] = [];
  const size = rules.boardSize;
  const fwd = forwardRowDelta(side);

  for (const dir of DIRS) {
    if (!isKing && rules.menMoveDirection === 'forward' && dir.row !== fwd) {
      continue;
    }

    if (isKing && rules.flyingKings) {
      let nr = from.row + dir.row;
      let nc = from.col + dir.col;
      while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        if (board[nr][nc] !== null) break;
        const to = { row: nr, col: nc };
        moves.push({
          from,
          to,
          path: [to],
          captured: [],
          promoted: false,
          notation: formatMoveNotation(from, [to], false, size),
          isCapture: false,
        });
        nr += dir.row;
        nc += dir.col;
      }
    } else {
      const nr = from.row + dir.row;
      const nc = from.col + dir.col;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === null) {
        const to = { row: nr, col: nc };
        const promoted = !isKing && isPromotionRow(nr, side, size);
        moves.push({
          from,
          to,
          path: [to],
          captured: [],
          promoted,
          notation: formatMoveNotation(from, [to], false, size),
          isCapture: false,
        });
      }
    }
  }

  return moves;
}

function generateCapturesFromSquare(
  board: PieceCode[][],
  origin: Coord,
  side: PlayerSide,
  initialIsKing: boolean,
  rules: RuleConfig
): DraughtsMove[] {
  const results: DraughtsMove[] = [];
  const size = rules.boardSize;
  const enemySide = oppositeSide(side);
  const fwd = forwardRowDelta(side);

  // Track captured coordinates in a set of "r,c" keys so pieces are not jumped twice
  // and remain blockers on board during the sequence (official International + safe English rule).
  function dfs(
    cur: Coord,
    isKing: boolean,
    path: Coord[],
    captured: Coord[],
    capturedSet: Set<string>,
    workBoard: PieceCode[][]
  ): void {
    let foundContinuation = false;

    for (const dir of DIRS) {
      if (!isKing && !rules.menCaptureBackward && dir.row !== fwd) {
        continue;
      }

      if (isKing && rules.flyingKings) {
        // Flying king: scan along diagonal until hitting a piece or edge
        let sr = cur.row + dir.row;
        let sc = cur.col + dir.col;
        let enemyCoord: Coord | null = null;

        while (sr >= 0 && sr < size && sc >= 0 && sc < size) {
          const sqPiece = workBoard[sr][sc];
          const key = `${sr},${sc}`;
          if (sqPiece !== null || capturedSet.has(key)) {
            if (sqPiece !== null && !capturedSet.has(key) && pieceOwner(sqPiece) === enemySide) {
              enemyCoord = { row: sr, col: sc };
            }
            break;
          }
          sr += dir.row;
          sc += dir.col;
        }

        if (!enemyCoord) continue;

        // Scan landing squares beyond enemyCoord
        let lr = enemyCoord.row + dir.row;
        let lc = enemyCoord.col + dir.col;
        const enemyKey = `${enemyCoord.row},${enemyCoord.col}`;

        while (lr >= 0 && lr < size && lc >= 0 && lc < size) {
          const landKey = `${lr},${lc}`;
          if (workBoard[lr][lc] !== null || capturedSet.has(landKey)) {
            break;
          }

          foundContinuation = true;
          const nextCoord = { row: lr, col: lc };
          const nextPath = [...path, nextCoord];
          const nextCaptured = [...captured, enemyCoord];
          capturedSet.add(enemyKey);

          if (rules.multipleCaptures) {
            dfs(nextCoord, isKing, nextPath, nextCaptured, capturedSet, workBoard);
          } else {
            results.push({
              from: origin,
              to: nextCoord,
              path: nextPath,
              captured: nextCaptured,
              promoted: false,
              notation: formatMoveNotation(origin, nextPath, true, size),
              isCapture: true,
            });
          }

          capturedSet.delete(enemyKey);
          lr += dir.row;
          lc += dir.col;
        }
      } else {
        // Short (1-step jump) for Men or non-flying Kings
        const er = cur.row + dir.row;
        const ec = cur.col + dir.col;
        const lr = cur.row + dir.row * 2;
        const lc = cur.col + dir.col * 2;

        if (lr < 0 || lr >= size || lc < 0 || lc >= size) continue;
        const enemyKey = `${er},${ec}`;
        if (capturedSet.has(enemyKey)) continue;

        const targetPiece = workBoard[er][ec];
        if (!targetPiece || pieceOwner(targetPiece) !== enemySide) continue;
        if (workBoard[lr][lc] !== null) continue;

        foundContinuation = true;
        const nextCoord = { row: lr, col: lc };
        const nextPath = [...path, nextCoord];
        const nextCaptured = [...captured, { row: er, col: ec }];
        capturedSet.add(enemyKey);

        const hitsPromoRow = !isKing && isPromotionRow(lr, side, size);

        if (!rules.multipleCaptures) {
          results.push({
            from: origin,
            to: nextCoord,
            path: nextPath,
            captured: nextCaptured,
            promoted: hitsPromoRow,
            notation: formatMoveNotation(origin, nextPath, true, size),
            isCapture: true,
          });
        } else if (hitsPromoRow && rules.promotionMode === 'immediate_stop') {
          // English Draughts: man promotes on back rank and turn immediately stops
          results.push({
            from: origin,
            to: nextCoord,
            path: nextPath,
            captured: nextCaptured,
            promoted: true,
            notation: formatMoveNotation(origin, nextPath, true, size),
            isCapture: true,
          });
        } else if (hitsPromoRow && rules.promotionMode === 'immediate_continue') {
          dfs(nextCoord, true, nextPath, nextCaptured, capturedSet, workBoard);
        } else {
          // end_of_turn_only (International) or not on promo row
          dfs(nextCoord, isKing, nextPath, nextCaptured, capturedSet, workBoard);
        }

        capturedSet.delete(enemyKey);
      }
    }

    if (!foundContinuation && captured.length > 0) {
      const finalSquare = path[path.length - 1];
      const promoted =
        !initialIsKing &&
        (isKing || isPromotionRow(finalSquare.row, side, size));
      results.push({
        from: origin,
        to: finalSquare,
        path,
        captured,
        promoted,
        notation: formatMoveNotation(origin, path, true, size),
        isCapture: true,
      });
    }
  }

  // Temporarily lift moving piece from origin so flying king or looping captures can pass over origin square
  const movingPiece = board[origin.row][origin.col];
  const workBoard = cloneBoard(board);
  workBoard[origin.row][origin.col] = null;

  dfs(origin, initialIsKing, [], [], new Set<string>(), workBoard);

  // Restore origin on workBoard (unused after)
  workBoard[origin.row][origin.col] = movingPiece;

  return results;
}

/**
 * Validates whether a candidate move matches one of the legal moves in the current game state.
 */
export function validateMove(state: GameState, candidate: { from: Coord; path: Coord[] } | DraughtsMove): DraughtsMove | null {
  if (state.status !== 'playing') return null;
  const legal = generateLegalMoves(state.board, state.turn, state.rules);
  return (
    legal.find((m) => {
      if (m.from.row !== candidate.from.row || m.from.col !== candidate.from.col) return false;
      if (m.path.length !== candidate.path.length) return false;
      return m.path.every((sq, i) => sq.row === candidate.path[i].row && sq.col === candidate.path[i].col);
    }) ?? null
  );
}

/**
 * Applies a validated move and returns the next immutable GameState.
 */
export function applyMove(state: GameState, move: DraughtsMove): GameState {
  const legalMove = validateMove(state, move);
  if (!legalMove) {
    throw new Error(`Illegal move attempted: ${move.notation}`);
  }

  const nextBoard = cloneBoard(state.board);
  const movingPiece = nextBoard[legalMove.from.row][legalMove.from.col];
  if (!movingPiece) {
    throw new Error('Source square has no piece');
  }

  const isMan = !isKingPiece(movingPiece);
  nextBoard[legalMove.from.row][legalMove.from.col] = null;

  for (const cap of legalMove.captured) {
    nextBoard[cap.row][cap.col] = null;
  }

  let finalPiece: PieceCode = movingPiece;
  if (legalMove.promoted) {
    finalPiece = state.turn === 'white' ? 'W' : 'B';
  }
  nextBoard[legalMove.to.row][legalMove.to.col] = finalPiece;

  const nextTurn = oppositeSide(state.turn);
  const nextMoveCount = state.moveCount + 1;
  const nextNoProgress = legalMove.isCapture || isMan ? 0 : state.noProgressCount + 1;

  const compressed = compressBoard(nextBoard, state.boardSize);
  const posKey = `${nextTurn}:${compressed}`;
  const nextPosCounts = {
    ...state.positionCounts,
    [posKey]: (state.positionCounts[posKey] ?? 0) + 1,
  };

  const record: MoveRecord = {
    ply: nextMoveCount,
    side: state.turn,
    move: legalMove,
    boardCompressed: compressed,
    timestamp: Date.now(),
  };

  let status: GameState['status'] = 'playing';
  let endReason: GameState['endReason'];

  // Check opponent piece count and legal moves
  let opponentPieces = 0;
  for (let r = 0; r < state.boardSize; r++) {
    for (let c = 0; c < state.boardSize; c++) {
      if (pieceOwner(nextBoard[r][c]) === nextTurn) {
        opponentPieces++;
      }
    }
  }

  if (opponentPieces === 0) {
    status = state.turn === 'white' ? 'white_won' : 'black_won';
    endReason = 'no_pieces';
  } else {
    const oppMoves = generateLegalMoves(nextBoard, nextTurn, state.rules);
    if (oppMoves.length === 0) {
      status = state.turn === 'white' ? 'white_won' : 'black_won';
      endReason = 'no_legal_moves';
    } else if (nextPosCounts[posKey] >= 3) {
      status = 'draw';
      endReason = 'threefold_repetition';
    } else if (nextNoProgress >= state.rules.drawNoProgressMoves) {
      status = 'draw';
      endReason = 'fifty_move_rule';
    }
  }

  return {
    boardSize: state.boardSize,
    board: nextBoard,
    initialBoardCompressed: state.initialBoardCompressed ?? compressBoard(state.board, state.boardSize),
    initialTurn: state.initialTurn ?? state.turn,
    turn: nextTurn,
    rules: state.rules,
    moveCount: nextMoveCount,
    noProgressCount: nextNoProgress,
    positionCounts: nextPosCounts,
    status,
    endReason,
    history: [...state.history, record],
  };
}

/**
 * Applies a move on a raw board in-place or cloned (fast path for AI search).
 */
export function applyMoveFast(board: PieceCode[][], move: DraughtsMove, side: PlayerSide): PieceCode[][] {
  const next = cloneBoard(board);
  const p = next[move.from.row][move.from.col];
  next[move.from.row][move.from.col] = null;
  for (let i = 0; i < move.captured.length; i++) {
    const cap = move.captured[i];
    next[cap.row][cap.col] = null;
  }
  next[move.to.row][move.to.col] = move.promoted ? (side === 'white' ? 'W' : 'B') : p;
  return next;
}

export function revertLastMove(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const targetPlies = state.history.slice(0, -1);
  let rebuilt: GameState;
  if (state.initialBoardCompressed) {
    const dec = decompressBoard(state.initialBoardCompressed);
    const turn = state.initialTurn ?? state.rules.firstPlayer;
    rebuilt = {
      boardSize: dec.boardSize,
      board: dec.board,
      initialBoardCompressed: state.initialBoardCompressed,
      initialTurn: turn,
      turn,
      rules: { ...state.rules },
      moveCount: 0,
      noProgressCount: 0,
      positionCounts: { [`${turn}:${state.initialBoardCompressed}`]: 1 },
      status: 'playing',
      history: [],
    };
  } else {
    rebuilt = createInitialGameState(state.rules);
  }
  for (const rec of targetPlies) {
    rebuilt = applyMove(rebuilt, rec.move);
  }
  return rebuilt;
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(json: string): GameState {
  const parsed = JSON.parse(json) as GameState;
  if (!parsed || !parsed.board || !parsed.rules) {
    throw new Error('Invalid serialized game state');
  }
  return parsed;
}

export function countPieces(board: PieceCode[][], boardSize: 8 | 10): {
  whiteMen: number;
  whiteKings: number;
  blackMen: number;
  blackKings: number;
} {
  let whiteMen = 0;
  let whiteKings = 0;
  let blackMen = 0;
  let blackKings = 0;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (p === 'w') whiteMen++;
      else if (p === 'W') whiteKings++;
      else if (p === 'b') blackMen++;
      else if (p === 'B') blackKings++;
    }
  }
  return { whiteMen, whiteKings, blackMen, blackKings };
}
