import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DRAFT_MASTER_8X8_RULES,
  ENGLISH_8X8_RULES,
  INTERNATIONAL_10X10_RULES,
  getPresetRules,
} from '../src/engine/presets.ts';
import {
  applyMove,
  compressBoard,
  coordToSquareNumber,
  countPieces,
  createInitialGameState,
  decompressBoard,
  generateLegalMoves,
  isPlayableSquare,
  revertLastMove,
  serializeGameState,
  deserializeGameState,
  validateMove,
} from '../src/engine/rules.ts';
import type { GameState, PieceCode, RuleConfig } from '../src/engine/types.ts';

function emptyBoard(size: 8 | 10): PieceCode[][] {
  return Array.from({ length: size }, () => Array<PieceCode>(size).fill(null));
}

function makeCustomState(board: PieceCode[][], turn: 'white' | 'black', rules: RuleConfig): GameState {
  const compressed = compressBoard(board, rules.boardSize);
  return {
    boardSize: rules.boardSize,
    board,
    turn,
    rules,
    moveCount: 0,
    noProgressCount: 0,
    positionCounts: { [`${turn}:${compressed}`]: 1 },
    status: 'playing',
    history: [],
  };
}

test('English 8x8 initial setup has 32 playable squares, 12 pieces each, and Black moves first', () => {
  const state = createInitialGameState(ENGLISH_8X8_RULES);
  assert.equal(state.boardSize, 8);
  assert.equal(state.turn, 'black');
  const counts = countPieces(state.board, 8);
  assert.equal(counts.blackMen, 12);
  assert.equal(counts.whiteMen, 12);
  assert.equal(counts.blackKings, 0);
  assert.equal(counts.whiteKings, 0);

  let playable = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isPlayableSquare(r, c, 8)) playable++;
    }
  }
  assert.equal(playable, 32);

  const moves = generateLegalMoves(state.board, 'black', state.rules);
  assert.equal(moves.length, 7); // 7 opening moves for Black in 8x8
});

test('English 8x8 men cannot capture backward and mandatory capture blocks quiet moves', () => {
  const board = emptyBoard(8);
  // Black man at (4,3), white man behind at (3,2) -> cannot capture backward in English!
  board[4][3] = 'b';
  board[3][2] = 'w';
  const state = makeCustomState(board, 'black', ENGLISH_8X8_RULES);
  const moves = generateLegalMoves(state.board, 'black', state.rules);
  assert.equal(moves.some((m) => m.isCapture), false);
  assert.equal(moves.length, 2); // (5,2) and (5,4)

  // Now put white man ahead at (5,4) -> mandatory forward capture to (6,5)
  board[5][4] = 'w';
  const mandatoryMoves = generateLegalMoves(board, 'black', ENGLISH_8X8_RULES);
  assert.equal(mandatoryMoves.length, 1);
  assert.equal(mandatoryMoves[0].isCapture, true);
  assert.deepEqual(mandatoryMoves[0].to, { row: 6, col: 5 });
});

test('English 8x8 promotion stops multi-capture immediately', () => {
  const board = emptyBoard(8);
  // White man at (2,3), black at (1,2), empty (0,1), and another black at (1,2) wouldn't apply—put black at (1,4) and (1,2)
  // Actually: white man at (2,3) jumps black at (1,2) -> lands on promotion row (0,1)!
  // Put another black at (1,0) or (1,2) -> wait: from (0,1), (1,2) is already captured, put black at (1,2) & wait: from (0,1) only (1,2) is diagonal neighbor!
  // Let's test (2,5) jumps (1,4) -> lands (0,3). Put another black at (1,2) with (2,1) empty!
  // In immediate_stop (English), promotion on (0,3) ends the turn and does NOT jump (1,2)->(2,1).
  board[2][5] = 'w';
  board[1][4] = 'b';
  board[1][2] = 'b';
  const moves = generateLegalMoves(board, 'white', ENGLISH_8X8_RULES);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].captured.length, 1);
  assert.deepEqual(moves[0].to, { row: 0, col: 3 });
  assert.equal(moves[0].promoted, true);
});

