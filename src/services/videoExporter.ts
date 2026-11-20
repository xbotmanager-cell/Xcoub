import { applyMove, createInitialGameState, decompressBoard, isKingPiece } from '../engine/rules.ts';
import type { GameState, PieceCode } from '../engine/types.ts';
import { BOARD_THEMES } from './localStore.ts';

export interface VideoExportProgress {
  phase: 'rendering' | 'encoding' | 'done';
  percent: number;
}

export interface ExportedVideoResult {
  blob: Blob;
  mimeType: string;
  extension: 'mp4' | 'webm';
  filename: string;
}

interface AnimatingPiece {
  piece: Exclude<PieceCode, null>;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  progress: number;
}

function drawCrown(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, radius * 0.14);
  const w = radius * 0.88;
  const h = radius * 0.65;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, cy + h * 0.4);
  ctx.lineTo(cx - w * 0.58, cy - h * 0.25);
  ctx.lineTo(cx - w * 0.2, cy + h * 0.05);
  ctx.lineTo(cx, cy - h * 0.45);
  ctx.lineTo(cx + w * 0.2, cy + h * 0.05);
  ctx.lineTo(cx + w * 0.58, cy - h * 0.25);
  ctx.lineTo(cx + w * 0.5, cy + h * 0.4);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Exclude<PieceCode, null>,
  cx: number,
  cy: number,
  radius: number,
  scale = 1
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const isWhite = piece === 'w' || piece === 'W';
  const isKing = isKingPiece(piece);

  // Drop shadow
  ctx.beginPath();
  ctx.arc(0, radius * 0.12, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  // Main disc gradient
  const grad = ctx.createRadialGradient(-radius * 0.25, -radius * 0.3, radius * 0.1, 0, 0, radius);
  if (isWhite) {
    grad.addColorStop(0, '#FFFDF9');
    grad.addColorStop(1, '#CFC0A6');
  } else {
    grad.addColorStop(0, '#3F4756');
    grad.addColorStop(1, '#11151E');
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.strokeStyle = isWhite ? '#A79374' : '#525B6E';
  ctx.stroke();

  // Inner turned ring
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isWhite ? 'rgba(90, 70, 45, 0.25)' : 'rgba(245, 158, 11, 0.25)';
  ctx.stroke();

  if (isKing) {
    drawCrown(ctx, 0, 0, radius * 0.65, isWhite ? '#9A3412' : '#F59E0B');
  }

  ctx.restore();
}

function reconstructBaseState(state: GameState): GameState {
  if (state.initialBoardCompressed) {
    const dec = decompressBoard(state.initialBoardCompressed);
    const turn = state.initialTurn ?? state.rules.firstPlayer;
    return {
      boardSize: dec.boardSize,
      board: dec.board,
      initialBoardCompressed: state.initialBoardCompressed,
      initialTurn: turn,
      turn,
      rules: state.rules,
      moveCount: 0,
      noProgressCount: 0,
      positionCounts: { [`${turn}:${state.initialBoardCompressed}`]: 1 },
      status: 'playing',
      history: [],
    };
  }
  return createInitialGameState(state.rules);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  boardSize: 8 | 10,
  board: PieceCode[][],
  title: string,
  subtitle: string,
  plyLabel: string,
  turnLabel: string,
  themeId: string,
  animPiece: AnimatingPiece | null,
  captureFlashes: Array<{ row: number; col: number; alpha: number }>,
  winnerBanner: string | null
) {
  const theme = BOARD_THEMES.find((t) => t.id === themeId) ?? BOARD_THEMES[0];

  // Background
  ctx.fillStyle = '#0B0F17';
  ctx.fillRect(0, 0, width, height);

  // Header brand + match title
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('DRAFT MASTER', 36, 48);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(title.slice(0, 38), 36, 86);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px sans-serif';
  ctx.fillText(subtitle, 36, 114);

  // Board frame
  const boardPx = width - 72;
  const boardX = 36;
  const boardY = 148;
  const framePad = 12;

  ctx.fillStyle = theme.frame;
  ctx.beginPath();
  ctx.roundRect(boardX - framePad, boardY - framePad, boardPx + framePad * 2, boardPx + framePad * 2, 16);
  ctx.fill();

  const cell = boardPx / boardSize;
  const radius = cell * 0.37;

  // Squares
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const playable = (r + c) % 2 === 1;
      ctx.fillStyle = playable ? theme.darkSquare : theme.lightSquare;
      ctx.fillRect(boardX + c * cell, boardY + r * cell, cell, cell);
    }
  }

  // Highlight animating move origin & target
  if (animPiece) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
    ctx.fillRect(boardX + animPiece.fromCol * cell, boardY + animPiece.fromRow * cell, cell, cell);
    ctx.fillRect(boardX + animPiece.toCol * cell, boardY + animPiece.toRow * cell, cell, cell);
  }

  // Static pieces
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (animPiece && animPiece.fromRow === r && animPiece.fromCol === c) continue;
      drawPiece(ctx, p, boardX + (c + 0.5) * cell, boardY + (r + 0.5) * cell, radius);
    }
  }

  // Capture flash markers
  for (const cf of captureFlashes) {
    ctx.save();
    ctx.strokeStyle = `rgba(245, 158, 11, ${cf.alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      boardX + (cf.col + 0.5) * cell,
      boardY + (cf.row + 0.5) * cell,
      radius * (1.25 - cf.alpha * 0.25),
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();
  }

  // Moving piece overlay
  if (animPiece) {
    const t = animPiece.progress;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const curRow = animPiece.fromRow + (animPiece.toRow - animPiece.fromRow) * eased;
    const curCol = animPiece.fromCol + (animPiece.toCol - animPiece.fromCol) * eased;
    const popScale = 1 + Math.sin(t * Math.PI) * 0.14;
    drawPiece(
      ctx,
      animPiece.piece,
      boardX + (curCol + 0.5) * cell,
      boardY + (curRow + 0.5) * cell,
      radius,
      popScale
    );
  }

  // Footer Telemetry
  const footY = boardY + boardPx + 48;
  ctx.fillStyle = '#131A26';
  ctx.beginPath();
  ctx.roundRect(36, footY - 26, width - 72, 64, 12);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(plyLabel, 54, footY + 4);

  ctx.fillStyle = '#F59E0B';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(turnLabel, width - 54, footY + 4);
  ctx.textAlign = 'left';

  // Winner end-card overlay
  if (winnerBanner) {
    ctx.fillStyle = 'rgba(11, 15, 23, 0.82)';
    ctx.fillRect(boardX, boardY + boardPx * 0.34, boardPx, boardPx * 0.32);

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.strokeRect(boardX + 4, boardY + boardPx * 0.34 + 4, boardPx - 8, boardPx * 0.32 - 8);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('MATCH RESULT', width / 2, boardY + boardPx * 0.45);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(winnerBanner, width / 2, boardY + boardPx * 0.54);
    ctx.textAlign = 'left';
  }
}

export async function exportMatchAsVideo(
  finalState: GameState,
  title: string,
  whiteName: string,
  blackName: string,
  boardThemeId: string,
  onProgress?: (p: VideoExportProgress) => void
): Promise<ExportedVideoResult> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Video recording requires a modern browser environment.');
  }

  const width = 720;
  const height = 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: preferredMime,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: preferredMime }));
    };
  });

  recorder.start(100);

  let curState = reconstructBaseState(finalState);
  const subtitle = `${finalState.rules.name} · ${whiteName} vs ${blackName}`;
  const totalPlies = finalState.history.length;

  const sleepFrame = () => new Promise<void>((r) => setTimeout(r, 33));

  // Intro hold (0.5s)
  for (let f = 0; f < 15; f++) {
    drawFrame(
      ctx,
      width,
      height,
      curState.boardSize,
      curState.board,
      title,
      subtitle,
      `Opening Position`,
      `${curState.turn === 'white' ? whiteName : blackName} to move`,
      boardThemeId,
      null,
      [],
      null
    );
    await sleepFrame();
  }

  // Animate every move in history
  for (let i = 0; i < totalPlies; i++) {
    const rec = finalState.history[i];
    const movingPiece = curState.board[rec.move.from.row][rec.move.from.col];
    const steps = [rec.move.from, ...rec.move.path];
    const framesPerLeg = totalPlies > 45 ? 6 : 9;

    if (movingPiece) {
      for (let leg = 0; leg < steps.length - 1; leg++) {
        const sFrom = steps[leg];
        const sTo = steps[leg + 1];
        for (let f = 1; f <= framesPerLeg; f++) {
          const prog = f / framesPerLeg;
          const flashes = rec.move.captured.map((cap) => ({
            row: cap.row,
            col: cap.col,
            alpha: Math.max(0, 1 - prog),
          }));
          drawFrame(
            ctx,
            width,
            height,
            curState.boardSize,
            curState.board,
            title,
            subtitle,
            `Move ${rec.ply} / ${totalPlies} · ${rec.move.notation}`,
            `${rec.side === 'white' ? whiteName : blackName} ${rec.move.promoted ? '(Crowned King!)' : ''}`,
            boardThemeId,
            {
              piece: movingPiece,
              fromRow: sFrom.row,
              fromCol: sFrom.col,
              toRow: sTo.row,
              toCol: sTo.col,
              progress: prog,
            },
            flashes,
            null
          );
          await sleepFrame();
        }
      }
    }

    curState = applyMove(curState, rec.move);
    onProgress?.({
      phase: 'rendering',
      percent: Math.round(((i + 1) / Math.max(1, totalPlies)) * 80),
    });
  }

  // Final result hold (2s)
  const winnerBanner =
    finalState.status === 'white_won'
      ? `${whiteName} Wins!`
      : finalState.status === 'black_won'
        ? `${blackName} Wins!`
        : 'Match Drawn';

  for (let f = 0; f < 45; f++) {
    drawFrame(
      ctx,
      width,
      height,
      curState.boardSize,
      curState.board,
      title,
      subtitle,
      `Final · ${totalPlies} moves`,
      winnerBanner,
      boardThemeId,
      null,
      [],
      winnerBanner
    );
    await sleepFrame();
  }

  recorder.stop();
  const webmBlob = await stopPromise;

  // Attempt server-side MP4 transcode via ffmpeg for universal mobile & Android share compatibility
  onProgress?.({ phase: 'encoding', percent: 88 });
  try {
    const resp = await fetch('/api/video/convert-mp4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: webmBlob,
    });
    if (resp.ok) {
      const mp4Blob = await resp.blob();
      onProgress?.({ phase: 'done', percent: 100 });
      return {
        blob: mp4Blob,
        mimeType: 'video/mp4',
        extension: 'mp4',
        filename: `draft-master-replay-${Date.now()}.mp4`,
      };
    }
  } catch {
    // Offline or server unavailable: gracefully fall back to client WebM
  }

  onProgress?.({ phase: 'done', percent: 100 });
  return {
    blob: webmBlob,
    mimeType: 'video/webm',
    extension: 'webm',
    filename: `draft-master-replay-${Date.now()}.webm`,
  };
}
