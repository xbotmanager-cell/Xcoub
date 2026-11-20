import '../engine/draughts_engine.dart';
import '../engine/king_movement.dart';
import '../models/game_status.dart';
import '../models/piece_model.dart';

class PositionEvaluator {
  PositionEvaluator._();

  static const int manValue = 100;
  static const int flyingKingValue = 440;
  static const int classicKingValue = 285;

  static int evaluate(GameState state, PlayerSide perspective) {
    if (state.status == GameStatus.whiteWon) {
      return perspective == PlayerSide.white ? 99999 : -99999;
    }
    if (state.status == GameStatus.blackWon) {
      return perspective == PlayerSide.black ? 99999 : -99999;
    }
    if (state.status == GameStatus.draw) return 0;

    final board = state.board;
    final size = board.size;
    final kingWeight =
        state.rules.flyingKings ? flyingKingValue : classicKingValue;

    int whiteScore = 0;
    int blackScore = 0;
    int whiteCount = 0;
    int blackCount = 0;

    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        final p = board.grid[r][c];
        if (p == null) continue;

        final isWhite = p.side == PlayerSide.white;
        if (isWhite) {
          whiteCount++;
        } else {
          blackCount++;
        }

        final centerDist =
            ((r - (size - 1) / 2).abs() + (c - (size - 1) / 2).abs());
        final centerBonus = ((size - centerDist) * 4).round();
        final edgeBonus = (c == 0 || c == size - 1) ? 8 : 0;

        if (p.isKing) {
          var kingPosScore = kingWeight + centerBonus * 2;
          if (state.rules.flyingKings) {
            int mobility = 0;
            for (final d in KingMovement.allDirections) {
              final nr = r + d[0];
              final nc = c + d[1];
              if (board.inBounds(nr, nc) && board.grid[nr][nc] == null) {
                mobility += 7;
              }
            }
            kingPosScore += mobility;
          }
          if (isWhite) {
            whiteScore += kingPosScore;
          } else {
            blackScore += kingPosScore;
          }
        } else {
          final advance = isWhite ? (size - 1 - r) : r;
          final backRankGuard =
              (isWhite && r == size - 1) || (!isWhite && r == 0) ? 14 : 0;
          final totalMan =
              manValue + advance * 5 + centerBonus + edgeBonus + backRankGuard;
          if (isWhite) {
            whiteScore += totalMan;
          } else {
            blackScore += totalMan;
          }
        }
      }
    }

    // Endgame tempo bonus when few pieces remain
    if (whiteCount + blackCount <= 8 && whiteCount != blackCount) {
      if (whiteCount > blackCount) {
        whiteScore += (whiteCount - blackCount) * 28;
      } else {
        blackScore += (blackCount - whiteCount) * 28;
      }
    }

    final diff = whiteScore - blackScore;
    return perspective == PlayerSide.white ? diff : -diff;
  }
}
