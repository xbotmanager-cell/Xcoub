import type { PieceCode, PlayerSide } from './types.ts';

// Deterministic PRNG (SplitMix32) for Zobrist table generation across environments
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0);
  };
}

const PIECE_INDEX: Record<Exclude<PieceCode, null>, number> = {
  w: 0,
  W: 1,
  b: 2,
  B: 3,
};

// Precompute Zobrist 64-bit hashes (stored as two 32-bit unsigned ints for fast JS bitwise ops)
const MAX_CELLS = 100;
const PIECE_TYPES = 4;
const rng = mulberry32(0x5f3759df);

const zobristHi = new Uint32Array(MAX_CELLS * PIECE_TYPES);
const zobristLo = new Uint32Array(MAX_CELLS * PIECE_TYPES);

for (let i = 0; i < MAX_CELLS * PIECE_TYPES; i++) {
  zobristHi[i] = rng();
  zobristLo[i] = rng();
}

const turnHi = rng();
const turnLo = rng();

export function computeZobristHash(board: PieceCode[][], boardSize: 8 | 10, turn: PlayerSide): string {
  let hi = 0;
  let lo = 0;

  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (p) {
        const idx = (r * boardSize + c) * PIECE_TYPES + PIECE_INDEX[p];
        hi ^= zobristHi[idx];
        lo ^= zobristLo[idx];
      }
    }
  }

  if (turn === 'black') {
    hi ^= turnHi;
    lo ^= turnLo;
  }

  return `${(hi >>> 0).toString(16)}_${(lo >>> 0).toString(16)}`;
}
