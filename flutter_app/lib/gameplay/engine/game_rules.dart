import '../models/game_status.dart';
import '../models/piece_model.dart';
import '../models/rule_config.dart';
import 'board_state.dart';
import 'move_generator.dart';

class GameRules {
  GameRules._();

  static bool isPromotionRow(int row, PlayerSide side, int boardSize) {
    return side == PlayerSide.white ? row == 0 : row == boardSize - 1;
  }

  static ({GameStatus status, EndReason? reason}) evaluateTerminalStatus({
    required BoardState board,
    required PlayerSide nextTurn,
    required RuleConfig rules,
    required Map<String, int> positionCounts,
    required String nextPositionKey,
    required int noProgressCount,
  }) {
    final counts = board.countPieces();
    if (counts.whiteTotal == 0) {
      return (status: GameStatus.blackWon, reason: EndReason.noPieces);
    }
    if (counts.blackTotal == 0) {
      return (status: GameStatus.whiteWon, reason: EndReason.noPieces);
    }

    final legal = MoveGenerator.generateLegalMoves(board, nextTurn, rules);
    if (legal.isEmpty) {
      return (
        status: nextTurn == PlayerSide.white
            ? GameStatus.blackWon
            : GameStatus.whiteWon,
        reason: EndReason.noMoves,
      );
    }

    if ((positionCounts[nextPositionKey] ?? 0) >= 3) {
      return (status: GameStatus.draw, reason: EndReason.repetition);
    }

    if (noProgressCount >= rules.drawNoProgressMoves) {
      return (status: GameStatus.draw, reason: EndReason.noProgress);
    }

    return (status: GameStatus.playing, reason: null);
  }
}
