import type { AIDifficultyId, GameState } from '../engine/types.ts';
import { findBestMove } from './search.ts';

interface WorkerRequest {
  requestId: string;
  state: GameState;
  difficulty: AIDifficultyId;
  budgetMs?: number;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { requestId, state, difficulty, budgetMs } = event.data;
  try {
    const result = findBestMove(state, difficulty, budgetMs);
    self.postMessage({ requestId, ok: true, result });
  } catch (err) {
    self.postMessage({
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : 'AI computation failed',
    });
  }
};
