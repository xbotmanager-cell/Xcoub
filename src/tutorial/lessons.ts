import {
  DRAFT_MASTER_8X8_RULES,
  ENGLISH_8X8_RULES,
  INTERNATIONAL_10X10_RULES,
  getPresetRules,
} from '../engine/presets.ts';
import { compressBoard } from '../engine/rules.ts';
import type { Coord, GameState, PieceCode, RuleConfig, VariantPreset } from '../engine/types.ts';

export interface TutorialLesson {
  id: string;
  track: VariantPreset;
  order: number;
  title: string;
  subtitle: string;
  coachLine: string;
  hintLine: string;
  successLine: string;
  rules: RuleConfig;
  initialBoard: PieceCode[][];
  playerSide: 'white' | 'black';
  highlightSquares: Coord[];
  expectedMove: {
    from: Coord;
    to: Coord;
    minCaptures?: number;
  } | null; // null = guided observation / demo step
  demoMove?: {
    from: Coord;
    to: Coord;
  };
}

function blank(size: 8 | 10): PieceCode[][] {
  return Array.from({ length: size }, () => Array<PieceCode>(size).fill(null));
}

function buildDraftMaster8x8Lessons(): TutorialLesson[] {
  // 1. 8x8 Board & Black opens
  const d1 = blank(8);
  d1[2][3] = 'b';
  d1[5][4] = 'w';

  // 2. Multi-capture chain
  const d2 = blank(8);
  d2[1][2] = 'b';
  d2[2][3] = 'w';
  d2[4][3] = 'w';

  // 3. Flying King Long-Range Movement
  const d3 = blank(8);
  d3[6][1] = 'B';
  d3[0][3] = 'w';

  // 4. Flying King Long-Range Capture
  const d4 = blank(8);
  d4[6][1] = 'B';
  d4[3][4] = 'w';
  d4[0][5] = 'w';

  // 5. Flying King Multi-Capture Turn
  const d5 = blank(8);
  d5[7][0] = 'B';
  d5[5][2] = 'w';
  d5[3][4] = 'b';
  d5[2][1] = 'w';

  return [
    {
      id: 'dm8_1_opening',
      track: 'draft_master_8x8',
      order: 1,
      title: 'The 8×8 Arena',
      subtitle: '32 dark squares, 12 pieces, Black moves first',
      coachLine:
        'Welcome to Draft Master 8×8! You play across 32 dark squares with 12 pieces per side—and promoted Kings gain full Flying King range. Advance your piece toward the center.',
      hintLine: 'Select your black piece on row 3, col 4 and step diagonally onto row 4, col 5.',
      successLine: 'Clean opening move. Central control gives your future Flying Kings wide diagonals.',
      rules: DRAFT_MASTER_8X8_RULES,
      initialBoard: d1,
      playerSide: 'black',
      highlightSquares: [{ row: 2, col: 3 }, { row: 3, col: 4 }],
      expectedMove: { from: { row: 2, col: 3 }, to: { row: 3, col: 4 } },
    },
    {
      id: 'dm8_2_multicapture',
      track: 'draft_master_8x8',
      order: 2,
      title: 'Mandatory & Multi-Captures',
      subtitle: 'Chain consecutive jumps in a single turn',
      coachLine:
        'Captures are mandatory. When a landing square reveals another jump, your piece sweeps through the entire chain in one turn. Clear both white pieces now!',
      hintLine: 'Jump from row 2, col 3 over both white men to finish at row 6, col 3.',
      successLine: 'Clinical double capture! Chain combinations are the quickest way to break a defense.',
      rules: DRAFT_MASTER_8X8_RULES,
      initialBoard: d2,
      playerSide: 'black',
      highlightSquares: [{ row: 1, col: 2 }, { row: 3, col: 4 }, { row: 5, col: 2 }],
      expectedMove: { from: { row: 1, col: 2 }, to: { row: 5, col: 2 }, minCaptures: 2 },
    },
    {
      id: 'dm8_3_flying_slide',
      track: 'draft_master_8x8',
      order: 3,
      title: 'Flying King Movement',
      subtitle: 'Long-range diagonal glide across the 8×8 board',
      coachLine:
        'Once promoted on the back rank, a Draft Master King becomes a Flying King! It can slide across any number of empty squares along a diagonal in one move. Fly to the far top-right corner.',
      hintLine: 'Select your King at (7, 2) and slide all the way to (1, 8).',
      successLine: 'Long-range dominance! Notice how a single Flying King controls the entire grand diagonal.',
      rules: DRAFT_MASTER_8X8_RULES,
      initialBoard: d3,
      playerSide: 'black',
      highlightSquares: [{ row: 6, col: 1 }, { row: 0, col: 7 }],
      expectedMove: { from: { row: 6, col: 1 }, to: { row: 0, col: 7 } },
    },
    {
      id: 'dm8_4_flying_capture',
      track: 'draft_master_8x8',
      order: 4,
      title: 'Flying King Long Capture',
      subtitle: 'Strike distant targets and choose your landing square',
      coachLine:
        'A Flying King can capture an enemy piece from several squares away and land on any open square beyond it along the diagonal. Strike the distant white man and land in the corner!',
      hintLine: 'Capture the white piece on row 4, col 5 and land at the top-right corner (0, 7).',
      successLine: 'Decisive long-range ambush. Choosing the right landing square sets up follow-up attacks.',
      rules: DRAFT_MASTER_8X8_RULES,
      initialBoard: d4,
      playerSide: 'black',
      highlightSquares: [{ row: 6, col: 1 }, { row: 0, col: 7 }],
      expectedMove: { from: { row: 6, col: 1 }, to: { row: 0, col: 7 }, minCaptures: 1 },
    },
    {
      id: 'dm8_5_flying_chain',
      track: 'draft_master_8x8',
      order: 5,
      title: 'Flying King Chain Strike',
      subtitle: 'Pivot diagonally across multiple distant targets',
      coachLine:
        'Master test: your Flying King can jump a distant piece, stop right before your friendly blocker, pivot 90 degrees, and capture a second distant defender in one fluid sequence!',
      hintLine: 'Jump over (6, 3) to pivot at (5, 4), then sweep over (3, 2) to finish at (2, 1).',
      successLine: 'Draft Master 8×8 Flying Kings certified! You are ready for Grandmaster play.',
      rules: DRAFT_MASTER_8X8_RULES,
      initialBoard: d5,
      playerSide: 'black',
      highlightSquares: [{ row: 7, col: 0 }, { row: 4, col: 3 }, { row: 1, col: 0 }],
      expectedMove: { from: { row: 7, col: 0 }, to: { row: 1, col: 0 }, minCaptures: 2 },
    },
  ];
}

