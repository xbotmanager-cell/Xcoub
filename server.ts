import express from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  DRAFT_MASTER_8X8_RULES,
  ENGLISH_8X8_RULES,
  INTERNATIONAL_10X10_RULES,
  getPresetRules,
} from './src/engine/presets.ts';
import {
  applyMove,
  createInitialGameState,
  validateMove,
} from './src/engine/rules.ts';
import type {
  Coord,
  GameState,
  PlayerSide,
  RuleConfig,
  VariantPreset,
} from './src/engine/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'draft_master_server.json');

interface ServerMatch {
  matchId: string;
  mode: 'realtime' | 'turn_based' | 'league' | 'tournament';
  variantPreset: VariantPreset;
  rules: RuleConfig;
  whitePlayerId: string | null;
  whitePlayerName: string;
  blackPlayerId: string | null;
  blackPlayerName: string;
  hostSidePreference: 'white' | 'black' | 'random';
  status: 'waiting' | 'active' | 'completed' | 'aborted';
  gameState: GameState;
  roomCode: string;
  isPrivate: boolean;
  timeControlSeconds: number; // per player for realtime; 0 = unlimited
  whiteTimeRemainingMs: number;
  blackTimeRemainingMs: number;
  lastTurnStartedAt: number;
  turnDeadlineHours: number; // for turn_based
  turnDeadlineAt: number | null;
  drawOfferBy: PlayerSide | null;
  winnerSide: 'white' | 'black' | 'draw' | null;
  resultReason: string | null;
  leagueId?: string;
  tournamentId?: string;
  createdAt: number;
  updatedAt: number;
}

interface LeagueMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'approved' | 'removed';
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  joinedAt: number;
}

interface LeagueFixture {
  fixtureId: string;
  round: number;
  whiteUserId: string;
  whiteUsername: string;
  blackUserId: string;
  blackUsername: string;
  matchId: string | null;
  result: 'pending' | 'white' | 'black' | 'draw';
}

interface ServerLeague {
  leagueId: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  inviteCode: string;
  ownerId: string;
  ownerName: string;
  variantPreset: VariantPreset;
  rules: RuleConfig;
  format: 'round_robin' | 'knockout';
  maxMembers: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  status: 'open' | 'active' | 'completed';
  seasonNumber: number;
  announcement: string;
  members: LeagueMember[];
  fixtures: LeagueFixture[];
  createdAt: number;
  updatedAt: number;
}

interface TournamentParticipant {
  userId: string;
  username: string;
  elo: number;
  seed: number;
  eliminated: boolean;
}

interface BracketSlot {
  slotId: string;
  round: number;
  matchIndex: number;
  whiteUserId: string | null;
  whiteUsername: string | null;
  blackUserId: string | null;
  blackUsername: string | null;
  winnerUserId: string | null;
  winnerUsername: string | null;
  matchId: string | null;
  status: 'pending' | 'ready' | 'completed';
}

interface ServerTournament {
  tournamentId: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  variantPreset: VariantPreset;
  rules: RuleConfig;
  format: 'single_elimination' | 'round_robin';
  maxParticipants: number;
  status: 'registration' | 'in_progress' | 'completed';
  championId: string | null;
  championName: string | null;
  participants: TournamentParticipant[];
  bracket: BracketSlot[];
  createdAt: number;
  updatedAt: number;
}

interface SharedReplay {
  replayId: string;
  title: string;
  whiteName: string;
  blackName: string;
  gameState: GameState;
  createdAt: number;
}

interface PersistedServerStore {
  matches: Record<string, ServerMatch>;
  leagues: Record<string, ServerLeague>;
  tournaments: Record<string, ServerTournament>;
  replays?: Record<string, SharedReplay>;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function loadStore(): PersistedServerStore {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as PersistedServerStore;
      if (parsed && parsed.matches && parsed.leagues && parsed.tournaments) {
        return {
          ...parsed,
          replays: parsed.replays ?? {},
        };
      }
    }
  } catch (err) {
    console.warn('Could not load persisted server store, starting fresh:', err);
  }

  return {
    matches: {},
    leagues: {},
    tournaments: {},
    replays: {},
  };
}

const store: PersistedServerStore = loadStore();

let saveTimeout: NodeJS.Timeout | null = null;
function schedulePersist(): void {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(store), 'utf8');
    } catch (err) {
      console.error('Failed to persist server store:', err);
    }
  }, 300);
}

function resolveRules(variantPreset: VariantPreset, customRules?: Partial<RuleConfig>): RuleConfig {
  if (variantPreset === 'draft_master_8x8') return { ...DRAFT_MASTER_8X8_RULES };
  if (variantPreset === 'english_8x8') return { ...ENGLISH_8X8_RULES };
  if (variantPreset === 'international_10x10') return { ...INTERNATIONAL_10X10_RULES };
  return getPresetRules('custom', customRules);
}

