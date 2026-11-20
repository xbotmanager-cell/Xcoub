import type { AIDifficultyId, GameState, RuleConfig, VariantPreset } from '../engine/types.ts';

export interface SavedMatchRecord {
  id: string;
  title: string;
  mode: 'ai' | 'local' | 'online';
  variantPreset: VariantPreset;
  rules: RuleConfig;
  difficulty?: AIDifficultyId;
  playerSide?: 'white' | 'black';
  opponentName: string;
  result: 'playing' | 'win' | 'loss' | 'draw';
  state: GameState;
  updatedAt: number;
}

export interface ChallengeProgress {
  id: string;
  title: string;
  description: string;
  period: 'daily' | 'weekly';
  target: number;
  progress: number;
  xpReward: number;
  claimed: boolean;
}

export interface LocalPlayerData {
  guestId: string;
  username: string;
  country: string;
  eloEnglish: number;
  eloInternational: number;
  eloCustom: number;
  peakElo: number;
  xp: number;
  level: number;
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  favoriteVariant: VariantPreset;
  badges: string[];
  unlockedThemes: string[];
  selectedBoardTheme: string;
  selectedPieceTheme: string;
  themeMode: 'dark' | 'light';
  soundEnabled: boolean;
  voiceCoachEnabled: boolean;
  showAIThinking: boolean;
  tutorialCompleted: {
    draft_master_8x8: string[];
    english_8x8: string[];
    international_10x10: string[];
    custom: string[];
  };
  challenges: ChallengeProgress[];
  savedMatches: SavedMatchRecord[];
  customRules: RuleConfig | null;
}

const STORAGE_KEY = 'draft_master_local_v1';

function createGuestId(): string {
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const BOARD_THEMES = [
  {
    id: 'walnut',
    name: 'Tournament Walnut',
    lightSquare: '#E7D5B8',
    darkSquare: '#5C3D28',
    frame: '#2B1B12',
    unlockLevel: 1,
  },
  {
    id: 'slate',
    name: 'Midnight Slate',
    lightSquare: '#CBD5E1',
    darkSquare: '#1E293B',
    frame: '#0F172A',
    unlockLevel: 1,
  },
  {
    id: 'emerald',
    name: 'Club Felt Emerald',
    lightSquare: '#D1FAE5',
    darkSquare: '#0F5132',
    frame: '#062C1B',
    unlockLevel: 2,
  },
  {
    id: 'obsidian_brass',
    name: 'Obsidian & Brass',
    lightSquare: '#D4CFC7',
    darkSquare: '#27272A',
    frame: '#18181B',
    unlockLevel: 4,
  },
] as const;

export const PIECE_THEMES = [
  { id: 'obsidian_ivory', name: 'Obsidian & Ivory', unlockLevel: 1 },
  { id: 'crimson_pearl', name: 'Crimson & Pearl', unlockLevel: 2 },
  { id: 'royal_amber', name: 'Amber & Ebony', unlockLevel: 3 },
] as const;

const DEFAULT_CHALLENGES: ChallengeProgress[] = [
  {
    id: 'daily_play_2',
    title: 'Opening Routine',
    description: 'Complete 2 matches in any variant today.',
    period: 'daily',
    target: 2,
    progress: 0,
    xpReward: 120,
    claimed: false,
  },
  {
    id: 'daily_captures_5',
    title: 'Tactical Striker',
    description: 'Execute 5 piece captures across matches.',
    period: 'daily',
    target: 5,
    progress: 0,
    xpReward: 150,
    claimed: false,
  },
  {
    id: 'weekly_intl_win',
    title: '10×10 Tactician',
    description: 'Win a match in International Draughts (10×10).',
    period: 'weekly',
    target: 1,
    progress: 0,
    xpReward: 320,
    claimed: false,
  },
  {
    id: 'weekly_hard_ai',
    title: 'Engine Challenger',
    description: 'Win a match against Hard AI or higher.',
    period: 'weekly',
    target: 1,
    progress: 0,
    xpReward: 450,
    claimed: false,
  },
];

export function createDefaultLocalData(): LocalPlayerData {
  return {
    guestId: createGuestId(),
    username: 'Tactician',
    country: 'Global',
    eloEnglish: 1200,
    eloInternational: 1200,
    eloCustom: 1200,
    peakElo: 1200,
    xp: 0,
    level: 1,
    totalGames: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    favoriteVariant: 'draft_master_8x8',
    badges: ['Welcome Competitor'],
    unlockedThemes: ['walnut', 'slate'],
    selectedBoardTheme: 'walnut',
    selectedPieceTheme: 'obsidian_ivory',
    themeMode: 'dark',
    soundEnabled: true,
    voiceCoachEnabled: true,
    showAIThinking: true,
    tutorialCompleted: {
      draft_master_8x8: [],
      english_8x8: [],
      international_10x10: [],
      custom: [],
    },
    challenges: DEFAULT_CHALLENGES,
    savedMatches: [],
    customRules: null,
  };
}

export function loadLocalPlayerData(): LocalPlayerData {
  if (typeof window === 'undefined') return createDefaultLocalData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultLocalData();
    const parsed = JSON.parse(raw) as Partial<LocalPlayerData>;
    const defaults = createDefaultLocalData();
    return {
      ...defaults,
      ...parsed,
      tutorialCompleted: {
        ...defaults.tutorialCompleted,
        ...(parsed.tutorialCompleted ?? {}),
      },
      challenges: Array.isArray(parsed.challenges) && parsed.challenges.length > 0 ? parsed.challenges : defaults.challenges,
      savedMatches: Array.isArray(parsed.savedMatches) ? parsed.savedMatches : [],
    };
  } catch {
    return createDefaultLocalData();
  }
}

export function saveLocalPlayerData(data: LocalPlayerData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not persist local data:', err);
  }
}

export function calculateLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

export function computeEloDelta(playerElo: number, opponentElo: number, score: 1 | 0.5 | 0): number {
  const k = 24;
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(k * (score - expected));
}
