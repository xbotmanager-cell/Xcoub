import { isKingPiece, oppositeSide } from '../engine/rules.ts';
import type { PieceCode, PlayerSide, RuleConfig } from '../engine/types.ts';

/**
 * Evaluates the board from the perspective of `perspectiveSide` in centipawns.
 * Positive = advantage for `perspectiveSide`.
 * Adapts dynamically to boardSize (8x8 or 10x10) and flyingKings / capture rules.
 */
export function evaluatePosition(
  board: PieceCode[][],
  perspectiveSide: PlayerSide,
  rules: RuleConfig
): number {
  const size = rules.boardSize;
  const kingValue = rules.flyingKings ? 395 : 320;
  const manValue = 100;

  let whiteScore = 0;
  let blackScore = 0;
  let whiteCount = 0;
  let blackCount = 0;
  let whiteKings = 0;
  let blackKings = 0;

  let whiteRowSum = 0;
  let whiteColSum = 0;
  let blackRowSum = 0;
  let blackColSum = 0;

  const centerCoord = (size - 1) / 2;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const isWhite = piece === 'w' || piece === 'W';
      const isKing = isKingPiece(piece);

      let score = isKing ? kingValue : manValue;

      // Center control bonus
      const distCenter = Math.abs(r - centerCoord) + Math.abs(c - centerCoord);
      const centerBonus = Math.max(0, Math.round((size - distCenter) * (isKing ? 4.5 : 2.8)));
      score += centerBonus;

      if (!isKing) {
        // Advancement toward promotion
        const adv = isWhite ? size - 1 - r : r;
        score += adv * 4;

        // Back rank defense (golden piece / bridge guard) in opening/midgame
        if ((isWhite && r === size - 1) || (!isWhite && r === 0)) {
          score += 14;
        }

        // Support / chain protection from friendly neighbors behind
        const backR = isWhite ? r + 1 : r - 1;
        if (backR >= 0 && backR < size) {
          const leftSupport = c - 1 >= 0 ? board[backR][c - 1] : null;
          const rightSupport = c + 1 < size ? board[backR][c + 1] : null;
          if (
            leftSupport &&
            ((isWhite && (leftSupport === 'w' || leftSupport === 'W')) ||
              (!isWhite && (leftSupport === 'b' || leftSupport === 'B')))
          ) {
            score += 7;
          }
          if (
            rightSupport &&
            ((isWhite && (rightSupport === 'w' || rightSupport === 'W')) ||
              (!isWhite && (rightSupport === 'b' || rightSupport === 'B')))
          ) {
            score += 7;
          }
        }
      } else {
        // King mobility & diagonal reach
        let openRays = 0;
        const dirs = [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ];
        for (const [dr, dc] of dirs) {
          let nr = r + dr;
          let nc = c + dc;
          let steps = 0;
          const maxScan = rules.flyingKings ? size - 1 : 1;
          while (nr >= 0 && nr < size && nc >= 0 && nc < size && steps < maxScan) {
            if (board[nr][nc] === null) {
              openRays++;
              steps++;
              nr += dr;
              nc += dc;
            } else {
              break;
            }
          }
        }
        score += openRays * (rules.flyingKings ? 5 : 8);

        // Main diagonal control bonus for flying kings
        if (rules.flyingKings && (r === c || r + c === size - 1)) {
          score += 18;
        }
      }

      if (isWhite) {
        whiteScore += score;
        whiteCount++;
        if (isKing) whiteKings++;
        whiteRowSum += r;
        whiteColSum += c;
      } else {
        blackScore += score;
        blackCount++;
        if (isKing) blackKings++;
        blackRowSum += r;
        blackColSum += c;
      }
    }
  }

  // Endgame proximity encouragement when one side is ahead
  const totalPieces = whiteCount + blackCount;
  if (totalPieces <= 8 && whiteCount > 0 && blackCount > 0) {
    const whiteMeanR = whiteRowSum / whiteCount;
    const whiteMeanC = whiteColSum / whiteCount;
    const blackMeanR = blackRowSum / blackCount;
    const blackMeanC = blackColSum / blackCount;
    const avgDist = Math.abs(whiteMeanR - blackMeanR) + Math.abs(whiteMeanC - blackMeanC);

    if (whiteScore > blackScore + 120 && whiteKings > 0) {
      whiteScore += Math.round((size * 2 - avgDist) * 3);
    } else if (blackScore > whiteScore + 120 && blackKings > 0) {
      blackScore += Math.round((size * 2 - avgDist) * 3);
    }
  }

  const diff = whiteScore - blackScore;
  const tempo = perspectiveSide === 'white' ? 8 : -8;
  const whiteEval = diff + tempo;
  return perspectiveSide === 'white' ? whiteEval : -whiteEval;
}

export function describeTacticalMove(
  captureCount: number,
  promoted: boolean,
  isKingMove: boolean,
  scoreCp: number,
  side: PlayerSide
): string {
  const parts: string[] = [];
  if (captureCount >= 2) {
    parts.push(`Executes a ${captureCount}-piece combination capture`);
  } else if (captureCount === 1) {
    parts.push('Forces a material capture');
  }
  if (promoted) {
    parts.push('Promotes to King on the back rank');
  } else if (isKingMove) {
    parts.push('Repositions King for diagonal pressure');
  } else if (captureCount === 0) {
    parts.push('Advances structure and contests center diagonals');
  }

  const adv = Math.abs(scoreCp);
  if (adv >= 300) {
    parts.push(`${side === 'white' ? 'White' : 'Black'} holds a decisive advantage`);
  } else if (adv >= 100) {
    parts.push('Maintains a clear positional edge');
  } else {
    parts.push('Position remains balanced and sharp');
  }

  return `${parts.join('. ')}.`;
}
