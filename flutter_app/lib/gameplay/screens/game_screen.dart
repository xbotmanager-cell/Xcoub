import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/services/audio_service.dart';
import '../../core/services/sound_haptic_service.dart';
import '../../replay/replay_session.dart';
import '../../settings/app_settings.dart';
import '../ai/ai_engine.dart';
import '../ai/minimax.dart';
import '../engine/draughts_engine.dart';
import '../models/board_coord.dart';
import '../models/draughts_move.dart';
import '../models/game_status.dart';
import '../models/piece_model.dart';
import '../models/rule_config.dart';
import '../widgets/draughts_board.dart';
import '../widgets/game_controls.dart';
import 'game_result_screen.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({
    super.key,
    required this.rules,
    required this.settings,
    this.vsAi = true,
    this.playerSide = PlayerSide.black,
    this.difficulty = AiDifficulty.medium,
    this.onMatchSaved,
  });

  final RuleConfig rules;
  final AppSettings settings;
  final bool vsAi;
  final PlayerSide playerSide;
  final AiDifficulty difficulty;
  final ValueChanged<ReplaySession>? onMatchSaved;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late GameState _state;
  bool _aiThinking = false;
  bool _paused = false;
  bool _completionHandled = false;
  bool _hintLoading = false;
  List<BoardCoord> _hintSquares = const [];
  DraughtsMove? _pendingMove;

  Timer? _clockTimer;
  int _whiteSecondsLeft = 0;
  int _blackSecondsLeft = 0;

  @override
  void initState() {
    super.initState();
    _initMatch();
    AudioService.instance.playMusic(MusicTrack.game);
    SoundHapticService.onMatchStart();
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    AudioService.instance.playMusic(MusicTrack.menu);
    super.dispose();
  }

  void _initMatch() {
    _clockTimer?.cancel();
    _state = DraughtsEngine.createInitialState(widget.rules);
    _paused = false;
    _aiThinking = false;
    _completionHandled = false;
    _hintSquares = const [];
    _pendingMove = null;

    final secs = widget.settings.matchTimerMinutes * 60;
    _whiteSecondsLeft = secs;
    _blackSecondsLeft = secs;

    if (secs > 0) {
      _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted || _paused || _state.status != GameStatus.playing) return;
        setState(() {
          if (_state.turn == PlayerSide.white) {
            _whiteSecondsLeft = (_whiteSecondsLeft - 1).clamp(0, 99999);
            if (_whiteSecondsLeft == 0) {
              _finishByTimeout(GameStatus.blackWon);
            }
          } else {
            _blackSecondsLeft = (_blackSecondsLeft - 1).clamp(0, 99999);
            if (_blackSecondsLeft == 0) {
              _finishByTimeout(GameStatus.whiteWon);
            }
          }
        });
      });
    }
    _maybeTriggerAi();
  }

  void _finishByTimeout(GameStatus winnerStatus) {
    _clockTimer?.cancel();
    final ended = GameState(
      board: _state.board,
      initialBoardCompressed: _state.initialBoardCompressed,
      initialTurn: _state.initialTurn,
      turn: _state.turn,
      rules: _state.rules,
      moveCount: _state.moveCount,
      noProgressCount: _state.noProgressCount,
      positionCounts: _state.positionCounts,
      status: winnerStatus,
      endReason: EndReason.timeout,
      history: _state.history,
    );
    _state = ended;
    _handleCompletion(ended);
  }

  String get _humanName => widget.settings.playerName.trim().isNotEmpty
      ? widget.settings.playerName
      : 'You';

  String get _whiteName => widget.vsAi
      ? (widget.playerSide == PlayerSide.white
          ? _humanName
          : '${widget.difficulty.label} AI')
      : 'White Player';

  String get _blackName => widget.vsAi
      ? (widget.playerSide == PlayerSide.black
          ? _humanName
          : '${widget.difficulty.label} AI')
      : 'Black Player';

  void _maybeTriggerAi() {
    if (!widget.vsAi || _paused || _state.status != GameStatus.playing) return;
    if (_state.turn == widget.playerSide) return;

    setState(() => _aiThinking = true);
    Future<void>.delayed(const Duration(milliseconds: 220)).then((_) async {
      if (!mounted || _paused || _state.status != GameStatus.playing) return;
      final res = await AiEngine.findBestMove(_state, widget.difficulty);
      if (!mounted) return;
      setState(() => _aiThinking = false);
      if (res.bestMove != null) {
        _applyMove(res.bestMove!);
      }
    });
  }

  void _applyMove(DraughtsMove move) {
    if (move.promoted) {
      SoundHapticService.onPromote();
    } else if (move.isCapture) {
      SoundHapticService.onCapture();
    } else {
      SoundHapticService.onMove();
    }

    final next = DraughtsEngine.applyMove(_state, move);
    setState(() {
      _state = next;
      _hintSquares = const [];
      _pendingMove = null;
    });

    if (next.status != GameStatus.playing) {
      _handleCompletion(next);
    } else {
      _maybeTriggerAi();
    }
  }

  void _handleCompletion(GameState finalState) {
    if (_completionHandled) return;
    _completionHandled = true;
    _clockTimer?.cancel();

    final playerWon = !widget.vsAi ||
        (widget.playerSide == PlayerSide.white &&
            finalState.status == GameStatus.whiteWon) ||
        (widget.playerSide == PlayerSide.black &&
            finalState.status == GameStatus.blackWon);

    if (finalState.status == GameStatus.draw || playerWon) {
      SoundHapticService.onVictory();
    } else {
      SoundHapticService.onDefeat();
    }

    final session = ReplaySession(
      id: 'match_${DateTime.now().millisecondsSinceEpoch}',
      title: '${finalState.rules.name} · $_whiteName vs $_blackName',
      whiteName: _whiteName,
      blackName: _blackName,
      finalState: finalState,
      createdAt: DateTime.now(),
    );
    widget.onMatchSaved?.call(session);

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GameResultScreen(
          finalState: finalState,
          whiteName: _whiteName,
          blackName: _blackName,
          replaySession: session,
          onPlayAgain: _restart,
        ),
      ),
    );
  }

  Future<void> _requestHint() async {
    if (_aiThinking || _paused || _hintLoading) return;
    if (_state.status != GameStatus.playing) return;
    setState(() => _hintLoading = true);
    final analysis = await AiEngine.findBestMove(_state, AiDifficulty.hard);
    if (!mounted) return;
    setState(() {
      _hintLoading = false;
      if (analysis.bestMove != null) {
        _hintSquares = [analysis.bestMove!.from, analysis.bestMove!.to];
      }
    });
  }

  void _undo() {
    if (_aiThinking || _state.history.isEmpty) return;
    SoundHapticService.onButtonTap();
    var next = DraughtsEngine.revertLastMove(_state);
    if (widget.vsAi &&
        next.turn != widget.playerSide &&
        next.history.isNotEmpty) {
      next = DraughtsEngine.revertLastMove(next);
    }
    setState(() {
      _state = next;
      _hintSquares = const [];
      _pendingMove = null;
    });
  }

  void _restart() {
    SoundHapticService.onMatchStart();
    AudioService.instance.playMusic(MusicTrack.game);
    setState(_initMatch);
  }

  void _resign() {
    SoundHapticService.onButtonTap();
    final status = _state.turn == PlayerSide.white
        ? GameStatus.blackWon
        : GameStatus.whiteWon;
    final resignedState = GameState(
      board: _state.board,
      initialBoardCompressed: _state.initialBoardCompressed,
      initialTurn: _state.initialTurn,
      turn: _state.turn,
      rules: _state.rules,
      moveCount: _state.moveCount,
      noProgressCount: _state.noProgressCount,
      positionCounts: _state.positionCounts,
      status: status,
      endReason: EndReason.resignation,
      history: _state.history,
    );
    setState(() => _state = resignedState);
    _handleCompletion(resignedState);
  }

  String? _formatClock(int seconds) {
    if (widget.settings.matchTimerMinutes <= 0) return null;
    final mins = seconds ~/ 60;
    final rem = seconds % 60;
    return '$mins:${rem.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final counts = _state.board.countPieces();
    final legalMoves = !_paused && !_aiThinking
        ? DraughtsEngine.generateLegalMoves(_state)
        : const <DraughtsMove>[];
    final flip = widget.vsAi && widget.playerSide == PlayerSide.black;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.rules.name,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          overflow: TextOverflow.ellipsis,
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _PlayerHudStrip(
                    name: flip ? _whiteName : _blackName,
                    isWhite: flip,
                    men: flip ? counts.whiteMen : counts.blackMen,
                    kings: flip ? counts.whiteKings : counts.blackKings,
                    clockText: _formatClock(
                        flip ? _whiteSecondsLeft : _blackSecondsLeft),
                    activeTurn: _state.turn ==
                        (flip ? PlayerSide.white : PlayerSide.black),
                    thinking: _aiThinking && _state.turn != widget.playerSide,
                  ),
                  const SizedBox(height: 6),
                  Expanded(
                    child: Center(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final boardDim = constraints.biggest.shortestSide;
                          return SizedBox(
                            width: boardDim,
                            height: boardDim,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                DraughtsBoardWidget(
                                  state: _state,
                                  legalMoves: legalMoves,
                                  interactive: !_paused &&
                                      !_aiThinking &&
                                      _state.status == GameStatus.playing,
                                  allowedSide:
                                      widget.vsAi ? widget.playerSide : null,
                                  flipped: flip,
                                  paletteId: widget.settings.boardPaletteId,
                                  pieceThemeId: widget.settings.pieceThemeId,
                                  highContrast:
                                      widget.settings.highContrastBoard,
                                  showSquareNumbers:
                                      widget.settings.showMoveLabels,
                                  highlightLegalMoves:
                                      widget.settings.highlightLegalMoves,
                                  highlightLastMove:
                                      widget.settings.highlightLastMove,
                                  animateMoves: widget.settings.boardAnimations,
                                  glideDurationMs: widget
                                      .settings.animationIntensity.glideMs,
                                  reducedMotion: widget.settings.reducedMotion,
                                  confirmMoves:
                                      widget.settings.moveConfirmation,
                                  highlightSquares: _hintSquares,
                                  pendingConfirmMove: _pendingMove,
                                  onPendingMoveSelected: (m) =>
                                      setState(() => _pendingMove = m),
                                  onExecuteMove: _applyMove,
                                ),
                                if (_paused)
                                  Container(
                                    padding: const EdgeInsets.all(24),
                                    decoration: BoxDecoration(
                                      color:
                                          Colors.black.withValues(alpha: 0.80),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Text(
                                          'Match Paused',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        FilledButton(
                                          onPressed: () {
                                            SoundHapticService.onButtonTap();
                                            setState(() => _paused = false);
                                            _maybeTriggerAi();
                                          },
                                          child: const Text('Resume'),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (_pendingMove != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: () => _applyMove(_pendingMove!),
                              icon: const Icon(Icons.check_rounded, size: 18),
                              label: Text('Confirm ${_pendingMove!.notation}'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton(
                            onPressed: () =>
                                setState(() => _pendingMove = null),
                            child: const Text('Cancel'),
                          ),
                        ],
                      ),
                    ),
                  _PlayerHudStrip(
                    name: flip ? _blackName : _whiteName,
                    isWhite: !flip,
                    men: flip ? counts.blackMen : counts.whiteMen,
                    kings: flip ? counts.blackKings : counts.whiteKings,
                    clockText: _formatClock(
                        flip ? _blackSecondsLeft : _whiteSecondsLeft),
                    activeTurn: _state.turn ==
                        (flip ? PlayerSide.black : PlayerSide.white),
                    thinking: false,
                  ),
                  const SizedBox(height: 4),
                  GameControlsBar(
                    canUndo: _state.history.isNotEmpty && !_aiThinking,
                    isPaused: _paused,
                    showHint: widget.settings.moveHints,
                    hintLoading: _hintLoading,
                    largerControls: widget.settings.largerControls,
                    onUndo: _undo,
                    onHint: _requestHint,
                    onTogglePause: () {
                      SoundHapticService.onButtonTap();
                      setState(() => _paused = !_paused);
                      if (!_paused) _maybeTriggerAi();
                    },
                    onRestart: _restart,
                    onResign: _resign,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PlayerHudStrip extends StatelessWidget {
  const _PlayerHudStrip({
    required this.name,
    required this.isWhite,
    required this.men,
    required this.kings,
    required this.activeTurn,
    required this.thinking,
    this.clockText,
  });

  final String name;
  final bool isWhite;
  final int men;
  final int kings;
  final bool activeTurn;
  final bool thinking;
  final String? clockText;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: activeTurn
            ? const Color(0xFFD97706).withValues(alpha: 0.14)
            : Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: activeTurn
              ? const Color(0xFFF59E0B)
              : Colors.grey.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 15,
            height: 15,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color:
                  isWhite ? const Color(0xFFF5EFE6) : const Color(0xFF1F2430),
              border: Border.all(color: Colors.grey.shade500),
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
          if (thinking)
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: SizedBox(
                width: 13,
                height: 13,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          if (clockText != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                clockText!,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFF59E0B),
                ),
              ),
            ),
          ],
          Text(
            '$men M · $kings K',
            style: const TextStyle(fontSize: 11.5, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
