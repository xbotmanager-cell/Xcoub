import '../models/board_coord.dart';
import '../models/draughts_move.dart';
import '../models/game_status.dart';
import 'draughts_engine.dart';
import 'move_generator.dart';

class GameValidator {
  GameValidator._();

  static DraughtsMove? validateMove(
    GameState state, {
    required BoardCoord from,
    required List<BoardCoord> path,
  }) {
    if (state.status != GameStatus.playing || path.isEmpty) return null;
    final legal =
        MoveGenerator.generateLegalMoves(state.board, state.turn, state.rules);
    for (final m in legal) {
      if (m.from != from) continue;
      if (m.path.length != path.length) continue;
      bool matches = true;
      for (int i = 0; i < path.length; i++) {
        if (m.path[i] != path[i]) {
          matches = false;
          break;
        }
      }
      if (matches) return m;
    }
    return null;
  }
}