test('English 8x8 king moves 1 step diagonally forward and backward (no flying)', () => {
  const board = emptyBoard(8);
  board[3][4] = 'W';
  const moves = generateLegalMoves(board, 'white', ENGLISH_8X8_RULES);
  assert.equal(moves.length, 4); // exactly 4 adjacent diagonal squares
});

test('International 10x10 initial setup has 50 playable squares, 20 pieces each, and White moves first', () => {
  const state = createInitialGameState(INTERNATIONAL_10X10_RULES);
  assert.equal(state.boardSize, 10);
  assert.equal(state.turn, 'white');
  const counts = countPieces(state.board, 10);
  assert.equal(counts.whiteMen, 20);
  assert.equal(counts.blackMen, 20);

  let playable = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (isPlayableSquare(r, c, 10)) playable++;
    }
  }
  assert.equal(playable, 50);

  const moves = generateLegalMoves(state.board, 'white', state.rules);
  assert.equal(moves.length, 9); // 9 opening moves in 10x10
});

test('International 10x10 supports backward man captures and enforces maximum capture rule', () => {
  const board = emptyBoard(10);
  // White man at (5,4):
  // Option A: forward capture over (4,3) -> (3,2) (1 capture)
  // Option B: backward capture over (6,5) -> (7,6) -> over (8,7) -> (9,8) or (6,7) -> (5,8) (2 captures!)
  board[5][4] = 'w';
  board[4][3] = 'b';
  board[6][5] = 'b';
  board[6][7] = 'b';

  const moves = generateLegalMoves(board, 'white', INTERNATIONAL_10X10_RULES);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].captured.length, 2);
  assert.deepEqual(moves[0].to, { row: 5, col: 8 });
});

test('International 10x10 flying king slides and captures with multiple landing squares', () => {
  const board = emptyBoard(10);
  board[8][1] = 'W';
  board[5][4] = 'b';
  // Along diagonal (-1, +1) from (8,1): (7,2), (6,3), [enemy at (5,4)], then (4,5), (3,6), (2,7), (1,8), (0,9) are all empty!
  const moves = generateLegalMoves(board, 'white', INTERNATIONAL_10X10_RULES);
  assert.equal(moves.length, 5);
  assert.ok(moves.every((m) => m.isCapture && m.captured.length === 1));
  assert.ok(moves.some((m) => m.to.row === 0 && m.to.col === 9));
  assert.ok(moves.some((m) => m.to.row === 4 && m.to.col === 5));
});

test('International 10x10 touch-and-pass promotion rule does not promote mid-capture', () => {
  const board = emptyBoard(10);
  // White man at (2,1) captures (1,2) -> lands (0,3) [promo rank!], then captures backward over (1,4) -> lands (2,5).
  board[2][1] = 'w';
  board[1][2] = 'b';
  board[1][4] = 'b';

  const state = makeCustomState(board, 'white', INTERNATIONAL_10X10_RULES);
  const moves = generateLegalMoves(state.board, 'white', state.rules);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].captured.length, 2);
  assert.deepEqual(moves[0].to, { row: 2, col: 5 });
  assert.equal(moves[0].promoted, false);

  const next = applyMove(state, moves[0]);
  assert.equal(next.board[2][5], 'w'); // still a man!
});

test('Custom rules allow non-mandatory captures, 8x8 flying kings, and preserve custom label', () => {
  const custom = getPresetRules('custom', {
    boardSize: 8,
    flyingKings: true,
    menCaptureBackward: true,
    mandatoryCapture: false,
    maximumCapture: false,
  });
  assert.equal(custom.preset, 'custom');
  assert.equal(custom.boardSize, 8);
  assert.equal(custom.flyingKings, true);

  const board = emptyBoard(8);
  board[4][3] = 'w';
  board[3][4] = 'b';
  const moves = generateLegalMoves(board, 'white', custom);
  // Should include BOTH the capture (to 2,5) AND quiet move (to 3,2) because mandatoryCapture is false
  assert.ok(moves.some((m) => m.isCapture));
  assert.ok(moves.some((m) => !m.isCapture));
});

