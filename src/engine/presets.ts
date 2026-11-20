import type { AIDifficultyId, AIDifficultyProfile, RuleConfig, VariantPreset } from './types.ts';

/**
 * Default 8x8 Draft Master ruleset featuring Flying Kings (long-range diagonal movement & captures).
 */
export const DRAFT_MASTER_8X8_RULES: RuleConfig = {
  preset: 'draft_master_8x8',
  name: 'Draft Master 8×8 (Flying Kings)',
  boardSize: 8,
  startingRows: 3,
  firstPlayer: 'black',
  menMoveDirection: 'forward',
  menCaptureBackward: false,
  flyingKings: true,
  mandatoryCapture: true,
  maximumCapture: false,
  multipleCaptures: true,
  promotionMode: 'immediate_stop',
  drawNoProgressMoves: 80,
};

export const ENGLISH_8X8_RULES: RuleConfig = {
  preset: 'english_8x8',
  name: 'English Draughts (8×8 Classic)',
  boardSize: 8,
  startingRows: 3,
  firstPlayer: 'black',
  menMoveDirection: 'forward',
  menCaptureBackward: false,
  flyingKings: false,
  mandatoryCapture: true,
  maximumCapture: false,
  multipleCaptures: true,
  promotionMode: 'immediate_stop',
  drawNoProgressMoves: 80,
};

export const INTERNATIONAL_10X10_RULES: RuleConfig = {
  preset: 'international_10x10',
  name: 'International Draughts (10×10)',
  boardSize: 10,
  startingRows: 4,
  firstPlayer: 'white',
  menMoveDirection: 'forward',
  menCaptureBackward: true,
  flyingKings: true,
  mandatoryCapture: true,
  maximumCapture: true,
  multipleCaptures: true,
  promotionMode: 'end_of_turn_only',
  drawNoProgressMoves: 50,
};

export function getPresetRules(preset: VariantPreset, customOverrides?: Partial<RuleConfig>): RuleConfig {
  if (preset === 'draft_master_8x8') {
    return { ...DRAFT_MASTER_8X8_RULES };
  }
  if (preset === 'english_8x8') {
    return { ...ENGLISH_8X8_RULES };
  }
  if (preset === 'international_10x10') {
    return { ...INTERNATIONAL_10X10_RULES };
  }
  const base = customOverrides?.boardSize === 10 ? INTERNATIONAL_10X10_RULES : DRAFT_MASTER_8X8_RULES;
  const boardSize: 8 | 10 = customOverrides?.boardSize === 10 ? 10 : 8;
  const maxStartingRows = boardSize === 10 ? 4 : 3;
  const rawRows = customOverrides?.startingRows ?? (boardSize === 10 ? 4 : 3);
  const startingRows = (rawRows > maxStartingRows ? maxStartingRows : rawRows < 2 ? 2 : rawRows) as 2 | 3 | 4;

  const merged: RuleConfig = {
    ...base,
    ...customOverrides,
    preset: 'custom',
    name: customOverrides?.name || `Custom Draughts (${boardSize}×${boardSize})`,
    boardSize,
    startingRows,
  };

  if (
    isExactOfficialMatch(merged, DRAFT_MASTER_8X8_RULES) ||
    isExactOfficialMatch(merged, ENGLISH_8X8_RULES) ||
    isExactOfficialMatch(merged, INTERNATIONAL_10X10_RULES)
  ) {
    merged.preset = 'custom';
    merged.name = `Custom Draughts (${boardSize}×${boardSize})`;
  }

  return merged;
}

function isExactOfficialMatch(a: RuleConfig, b: RuleConfig): boolean {
  return (
    a.boardSize === b.boardSize &&
    a.startingRows === b.startingRows &&
    a.firstPlayer === b.firstPlayer &&
    a.menMoveDirection === b.menMoveDirection &&
    a.menCaptureBackward === b.menCaptureBackward &&
    a.flyingKings === b.flyingKings &&
    a.mandatoryCapture === b.mandatoryCapture &&
    a.maximumCapture === b.maximumCapture &&
    a.multipleCaptures === b.multipleCaptures &&
    a.promotionMode === b.promotionMode
  );
}

export const AI_DIFFICULTIES: Record<AIDifficultyId, AIDifficultyProfile> = {
  beginner: {
    id: 'beginner',
    level: 1,
    label: 'Beginner',
    eloEstimate: 650,
    maxDepth: 1,
    timeBudgetMs: 80,
    randomnessCp: 160,
    useQuiescence: false,
    useTransposition: false,
    usePVS: false,
    description: 'Learns basic captures and avoids obvious blunders only occasionally.',
  },
  easy: {
    id: 'easy',
    level: 2,
    label: 'Easy',
    eloEstimate: 900,
    maxDepth: 2,
    timeBudgetMs: 140,
    randomnessCp: 85,
    useQuiescence: false,
    useTransposition: false,
    usePVS: false,
    description: 'Spots immediate 1-move tactics and basic piece exchanges.',
  },
  normal: {
    id: 'normal',
    level: 3,
    label: 'Normal',
    eloEstimate: 1150,
    maxDepth: 3,
    timeBudgetMs: 220,
    randomnessCp: 35,
    useQuiescence: true,
    useTransposition: true,
    usePVS: false,
    description: 'Solid club-casual play with capture-tree awareness.',
  },
  medium: {
    id: 'medium',
    level: 4,
    label: 'Medium',
    eloEstimate: 1400,
    maxDepth: 4,
    timeBudgetMs: 360,
    randomnessCp: 14,
    useQuiescence: true,
    useTransposition: true,
    usePVS: false,
    description: 'Balanced positional control with center awareness and tactical lookahead.',
  },
  hard: {
    id: 'hard',
    level: 5,
    label: 'Hard',
    eloEstimate: 1680,
    maxDepth: 5,
    timeBudgetMs: 600,
    randomnessCp: 4,
    useQuiescence: true,
    useTransposition: true,
    usePVS: true,
    description: 'Strong tactical opponent calculating multi-step combinations.',
  },
  expert: {
    id: 'expert',
    level: 6,
    label: 'Expert',
    eloEstimate: 1950,
    maxDepth: 6,
    timeBudgetMs: 950,
    randomnessCp: 0,
    useQuiescence: true,
    useTransposition: true,
    usePVS: true,
    description: 'Zero-noise Principal Variation Search with king-mobility heuristics.',
  },
  master: {
    id: 'master',
    level: 7,
    label: 'Master',
    eloEstimate: 2220,
    maxDepth: 8,
    timeBudgetMs: 1500,
    randomnessCp: 0,
    useQuiescence: true,
    useTransposition: true,
    usePVS: true,
    description: 'Tournament-strength iterative deepening with endgame tempo evaluation.',
  },
  legendary: {
    id: 'legendary',
    level: 8,
    label: 'Legendary',
    eloEstimate: 2550,
    maxDepth: 11,
    timeBudgetMs: 2400,
    randomnessCp: 0,
    useQuiescence: true,
    useTransposition: true,
    usePVS: true,
    description: 'Flagship deep-search engine with full candidate analysis and endgame precision.',
  },
};

export const AI_DIFFICULTY_LIST: AIDifficultyProfile[] = Object.values(AI_DIFFICULTIES);
