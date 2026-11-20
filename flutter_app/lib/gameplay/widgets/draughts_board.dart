import 'package:flutter/material.dart';

import '../../core/services/sound_haptic_service.dart';
import '../../core/theme/app_theme.dart';
import '../engine/draughts_engine.dart';
import '../models/board_coord.dart';
import '../models/draughts_move.dart';
import '../models/piece_model.dart';
import 'draughts_piece.dart';
import 'move_highlighter.dart';

class DraughtsBoardWidget extends StatefulWidget {
  const DraughtsBoardWidget({
    super.key,
    required this.state,
    required this.legalMoves,
    required this.interactive,
    this.allowedSide,
    this.flipped = false,
    this.paletteId = 'walnut',
    this.pieceThemeId = 'ivory_obsidian',
    this.highContrast = false,
    this.showSquareNumbers = true,
    this.highlightLegalMoves = true,
    this.highlightLastMove = true,
    this.animateMoves = true,
    this.glideDurationMs = 220,
    this.reducedMotion = false,
    this.confirmMoves = false,
    this.highlightSquares = const [],
    this.pendingConfirmMove,
    this.onPendingMoveSelected,
    this.onExecuteMove,
  });

  final GameState state;
  final List<DraughtsMove> legalMoves;
  final bool interactive;
  final PlayerSide? allowedSide;
  final bool flipped;
  final String paletteId;
  final String pieceThemeId;
  final bool highContrast;
  final bool showSquareNumbers;
  final bool highlightLegalMoves;
  final bool highlightLastMove;
  final bool animateMoves;
  final int glideDurationMs;
  final bool reducedMotion;
  final bool confirmMoves;
  final List<BoardCoord> highlightSquares;
  final DraughtsMove? pendingConfirmMove;
  final ValueChanged<DraughtsMove?>? onPendingMoveSelected;
  final ValueChanged<DraughtsMove>? onExecuteMove;

  @override
  State<DraughtsBoardWidget> createState() => _DraughtsBoardWidgetState();
}

class _DraughtsBoardWidgetState extends State<DraughtsBoardWidget> {
  BoardCoord? _selected;
  List<BoardCoord> _partialPath = const [];

