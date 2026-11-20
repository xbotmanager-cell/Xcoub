import '../models/board_coord.dart';
import '../models/piece_model.dart';
import '../models/rule_config.dart';
import 'board_state.dart';

class KingCaptureOption {
  const KingCaptureOption({
    required this.capturedSquare,
    required this.landingSquare,
  });

  final BoardCoord capturedSquare;
  final BoardCoord landingSquare;
}

class KingMovement {
  KingMovement._();

  static const List<List<int>> allDirections = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  /// Generates all legal quiet destination squares for a King.
  /// Supports long-range Flying Kings when [rules.flyingKings] is true.
  static List<BoardCoord> generateQuietTargets(
    BoardState board,
    BoardCoord from,
    RuleConfig rules,
  ) {
    final targets = <BoardCoord>[];
    final maxSteps = rules.flyingKings ? board.size : 1;

    for (final dir in allDirections) {
      for (int step = 1; step <= maxSteps; step++) {
        final nr = from.row + dir[0] * step;
        final nc = from.col + dir[1] * step;
        if (!board.inBounds(nr, nc)) break;
        if (board.grid[nr][nc] != null)
          break; // Blocked by friendly or enemy piece
        targets.add(BoardCoord(nr, nc));
      }
    }
    return targets;
  }

  /// Generates all single-jump capture options for a King from [from].
  /// For Flying Kings, scans along each diagonal past empty squares until hitting
  /// an enemy piece, then returns every valid empty landing square behind it
  /// (stopping if another piece or board edge blocks further flight).
  static List<KingCaptureOption> generateSingleCaptures(
    BoardState board,
    BoardCoord from,
    PlayerSide side,
    Set<String> alreadyCaptured,
    RuleConfig rules,
  ) {
    final options = <KingCaptureOption>[];

    if (rules.flyingKings) {
      for (final dir in allDirections) {
        BoardCoord? enemySquare;
        for (int step = 1; step < board.size; step++) {
          final nr = from.row + dir[0] * step;
          final nc = from.col + dir[1] * step;
          if (!board.inBounds(nr, nc)) break;

          final occupant = board.grid[nr][nc];
          final key = '$nr,$nc';

          if (enemySquare == null) {
            if (occupant == null) continue;
            if (occupant.side == side) break; // Friendly piece blocks ray
            if (alreadyCaptured.contains(key))
              break; // Already jumped in this chain
            enemySquare = BoardCoord(nr, nc);
          } else {
            if (occupant != null) break; // Blocked beyond enemy piece
            options.add(
              KingCaptureOption(
                capturedSquare: enemySquare,
                landingSquare: BoardCoord(nr, nc),
              ),
            );
          }
        }
      }
    } else {
      for (final dir in allDirections) {
        final mr = from.row + dir[0];
        final mc = from.col + dir[1];
        final lr = from.row + dir[0] * 2;
        final lc = from.col + dir[1] * 2;
        if (!board.inBounds(lr, lc)) continue;
        final mid = board.grid[mr][mc];
        final key = '$mr,$mc';
        if (mid != null &&
            mid.side != side &&
            !alreadyCaptured.contains(key) &&
            board.grid[lr][lc] == null) {
          options.add(
            KingCaptureOption(
              capturedSquare: BoardCoord(mr, mc),
              landingSquare: BoardCoord(lr, lc),
            ),
          );
        }
      }
    }

    return options;
  }
}
