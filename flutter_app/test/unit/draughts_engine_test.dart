import 'dart:convert';

import 'package:draft_master/gameplay/ai/ai_engine.dart';
import 'package:draft_master/gameplay/ai/minimax.dart';
import 'package:draft_master/gameplay/engine/board_state.dart';
import 'package:draft_master/gameplay/engine/draughts_engine.dart';
import 'package:draft_master/gameplay/models/board_coord.dart';
import 'package:draft_master/gameplay/models/game_status.dart';
import 'package:draft_master/gameplay/models/piece_model.dart';
import 'package:draft_master/gameplay/models/rule_config.dart';
import 'package:draft_master/settings/app_settings.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Draft Master Multi-Variant Engine & Flying Kings (Dart)', () {
    test('default ruleset is 8x8 with 12 pieces each, Black first, and Flying Kings enabled', () {
      final state = DraughtsEngine.createInitialState();
      final counts = state.board.countPieces();

      expect(state.board.size, 8);
      expect(state.rules.preset, VariantPreset.draftMaster8x8);
      expect(state.rules.flyingKings, isTrue);
      expect(state.turn, PlayerSide.black);
      expect(counts.blackTotal, 12);
      expect(counts.whiteTotal, 12);
    });

    test('8x8 Flying King slides long distance diagonally and stops cleanly before friendly piece', () {
      final board = BoardState.empty(8);
      board.grid[4][3] =
          const DraughtsPiece(side: PlayerSide.white, type: PieceType.king);
      board.grid[2][1] =
          const DraughtsPiece(side: PlayerSide.white, type: PieceType.man);
      board.grid[0][7] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);

      final state = DraughtsEngine.createCustomBoardState(
        board: board,
        turn: PlayerSide.white,
        rules: RuleConfig.draftMaster8x8,
      );

      final moves = DraughtsEngine.generateLegalMoves(state);
      final kingMoves =
          moves.where((m) => m.from == const BoardCoord(4, 3)).toList();

      expect(kingMoves.any((m) => m.to == const BoardCoord(7, 6)), isTrue);
      expect(kingMoves.any((m) => m.to == const BoardCoord(1, 6)), isTrue);
      expect(kingMoves.any((m) => m.to == const BoardCoord(3, 2)), isTrue);
      expect(kingMoves.any((m) => m.to == const BoardCoord(2, 1)), isFalse);
      expect(kingMoves.any((m) => m.to == const BoardCoord(1, 0)), isFalse);
    });

    test('8x8 Flying King executes long-range captures and offers all empty landing squares beyond victim', () {
      final board = BoardState.empty(8);
      board.grid[6][1] =
          const DraughtsPiece(side: PlayerSide.white, type: PieceType.king);
      board.grid[4][3] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);

      final state = DraughtsEngine.createCustomBoardState(
        board: board,
        turn: PlayerSide.white,
        rules: RuleConfig.draftMaster8x8,
      );

      final moves = DraughtsEngine.generateLegalMoves(state);
      expect(moves.every((m) => m.isCapture), isTrue);
      expect(moves.any((m) => m.to == const BoardCoord(3, 4)), isTrue);
      expect(moves.any((m) => m.to == const BoardCoord(2, 5)), isTrue);
      expect(moves.any((m) => m.to == const BoardCoord(1, 6)), isTrue);
      expect(moves.any((m) => m.to == const BoardCoord(0, 7)), isTrue);
    });

    test('8x8 Flying King executes multi-capture chain across long diagonals', () {
      final board = BoardState.empty(8);
      board.grid[7][0] =
          const DraughtsPiece(side: PlayerSide.white, type: PieceType.king);
      board.grid[5][2] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);
      board.grid[1][4] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);

      final state = DraughtsEngine.createCustomBoardState(
        board: board,
        turn: PlayerSide.white,
        rules: RuleConfig.draftMaster8x8,
      );

      final moves = DraughtsEngine.generateLegalMoves(state);
      final doubleJump = moves.firstWhere((m) => m.captured.length == 2);
      expect(doubleJump.captured.length, 2);

      final next = DraughtsEngine.applyMove(state, doubleJump);
      expect(next.board.countPieces().blackTotal, 0);
      expect(next.status, GameStatus.whiteWon);
    });

    test('English 8x8 restricts Kings to 1 diagonal step', () {
      final board = BoardState.empty(8);
      board.grid[4][3] =
          const DraughtsPiece(side: PlayerSide.white, type: PieceType.king);
      board.grid[0][7] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);

      final state = DraughtsEngine.createCustomBoardState(
        board: board,
        turn: PlayerSide.white,
        rules: RuleConfig.english8x8,
      );

      final moves = DraughtsEngine.generateLegalMoves(state);
      expect(moves.any((m) => m.to == const BoardCoord(7, 6)), isFalse);
      expect(moves.any((m) => m.to == const BoardCoord(3, 2)), isTrue);
    });

    test('International 10x10 enforces maximum capture rule & starts with 20 pieces each', () {
      final initial =
          DraughtsEngine.createInitialState(RuleConfig.international10x10);
      expect(initial.board.size, 10);
      expect(initial.board.countPieces().whiteTotal, 20);
      expect(initial.board.countPieces().blackTotal, 20);
      expect(initial.turn, PlayerSide.white);

      final board = BoardState.empty(10);
      board.grid[7][2] =
          const DraughtsPiece(side: PlayerSide.white, type: PieceType.man);
      board.grid[6][1] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);
      board.grid[6][3] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);
      board.grid[4][5] =
          const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);

      final state = DraughtsEngine.createCustomBoardState(
        board: board,
        turn: PlayerSide.white,
        rules: RuleConfig.international10x10,
      );

      final moves = DraughtsEngine.generateLegalMoves(state);
      expect(moves.every((m) => m.captured.length == 2), isTrue);
    });

    test('reconstructAtPly accurately rebuilds match replay frames and revertLastMove restores custom boards', () {
      var state = DraughtsEngine.createInitialState(RuleConfig.draftMaster8x8);
      for (int i = 0; i < 4; i++) {
        final legal = DraughtsEngine.generateLegalMoves(state);
        state = DraughtsEngine.applyMove(state, legal.first);
      }
      expect(state.moveCount, 4);

      final ply0 = DraughtsEngine.reconstructAtPly(state, 0);
      expect(ply0.moveCount, 0);
      expect(ply0.board.compress(), state.initialBoardCompressed);

      final ply2 = DraughtsEngine.reconstructAtPly(state, 2);
      expect(ply2.moveCount, 2);

      final reverted = DraughtsEngine.revertLastMove(state);
      expect(reverted.moveCount, 3);
    });

    test('AI engine selects legal moves across difficulty tiers on 8x8 Flying Kings', () async {
      final state = DraughtsEngine.createInitialState(RuleConfig.draftMaster8x8);
      final legalNotations =
          DraughtsEngine.generateLegalMoves(state).map((m) => m.notation).toSet();

      for (final tier in [
        AiDifficulty.beginner,
        AiDifficulty.medium,
        AiDifficulty.hard,
      ]) {
        final result = await AiEngine.findBestMove(state, tier);
        expect(result.bestMove, isNotNull);
        expect(legalNotations.contains(result.bestMove!.notation), isTrue);
      }
    });

    test('AppSettings serializes and restores all Gameplay, Display, Audio, Accessibility, and Privacy fields', () {
      final customRules = RuleConfig.draftMaster8x8.copyWith(
        preset: VariantPreset.custom,
        name: 'Custom (8×8)',
        mandatoryCapture: false,
      );
      final original = AppSettings(
        rules: customRules,
        moveHints: false,
        moveConfirmation: true,
        defaultDifficulty: AiDifficulty.expert,
        matchTimerMinutes: 10,
        themePreference: AppThemePreference.system,
        boardPaletteId: 'emerald',
        pieceThemeId: 'imperial_gold',
        boardAnimations: true,
        animationIntensity: AnimationIntensity.dynamic,
        masterVolume: 0.65,
        musicVolume: 0.35,
        sfxVolume: 0.90,
        musicEnabled: false,
        largerControls: true,
        highContrastBoard: true,
        reducedMotion: true,
        playerName: 'Grandmaster',
        notifyTournaments: false,
      );

      final restored = AppSettings.fromJson(
        jsonDecode(original.encode()) as Map<String, dynamic>,
      );

      expect(restored.isCustomRuleset, isTrue);
      expect(restored.rules.mandatoryCapture, isFalse);
      expect(restored.moveHints, isFalse);
      expect(restored.moveConfirmation, isTrue);
      expect(restored.defaultDifficulty, AiDifficulty.expert);
      expect(restored.matchTimerMinutes, 10);
      expect(restored.themePreference, AppThemePreference.system);
      expect(restored.boardPaletteId, 'emerald');
      expect(restored.pieceThemeId, 'imperial_gold');
      expect(restored.animationIntensity, AnimationIntensity.dynamic);
      expect(restored.masterVolume, 0.65);
      expect(restored.musicEnabled, isFalse);
      expect(restored.largerControls, isTrue);
      expect(restored.highContrastBoard, isTrue);
      expect(restored.reducedMotion, isTrue);
      expect(restored.playerName, 'Grandmaster');
      expect(restored.notifyTournaments, isFalse);
    });
  });
}