  @override
  void didUpdateWidget(covariant DraughtsBoardWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.state.moveCount != widget.state.moveCount ||
        oldWidget.state.turn != widget.state.turn) {
      _selected = null;
      _partialPath = const [];
    }
  }

  List<DraughtsMove> get _activeMoves {
    final sel = _selected;
    if (sel == null) return const [];
    return widget.legalMoves.where((m) {
      if (m.from != sel) return false;
      if (_partialPath.length > m.path.length) return false;
      for (int i = 0; i < _partialPath.length; i++) {
        if (m.path[i] != _partialPath[i]) return false;
      }
      return true;
    }).toList(growable: false);
  }

  Map<BoardCoord, ({bool isCapture, DraughtsMove? completes})>
      get _nextStepTargets {
    final stepIdx = _partialPath.length;
    final map = <BoardCoord, ({bool isCapture, DraughtsMove? completes})>{};
    for (final m in _activeMoves) {
      if (stepIdx >= m.path.length) continue;
      final target = m.path[stepIdx];
      final isFinal = m.path.length == stepIdx + 1;
      map.putIfAbsent(
        target,
        () => (isCapture: m.isCapture, completes: isFinal ? m : null),
      );
    }
    return map;
  }

  Map<BoardCoord, List<DraughtsMove>> get _directFinalMoves {
    final map = <BoardCoord, List<DraughtsMove>>{};
    for (final m in _activeMoves) {
      map.putIfAbsent(m.to, () => []).add(m);
    }
    return map;
  }

  Set<BoardCoord> get _movableOrigins =>
      widget.legalMoves.map((m) => m.from).toSet();

  void _commitOrStageMove(DraughtsMove chosen) {
    if (widget.confirmMoves) {
      if (widget.pendingConfirmMove?.notation == chosen.notation &&
          widget.pendingConfirmMove?.to == chosen.to) {
        // Second tap confirms immediately
        setState(() {
          _selected = null;
          _partialPath = const [];
        });
        widget.onPendingMoveSelected?.call(null);
        widget.onExecuteMove?.call(chosen);
      } else {
        SoundHapticService.onPieceSelect();
        widget.onPendingMoveSelected?.call(chosen);
      }
      return;
    }

    setState(() {
      _selected = null;
      _partialPath = const [];
    });
    widget.onExecuteMove?.call(chosen);
  }

  void _onSquareTap(int row, int col) {
    if (!widget.interactive) return;
    if (widget.allowedSide != null && widget.allowedSide != widget.state.turn) {
      return;
    }

    final tapped = BoardCoord(row, col);
    final nextTargets = _nextStepTargets;

    if (_selected != null && nextTargets.containsKey(tapped)) {
      final nextPath = [..._partialPath, tapped];
      final matching = _activeMoves.where((m) {
        if (m.path.length < nextPath.length) return false;
        for (int i = 0; i < nextPath.length; i++) {
          if (m.path[i] != nextPath[i]) return false;
        }
        return true;
      }).toList(growable: false);

      if (matching.length == 1 &&
          matching.first.path.length == nextPath.length) {
        _commitOrStageMove(matching.first);
        return;
      }

      final completedHere = matching
          .where((m) => m.path.length == nextPath.length)
          .toList(growable: false);
      final longerExists = matching.any((m) => m.path.length > nextPath.length);
      if (completedHere.isNotEmpty && !longerExists) {
        _commitOrStageMove(completedHere.first);
        return;
      }

      SoundHapticService.onPieceSelect();
      widget.onPendingMoveSelected?.call(null);
      setState(() {
        _partialPath = nextPath;
      });
      return;
    }

    if (_selected != null && _partialPath.isEmpty) {
      final finals = _directFinalMoves[tapped];
      if (finals != null && finals.length == 1) {
        _commitOrStageMove(finals.first);
        return;
      }
    }

    final piece = widget.state.board.pieceAt(row, col);
    if (piece != null &&
        piece.side == widget.state.turn &&
        _movableOrigins.contains(tapped)) {
      SoundHapticService.onPieceSelect();
      widget.onPendingMoveSelected?.call(null);
      setState(() {
        if (_selected == tapped && _partialPath.isEmpty) {
          _selected = null;
        } else {
          _selected = tapped;
          _partialPath = const [];
        }
      });
      return;
    }

    widget.onPendingMoveSelected?.call(null);
    setState(() {
      _selected = null;
      _partialPath = const [];
    });
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.state.board.size;
    final palette = AppTheme.paletteById(
      widget.paletteId,
      highContrast: widget.highContrast,
    );
    final nextTargets = _nextStepTargets;
    final directFinals = _directFinalMoves;
    final lastMove =
        widget.state.history.isNotEmpty ? widget.state.history.last.move : null;
    final shouldAnimate = widget.animateMoves && !widget.reducedMotion;
    final glideDuration = Duration(
      milliseconds: shouldAnimate ? widget.glideDurationMs : 0,
    );

    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: palette.frame,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.45),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final cellPx = constraints.maxWidth / size;
              final pieceWidgets = <Widget>[];

              for (int r = 0; r < size; r++) {
                for (int c = 0; c < size; c++) {
                  final piece = widget.state.board.grid[r][c];
                  if (piece == null) continue;
                  final dispR = widget.flipped ? size - 1 - r : r;
                  final dispC = widget.flipped ? size - 1 - c : c;
                  final coord = BoardCoord(r, c);
                  final isSel = _selected == coord;
                  final isPromotedNow = lastMove != null &&
                      lastMove.to == coord &&
                      lastMove.promoted;

                  final isMovedTarget =
                      lastMove != null && lastMove.to == coord;
                  final fromDispR = isMovedTarget
                      ? (widget.flipped
                          ? size - 1 - lastMove.from.row
                          : lastMove.from.row)
                      : dispR;
                  final fromDispC = isMovedTarget
                      ? (widget.flipped
                          ? size - 1 - lastMove.from.col
                          : lastMove.from.col)
                      : dispC;

                  pieceWidgets.add(
                    Positioned(
                      left: dispC * cellPx + cellPx * 0.11,
                      top: dispR * cellPx + cellPx * 0.11,
                      width: cellPx * 0.78,
                      height: cellPx * 0.78,
                      child: IgnorePointer(
                        child: isMovedTarget && shouldAnimate
                            ? TweenAnimationBuilder<Offset>(
                                key:
                                    ValueKey('glide_${widget.state.moveCount}'),
                                tween: Tween<Offset>(
                                  begin: Offset(
                                    (fromDispC - dispC) * cellPx,
                                    (fromDispR - dispR) * cellPx,
                                  ),
                                  end: Offset.zero,
                                ),
                                duration: glideDuration,
                                curve: Curves.easeOutCubic,
                                builder: (context, offset, child) =>
                                    Transform.translate(
                                  offset: offset,
                                  child: child,
                                ),
                                child: DraughtsPieceWidget(
                                  piece: piece,
                                  pieceThemeId: widget.pieceThemeId,
                                  highContrast: widget.highContrast,
                                  isSelected: isSel,
                                  justPromoted: isPromotedNow,
                                  reducedMotion: widget.reducedMotion,
                                ),
                              )
                            : DraughtsPieceWidget(
                                piece: piece,
                                pieceThemeId: widget.pieceThemeId,
                                highContrast: widget.highContrast,
                                isSelected: isSel,
                                justPromoted: false,
                                reducedMotion: widget.reducedMotion,
                              ),
                      ),
                    ),
                  );
                }
              }

              return Stack(
                children: [
                  CustomPaint(
                    size: Size.square(constraints.maxWidth),
                    painter: _BoardGridPainter(
                      size: size,
                      flipped: widget.flipped,
                      palette: palette,
                      selected: _selected,
                      lastFrom:
                          widget.highlightLastMove ? lastMove?.from : null,
                      lastTo: widget.highlightLastMove ? lastMove?.to : null,
                      pendingTo: widget.pendingConfirmMove?.to,
                      highlightSquares: widget.highlightSquares,
                    ),
                  ),
                  GridView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: size,
                    ),
                    itemCount: size * size,
                    itemBuilder: (context, index) {
                      final dispR = index ~/ size;
                      final dispC = index % size;
                      final r = widget.flipped ? size - 1 - dispR : dispR;
                      final c = widget.flipped ? size - 1 - dispC : dispC;
                      final playable = (r + c) % 2 == 1;
                      final coord = BoardCoord(r, c);
                      final stepTarget = nextTargets[coord];
                      final isDirectFinal = stepTarget == null &&
                          _selected != null &&
                          _partialPath.isEmpty &&
                          directFinals.containsKey(coord);
                      final sqNum = playable
                          ? widget.state.board.coordToSquareNumber(coord)
                          : null;

                      return GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: playable ? () => _onSquareTap(r, c) : null,
                        child: Stack(
                          children: [
                            if (widget.showSquareNumbers && sqNum != null)
                              Positioned(
                                top: 2,
                                left: 3,
                                child: Text(
                                  '$sqNum',
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: Colors.white.withValues(alpha: 0.50),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            if (widget.highlightLegalMoves &&
                                (stepTarget != null || isDirectFinal))
                              MoveHighlighter(
                                isCapture: stepTarget?.isCapture ?? true,
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                  ...pieceWidgets,
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BoardGridPainter extends CustomPainter {
  const _BoardGridPainter({
    required this.size,
    required this.flipped,
    required this.palette,
    required this.selected,
    required this.lastFrom,
    required this.lastTo,
    required this.pendingTo,
    required this.highlightSquares,
  });

  final int size;
  final bool flipped;
  final BoardColorPalette palette;
  final BoardCoord? selected;
  final BoardCoord? lastFrom;
  final BoardCoord? lastTo;
  final BoardCoord? pendingTo;
  final List<BoardCoord> highlightSquares;

  @override
  void paint(Canvas canvas, Size canvasSize) {
    final cell = canvasSize.width / size;
    final paint = Paint();

    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        final dispR = flipped ? size - 1 - r : r;
        final dispC = flipped ? size - 1 - c : c;
        final rect = Rect.fromLTWH(dispC * cell, dispR * cell, cell, cell);
        final playable = (r + c) % 2 == 1;
        paint.color = playable ? palette.darkSquare : palette.lightSquare;
        canvas.drawRect(rect, paint);

        final coord = BoardCoord(r, c);
        if (lastFrom == coord || lastTo == coord) {
          paint.color = const Color(0xFFF59E0B).withValues(alpha: 0.22);
          canvas.drawRect(rect, paint);
        }
        if (highlightSquares.contains(coord)) {
          paint.color = const Color(0xFF10B981).withValues(alpha: 0.34);
          canvas.drawRect(rect, paint);
        }
        if (pendingTo == coord) {
          paint.color = const Color(0xFF38BDF8).withValues(alpha: 0.36);
          canvas.drawRect(rect, paint);
        }
        if (selected == coord) {
          paint.color = const Color(0xFFF59E0B).withValues(alpha: 0.36);
          canvas.drawRect(rect, paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _BoardGridPainter old) =>
      old.selected != selected ||
      old.lastFrom != lastFrom ||
      old.lastTo != lastTo ||
      old.pendingTo != pendingTo ||
      old.flipped != flipped ||
      old.palette.id != palette.id ||
      old.highlightSquares.length != highlightSquares.length;
}
