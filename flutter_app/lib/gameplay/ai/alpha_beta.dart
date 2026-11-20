import 'dart:math';

import '../engine/draughts_engine.dart';
import '../models/draughts_move.dart';
import '../models/game_status.dart';
import '../models/piece_model.dart';
import 'position_evaluator.dart';

class _TtEntry {
  _TtEntry(this.depth, this.score, this.flag, this.bestNotation);
  final int depth;
  final int score;
  final int flag; // 0 = exact, 1 = lower, 2 = upper
  final String? bestNotation;
}

class SearchContext {
  SearchContext({
    required this.rootSide,
    required this.useQuiescence,
    required this.useTransposition,
    required this.usePvs,
    required this.deadlineMs,
  });

  final PlayerSide rootSide;
  final bool useQuiescence;
  final bool useTransposition;
  final bool usePvs;
  final int deadlineMs;

  int nodesVisited = 0;
  bool aborted = false;
  final Map<int, _TtEntry> tt = {};
  final Map<String, int> historyHeuristic = {};

  static final List<List<int>> _zobristTable = _buildZobrist();

  static List<List<int>> _buildZobrist() {
    final rng = Random(0x5F3759DF);
    return List<List<int>>.generate(
      100,
      (_) => List<int>.generate(4, (_) => rng.nextInt(1 << 30)),
    );
  }

  int hashState(GameState state) {
    int h = state.turn == PlayerSide.white ? 0x1A2B3C4D : 0x5E6F7A8B;
    final size = state.board.size;
    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        final p = state.board.grid[r][c];
        if (p == null) continue;
        final idx = p.side == PlayerSide.white
            ? (p.isKing ? 1 : 0)
            : (p.isKing ? 3 : 2);
        h ^= _zobristTable[r * size + c][idx];
      }
    }
    return h;
  }
}

class AlphaBetaSearch {
  AlphaBetaSearch._();

  static List<DraughtsMove> orderMoves(
    List<DraughtsMove> moves,
    String? ttBest,
    SearchContext ctx,
  ) {
    final copy = List<DraughtsMove>.from(moves);
    copy.sort((a, b) {
      if (ttBest != null) {
        if (a.notation == ttBest && b.notation != ttBest) return -1;
        if (b.notation == ttBest && a.notation != ttBest) return 1;
      }
      final capDiff = b.captured.length.compareTo(a.captured.length);
      if (capDiff != 0) return capDiff;
      if (a.promoted != b.promoted) return a.promoted ? -1 : 1;
      final hb = ctx.historyHeuristic[b.notation] ?? 0;
      final ha = ctx.historyHeuristic[a.notation] ?? 0;
      return hb.compareTo(ha);
    });
    return copy;
  }

  static int quiescence(
    GameState state,
    int alpha,
    int beta,
    int qDepth,
    SearchContext ctx,
  ) {
    ctx.nodesVisited++;
    if ((ctx.nodesVisited & 511) == 0 &&
        DateTime.now().millisecondsSinceEpoch >= ctx.deadlineMs) {
      ctx.aborted = true;
      return PositionEvaluator.evaluate(state, state.turn);
    }

    final standPat = PositionEvaluator.evaluate(state, state.turn);
    if (qDepth <= 0 || state.status != GameStatus.playing) return standPat;

    if (standPat >= beta) return beta;
    var curAlpha = max(alpha, standPat);

    final captures = DraughtsEngine.generateLegalMoves(state)
        .where((m) => m.isCapture)
        .toList(growable: false);
    if (captures.isEmpty) return curAlpha;

    final ordered = orderMoves(captures, null, ctx);
    for (final move in ordered) {
      final child = DraughtsEngine.applyMove(state, move);
      final score = -quiescence(child, -beta, -curAlpha, qDepth - 1, ctx);
      if (ctx.aborted) return curAlpha;
      if (score >= beta) return beta;
      if (score > curAlpha) curAlpha = score;
    }
    return curAlpha;
  }

  static int negamax(
    GameState state,
    int depth,
    int alpha,
    int beta,
    SearchContext ctx,
  ) {
    ctx.nodesVisited++;
    if ((ctx.nodesVisited & 511) == 0 &&
        DateTime.now().millisecondsSinceEpoch >= ctx.deadlineMs) {
      ctx.aborted = true;
      return PositionEvaluator.evaluate(state, state.turn);
    }

    if (state.status != GameStatus.playing) {
      return PositionEvaluator.evaluate(state, state.turn);
    }

    if (depth <= 0) {
      return ctx.useQuiescence
          ? quiescence(state, alpha, beta, 4, ctx)
          : PositionEvaluator.evaluate(state, state.turn);
    }

    final hash = ctx.useTransposition ? ctx.hashState(state) : 0;
    String? ttBest;
    if (ctx.useTransposition) {
      final entry = ctx.tt[hash];
      if (entry != null) {
        ttBest = entry.bestNotation;
        if (entry.depth >= depth) {
          if (entry.flag == 0) return entry.score;
          if (entry.flag == 1 && entry.score > alpha) alpha = entry.score;
          if (entry.flag == 2 && entry.score < beta) beta = entry.score;
          if (alpha >= beta) return entry.score;
        }
      }
    }

    final legal = DraughtsEngine.generateLegalMoves(state);
    if (legal.isEmpty) return -99999;

    final ordered = orderMoves(legal, ttBest, ctx);
    final origAlpha = alpha;
    var bestScore = -1000000;
    String? bestNotation;

    for (int i = 0; i < ordered.length; i++) {
      final move = ordered[i];
      final child = DraughtsEngine.applyMove(state, move);

      int score;
      if (ctx.usePvs && i > 0) {
        score = -negamax(child, depth - 1, -alpha - 1, -alpha, ctx);
        if (!ctx.aborted && score > alpha && score < beta) {
          score = -negamax(child, depth - 1, -beta, -alpha, ctx);
        }
      } else {
        score = -negamax(child, depth - 1, -beta, -alpha, ctx);
      }

      if (ctx.aborted) return bestScore == -1000000 ? alpha : bestScore;

      if (score > bestScore) {
        bestScore = score;
        bestNotation = move.notation;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        ctx.historyHeuristic[move.notation] =
            (ctx.historyHeuristic[move.notation] ?? 0) + depth * depth;
        break;
      }
    }

    if (ctx.useTransposition && !ctx.aborted) {
      final flag = bestScore <= origAlpha ? 2 : (bestScore >= beta ? 1 : 0);
      ctx.tt[hash] = _TtEntry(depth, bestScore, flag, bestNotation);
    }

    return bestScore;
  }
}
