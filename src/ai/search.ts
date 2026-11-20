import { AI_DIFFICULTIES } from '../engine/presets.ts';
import {
  applyMoveFast,
  generateLegalMoves,
  isKingPiece,
  oppositeSide,
} from '../engine/rules.ts';
import type {
  AIAnalysisResult,
  AIDifficultyId,
  DraughtsMove,
  GameState,
  PieceCode,
  PlayerSide,
  RuleConfig,
} from '../engine/types.ts';
import { computeZobristHash } from '../engine/zobrist.ts';
import { describeTacticalMove, evaluatePosition } from './evaluate.ts';

const INF = 1_000_000;
const WIN_SCORE = 500_000;

const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

interface TTEntry {
  depth: number;
  score: number;
  flag: number;
  bestNotation: string | null;
}

class SearchContext {
  nodes = 0;
  deadline = 0;
  aborted = false;
  tt = new Map<string, TTEntry>();
  killers: Map<number, string[]> = new Map();
  history: Map<string, number> = new Map();
  rules: RuleConfig;
  useQuiescence: boolean;
  useTransposition: boolean;
  usePVS: boolean;

  constructor(
    rules: RuleConfig,
    deadline: number,
    useQuiescence: boolean,
    useTransposition: boolean,
    usePVS: boolean
  ) {
    this.rules = rules;
    this.deadline = deadline;
    this.useQuiescence = useQuiescence;
    this.useTransposition = useTransposition;
    this.usePVS = usePVS;
  }

  checkTime(): boolean {
    if (this.aborted) return true;
    if ((this.nodes & 511) === 0 && Date.now() >= this.deadline) {
      this.aborted = true;
      return true;
    }
    return false;
  }
}

function orderMoves(
  moves: DraughtsMove[],
  ttBest: string | null,
  ply: number,
  ctx: SearchContext
): DraughtsMove[] {
  const killers = ctx.killers.get(ply) ?? [];
  return moves.slice().sort((a, b) => {
    const sa = scoreMoveForOrdering(a, ttBest, killers, ctx);
    const sb = scoreMoveForOrdering(b, ttBest, killers, ctx);
    return sb - sa;
  });
}

function scoreMoveForOrdering(
  move: DraughtsMove,
  ttBest: string | null,
  killers: string[],
  ctx: SearchContext
): number {
  if (ttBest && move.notation === ttBest) return 100_000;
  let score = 0;
  if (move.isCapture) score += 20_000 + move.captured.length * 1000;
  if (move.promoted) score += 8_000;
  if (killers[0] === move.notation) score += 5_000;
  else if (killers[1] === move.notation) score += 4_000;
  score += ctx.history.get(move.notation) ?? 0;
  return score;
}