// Track WebSocket connections subscribed to matches
const matchSubscribers = new Map<string, Set<{ ws: WebSocket; userId: string }>>();
const matchmakingQueue: Array<{
  ws: WebSocket;
  userId: string;
  username: string;
  variantPreset: VariantPreset;
  timeControlSeconds: number;
  queuedAt: number;
}> = [];

function broadcastMatchState(match: ServerMatch, eventType = 'match:sync'): void {
  const subs = matchSubscribers.get(match.matchId);
  if (!subs) return;
  const payload = JSON.stringify({ type: eventType, match });
  for (const sub of subs) {
    if (sub.ws.readyState === WebSocket.OPEN) {
      sub.ws.send(payload);
    }
  }
}

function summarizeMatch(m: ServerMatch) {
  return {
    matchId: m.matchId,
    mode: m.mode,
    variantPreset: m.variantPreset,
    rules: m.rules,
    whitePlayerId: m.whitePlayerId,
    whitePlayerName: m.whitePlayerName,
    blackPlayerId: m.blackPlayerId,
    blackPlayerName: m.blackPlayerName,
    status: m.status,
    turn: m.gameState.turn,
    moveCount: m.gameState.moveCount,
    roomCode: m.roomCode,
    isPrivate: m.isPrivate,
    timeControlSeconds: m.timeControlSeconds,
    turnDeadlineHours: m.turnDeadlineHours,
    turnDeadlineAt: m.turnDeadlineAt,
    winnerSide: m.winnerSide,
    resultReason: m.resultReason,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function checkMatchTimeout(match: ServerMatch): boolean {
  if (match.status !== 'active') return false;
  const now = Date.now();

  if (match.mode === 'realtime' && match.timeControlSeconds > 0) {
    const elapsed = now - match.lastTurnStartedAt;
    const currentTurn = match.gameState.turn;
    const remaining =
      (currentTurn === 'white' ? match.whiteTimeRemainingMs : match.blackTimeRemainingMs) - elapsed;
    if (remaining <= 0) {
      if (currentTurn === 'white') match.whiteTimeRemainingMs = 0;
      else match.blackTimeRemainingMs = 0;
      match.status = 'completed';
      match.winnerSide = currentTurn === 'white' ? 'black' : 'white';
      match.resultReason = 'timeout';
      match.updatedAt = now;
      schedulePersist();
      return true;
    }
  }

  if (match.mode === 'turn_based' && match.turnDeadlineAt && now > match.turnDeadlineAt) {
    const loser = match.gameState.turn;
    match.status = 'completed';
    match.winnerSide = loser === 'white' ? 'black' : 'white';
    match.resultReason = 'timeout';
    match.updatedAt = now;
    schedulePersist();
    return true;
  }

  return false;
}

function applyAuthoritativeMove(
  match: ServerMatch,
  userId: string,
  from: Coord,
  path: Coord[]
): { ok: true; match: ServerMatch } | { ok: false; error: string } {
  if (match.status !== 'active') {
    return { ok: false, error: 'Match is not active.' };
  }

  if (checkMatchTimeout(match)) {
    return { ok: false, error: 'Match ended due to clock expiration.' };
  }

  const expectedPlayerId =
    match.gameState.turn === 'white' ? match.whitePlayerId : match.blackPlayerId;
  if (!expectedPlayerId || expectedPlayerId !== userId) {
    return { ok: false, error: 'Not your turn.' };
  }

  const legalMove = validateMove(match.gameState, { from, path });
  if (!legalMove) {
    return { ok: false, error: 'Illegal move rejected by authoritative server rules engine.' };
  }

  const now = Date.now();
  if (match.mode === 'realtime' && match.timeControlSeconds > 0) {
    const elapsed = now - match.lastTurnStartedAt;
    if (match.gameState.turn === 'white') {
      match.whiteTimeRemainingMs = Math.max(0, match.whiteTimeRemainingMs - elapsed);
    } else {
      match.blackTimeRemainingMs = Math.max(0, match.blackTimeRemainingMs - elapsed);
    }
  }

  const nextState = applyMove(match.gameState, legalMove);
  match.gameState = nextState;
  match.drawOfferBy = null;
  match.lastTurnStartedAt = now;
  match.updatedAt = now;

  if (match.mode === 'turn_based' && match.turnDeadlineHours > 0) {
    match.turnDeadlineAt = now + match.turnDeadlineHours * 3600 * 1000;
  }

  if (nextState.status !== 'playing') {
    match.status = 'completed';
    if (nextState.status === 'white_won') match.winnerSide = 'white';
    else if (nextState.status === 'black_won') match.winnerSide = 'black';
    else match.winnerSide = 'draw';
    match.resultReason = nextState.endReason ?? 'completed';
  }

  schedulePersist();
  return { ok: true, match };
}

function generateRoundRobinFixtures(members: LeagueMember[], season: number): LeagueFixture[] {
  const approved = members.filter((m) => m.status === 'approved');
  const fixtures: LeagueFixture[] = [];
  let idx = 1;
  for (let i = 0; i < approved.length; i++) {
    for (let j = i + 1; j < approved.length; j++) {
      const swap = (i + j) % 2 === 1;
      const white = swap ? approved[j] : approved[i];
      const black = swap ? approved[i] : approved[j];
      fixtures.push({
        fixtureId: `fx_s${season}_${idx++}`,
        round: Math.ceil(fixtures.length / Math.max(1, Math.floor(approved.length / 2))),
        whiteUserId: white.userId,
        whiteUsername: white.username,
        blackUserId: black.userId,
        blackUsername: black.username,
        matchId: null,
        result: 'pending',
      });
    }
  }
  return fixtures;
}

function generateSingleEliminationBracket(participants: TournamentParticipant[]): BracketSlot[] {
  const count = participants.length;
  let size = 2;
  while (size < count) size *= 2;
  const slots: BracketSlot[] = [];

  const round1Matches = size / 2;
  for (let i = 0; i < round1Matches; i++) {
    const p1 = participants[i * 2] ?? null;
    const p2 = participants[i * 2 + 1] ?? null;
    const isBye = Boolean(p1 && !p2);
    slots.push({
      slotId: `r1_m${i + 1}`,
      round: 1,
      matchIndex: i,
      whiteUserId: p1?.userId ?? null,
      whiteUsername: p1?.username ?? null,
      blackUserId: p2?.userId ?? null,
      blackUsername: p2?.username ?? null,
      winnerUserId: isBye ? p1!.userId : null,
      winnerUsername: isBye ? p1!.username : null,
      matchId: null,
      status: isBye ? 'completed' : p1 && p2 ? 'ready' : 'pending',
    });
  }

  let totalRounds = Math.log2(size);
  let prevRoundCount = round1Matches;
  for (let r = 2; r <= totalRounds; r++) {
    const rCount = prevRoundCount / 2;
    for (let i = 0; i < rCount; i++) {
      // Check if bye winners feed directly
      const leftPrev = slots.find((s) => s.round === r - 1 && s.matchIndex === i * 2);
      const rightPrev = slots.find((s) => s.round === r - 1 && s.matchIndex === i * 2 + 1);
      const wId = leftPrev?.status === 'completed' ? leftPrev.winnerUserId : null;
      const wName = leftPrev?.status === 'completed' ? leftPrev.winnerUsername : null;
      const bId = rightPrev?.status === 'completed' ? rightPrev.winnerUserId : null;
      const bName = rightPrev?.status === 'completed' ? rightPrev.winnerUsername : null;

      slots.push({
        slotId: `r${r}_m${i + 1}`,
        round: r,
        matchIndex: i,
        whiteUserId: wId,
        whiteUsername: wName,
        blackUserId: bId,
        blackUsername: bName,
        winnerUserId: null,
        winnerUsername: null,
        matchId: null,
        status: wId && bId ? 'ready' : 'pending',
      });
    }
    prevRoundCount = rCount;
  }

  return slots;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'draft-master-server', timestamp: Date.now() });
  });

  // --- REPLAY SHARING & VIDEO CONVERSION API ---
  app.post('/api/replays', (req, res) => {
    const { title, whiteName = 'White', blackName = 'Black', gameState } = req.body ?? {};
    if (!gameState || !gameState.history) {
      res.status(400).json({ error: 'Valid gameState is required.' });
      return;
    }
    const replayId = generateId('rpl');
    if (!store.replays) store.replays = {};
    store.replays[replayId] = {
      replayId,
      title: String(title || `${whiteName} vs ${blackName}`).slice(0, 80),
      whiteName: String(whiteName).slice(0, 40),
      blackName: String(blackName).slice(0, 40),
      gameState,
      createdAt: Date.now(),
    };
    schedulePersist();
    res.status(201).json({ replayId });
  });

  app.get('/api/replays/:replayId', (req, res) => {
    const item = store.replays?.[req.params.replayId];
    if (!item) {
      res.status(404).json({ error: 'Shared replay not found.' });
      return;
    }
    res.json({ replay: item });
  });

  app.post(
    '/api/video/convert-mp4',
    express.raw({ type: 'application/octet-stream', limit: '30mb' }),
    async (req, res) => {
      const body = req.body as Buffer;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'Empty video payload.' });
        return;
      }

      const tmpId = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const inPath = path.join(os.tmpdir(), `${tmpId}.webm`);
      const outPath = path.join(os.tmpdir(), `${tmpId}.mp4`);

      try {
        fs.writeFileSync(inPath, body);
        await new Promise<void>((resolve, reject) => {
          const ff = spawn('ffmpeg', [
            '-y',
            '-i',
            inPath,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            outPath,
          ]);
          ff.on('error', reject);
          ff.on('close', (code) => {
            if (code === 0 && fs.existsSync(outPath)) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
          });
        });
        const mp4 = fs.readFileSync(outPath);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="draft-master-replay.mp4"');
        res.send(mp4);
      } catch (err) {
        console.error('MP4 transcode failed:', err);
        res.status(500).json({ error: 'Video conversion failed.' });
      } finally {
        try {
          if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
          if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        } catch {
          // ignore cleanup failure
        }
      }
    }
  );

  // --- MATCHES API ---
  app.get('/api/matches', (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    const mode = typeof req.query.mode === 'string' ? req.query.mode : null;
    const all = Object.values(store.matches).map((m) => {
      checkMatchTimeout(m);
      return m;
    });

    const filtered = all
      .filter((m) => {
        if (mode && m.mode !== mode) return false;
        if (m.status === 'waiting' && !m.isPrivate) return true;
        if (userId && (m.whitePlayerId === userId || m.blackPlayerId === userId)) return true;
        return !m.isPrivate && m.status === 'active';
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 50)
      .map(summarizeMatch);

    res.json({ matches: filtered });
  });

  app.get('/api/matches/:matchId', (req, res) => {
    const match = store.matches[req.params.matchId];
    if (!match) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }
    checkMatchTimeout(match);
    res.json({ match });
  });

  app.post('/api/matches', (req, res) => {
    const {
      userId,
      username,
      mode = 'realtime',
      variantPreset = 'english_8x8',
      customRules,
      isPrivate = false,
      timeControlSeconds = 600,
      turnDeadlineHours = 48,
      preferredSide = 'white',
    } = req.body ?? {};

    if (!userId || !username) {
      res.status(400).json({ error: 'userId and username are required.' });
      return;
    }

    const rules = resolveRules(variantPreset, customRules);
    const matchId = generateId('m');
    const now = Date.now();
    const initialState = createInitialGameState(rules);

    const assignWhite =
      preferredSide === 'white'
        ? true
        : preferredSide === 'black'
          ? false
          : Math.random() < 0.5;

    const match: ServerMatch = {
      matchId,
      mode,
      variantPreset: rules.preset,
      rules,
      whitePlayerId: assignWhite ? userId : null,
      whitePlayerName: assignWhite ? username : 'Open Seat',
      blackPlayerId: assignWhite ? null : userId,
      blackPlayerName: assignWhite ? 'Open Seat' : username,
      hostSidePreference: preferredSide,
      status: 'waiting',
      gameState: initialState,
      roomCode: generateRoomCode(),
      isPrivate: Boolean(isPrivate),
      timeControlSeconds: mode === 'realtime' ? Number(timeControlSeconds) : 0,
      whiteTimeRemainingMs: Number(timeControlSeconds) * 1000,
      blackTimeRemainingMs: Number(timeControlSeconds) * 1000,
      lastTurnStartedAt: now,
      turnDeadlineHours: mode === 'turn_based' ? Number(turnDeadlineHours) : 0,
      turnDeadlineAt: null,
      drawOfferBy: null,
      winnerSide: null,
      resultReason: null,
      createdAt: now,
      updatedAt: now,
    };

    store.matches[matchId] = match;
    schedulePersist();
    res.status(201).json({ match });
  });

  app.post('/api/matches/join-by-code', (req, res) => {
    const { roomCode, userId, username } = req.body ?? {};
    if (!roomCode || !userId || !username) {
      res.status(400).json({ error: 'roomCode, userId, and username are required.' });
      return;
    }
    const normalized = String(roomCode).trim().toUpperCase();
    const match = Object.values(store.matches).find(
      (m) => m.roomCode === normalized && m.status === 'waiting'
    );
    if (!match) {
      res.status(404).json({ error: 'No open match found for that room code.' });
      return;
    }
    if (match.whitePlayerId === userId || match.blackPlayerId === userId) {
      res.json({ match });
      return;
    }
    if (!match.whitePlayerId) {
      match.whitePlayerId = userId;
      match.whitePlayerName = username;
    } else if (!match.blackPlayerId) {
      match.blackPlayerId = userId;
      match.blackPlayerName = username;
    } else {
      res.status(409).json({ error: 'Match already full.' });
      return;
    }

    const now = Date.now();
    match.status = 'active';
    match.lastTurnStartedAt = now;
    if (match.mode === 'turn_based' && match.turnDeadlineHours > 0) {
      match.turnDeadlineAt = now + match.turnDeadlineHours * 3600 * 1000;
    }
    match.updatedAt = now;
    schedulePersist();
    broadcastMatchState(match, 'match:joined');
    res.json({ match });
  });

  app.post('/api/matches/:matchId/join', (req, res) => {
    const { userId, username } = req.body ?? {};
    const match = store.matches[req.params.matchId];
    if (!match) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }
    if (match.whitePlayerId === userId || match.blackPlayerId === userId) {
      res.json({ match });
      return;
    }
    if (match.status !== 'waiting') {
      res.status(409).json({ error: 'Match is no longer accepting players.' });
      return;
    }
    if (!match.whitePlayerId) {
      match.whitePlayerId = userId;
      match.whitePlayerName = username;
    } else if (!match.blackPlayerId) {
      match.blackPlayerId = userId;
      match.blackPlayerName = username;
    }
    const now = Date.now();
    match.status = 'active';
    match.lastTurnStartedAt = now;
    if (match.mode === 'turn_based' && match.turnDeadlineHours > 0) {
      match.turnDeadlineAt = now + match.turnDeadlineHours * 3600 * 1000;
    }
    match.updatedAt = now;
    schedulePersist();
    broadcastMatchState(match, 'match:joined');
    res.json({ match });
  });

  app.post('/api/matches/:matchId/move', (req, res) => {
    const { userId, from, path: movePath } = req.body ?? {};
    const match = store.matches[req.params.matchId];
    if (!match) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }
    const result = applyAuthoritativeMove(match, userId, from, movePath);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    broadcastMatchState(result.match, 'match:move');
    res.json({ match: result.match });
  });

  app.post('/api/matches/:matchId/resign', (req, res) => {
    const { userId } = req.body ?? {};
    const match = store.matches[req.params.matchId];
    if (!match) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }
    if (match.status !== 'active') {
      res.status(400).json({ error: 'Match is not active.' });
      return;
    }
    if (match.whitePlayerId !== userId && match.blackPlayerId !== userId) {
      res.status(403).json({ error: 'Only participants can resign.' });
      return;
    }
    const resigningSide: PlayerSide = match.whitePlayerId === userId ? 'white' : 'black';
    match.status = 'completed';
    match.winnerSide = resigningSide === 'white' ? 'black' : 'white';
    match.resultReason = 'resignation';
    match.gameState = {
      ...match.gameState,
      status: match.winnerSide === 'white' ? 'white_won' : 'black_won',
      endReason: 'resignation',
    };
    match.updatedAt = Date.now();
    schedulePersist();
    broadcastMatchState(match, 'match:ended');
    res.json({ match });
  });

  app.post('/api/matches/:matchId/draw', (req, res) => {
    const { userId, action } = req.body ?? {};
    const match = store.matches[req.params.matchId];
    if (!match || match.status !== 'active') {
      res.status(400).json({ error: 'Match is not active.' });
      return;
    }
    if (match.whitePlayerId !== userId && match.blackPlayerId !== userId) {
      res.status(403).json({ error: 'Only participants can offer or accept draws.' });
      return;
    }
    const side: PlayerSide = match.whitePlayerId === userId ? 'white' : 'black';
    if (action === 'offer') {
      match.drawOfferBy = side;
    } else if (action === 'accept' && match.drawOfferBy && match.drawOfferBy !== side) {
      match.status = 'completed';
      match.winnerSide = 'draw';
      match.resultReason = 'agreement';
      match.gameState = { ...match.gameState, status: 'draw', endReason: 'agreement' };
      match.drawOfferBy = null;
    } else if (action === 'decline') {
      match.drawOfferBy = null;
    }
    match.updatedAt = Date.now();
    schedulePersist();
    broadcastMatchState(match, 'match:sync');
    res.json({ match });
  });

  app.post('/api/matches/:matchId/rematch', (req, res) => {
    const { userId } = req.body ?? {};
    const oldMatch = store.matches[req.params.matchId];
    if (!oldMatch) {
      res.status(404).json({ error: 'Original match not found.' });
      return;
    }
    if (oldMatch.whitePlayerId !== userId && oldMatch.blackPlayerId !== userId) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }
    const now = Date.now();
    const matchId = generateId('m');
    const rematch: ServerMatch = {
      ...oldMatch,
      matchId,
      whitePlayerId: oldMatch.blackPlayerId,
      whitePlayerName: oldMatch.blackPlayerName,
      blackPlayerId: oldMatch.whitePlayerId,
      blackPlayerName: oldMatch.whitePlayerName,
      status: 'active',
      gameState: createInitialGameState(oldMatch.rules),
      roomCode: generateRoomCode(),
      whiteTimeRemainingMs: oldMatch.timeControlSeconds * 1000,
      blackTimeRemainingMs: oldMatch.timeControlSeconds * 1000,
      lastTurnStartedAt: now,
      turnDeadlineAt:
        oldMatch.mode === 'turn_based' && oldMatch.turnDeadlineHours > 0
          ? now + oldMatch.turnDeadlineHours * 3600 * 1000
          : null,
      drawOfferBy: null,
      winnerSide: null,
      resultReason: null,
      createdAt: now,
      updatedAt: now,
    };
    store.matches[matchId] = rematch;
    schedulePersist();
    res.status(201).json({ match: rematch });
  });

  // --- LEAGUES API ---
  app.get('/api/leagues', (_req, res) => {
    const leagues = Object.values(store.leagues).sort((a, b) => b.updatedAt - a.updatedAt);
    res.json({ leagues });
  });

  app.post('/api/leagues', (req, res) => {
    const {
      name,
      description = '',
      visibility = 'public',
      ownerId,
      ownerName,
      variantPreset = 'english_8x8',
      customRules,
      format = 'round_robin',
      maxMembers = 16,
      winPoints = 3,
      drawPoints = 1,
      lossPoints = 0,
    } = req.body ?? {};

    if (!name || !ownerId || !ownerName) {
      res.status(400).json({ error: 'League name, ownerId, and ownerName are required.' });
      return;
    }
    const rules = resolveRules(variantPreset, customRules);
    const leagueId = generateId('lg');
    const now = Date.now();
    const league: ServerLeague = {
      leagueId,
      name: String(name).trim().slice(0, 64),
      description: String(description).slice(0, 500),
      visibility: visibility === 'private' ? 'private' : 'public',
      inviteCode: generateRoomCode(),
      ownerId,
      ownerName,
      variantPreset: rules.preset,
      rules,
      format: format === 'knockout' ? 'knockout' : 'round_robin',
      maxMembers: Math.min(128, Math.max(2, Number(maxMembers))),
      winPoints: Number(winPoints),
      drawPoints: Number(drawPoints),
      lossPoints: Number(lossPoints),
      status: 'open',
      seasonNumber: 1,
      announcement: 'Welcome to the inaugural season. Check rules and fixtures before play.',
      members: [
        {
          userId: ownerId,
          username: ownerName,
          role: 'owner',
          status: 'approved',
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          joinedAt: now,
        },
      ],
      fixtures: [],
      createdAt: now,
      updatedAt: now,
    };
    store.leagues[leagueId] = league;
    schedulePersist();
    res.status(201).json({ league });
  });

  app.post('/api/leagues/:leagueId/join', (req, res) => {
    const { userId, username, inviteCode } = req.body ?? {};
    const league = store.leagues[req.params.leagueId];
    if (!league) {
      res.status(404).json({ error: 'League not found.' });
      return;
    }
    if (league.members.some((m) => m.userId === userId)) {
      res.json({ league });
      return;
    }
    if (league.members.filter((m) => m.status === 'approved').length >= league.maxMembers) {
      res.status(409).json({ error: 'League is full.' });
      return;
    }
    const codeMatch = inviteCode && String(inviteCode).trim().toUpperCase() === league.inviteCode;
    const status = league.visibility === 'public' || codeMatch ? 'approved' : 'pending';
    league.members.push({
      userId,
      username,
      role: 'member',
      status,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      joinedAt: Date.now(),
    });
    league.updatedAt = Date.now();
    schedulePersist();
    res.json({ league });
  });

  app.post('/api/leagues/:leagueId/manage', (req, res) => {
    const { ownerId, action, targetUserId, announcement, fixtureId, result } = req.body ?? {};
    const league = store.leagues[req.params.leagueId];
    if (!league) {
      res.status(404).json({ error: 'League not found.' });
      return;
    }
    if (league.ownerId !== ownerId) {
      res.status(403).json({ error: 'Only league owner/admin can manage league.' });
      return;
    }

    if (action === 'approve' && targetUserId) {
      const m = league.members.find((x) => x.userId === targetUserId);
      if (m) m.status = 'approved';
    } else if (action === 'remove' && targetUserId && targetUserId !== league.ownerId) {
      league.members = league.members.filter((x) => x.userId !== targetUserId);
    } else if (action === 'announce' && typeof announcement === 'string') {
      league.announcement = announcement.slice(0, 300);
    } else if (action === 'start_season') {
      const approved = league.members.filter((m) => m.status === 'approved');
      if (approved.length < 2) {
        res.status(400).json({ error: 'Need at least 2 approved members to start a season.' });
        return;
      }
      league.status = 'active';
      league.fixtures = generateRoundRobinFixtures(league.members, league.seasonNumber);
    } else if (action === 'record_fixture' && fixtureId && result) {
      const fx = league.fixtures.find((f) => f.fixtureId === fixtureId);
      if (fx && fx.result === 'pending' && (result === 'white' || result === 'black' || result === 'draw')) {
        fx.result = result;
        const w = league.members.find((m) => m.userId === fx.whiteUserId);
        const b = league.members.find((m) => m.userId === fx.blackUserId);
        if (w && b) {
          w.played += 1;
          b.played += 1;
          if (result === 'white') {
            w.wins += 1;
            w.points += league.winPoints;
            b.losses += 1;
            b.points += league.lossPoints;
          } else if (result === 'black') {
            b.wins += 1;
            b.points += league.winPoints;
            w.losses += 1;
            w.points += league.lossPoints;
          } else {
            w.draws += 1;
            b.draws += 1;
            w.points += league.drawPoints;
            b.points += league.drawPoints;
          }
        }
        if (league.fixtures.every((f) => f.result !== 'pending')) {
          league.status = 'completed';
        }
      }
    }

    league.updatedAt = Date.now();
    schedulePersist();
    res.json({ league });
  });

  // --- TOURNAMENTS API ---
  app.get('/api/tournaments', (_req, res) => {
    const tournaments = Object.values(store.tournaments).sort((a, b) => b.updatedAt - a.updatedAt);
    res.json({ tournaments });
  });

  app.post('/api/tournaments', (req, res) => {
    const {
      name,
      description = '',
      ownerId,
      ownerName,
      ownerElo = 1200,
      variantPreset = 'english_8x8',
      customRules,
      format = 'single_elimination',
      maxParticipants = 8,
    } = req.body ?? {};
    if (!name || !ownerId || !ownerName) {
      res.status(400).json({ error: 'Tournament name, ownerId, and ownerName are required.' });
      return;
    }
    const rules = resolveRules(variantPreset, customRules);
    const tournamentId = generateId('trn');
    const now = Date.now();
    const tournament: ServerTournament = {
      tournamentId,
      name: String(name).trim().slice(0, 64),
      description: String(description).slice(0, 500),
      ownerId,
      ownerName,
      variantPreset: rules.preset,
      rules,
      format: format === 'round_robin' ? 'round_robin' : 'single_elimination',
      maxParticipants: Math.min(64, Math.max(2, Number(maxParticipants))),
      status: 'registration',
      championId: null,
      championName: null,
      participants: [
        {
          userId: ownerId,
          username: ownerName,
          elo: Number(ownerElo),
          seed: 1,
          eliminated: false,
        },
      ],
      bracket: [],
      createdAt: now,
      updatedAt: now,
    };
    store.tournaments[tournamentId] = tournament;
    schedulePersist();
    res.status(201).json({ tournament });
  });

  app.post('/api/tournaments/:tournamentId/join', (req, res) => {
    const { userId, username, elo = 1200 } = req.body ?? {};
    const t = store.tournaments[req.params.tournamentId];
    if (!t) {
      res.status(404).json({ error: 'Tournament not found.' });
      return;
    }
    if (t.status !== 'registration') {
      res.status(409).json({ error: 'Registration is closed.' });
      return;
    }
    if (t.participants.some((p) => p.userId === userId)) {
      res.json({ tournament: t });
      return;
    }
    if (t.participants.length >= t.maxParticipants) {
      res.status(409).json({ error: 'Tournament is full.' });
      return;
    }
    t.participants.push({
      userId,
      username,
      elo: Number(elo),
      seed: t.participants.length + 1,
      eliminated: false,
    });
    t.updatedAt = Date.now();
    schedulePersist();
    res.json({ tournament: t });
  });

  app.post('/api/tournaments/:tournamentId/start', (req, res) => {
    const { ownerId } = req.body ?? {};
    const t = store.tournaments[req.params.tournamentId];
    if (!t) {
      res.status(404).json({ error: 'Tournament not found.' });
      return;
    }
    if (t.ownerId !== ownerId) {
      res.status(403).json({ error: 'Only organizer can start tournament.' });
      return;
    }
    if (t.participants.length < 2) {
      res.status(400).json({ error: 'Need at least 2 participants.' });
      return;
    }
    t.status = 'in_progress';
    t.bracket = generateSingleEliminationBracket(t.participants);
    t.updatedAt = Date.now();
    schedulePersist();
    res.json({ tournament: t });
  });

  app.post('/api/tournaments/:tournamentId/advance', (req, res) => {
    const { ownerId, slotId, winnerUserId } = req.body ?? {};
    const t = store.tournaments[req.params.tournamentId];
    if (!t) {
      res.status(404).json({ error: 'Tournament not found.' });
      return;
    }
    if (t.ownerId !== ownerId) {
      res.status(403).json({ error: 'Only organizer can verify bracket results.' });
      return;
    }
    const slot = t.bracket.find((s) => s.slotId === slotId);
    if (!slot || slot.status === 'completed') {
      res.status(400).json({ error: 'Invalid or already completed bracket slot.' });
      return;
    }
    const isWhite = slot.whiteUserId === winnerUserId;
    const isBlack = slot.blackUserId === winnerUserId;
    if (!isWhite && !isBlack) {
      res.status(400).json({ error: 'Winner must be a participant in this slot.' });
      return;
    }

    slot.winnerUserId = winnerUserId;
    slot.winnerUsername = isWhite ? slot.whiteUsername : slot.blackUsername;
    slot.status = 'completed';

    const loserId = isWhite ? slot.blackUserId : slot.whiteUserId;
    if (loserId) {
      const loser = t.participants.find((p) => p.userId === loserId);
      if (loser) loser.eliminated = true;
    }

    // Advance winner to next round
    const nextRound = slot.round + 1;
    const nextIndex = Math.floor(slot.matchIndex / 2);
    const nextSlot = t.bracket.find((s) => s.round === nextRound && s.matchIndex === nextIndex);
    if (nextSlot) {
      if (slot.matchIndex % 2 === 0) {
        nextSlot.whiteUserId = slot.winnerUserId;
        nextSlot.whiteUsername = slot.winnerUsername;
      } else {
        nextSlot.blackUserId = slot.winnerUserId;
        nextSlot.blackUsername = slot.winnerUsername;
      }
      if (nextSlot.whiteUserId && nextSlot.blackUserId) {
        nextSlot.status = 'ready';
      }
    } else {
      // Final match completed -> crown champion
      t.status = 'completed';
      t.championId = slot.winnerUserId;
      t.championName = slot.winnerUsername;
    }

    t.updatedAt = Date.now();
    schedulePersist();
    res.json({ tournament: t });
  });

  // --- VITE / STATIC SERVING ---
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let joinedMatchId: string | null = null;
    let clientUserId = '';

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          matchId?: string;
          userId?: string;
          username?: string;
          variantPreset?: VariantPreset;
          timeControlSeconds?: number;
          from?: Coord;
          path?: Coord[];
        };

        if (msg.type === 'match:subscribe' && msg.matchId && msg.userId) {
          joinedMatchId = msg.matchId;
          clientUserId = msg.userId;
          if (!matchSubscribers.has(msg.matchId)) {
            matchSubscribers.set(msg.matchId, new Set());
          }
          matchSubscribers.get(msg.matchId)!.add({ ws, userId: msg.userId });
          const match = store.matches[msg.matchId];
          if (match) {
            checkMatchTimeout(match);
            ws.send(JSON.stringify({ type: 'match:sync', match }));
          }
        } else if (msg.type === 'match:move' && msg.matchId && msg.userId && msg.from && msg.path) {
          const match = store.matches[msg.matchId];
          if (!match) return;
          const resMove = applyAuthoritativeMove(match, msg.userId, msg.from, msg.path);
          if (resMove.ok) {
            broadcastMatchState(resMove.match, 'match:move');
          } else {
            ws.send(JSON.stringify({ type: 'match:error', error: resMove.error }));
          }
        } else if (msg.type === 'matchmaking:join' && msg.userId && msg.username) {
          const preset: VariantPreset = msg.variantPreset ?? 'english_8x8';
          const tc = Number(msg.timeControlSeconds ?? 600);
          // Find compatible opponent in queue
          const opponentIdx = matchmakingQueue.findIndex(
            (q) =>
              q.userId !== msg.userId &&
              q.variantPreset === preset &&
              q.timeControlSeconds === tc &&
              q.ws.readyState === WebSocket.OPEN
          );
          if (opponentIdx >= 0) {
            const opp = matchmakingQueue.splice(opponentIdx, 1)[0];
            const rules = resolveRules(preset);
            const matchId = generateId('m');
            const now = Date.now();
            const match: ServerMatch = {
              matchId,
              mode: 'realtime',
              variantPreset: preset,
              rules,
              whitePlayerId: opp.userId,
              whitePlayerName: opp.username,
              blackPlayerId: msg.userId,
              blackPlayerName: msg.username,
              hostSidePreference: 'white',
              status: 'active',
              gameState: createInitialGameState(rules),
              roomCode: generateRoomCode(),
              isPrivate: false,
              timeControlSeconds: tc,
              whiteTimeRemainingMs: tc * 1000,
              blackTimeRemainingMs: tc * 1000,
              lastTurnStartedAt: now,
              turnDeadlineHours: 0,
              turnDeadlineAt: null,
              drawOfferBy: null,
              winnerSide: null,
              resultReason: null,
              createdAt: now,
              updatedAt: now,
            };
            store.matches[matchId] = match;
            schedulePersist();
            const foundPayload = JSON.stringify({ type: 'matchmaking:matched', match });
            opp.ws.send(foundPayload);
            ws.send(foundPayload);
          } else {
            // Avoid duplicates in queue
            const existingIdx = matchmakingQueue.findIndex((q) => q.userId === msg.userId);
            if (existingIdx >= 0) matchmakingQueue.splice(existingIdx, 1);
            matchmakingQueue.push({
              ws,
              userId: msg.userId,
              username: msg.username,
              variantPreset: preset,
              timeControlSeconds: tc,
              queuedAt: Date.now(),
            });
            ws.send(JSON.stringify({ type: 'matchmaking:queued' }));
          }
        } else if (msg.type === 'matchmaking:leave' && msg.userId) {
          const idx = matchmakingQueue.findIndex((q) => q.userId === msg.userId);
          if (idx >= 0) matchmakingQueue.splice(idx, 1);
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (joinedMatchId && matchSubscribers.has(joinedMatchId)) {
        const set = matchSubscribers.get(joinedMatchId)!;
        for (const item of set) {
          if (item.ws === ws || item.userId === clientUserId) {
            set.delete(item);
          }
        }
      }
      const qIdx = matchmakingQueue.findIndex((q) => q.ws === ws);
      if (qIdx >= 0) matchmakingQueue.splice(qIdx, 1);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`DRAFT MASTER server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