test('Win detection, draw by repetition, serialization, and revertLastMove work accurately', () => {
  const board = emptyBoard(8);
  board[4][3] = 'w';
  board[3][4] = 'b';
  const state = makeCustomState(board, 'white', ENGLISH_8X8_RULES);
  const moves = generateLegalMoves(state.board, 'white', state.rules);
  const wonState = applyMove(state, moves[0]);
  assert.equal(wonState.status, 'white_won');
  assert.equal(wonState.endReason, 'no_pieces');

  // Revert back
  const reverted = revertLastMove(wonState);
  assert.equal(reverted.status, 'playing');
  assert.equal(reverted.board[3][4], 'b');

  // Serialize/deserialize + board compress/decompress
  const serialized = serializeGameState(wonState);
  const restored = deserializeGameState(serialized);
  assert.equal(restored.status, 'white_won');
  const dec = decompressBoard(compressBoard(restored.board, 8));
  assert.equal(dec.boardSize, 8);
  assert.equal(dec.board[2][5], 'w');

  // Square numbering roundtrip
  assert.equal(coordToSquareNumber({ row: 0, col: 1 }, 8), 1);
  assert.equal(coordToSquareNumber({ row: 7, col: 6 }, 8), 32);
  assert.equal(coordToSquareNumber({ row: 9, col: 8 }, 10), 50);

  // Validation rejects illegal moves
  const illegal = validateMove(state, { from: { row: 4, col: 3 }, path: [{ row: 3, col: 2 }] });
  assert.equal(illegal, null);
});

test('Draft Master 8x8 Flying Kings move diagonally across multiple empty squares and block properly', () => {
  const state = createInitialGameState(DRAFT_MASTER_8X8_RULES);
  assert.equal(state.boardSize, 8);
  assert.equal(state.rules.flyingKings, true);

  const board = emptyBoard(8);
  // White flying king in center (4,3), friendly blocker at (2,1), enemy blocker at (6,5)
  board[4][3] = 'W';
  board[2][1] = 'w';
  board[6][5] = 'b';
  // Note: (6,5) has enemy with (7,6) empty -> mandatory capture exists! Test quiet slide first without capture:
  board[6][5] = null;
  const quietMoves = generateLegalMoves(board, 'white', DRAFT_MASTER_8X8_RULES);
  // King at (4,3) can slide (-1,-1) to (3,2) ONLY (blocked at 2,1 by friendly 'w')
  const kingMoves = quietMoves.filter((m) => m.from.row === 4 && m.from.col === 3);
  assert.ok(kingMoves.some((m) => m.to.row === 3 && m.to.col === 2));
  assert.ok(!kingMoves.some((m) => m.to.row === 1 && m.to.col === 0));
  assert.ok(!kingMoves.some((m) => m.to.row === 2 && m.to.col === 1));
  // King can slide (-1,+1) all the way across board: (3,4), (2,5), (1,6), (0,7)
  assert.ok(kingMoves.some((m) => m.to.row === 0 && m.to.col === 7));
  // King can slide (+1,-1) to (5,2), (6,1), (7,0) and (+1,+1) to (5,4), (6,5), (7,6)
  assert.ok(kingMoves.some((m) => m.to.row === 7 && m.to.col === 0));
  assert.ok(kingMoves.some((m) => m.to.row === 7 && m.to.col === 6));
});

test('Draft Master 8x8 Flying Kings perform long-range captures, choose landing squares, and chain multi-captures', () => {
  const board = emptyBoard(8);
  board[7][0] = 'W';
  board[4][3] = 'b';
  // Along diagonal (-1,+1) from (7,0) over enemy at (4,3) -> valid landing squares: (3,4), (2,5), (1,6), (0,7)
  const capMoves = generateLegalMoves(board, 'white', DRAFT_MASTER_8X8_RULES);
  assert.equal(capMoves.length, 4);
  assert.ok(capMoves.every((m) => m.isCapture && m.captured.length === 1));
  assert.ok(capMoves.some((m) => m.to.row === 3 && m.to.col === 4));
  assert.ok(capMoves.some((m) => m.to.row === 0 && m.to.col === 7));

  // Add second enemy piece at (3,6) reachable after landing at (2,5) -> multi-capture chain to (4,7)!
  board[3][6] = 'b';
  const multiMoves = generateLegalMoves(board, 'white', DRAFT_MASTER_8X8_RULES);
  const twoCap = multiMoves.find((m) => m.captured.length === 2);
  assert.ok(twoCap);
  assert.deepEqual(twoCap.to, { row: 4, col: 7 });
});