function buildEnglishLessons(): TutorialLesson[] {
  // 1. Understanding the 8x8 Board
  const b1 = blank(8);
  b1[5][2] = 'b';
  b1[2][3] = 'w';
  b1[2][5] = 'w';

  // 2. Basic Forward Movement
  const b2 = blank(8);
  b2[2][3] = 'b';
  b2[5][4] = 'w';

  // 3. Capturing Opponents (Forward)
  const b3 = blank(8);
  b3[3][2] = 'b';
  b3[4][3] = 'w';

  // 4. Mandatory Capture Rule
  const b4 = blank(8);
  b4[2][1] = 'b';
  b4[3][4] = 'b';
  b4[4][5] = 'w';

  // 5. Multiple Captures
  const b5 = blank(8);
  b5[1][2] = 'b';
  b5[2][3] = 'w';
  b5[4][3] = 'w';

  // 6. King Promotion (Immediate Stop)
  const b6 = blank(8);
  b6[6][3] = 'b';
  b6[1][4] = 'w';

  // 7. 1-Square King Movement
  const b7 = blank(8);
  b7[4][3] = 'B';
  b7[5][4] = 'w';

  // 8. Winning Endgames (Opposition & Blockade)
  const b8 = blank(8);
  b8[3][2] = 'B';
  b8[2][3] = 'w';

  return [
    {
      id: 'eng_1_board',
      track: 'english_8x8',
      order: 1,
      title: 'Understanding the 8×8 Board',
      subtitle: '32 dark squares, 12 pieces per side',
      coachLine:
        'Welcome to the tactical room. In English Draughts, we battle across 32 dark squares on an 8×8 grid. Black opens the match. Advance your highlighted piece forward one diagonal square.',
      hintLine: 'Click the highlighted black piece on square 10 (row 3, col 4) and move diagonally down-right.',
      successLine: 'Clean start. Controlling the center diagonals early dictates the tempo.',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b2,
      playerSide: 'black',
      highlightSquares: [{ row: 2, col: 3 }, { row: 3, col: 4 }],
      expectedMove: { from: { row: 2, col: 3 }, to: { row: 3, col: 4 } },
    },
    {
      id: 'eng_2_pieces',
      track: 'english_8x8',
      order: 2,
      title: 'Men vs. Kings',
      subtitle: 'Understanding piece hierarchy',
      coachLine:
        'Standard men march forward one diagonal step at a time. When a man reaches the far back rank, it earns a crown and becomes a King able to move backward too. Move your piece toward the center.',
      hintLine: 'Select your piece on row 6, col 3 and step forward onto row 5, col 2.',
      successLine: 'Well positioned. Keep your pieces connected so they guard each other.',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b1,
      playerSide: 'black',
      highlightSquares: [{ row: 5, col: 2 }, { row: 6, col: 1 }],
      expectedMove: { from: { row: 5, col: 2 }, to: { row: 6, col: 1 } },
    },
    {
      id: 'eng_3_capture',
      track: 'english_8x8',
      order: 3,
      title: 'Forward Captures',
      subtitle: 'Jumping over enemy pieces',
      coachLine:
        'In English Draughts, men capture forward only by jumping diagonally over an adjacent enemy onto the empty square directly behind it. Take the white piece now!',
      hintLine: 'Jump from row 4, col 3 over the white piece to row 5, col 4.',
      successLine: 'Decisive strike. Notice how removing that outpost opens the lane.',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b3,
      playerSide: 'black',
      highlightSquares: [{ row: 3, col: 2 }, { row: 5, col: 4 }],
      expectedMove: { from: { row: 3, col: 2 }, to: { row: 5, col: 4 }, minCaptures: 1 },
    },
    {
      id: 'eng_4_mandatory',
      track: 'english_8x8',
      order: 4,
      title: 'Mandatory Capture Rule',
      subtitle: 'Captures are never optional',
      coachLine:
        'Pay sharp attention here: whenever a capture is available on the board, you MUST take it—even if another piece has a quiet move. Execute the mandatory jump.',
      hintLine: 'The piece at row 4, col 5 has a forced capture over row 5, col 6.',
      successLine: 'Correct discipline. Never miss a forced capture—you can use this rule to set traps!',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b4,
      playerSide: 'black',
      highlightSquares: [{ row: 3, col: 4 }, { row: 5, col: 6 }],
      expectedMove: { from: { row: 3, col: 4 }, to: { row: 5, col: 6 }, minCaptures: 1 },
    },
    {
      id: 'eng_5_multi',
      track: 'english_8x8',
      order: 5,
      title: 'Multiple Captures',
      subtitle: 'Chain jumps in a single turn',
      coachLine:
        'When a landing square reveals another jump, you must complete the entire capture chain in one turn. Sweep both white pieces off the board.',
      hintLine: 'Jump from row 2, col 3 over both white men ending at row 5, col 2.',
      successLine: 'Clinical two-for-one combination! That swings the endgame immediately.',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b5,
      playerSide: 'black',
      highlightSquares: [{ row: 1, col: 2 }, { row: 3, col: 4 }, { row: 5, col: 2 }],
      expectedMove: { from: { row: 1, col: 2 }, to: { row: 5, col: 2 }, minCaptures: 2 },
    },
    {
      id: 'eng_6_promotion',
      track: 'english_8x8',
      order: 6,
      title: 'King Promotion',
      subtitle: 'Crowning on the eighth rank',
      coachLine:
        'Reach the opponent’s back rank to crown your man into a King. In English 8×8, reaching the back rank immediately completes your turn. Claim your crown!',
      hintLine: 'Advance your man from row 7, col 4 to the bottom rank.',
      successLine: 'Crowned! Now your King controls both forward and backward diagonals.',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b6,
      playerSide: 'black',
      highlightSquares: [{ row: 6, col: 3 }, { row: 7, col: 2 }],
      expectedMove: { from: { row: 6, col: 3 }, to: { row: 7, col: 2 } },
    },
    {
      id: 'eng_7_king',
      track: 'english_8x8',
      order: 7,
      title: 'King Tactics (8×8)',
      subtitle: 'One-square backward and forward power',
      coachLine:
        'An English King moves one square diagonally in all four directions. Use your backward mobility to ambush the white piece below.',
      hintLine: 'Capture the white piece diagonally with your King.',
      successLine: 'Commanding use of the King. Mobility wins tight endings.',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b7,
      playerSide: 'black',
      highlightSquares: [{ row: 4, col: 3 }, { row: 6, col: 5 }],
      expectedMove: { from: { row: 4, col: 3 }, to: { row: 6, col: 5 }, minCaptures: 1 },
    },
    {
      id: 'eng_8_endgame',
      track: 'english_8x8',
      order: 8,
      title: 'Winning Endgames',
      subtitle: 'Back-rank ambush & final strike',
      coachLine:
        'Final test for 8×8 certification: your King is behind enemy lines. Strike backward over the final white defender to seal the victory!',
      hintLine: 'Jump backward-right with your King from row 4, col 3 to row 2, col 5.',
      successLine: 'Match won! You have mastered official English Draughts (8×8).',
      rules: ENGLISH_8X8_RULES,
      initialBoard: b8,
      playerSide: 'black',
      highlightSquares: [{ row: 3, col: 2 }, { row: 1, col: 4 }],
      expectedMove: { from: { row: 3, col: 2 }, to: { row: 1, col: 4 }, minCaptures: 1 },
    },
  ];
}

