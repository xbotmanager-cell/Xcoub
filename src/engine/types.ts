export type PlayerSide = 'white' | 'black';

export type PieceType = 'man' | 'king';

export type PieceCode = 'w' | 'W' | 'b' | 'B' | null;

export type VariantPreset = 'draft_master_8x8' | 'english_8x8' | 'international_10x10' | 'custom';

export type PromotionMode = 'immediate_stop' | 'end_of_turn_only' | 'immediate_continue';

export interface RuleConfig {
  preset: VariantPreset;
  name: string;
  boardSize: 8 | 10;
  startingRows: 2 | 3 | 4;
  firstPlayer: PlayerSide;
  menMoveDirection: 'forward' | 'both';
  menCaptureBackward: boolean;
  flyingKings: boolean;
  mandatoryCapture: boolean;
  maximumCapture: boolean;
  multipleCaptures: boolean;
  promotionMode: PromotionMode;
  drawNoProgressMoves: number;
}

export interface Coord {
  row: number;
  col: number;
}

export interface DraughtsMove {
  from: Coord;
  to: Coord;
  path: Coord[]; // intermediate + final squares (excluding `from`, length >= 1)
  captured: Coord[]; // coordinates of captured opponent pieces in order
  promoted: boolean;
  notation: string;
  isCapture: boolean;
}

export type GameStatus = 'playing' | 'white_won' | 'black_won' | 'draw';

export type EndReason =
  | 'no_pieces'
  | 'no_legal_moves'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  | 'insufficient_material'
  | 'resignation'
  | 'timeout'
  | 'agreement';

export interface GameState {
  boardSize: 8 | 10;
  board: PieceCode[][];
  initialBoardCompressed?: string;
  initialTurn?: PlayerSide;
  turn: PlayerSide;
  rules: RuleConfig;
  moveCount: number;
  noProgressCount: number; // consecutive half-moves without capture or man movement
  positionCounts: Record<string, number>;
  status: GameStatus;
  endReason?: EndReason;
  history: MoveRecord[];
}

export interface MoveRecord {
  ply: number;
  side: PlayerSide;
  move: DraughtsMove;
  boardCompressed: string;
  timestamp: number;
}

export type AIDifficultyId =
  | 'beginner'
  | 'easy'
  | 'normal'
  | 'medium'
  | 'hard'
  | 'expert'
  | 'master'
  | 'legendary';

export interface AIDifficultyProfile {
  id: AIDifficultyId;
  level: number;
  label: string;
  eloEstimate: number;
  maxDepth: number;
  timeBudgetMs: number;
  randomnessCp: number;
  useQuiescence: boolean;
  useTransposition: boolean;
  usePVS: boolean;
  description: string;
}

export interface AIAnalysisResult {
  bestMove: DraughtsMove | null;
  scoreCp: number; // positive = good for side to move (or normalized white perspective)
  whiteEvalCp: number;
  depthReached: number;
  nodesAnalyzed: number;
  elapsedMs: number;
  principalVariation: string[];
  explanation: string;
  candidateMoves: Array<{
    notation: string;
    scoreCp: number;
  }>;
}