function quiescence(
  board: PieceCode[][],
  side: PlayerSide,
  alpha: number,
  beta: number,
  qDepth: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if (ctx.checkTime()) return 0;

  const standPat = evaluatePosition(board, side, ctx.rules);
  if (qDepth >= 4) return standPat;

  const legal = generateLegalMoves(board, side, ctx.rules);
  if (legal.length === 0) {
    return -WIN_SCORE + 50;
  }

  const captureMoves = legal.filter((m) => m.isCapture);
  // If mandatory capture is active and captures exist, standPat is not guaranteed
  if (captureMoves.length === 0) {
    return standPat;
  }

  let best = standPat;
  if (!ctx.rules.mandatoryCapture) {
    if (best >= beta) return beta;
    if (best > alpha) alpha = best;
  } else {
    best = -INF;
  }

  const ordered = captureMoves.sort((a, b) => b.captured.length - a.captured.length);
  const nextSide = oppositeSide(side);

  for (const move of ordered) {
    const nextBoard = applyMoveFast(board, move, side);
    const score = -quiescence(nextBoard, nextSide, -beta, -alpha, qDepth + 1, ctx);
    if (ctx.aborted) return 0;

    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  return best;
}

function negamax(
  board: PieceCode[][],
  side: PlayerSide,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if (ctx.checkTime()) return 0;

  const alphaOrig = alpha;
  const hash = ctx.useTransposition ? computeZobristHash(board, ctx.rules.boardSize, side) : '';
  let ttBest: string | null = null;

  if (ctx.useTransposition) {
    const entry = ctx.tt.get(hash);
    if (entry) {
      ttBest = entry.bestNotation;
      if (entry.depth >= depth) {
        if (entry.flag === TT_EXACT) return entry.score;
        if (entry.flag === TT_LOWER) alpha = Math.max(alpha, entry.score);
        else if (entry.flag === TT_UPPER) beta = Math.min(beta, entry.score);
        if (alpha >= beta) return entry.score;
      }
    }
  }

  const legal = generateLegalMoves(board, side, ctx.rules);
  if (legal.length === 0) {
    return -WIN_SCORE + ply;
  }

  if (depth <= 0) {
    if (ctx.useQuiescence) {
      return quiescence(board, side, alpha, beta, 0, ctx);
    }
    return evaluatePosition(board, side, ctx.rules);
  }

  const ordered = orderMoves(legal, ttBest, ply, ctx);
  const nextSide = oppositeSide(side);

  let bestScore = -INF;
  let bestMoveNotation: string | null = ordered[0]?.notation ?? null;

  for (let i = 0; i < ordered.length; i++) {
    const move = ordered[i];
    const nextBoard = applyMoveFast(board, move, side);

    let score: number;
    if (ctx.usePVS && i > 0) {
      // Null-window Principal Variation Search
      score = -negamax(nextBoard, nextSide, depth - 1, ply + 1, -alpha - 1, -alpha, ctx);
      if (!ctx.aborted && score > alpha && score < beta) {
        score = -negamax(nextBoard, nextSide, depth - 1, ply + 1, -beta, -alpha, ctx);
      }
    } else {
      score = -negamax(nextBoard, nextSide, depth - 1, ply + 1, -beta, -alpha, ctx);
    }

    if (ctx.aborted) return 0;

    if (score > bestScore) {
      bestScore = score;
      bestMoveNotation = move.notation;
    }
    if (score > alpha) {
      alpha = score;
      if (!move.isCapture) {
        ctx.history.set(move.notation, (ctx.history.get(move.notation) ?? 0) + depth * depth);
      }
    }
    if (alpha >= beta) {
      if (!move.isCapture) {
        const list = ctx.killers.get(ply) ?? [];
        if (list[0] !== move.notation) {
          ctx.killers.set(ply, [move.notation, list[0] ?? '']);
        }
      }
      break;
    }
  }

  if (ctx.useTransposition && !ctx.aborted) {
    let flag = TT_EXACT;
    if (bestScore <= alphaOrig) flag = TT_UPPER;
    else if (bestScore >= beta) flag = TT_LOWER;

    if (ctx.tt.size > 60_000) {
      ctx.tt.clear();
    }
    ctx.tt.set(hash, {
      depth,
      score: bestScore,
      flag,
      bestNotation: bestMoveNotation,
    });
  }

  return bestScore;
}

function extractPV(
  board: PieceCode[][],
  side: PlayerSide,
  rules: RuleConfig,
  tt: Map<string, TTEntry>,
  maxPlies = 6
): string[] {
  const pv: string[] = [];
  let curBoard = board;
  let curSide = side;
  const seen = new Set<string>();

  for (let i = 0; i < maxPlies; i++) {
    const hash = computeZobristHash(curBoard, rules.boardSize, curSide);
    if (seen.has(hash)) break;
    seen.add(hash);

    const entry = tt.get(hash);
    if (!entry?.bestNotation) break;

    const legal = generateLegalMoves(curBoard, curSide, rules);
    const move = legal.find((m) => m.notation === entry.bestNotation);
    if (!move) break;

    pv.push(move.notation);
    curBoard = applyMoveFast(curBoard, move, curSide);
    curSide = oppositeSide(curSide);
  }

  return pv;
}

/**
 * Runs Iterative Deepening Alpha-Beta / PVS search for the given GameState & difficulty.
 */
export function findBestMove(
  state: GameState,
  difficultyId: AIDifficultyId,
  customBudgetMs?: number
): AIAnalysisResult {
  const startMs = Date.now();
  const profile = AI_DIFFICULTIES[difficultyId];
  const legal = generateLegalMoves(state.board, state.turn, state.rules);

  if (legal.length === 0) {
    return {
      bestMove: null,
      scoreCp: -WIN_SCORE,
      whiteEvalCp: state.turn === 'white' ? -WIN_SCORE : WIN_SCORE,
      depthReached: 0,
      nodesAnalyzed: 0,
      elapsedMs: 0,
      principalVariation: [],
      explanation: 'No legal moves available.',
      candidateMoves: [],
    };
  }

  const budget = customBudgetMs ?? profile.timeBudgetMs;
  // Immediate single-move fast path if only 1 legal move exists (still evaluate briefly for UI telemetry)
  const effectiveMaxDepth = legal.length === 1 ? Math.min(2, profile.maxDepth) : profile.maxDepth;
  const deadline = startMs + budget;

  const ctx = new SearchContext(
    state.rules,
    deadline,
    profile.useQuiescence,
    profile.useTransposition,
    profile.usePVS
  );

  let bestMove = legal[0];
  let bestScore = evaluatePosition(state.board, state.turn, state.rules);
  let depthReached = 0;
  let rootCandidateScores: Array<{ move: DraughtsMove; score: number }> = [];

  for (let depth = 1; depth <= effectiveMaxDepth; depth++) {
    ctx.aborted = false;
    const prevBest = bestMove.notation;
    const orderedRoot = orderMoves(legal, prevBest, 0, ctx);
    const nextSide = oppositeSide(state.turn);

    let alpha = -INF;
    const beta = INF;
    let iterBestMove = orderedRoot[0];
    let iterBestScore = -INF;
    const iterCandidates: Array<{ move: DraughtsMove; score: number }> = [];

    for (let i = 0; i < orderedRoot.length; i++) {
      const move = orderedRoot[i];
      const nextBoard = applyMoveFast(state.board, move, state.turn);

      let score: number;
      if (ctx.usePVS && i > 0) {
        score = -negamax(nextBoard, nextSide, depth - 1, 1, -alpha - 1, -alpha, ctx);
        if (!ctx.aborted && score > alpha && score < beta) {
          score = -negamax(nextBoard, nextSide, depth - 1, 1, -beta, -alpha, ctx);
        }
      } else {
        score = -negamax(nextBoard, nextSide, depth - 1, 1, -beta, -alpha, ctx);
      }

      if (ctx.aborted) break;

      iterCandidates.push({ move, score });
      if (score > iterBestScore) {
        iterBestScore = score;
        iterBestMove = move;
      }
      if (score > alpha) {
        alpha = score;
      }
    }

    if (ctx.aborted) {
      break;
    }

    bestMove = iterBestMove;
    bestScore = iterBestScore;
    depthReached = depth;
    rootCandidateScores = iterCandidates.sort((a, b) => b.score - a.score);

    // Store root in TT for PV extraction
    if (ctx.useTransposition) {
      const hash = computeZobristHash(state.board, state.rules.boardSize, state.turn);
      ctx.tt.set(hash, {
        depth,
        score: bestScore,
        flag: TT_EXACT,
        bestNotation: bestMove.notation,
      });
    }

    // Early stop if forced win detected
    if (bestScore > WIN_SCORE - 100) {
      break;
    }
  }

  // Apply controlled imprecision ONLY for lower difficulties (never cheats, always chooses from legal moves)
  if (profile.randomnessCp > 0 && rootCandidateScores.length > 1) {
    const scoredWithNoise = rootCandidateScores.map((c) => ({
      move: c.move,
      noisy: c.score + (Math.random() * 2 - 1) * profile.randomnessCp,
      actual: c.score,
    }));
    scoredWithNoise.sort((a, b) => b.noisy - a.noisy);
    bestMove = scoredWithNoise[0].move;
    bestScore = scoredWithNoise[0].actual;
  }

  const elapsedMs = Math.max(1, Date.now() - startMs);
  const pv = ctx.useTransposition
    ? extractPV(state.board, state.turn, state.rules, ctx.tt, 6)
    : [bestMove.notation];

  if (pv.length === 0) pv.push(bestMove.notation);

  const movingPiece = state.board[bestMove.from.row][bestMove.from.col];
  const isKing = isKingPiece(movingPiece);
  const whiteEvalCp = state.turn === 'white' ? bestScore : -bestScore;

  return {
    bestMove,
    scoreCp: bestScore,
    whiteEvalCp,
    depthReached: Math.max(1, depthReached),
    nodesAnalyzed: ctx.nodes,
    elapsedMs,
    principalVariation: pv,
    explanation: describeTacticalMove(
      bestMove.captured.length,
      bestMove.promoted,
      isKing,
      bestScore,
      state.turn
    ),
    candidateMoves: rootCandidateScores.slice(0, 4).map((c) => ({
      notation: c.move.notation,
      scoreCp: c.score,
    })),
  };
}
