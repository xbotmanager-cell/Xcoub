import 'dart:isolate';

import '../engine/draughts_engine.dart';
import 'minimax.dart';

class AiEngine {
  AiEngine._();

  /// Computes the best move off the UI thread using Dart Isolate.run
  /// so animations and frame rate stay silky-smooth even in Master/Legendary mode.
  static Future<AiAnalysisResult> findBestMove(
    GameState state,
    AiDifficulty difficulty,
  ) async {
    return Isolate.run(() => MinimaxSearch.findBestMove(state, difficulty));
  }

  /// Synchronous search entry point for unit tests and lightweight checks.
  static AiAnalysisResult findBestMoveSync(
    GameState state,
    AiDifficulty difficulty,
  ) {
    return MinimaxSearch.findBestMove(state, difficulty);
  }
}