function buildInternationalLessons(): TutorialLesson[] {
  // 1. 10x10 Board & White opens
  const i1 = blank(10);
  i1[6][3] = 'w';
  i1[3][4] = 'b';

  // 2. Backward Man Capture (unique to 10x10!)
  const i2 = blank(10);
  i2[4][3] = 'w';
  i2[5][4] = 'b';

  // 3. Maximum Capture Rule
  const i3 = blank(10);
  i3[5][4] = 'w';
  i3[4][3] = 'b';
  i3[6][5] = 'b';
  i3[6][7] = 'b';

  // 4. Flying King Long-Range Slide & Capture
  const i4 = blank(10);
  i4[8][1] = 'W';
  i4[5][4] = 'b';

  // 5. Touch-and-Pass Promotion Rule
  const i5 = blank(10);
  i5[2][1] = 'w';
  i5[1][2] = 'b';
  i5[1][4] = 'b';

  // 6. Strategic Center & Grand Diagonal Control
  const i6 = blank(10);
  i6[6][5] = 'w';
  i6[7][4] = 'w';
  i6[3][4] = 'b';

  return [
    {
      id: 'intl_1_board',
      track: 'international_10x10',
      order: 1,
      title: 'The 10×10 Arena',
      subtitle: '50 squares, 20 pieces, White moves first',
      coachLine:
        'Step up to the Championship 10×10 board. In International Draughts, White moves first across 50 playable squares. Open strongly toward the center.',
      hintLine: 'Move your white man from row 7, col 4 diagonally forward to row 6, col 5.',
      successLine: 'Good tempo. Center space is vital on a 10×10 board.',
      rules: INTERNATIONAL_10X10_RULES,
      initialBoard: i1,
      playerSide: 'white',
      highlightSquares: [{ row: 6, col: 3 }, { row: 5, col: 4 }],
      expectedMove: { from: { row: 6, col: 3 }, to: { row: 5, col: 4 } },
    },
    {
      id: 'intl_2_backward',
      track: 'international_10x10',
      order: 2,
      title: 'Backward Man Captures',
      subtitle: 'Men strike in all four diagonal directions',
      coachLine:
        'Crucial difference from 8×8: in International 10×10, ordinary men can capture BOTH forward and backward! Snap up the black piece behind you.',
      hintLine: 'Jump backward-right from row 5, col 4 over row 6, col 5.',
      successLine: 'Sharp eyes! Never leave your back diagonals unguarded in 10×10.',
      rules: INTERNATIONAL_10X10_RULES,
      initialBoard: i2,
      playerSide: 'white',
      highlightSquares: [{ row: 4, col: 3 }, { row: 6, col: 5 }],
      expectedMove: { from: { row: 4, col: 3 }, to: { row: 6, col: 5 }, minCaptures: 1 },
    },
    {
      id: 'intl_3_maxcap',
      track: 'international_10x10',
      order: 3,
      title: 'The Maximum Capture Law',
      subtitle: 'You must take the highest-count chain',
      coachLine:
        'In 10×10, you have a 1-piece capture forward OR a 2-piece capture backward. Official International rules FORCE you to choose the 2-piece chain!',
      hintLine: 'Take the 2-piece backward-and-forward chain starting over row 7, col 6.',
      successLine: 'Exact adherence to the maximum capture rule. This enables brilliant sacrificial combinations!',
      rules: INTERNATIONAL_10X10_RULES,
      initialBoard: i3,
      playerSide: 'white',
      highlightSquares: [{ row: 5, col: 4 }, { row: 7, col: 6 }, { row: 5, col: 8 }],
      expectedMove: { from: { row: 5, col: 4 }, to: { row: 5, col: 8 }, minCaptures: 2 },
    },
    {
      id: 'intl_4_flying',
      track: 'international_10x10',
      order: 4,
      title: 'Flying Kings',
      subtitle: 'Long-range diagonal dominance',
      coachLine:
        'International Kings fly across any number of empty squares—and when capturing, can land on ANY open square beyond the victim! Slide down and strike.',
      hintLine: 'Use your King on (9, 1) to capture the black piece and land on the far top-right corner.',
      successLine: 'Long-range precision. Flying Kings turn the entire board into a tactical web.',
      rules: INTERNATIONAL_10X10_RULES,
      initialBoard: i4,
      playerSide: 'white',
      highlightSquares: [{ row: 8, col: 1 }, { row: 0, col: 9 }],
      expectedMove: { from: { row: 8, col: 1 }, to: { row: 0, col: 9 }, minCaptures: 1 },
    },
    {
      id: 'intl_5_touchpass',
      track: 'international_10x10',
      order: 5,
      title: 'Touch-and-Pass Promotion',
      subtitle: 'Only finishing on row 1 crowns a King',
      coachLine:
        'If a man touches the promotion row mid-capture and keeps jumping off it, it stays a Man! Execute the 2-piece capture passing through the top rank.',
      hintLine: 'Capture over (2, 3) to the top row, then bounce backward over (2, 5).',
      successLine: 'Mastered! Only ending your turn on the crown row grants King status in 10×10.',
      rules: INTERNATIONAL_10X10_RULES,
      initialBoard: i5,
      playerSide: 'white',
      highlightSquares: [{ row: 2, col: 1 }, { row: 0, col: 3 }, { row: 2, col: 5 }],
      expectedMove: { from: { row: 2, col: 1 }, to: { row: 2, col: 5 }, minCaptures: 2 },
    },
    {
      id: 'intl_6_strategy',
      track: 'international_10x10',
      order: 6,
      title: 'Center Outposts & Tempo',
      subtitle: 'Building connected wedges',
      coachLine:
        'Support your forward spearhead from behind so any exchange trades in your favor. Advance your flank piece to reinforce the center wedge.',
      hintLine: 'Move your front white piece at row 7, col 6 forward onto the central diagonal.',
      successLine: 'International 10×10 Mastery certified! You are ready for Grandmaster play.',
      rules: INTERNATIONAL_10X10_RULES,
      initialBoard: i6,
      playerSide: 'white',
      highlightSquares: [{ row: 6, col: 5 }, { row: 5, col: 4 }],
      expectedMove: { from: { row: 6, col: 5 }, to: { row: 5, col: 4 } },
    },
  ];
}

