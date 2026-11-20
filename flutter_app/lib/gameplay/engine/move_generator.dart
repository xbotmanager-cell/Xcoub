import '../models/board_coord.dart';
import '../models/draughts_move.dart';
import '../models/piece_model.dart';
import '../models/rule_config.dart';
import 'board_state.dart';
import 'capture_generator.dart';
import 'game_rules.dart';
import 'king_movement.dart';

class MoveGenerator {
  MoveGenerator._();

  static String formatNotation(
    BoardState board,
    BoardCoord from,
    List<BoardCoord> path,
    bool isCapture,
  ) {
    final sep = isCapture ? '×' : '-';
    final squares = [
      board.coordToSquareNumber(from),
      ...path.map(board.coordToSquareNumber),
    ];
    return squares.join(sep);
  }

  static List<DraughtsMove> generateLegalMoves(
    BoardState board,
    PlayerSide turn,
    RuleConfig rules,
  ) {
    final captureMoves = <DraughtsMove>[];
    final quietMoves = <DraughtsMove>[];

    for (int r = 0; r < board.size; r++) {
      for (int c = 0; c < board.size; c++) {
        final piece = board.grid[r][c];
        if (piece == null || piece.side != turn) continue;
        final from = BoardCoord(r, c);

        final sequences =
            CaptureGenerator.findSequencesForPiece(board, from, piece, rules);
        for (final seq in sequences) {
          captureMoves.add(
            DraughtsMove(
              from: from,
              to: seq.path.last,
              path: seq.path,
              captured: seq.captured,
              promoted: seq.promoted,
              notation: formatNotation(board, from, seq.path, true),
            ),
          );
        }

        if (captureMoves.isEmpty || !rules.mandatoryCapture) {
          if (piece.isKing) {
            final targets =
                KingMovement.generateQuietTargets(board, from, rules);
            for (final to in targets) {
              quietMoves.add(
                DraughtsMove(
                  from: from,
                  to: to,
                  path: [to],
                  captured: const [],
                  promoted: false,
                  notation: formatNotation(board, from, [to], false),
                ),
              );
            }
          } else {
            final forwardDir = turn == PlayerSide.white ? -1 : 1;
            for (final dc in const [-1, 1]) {
              final nr = r + forwardDir;
              final nc = c + dc;
              if (board.inBounds(nr, nc) && board.grid[nr][nc] == null) {
                final to = BoardCoord(nr, nc);
                final promoted = GameRules.isPromotionRow(nr, turn, board.size);
                quietMoves.add(
                  DraughtsMove(
                    from: from,
                    to: to,
                    path: [to],
                    captured: const [],
                    promoted: promoted,
                    notation: formatNotation(board, from, [to], false),
                  ),
                );
              }
            }
          }
        }
      }
    }

    if (captureMoves.isNotEmpty) {
      var filteredCaptures = captureMoves;
      if (rules.maximumCapture) {
        int maxLen = 0;
        for (final m in captureMoves) {
          if (m.captured.length > maxLen) maxLen = m.captured.length;
        }
        filteredCaptures = captureMoves
            .where((m) => m.captured.length == maxLen)
            .toList(growable: false);
      }
      if (rules.mandatoryCapture) {
        return filteredCaptures;
      }
      return [...filteredCaptures, ...quietMoves];
    }

    return quietMoves;
  }
}
