import assert from 'node:assert/strict';
import test from 'node:test';
import { findBestMove } from '../src/ai/search.ts';
import {
  AI_DIFFICULTY_LIST,
  ENGLISH_8X8_RULES,
  INTERNATIONAL_10X10_RULES,
  getPresetRules,
} from '../src/engine/presets.ts';
import {
  compressBoard,
  createInitialGameState,
  validateMove,
} from '../src/engine/rules.ts';
import type { GameState, PieceCode } from '../src/engine/types.ts';

function emptyBoard(size: 8 | 10): PieceCode[][] {
  return Array.from({ length: size }, () => Array<PieceCode>(size).fill(null));
}

test('All 8 AI difficulty levels produce strictly legal moves on 8x8 and 10x10', () => {
  const s8 = createInitialGameState(ENGLISH_8X8_RULES);
  const s10 = createInitialGameState(INTERNATIONAL_10X10_RULES);

  for (const diff of AI_DIFFICULTY_LIST) {
    const res8 = findBestMove(s8, diff.id, 120);
    assert.ok(res8.bestMove, `Expected legal move on 8x8 for ${diff.id}`);
    assert.ok(validateMove(s8, res8.bestMove), `Move on 8x8 must be legal for ${diff.id}`);

    const res10 = findBestMove(s10, diff.id, 120);
    assert.ok(res10.bestMove, `Expected legal move on 10x10 for ${diff.id}`);
    assert.ok(validateMove(s10, res10.bestMove), `Move on 10x10 must be legal for ${diff.id}`);
  }
});

test('Legendary AI spots forced winning capture sequence without cheating', () => {
  const board = emptyBoard(10);
  // White has a flying king vs 2 Black men in line to be captured
  board[9][0] = 'W';
  board[6][3] = 'b';
  board[4][5] = 'b';
  const state: GameState = {
    boardSize: 10,
    board,
    turn: 'white',
    rules: INTERNATIONAL_10X10_RULES,
    moveCount: 0,
    noProgressCount: 0,
    positionCounts: { [`white:${compressBoard(board, 10)}`]: 1 },
    status: 'playing',
    history: [],
  };

  const res = findBestMove(state, 'legendary', 400);
  assert.ok(res.bestMove);
  assert.equal(res.bestMove.isCapture, true);
  assert.equal(res.bestMove.captured.length, 2);
  assert.ok(res.nodesAnalyzed >= 1);
  assert.ok(res.depthReached >= 1);
  assert.ok(res.explanation.length > 0);
});

test('AI respects custom rule configurations without mixing 8x8/10x10 logic', () => {
  const custom = getPresetRules('custom', {
    boardSize: 8,
    flyingKings: true,
    mandatoryCapture: false,
  });
  const state = createInitialGameState(custom);
  const res = findBestMove(state, 'hard', 200);
  assert.ok(res.bestMove);
  assert.ok(validateMove(state, res.bestMove));
});