function buildCustomLessons(): TutorialLesson[] {
  const customHybrid = getPresetRules('custom', {
    name: 'Custom Hybrid (8×8 Flying + Optional Capture)',
    boardSize: 8,
    firstPlayer: 'white',
    flyingKings: true,
    menCaptureBackward: true,
    mandatoryCapture: false,
    maximumCapture: false,
  });

  const c1 = blank(8);
  c1[4][3] = 'w';
  c1[3][4] = 'b';

  const c2 = blank(8);
  c2[6][1] = 'W';
  c2[4][3] = 'b';

  return [
    {
      id: 'cust_1_optional',
      track: 'custom',
      order: 1,
      title: 'Custom Capture Freedom',
      subtitle: 'Playing when Mandatory Capture is OFF',
      coachLine:
        'In Custom Rules, you decide the laws! With Mandatory Capture turned OFF, you can decline a capture to pursue a positional move instead. Try declining the jump to retreat safely.',
      hintLine: 'Instead of capturing (3, 4), move quietly left to row 4, col 3.',
      successLine: 'Exactly right—custom rules completely transform tactical priorities.',
      rules: customHybrid,
      initialBoard: c1,
      playerSide: 'white',
      highlightSquares: [{ row: 4, col: 3 }, { row: 3, col: 2 }],
      expectedMove: { from: { row: 4, col: 3 }, to: { row: 3, col: 2 } },
    },
    {
      id: 'cust_2_flying8',
      track: 'custom',
      order: 2,
      title: '8×8 Flying Kings',
      subtitle: 'Hybrid speed on a compact board',
      coachLine:
        'Enabling Flying Kings on an 8×8 board creates explosive long-diagonal strikes. Sweep across the 8×8 board to capture and land in the far corner.',
      hintLine: 'Fly your King from (7, 2) over (5, 4) all the way to (1, 8).',
      successLine: 'Custom Mastery unlocked! Configure any rule combination in Rules & Board Settings.',
      rules: customHybrid,
      initialBoard: c2,
      playerSide: 'white',
      highlightSquares: [{ row: 6, col: 1 }, { row: 0, col: 7 }],
      expectedMove: { from: { row: 6, col: 1 }, to: { row: 0, col: 7 }, minCaptures: 1 },
    },
  ];
}

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  ...buildDraftMaster8x8Lessons(),
  ...buildEnglishLessons(),
  ...buildInternationalLessons(),
  ...buildCustomLessons(),
];

export function createLessonGameState(lesson: TutorialLesson): GameState {
  const compressed = compressBoard(lesson.initialBoard, lesson.rules.boardSize);
  return {
    boardSize: lesson.rules.boardSize,
    board: lesson.initialBoard.map((r) => r.slice()),
    initialBoardCompressed: compressed,
    initialTurn: lesson.playerSide,
    turn: lesson.playerSide,
    rules: lesson.rules,
    moveCount: 0,
    noProgressCount: 0,
    positionCounts: { [`${lesson.playerSide}:${compressed}`]: 1 },
    status: 'playing',
    history: [],
  };
}
