import '../models/board_coord.dart';
import '../models/piece_model.dart';
import '../models/rule_config.dart';
import 'board_state.dart';
import 'game_rules.dart';
import 'king_movement.dart';

class CaptureSequence {
  const CaptureSequence({
    required this.path,
    required this.captured,
    required this.promoted,
  });

  final List<BoardCoord> path;
  final List<BoardCoord> captured;
  final bool promoted;
}

class CaptureGenerator {
  CaptureGenerator._();

  static List<CaptureSequence> findSequencesForPiece(
    BoardState board,
    BoardCoord origin,
    DraughtsPiece piece,
    RuleConfig rules,
  ) {
    final working = board.clone();
    working.grid[origin.row][origin.col] = null;
    final results = <CaptureSequence>[];

    void dfs(
      BoardCoord pos,
      bool isKing,
      List<BoardCoord> path,
      List<BoardCoord> captured,
      Set<String> capturedKeys,
      bool promotedSoFar,
    ) {
      final singleSteps = <_StepOption>[];

      if (isKing) {
        final kingCaps = KingMovement.generateSingleCaptures(
          working,
          pos,
          piece.side,
          capturedKeys,
          rules,
        );
        for (final k in kingCaps) {
          singleSteps.add(
            _StepOption(
              capturedSquare: k.capturedSquare,
              landingSquare: k.landingSquare,
            ),
          );
        }
      } else {
        final forwardRow = piece.side == PlayerSide.white ? -1 : 1;
        final dirs = rules.menCaptureBackward
            ? KingMovement.allDirections
            : [
                [forwardRow, -1],
                [forwardRow, 1],
              ];
        for (final dir in dirs) {
          final mr = pos.row + dir[0];
          final mc = pos.col + dir[1];
          final lr = pos.row + dir[0] * 2;
          final lc = pos.col + dir[1] * 2;
          if (!working.inBounds(lr, lc)) continue;
          final mid = working.grid[mr][mc];
          final key = '$mr,$mc';
          if (mid != null &&
              mid.side != piece.side &&
              !capturedKeys.contains(key) &&
              working.grid[lr][lc] == null) {
            singleSteps.add(
              _StepOption(
                capturedSquare: BoardCoord(mr, mc),
                landingSquare: BoardCoord(lr, lc),
              ),
            );
          }
        }
      }

      bool extended = false;
      if (rules.multipleCaptures || path.isEmpty) {
        for (final step in singleSteps) {
          final capKey =
              '${step.capturedSquare.row},${step.capturedSquare.col}';
          final nextPath = [...path, step.landingSquare];
          final nextCaptured = [...captured, step.capturedSquare];
          final nextKeys = {...capturedKeys, capKey};

          final reachesBackRank =
              !isKing &&
              GameRules.isPromotionRow(
                step.landingSquare.row,
                piece.side,
                working.size,
              );

          if (reachesBackRank && rules.promotionMode == PromotionMode.immediateStop) {
            results.add(
              CaptureSequence(
                path: nextPath,
                captured: nextCaptured,
                promoted: true,
              ),
            );
            extended = true;
            continue;
          }

          if (rules.multipleCaptures) {
            final beforeLen = results.length;
            dfs(
              step.landingSquare,
              isKing,
              nextPath,
              nextCaptured,
              nextKeys,
              promotedSoFar,
            );
            if (results.length > beforeLen) {
              extended = true;
              continue;
            }
          }

          final promotedAtEnd = !isKing &&
              GameRules.isPromotionRow(
                step.landingSquare.row,
                piece.side,
                working.size,
              );
          results.add(
            CaptureSequence(
              path: nextPath,
              captured: nextCaptured,
              promoted: promotedAtEnd,
            ),
          );
          extended = true;
        }
      }

      if (!extended && path.isNotEmpty) {
        final endPos = path.last;
        final promotedAtEnd = !isKing &&
            GameRules.isPromotionRow(endPos.row, piece.side, working.size);
        results.add(
          CaptureSequence(
            path: path,
            captured: captured,
            promoted: promotedSoFar || promotedAtEnd,
          ),
        );
      }
    }

    dfs(origin, piece.isKing, const [], const [], <String>{}, false);
    return results;
  }
}

class _StepOption {
  const _StepOption({
    required this.capturedSquare,
    required this.landingSquare,
  });

  final BoardCoord capturedSquare;
  final BoardCoord landingSquare;
}
