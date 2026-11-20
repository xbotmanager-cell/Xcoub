import 'package:flutter/material.dart';

import '../core/services/sound_haptic_service.dart';
import '../gameplay/engine/board_state.dart';
import '../gameplay/engine/draughts_engine.dart';
import '../gameplay/models/board_coord.dart';
import '../gameplay/models/draughts_move.dart';
import '../gameplay/models/piece_model.dart';
import '../gameplay/models/rule_config.dart';
import '../gameplay/widgets/draughts_board.dart';

class TutorialScreen extends StatefulWidget {
  const TutorialScreen({super.key, this.paletteId = 'walnut'});

  final String paletteId;

  @override
  State<TutorialScreen> createState() => _TutorialScreenState();
}

class _TutorialScreenState extends State<TutorialScreen> {
  int _lessonIdx = 0;
  late GameState _state;
  String _feedback = '';
  bool _completed = false;

  static final List<_LessonSpec> _lessons = [
    _LessonSpec(
      title: '1. Flying King Diagonal Glide (8×8)',
      instruction:
          'Promoted Kings fly across any number of empty diagonal squares. Slide your King at (7,2) to the far corner (1,8).',
      expectedFrom: const BoardCoord(6, 1),
      expectedTo: const BoardCoord(0, 7),
      buildBoard: () {
        final b = BoardState.empty(8);
        b.grid[6][1] =
            const DraughtsPiece(side: PlayerSide.black, type: PieceType.king);
        b.grid[0][3] =
            const DraughtsPiece(side: PlayerSide.white, type: PieceType.man);
        return b;
      },
    ),
    _LessonSpec(
      title: '2. Flying King Long-Range Capture (8×8)',
      instruction:
          'Strike distant enemy pieces and land beyond them! Capture the white man and land at (1,8).',
      expectedFrom: const BoardCoord(6, 1),
      expectedTo: const BoardCoord(0, 7),
      buildBoard: () {
        final b = BoardState.empty(8);
        b.grid[6][1] =
            const DraughtsPiece(side: PlayerSide.black, type: PieceType.king);
        b.grid[3][4] =
            const DraughtsPiece(side: PlayerSide.white, type: PieceType.man);
        b.grid[0][5] =
            const DraughtsPiece(side: PlayerSide.white, type: PieceType.man);
        return b;
      },
    ),
  ];

  @override
  void initState() {
    super.initState();
    _loadLesson(0);
  }

  void _loadLesson(int idx) {
    final spec = _lessons[idx];
    setState(() {
      _lessonIdx = idx;
      _state = DraughtsEngine.createCustomBoardState(
        board: spec.buildBoard(),
        turn: PlayerSide.black,
        rules: RuleConfig.draftMaster8x8,
      );
      _feedback = spec.instruction;
      _completed = false;
    });
  }

  void _onMove(DraughtsMove move) {
    final spec = _lessons[_lessonIdx];
    if (move.from == spec.expectedFrom && move.to == spec.expectedTo) {
      SoundHapticService.onPromote();
      setState(() {
        _state = DraughtsEngine.applyMove(_state, move);
        _completed = true;
        _feedback = 'Excellent execution! Long-diagonal control mastered.';
      });
    } else {
      setState(() {
        _feedback = 'Try again — ${spec.instruction}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final spec = _lessons[_lessonIdx];
    final legal = _completed
        ? const <DraughtsMove>[]
        : DraughtsEngine.generateLegalMoves(_state);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            spec.title,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _completed
                  ? const Color(0xFF10B981).withValues(alpha: 0.14)
                  : Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _completed
                    ? const Color(0xFF10B981)
                    : Colors.grey.withValues(alpha: 0.25),
              ),
            ),
            child: Text(_feedback, style: const TextStyle(fontSize: 13)),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Center(
              child: DraughtsBoardWidget(
                state: _state,
                legalMoves: legal,
                interactive: !_completed,
                flipped: true,
                paletteId: widget.paletteId,
                highlightSquares: [spec.expectedFrom, spec.expectedTo],
                onExecuteMove: _onMove,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () => _loadLesson(_lessonIdx),
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Reset'),
              ),
              const Spacer(),
              if (_lessonIdx + 1 < _lessons.length)
                FilledButton.icon(
                  onPressed: () => _loadLesson(_lessonIdx + 1),
                  icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                  label: const Text('Next Drill'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LessonSpec {
  const _LessonSpec({
    required this.title,
    required this.instruction,
    required this.expectedFrom,
    required this.expectedTo,
    required this.buildBoard,
  });

  final String title;
  final String instruction;
  final BoardCoord expectedFrom;
  final BoardCoord expectedTo;
  final BoardState Function() buildBoard;
}
