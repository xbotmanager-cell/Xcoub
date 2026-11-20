import '../models/draughts_move.dart';
import '../models/game_status.dart';
import '../models/piece_model.dart';
import '../models/rule_config.dart';
import 'board_state.dart';
import 'game_rules.dart';
import 'move_generator.dart';

class GameState {
  const GameState({
    required this.board,
    required this.initialBoardCompressed,
    required this.initialTurn,
    required this.turn,
    required this.rules,
    required this.moveCount,
    required this.noProgressCount,
    required this.positionCounts,
    required this.status,
    this.endReason,
    required this.history,
  });

  final BoardState board;
  final String initialBoardCompressed;
  final PlayerSide initialTurn;
  final PlayerSide turn;
  final RuleConfig rules;
  final int moveCount;
  final int noProgressCount;
  final Map<String, int> positionCounts;
  final GameStatus status;
  final EndReason? endReason;
  final List<MoveRecord> history;

  Map<String, dynamic> toJson() => {
        'boardSize': board.size,
        'initialBoardCompressed': initialBoardCompressed,
        'initialTurn': initialTurn.code,
        'turn': turn.code,
        'rules': rules.toJson(),
        'moveCount': moveCount,
        'noProgressCount': noProgressCount,
        'positionCounts': positionCounts,
        'status': status.name,
        'endReason': endReason?.name,
        'history': history.map((h) => h.toJson()).toList(),
      };

  factory GameState.fromJson(Map<String, dynamic> json) {
    final rules = RuleConfig.fromJson(
      json['rules'] as Map<String, dynamic>? ?? const {},
    );
    final initialBoardCompressed =
        json['initialBoardCompressed'] as String? ??
            BoardState.initial(rules).compress();
    final initialTurn =
        PlayerSide.fromCode(json['initialTurn'] as String? ?? 'black');
    final historyRaw = json['history'] as List<dynamic>? ?? const [];
    final history = historyRaw
        .map((e) => MoveRecord.fromJson(e as Map<String, dynamic>))
        .toList();

    var state = DraughtsEngine.createCustomBoardState(
      board: BoardState.decompress(initialBoardCompressed),
      turn: initialTurn,
      rules: rules,
    );
    for (final rec in history) {
      state = DraughtsEngine.applyMove(state, rec.move);
    }

    final statusName = json['status'] as String? ?? state.status.name;
    final parsedStatus = GameStatus.values.firstWhere(
      (s) => s.name == statusName,
      orElse: () => state.status,
    );
    final endReasonName = json['endReason'] as String?;
    final parsedReason = endReasonName == null
        ? state.endReason
        : EndReason.values.firstWhere(
            (r) => r.name == endReasonName,
            orElse: () => EndReason.resignation,
          );

    if (parsedStatus != state.status || parsedReason != state.endReason) {
      return GameState(
        board: state.board,
        initialBoardCompressed: state.initialBoardCompressed,
        initialTurn: state.initialTurn,
        turn: state.turn,
        rules: state.rules,
        moveCount: state.moveCount,
        noProgressCount: state.noProgressCount,
        positionCounts: state.positionCounts,
        status: parsedStatus,
        endReason: parsedReason,
        history: state.history,
      );
    }
    return state;
  }
}

class DraughtsEngine {
  DraughtsEngine._();

  static GameState createInitialState([
    RuleConfig rules = RuleConfig.draftMaster8x8,
  ]) {
    final board = BoardState.initial(rules);
    final compressed = board.compress();
    return GameState(
      board: board,
      initialBoardCompressed: compressed,
      initialTurn: rules.firstPlayer,
      turn: rules.firstPlayer,
      rules: rules,
      moveCount: 0,
      noProgressCount: 0,
      positionCounts: {'${rules.firstPlayer.code}:$compressed': 1},
      status: GameStatus.playing,
      history: const [],
    );
  }

  static GameState createCustomBoardState({
    required BoardState board,
    required PlayerSide turn,
    required RuleConfig rules,
  }) {
    final compressed = board.compress();
    return GameState(
      board: board.clone(),
      initialBoardCompressed: compressed,
      initialTurn: turn,
      turn: turn,
      rules: rules,
      moveCount: 0,
      noProgressCount: 0,
      positionCounts: {'${turn.code}:$compressed': 1},
      status: GameStatus.playing,
      history: const [],
    );
  }

  static List<DraughtsMove> generateLegalMoves(GameState state) {
    if (state.status != GameStatus.playing) return const [];
    return MoveGenerator.generateLegalMoves(
      state.board,
      state.turn,
      state.rules,
    );
  }

  static GameState applyMove(GameState state, DraughtsMove move) {
    if (state.status != GameStatus.playing) return state;

    final nextBoard = state.board.clone();
    final moving = nextBoard.grid[move.from.row][move.from.col];
    if (moving == null) return state;

    nextBoard.grid[move.from.row][move.from.col] = null;
    for (final cap in move.captured) {
      nextBoard.grid[cap.row][cap.col] = null;
    }

    final placed = move.promoted ? moving.promote() : moving;
    nextBoard.grid[move.to.row][move.to.col] = placed;

    final nextTurn = state.turn.opponent;
    final nextPly = state.moveCount + 1;
    final resetsProgress = move.isCapture || !moving.isKing;
    final nextNoProgress = resetsProgress ? 0 : state.noProgressCount + 1;

    final compressedAfter = nextBoard.compress();
    final posKey = '${nextTurn.code}:$compressedAfter';
    final nextCounts = Map<String, int>.from(state.positionCounts);
    nextCounts[posKey] = (nextCounts[posKey] ?? 0) + 1;

    final eval = GameRules.evaluateTerminalStatus(
      board: nextBoard,
      nextTurn: nextTurn,
      rules: state.rules,
      positionCounts: nextCounts,
      nextPositionKey: posKey,
      noProgressCount: nextNoProgress,
    );

    final record = MoveRecord(
      ply: nextPly,
      side: state.turn,
      move: move,
      boardAfterCompressed: compressedAfter,
    );

    return GameState(
      board: nextBoard,
      initialBoardCompressed: state.initialBoardCompressed,
      initialTurn: state.initialTurn,
      turn: nextTurn,
      rules: state.rules,
      moveCount: nextPly,
      noProgressCount: nextNoProgress,
      positionCounts: nextCounts,
      status: eval.status,
      endReason: eval.reason,
      history: [...state.history, record],
    );
  }

  static GameState revertLastMove(GameState state) {
    if (state.history.isEmpty) return state;
    return reconstructAtPly(state, state.history.length - 1);
  }

  static GameState reconstructAtPly(GameState completedOrActive, int ply) {
    var cur = createCustomBoardState(
      board: BoardState.decompress(completedOrActive.initialBoardCompressed),
      turn: completedOrActive.initialTurn,
      rules: completedOrActive.rules,
    );
    final limit = ply.clamp(0, completedOrActive.history.length);
    for (int i = 0; i < limit; i++) {
      cur = applyMove(cur, completedOrActive.history[i].move);
    }
    return cur;
  }
}
