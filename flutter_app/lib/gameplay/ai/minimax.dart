import 'dart:math';

import '../engine/draughts_engine.dart';
import '../models/draughts_move.dart';
import '../models/game_status.dart';
import 'alpha_beta.dart';

enum AiDifficulty {
  beginner(1, 'Beginner', 650, 1, 80, 150, false, false, false),
  easy(2, 'Easy', 900, 2, 140, 80, false, false, false),
  normal(3, 'Normal', 1150, 3, 220, 35, true, true, false),
  medium(4, 'Medium', 1400, 4, 360, 12, true, true, false),
  hard(5, 'Hard', 1680, 5, 600, 4, true, true, true),
  expert(6, 'Expert', 1950, 6, 950, 0, true, true, true),
  master(7, 'Master', 2220, 8, 1500, 0, true, true, true),
  legendary(8, 'Legendary', 2550, 10, 2400, 0, true, true, true);

  const AiDifficulty(
    this.level,
    this.label,
    this.eloEstimate,
    this.maxDepth,
    this.timeBudgetMs,
    this.randomnessCp,
    this.useQuiescence,
    this.useTransposition,
    this.usePvs,
  );

  final int level;
  final String label;
  final int eloEstimate;
  final int maxDepth;
  final int timeBudgetMs;
  final int randomnessCp;
  final bool useQuiescence;
  final bool useTransposition;
  final bool usePvs;
}

class AiAnalysisResult {
  const AiAnalysisResult({
    required this.bestMove,
    required this.scoreCp,
    required this.depthReached,
    required this.nodesEvaluated,
  });

  final DraughtsMove? bestMove;
  final int scoreCp;
  final int depthReached;
  final int nodesEvaluated;
}

class MinimaxSearch {
  MinimaxSearch._();

  static AiAnalysisResult findBestMove(
    GameState state,
    AiDifficulty difficulty,
  ) {
    if (state.status != GameStatus.playing) {
      return const AiAnalysisResult(
        bestMove: null,
        scoreCp: 0,
        depthReached: 0,
        nodesEvaluated: 0,
      );
    }

    final legal = DraughtsEngine.generateLegalMoves(state);
    if (legal.isEmpty) {
      return const AiAnalysisResult(
        bestMove: null,
        scoreCp: 0,
        depthReached: 0,
        nodesEvaluated: 0,
      );
    }

    if (legal.length == 1) {
      return AiAnalysisResult(
        bestMove: legal.first,
        scoreCp: 0,
        depthReached: 1,
        nodesEvaluated: 1,
      );
    }

    final deadline =
        DateTime.now().millisecondsSinceEpoch + difficulty.timeBudgetMs;
    final ctx = SearchContext(
      rootSide: state.turn,
      useQuiescence: difficulty.useQuiescence,
      useTransposition: difficulty.useTransposition,
      usePvs: difficulty.usePvs,
      deadlineMs: deadline,
    );

    var bestMove = legal.first;
    var bestScore = 0;
    var depthReached = 1;
    final rng = Random();

    for (int depth = 1; depth <= difficulty.maxDepth; depth++) {
      var iterBestMove = legal.first;
      var iterBestScore = -1000000;
      var alpha = -1000000;
      const beta = 1000000;

      final ordered = AlphaBetaSearch.orderMoves(
        legal,
        depth > 1 ? bestMove.notation : null,
        ctx,
      );

      for (final move in ordered) {
        final child = DraughtsEngine.applyMove(state, move);
        final rawScore =
            -AlphaBetaSearch.negamax(child, depth - 1, -beta, -alpha, ctx);
        if (ctx.aborted) break;

        final jitter = difficulty.randomnessCp > 0
            ? rng.nextInt(difficulty.randomnessCp * 2 + 1) -
                difficulty.randomnessCp
            : 0;
        final score = rawScore + jitter;

        if (score > iterBestScore) {
          iterBestScore = score;
          iterBestMove = move;
        }
        if (score > alpha) alpha = score;
      }

      if (ctx.aborted) break;
      bestMove = iterBestMove;
      bestScore = iterBestScore;
      depthReached = depth;

      if (bestScore.abs() >= 90000) break;
    }

    return AiAnalysisResult(
      bestMove: bestMove,
      scoreCp: bestScore,
      depthReached: depthReached,
      nodesEvaluated: ctx.nodesVisited,
    );
  }
}
