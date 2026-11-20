import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Copy,
  Film,
  Flag,
  Handshake,
  History,
  Pause,
  Play,
  RotateCcw,
  Save,
  Undo2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AI_DIFFICULTIES } from '../engine/presets.ts';
import {
  applyMove,
  countPieces,
  createInitialGameState,
  generateLegalMoves,
  revertLastMove,
} from '../engine/rules.ts';
import type {
  AIAnalysisResult,
  AIDifficultyId,
  DraughtsMove,
  GameState,
  PlayerSide,
  RuleConfig,
} from '../engine/types.ts';
import { findBestMove } from '../ai/search.ts';
import { playCaptureSound, playMoveSound, playPromoteSound, playVictorySound } from '../services/sound.ts';
import { AIThinkingPanel } from './AIThinkingPanel.tsx';
import { DraughtsBoard, type BoardLastMove } from './DraughtsBoard.tsx';

export interface OnlineMatchContext {
  matchId: string;
  mode: 'realtime' | 'turn_based' | 'league' | 'tournament';
  roomCode: string;
  whitePlayerId: string | null;
  whitePlayerName: string;
  blackPlayerId: string | null;
  blackPlayerName: string;
  status: 'waiting' | 'active' | 'completed' | 'aborted';
  timeControlSeconds: number;
  whiteTimeRemainingMs: number;
  blackTimeRemainingMs: number;
  lastTurnStartedAt: number;
  turnDeadlineAt: number | null;
  drawOfferBy: PlayerSide | null;
  winnerSide: 'white' | 'black' | 'draw' | null;
  resultReason: string | null;
  rules?: RuleConfig;
  gameState: GameState;
}

interface MatchArenaProps {
  mode: 'ai' | 'local' | 'online';
  initialState?: GameState;
  rules: RuleConfig;
  playerSide?: PlayerSide;
  difficulty?: AIDifficultyId;
  timeControlSeconds?: number;
  whiteName?: string;
  blackName?: string;
  currentUserId: string;
  onlineMatch?: OnlineMatchContext | null;
  boardThemeId: string;
  pieceThemeId: string;
  soundEnabled: boolean;
  showAIThinking: boolean;
  onToggleAIThinking: () => void;
  onSaveMatch: (state: GameState, result: 'playing' | 'win' | 'loss' | 'draw') => void;
  onCompleteMatch: (
    result: 'win' | 'loss' | 'draw',
    capturesCount: number,
    rules: RuleConfig,
    difficulty?: AIDifficultyId
  ) => void;
  onOpenAnalysis: (
    state: GameState,
    title: string,
    whiteName?: string,
    blackName?: string,
    autoExportVideo?: boolean
  ) => void;
  onExit: () => void;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MatchArena: React.FC<MatchArenaProps> = ({
  mode,
  initialState,
  rules,
  playerSide = 'white',
  difficulty = 'medium',
  timeControlSeconds = 0,
  whiteName = 'White',
  blackName = 'Black',
  currentUserId,
  onlineMatch: initialOnlineMatch = null,
  boardThemeId,
  pieceThemeId,
  soundEnabled,
  showAIThinking,
  onToggleAIThinking,
  onSaveMatch,
  onCompleteMatch,
  onOpenAnalysis,
  onExit,
}) => {
  const [gameState, setGameState] = useState<GameState>(
    () => initialState ?? initialOnlineMatch?.gameState ?? createInitialGameState(rules)
  );
  const [paused, setPaused] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [onlineMeta, setOnlineMeta] = useState<OnlineMatchContext | null>(initialOnlineMatch);
  const [wsConnected, setWsConnected] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Local clocks for AI/local timed modes
  const [whiteClockMs, setWhiteClockMs] = useState<number>(
    initialOnlineMatch ? initialOnlineMatch.whiteTimeRemainingMs : timeControlSeconds * 1000
  );
  const [blackClockMs, setBlackClockMs] = useState<number>(
    initialOnlineMatch ? initialOnlineMatch.blackTimeRemainingMs : timeControlSeconds * 1000
  );

  const workerRef = useRef<Worker | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reportedCompletionRef = useRef(false);

  const effectiveRules = onlineMeta?.rules ?? gameState.rules;
  const effectiveSide: PlayerSide | undefined = useMemo(() => {
    if (mode === 'ai') return playerSide;
    if (mode === 'online' && onlineMeta) {
      if (onlineMeta.whitePlayerId === currentUserId) return 'white';
      if (onlineMeta.blackPlayerId === currentUserId) return 'black';
    }
    return undefined;
  }, [mode, playerSide, onlineMeta, currentUserId]);

  const legalMoves = useMemo(
    () =>
      gameState.status === 'playing'
        ? generateLegalMoves(gameState.board, gameState.turn, gameState.rules)
        : [],
    [gameState]
  );

  const pieceCounts = useMemo(
    () => countPieces(gameState.board, gameState.boardSize),
    [gameState.board, gameState.boardSize]
  );

  const lastMove: BoardLastMove | null = useMemo(() => {
    const last = gameState.history[gameState.history.length - 1];
    return last
      ? {
          from: last.move.from,
          to: last.move.to,
          path: last.move.path,
          captured: last.move.captured,
          promoted: last.move.promoted,
          ply: last.ply,
        }
      : null;
  }, [gameState.history]);

  // Spawn dedicated Web Worker for AI search so UI never blocks
  useEffect(() => {
    if (mode !== 'ai') return;
    try {
      const worker = new Worker(new URL('../ai/ai.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, [mode]);

  // Connect WebSocket for online multiplayer
  useEffect(() => {
    if (mode !== 'online' || !onlineMeta?.matchId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(
        JSON.stringify({
          type: 'match:subscribe',
          matchId: onlineMeta.matchId,
          userId: currentUserId,
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (
          (msg.type === 'match:sync' ||
            msg.type === 'match:move' ||
            msg.type === 'match:joined' ||
            msg.type === 'match:ended') &&
          msg.match
        ) {
          const m = msg.match as OnlineMatchContext & { rules?: RuleConfig };
          setOnlineMeta(m);
          setGameState(m.gameState);
          setWhiteClockMs(m.whiteTimeRemainingMs);
          setBlackClockMs(m.blackTimeRemainingMs);
          if (msg.type === 'match:joined') {
            setStatusBanner('Opponent joined! Match is now live.');
          }
        } else if (msg.type === 'match:error') {
          setStatusBanner(msg.error || 'Move rejected by server.');
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [mode, onlineMeta?.matchId, currentUserId]);

  // Clocks ticker
  useEffect(() => {
    if (paused || gameState.status !== 'playing') return;
    if (mode === 'online' && onlineMeta?.status !== 'active') return;
    if (mode === 'online' && onlineMeta?.mode !== 'realtime') return;
    if (mode !== 'online' && timeControlSeconds <= 0) return;

    const timer = setInterval(() => {
      if (gameState.turn === 'white') {
        setWhiteClockMs((prev) => {
          const next = Math.max(0, prev - 250);
          if (next === 0 && mode !== 'online') {
            setGameState((gs) =>
              gs.status === 'playing'
                ? { ...gs, status: 'black_won', endReason: 'timeout' }
                : gs
            );
          }
          return next;
        });
      } else {
        setBlackClockMs((prev) => {
          const next = Math.max(0, prev - 250);
          if (next === 0 && mode !== 'online') {
            setGameState((gs) =>
              gs.status === 'playing'
                ? { ...gs, status: 'white_won', endReason: 'timeout' }
                : gs
            );
          }
          return next;
        });
      }
    }, 250);

    return () => clearInterval(timer);
  }, [paused, gameState.status, gameState.turn, mode, onlineMeta?.status, onlineMeta?.mode, timeControlSeconds]);

  // Report completion & auto-save completed match once
  useEffect(() => {
    if (gameState.status === 'playing' || reportedCompletionRef.current) return;
    reportedCompletionRef.current = true;
    playVictorySound(soundEnabled);

    const humanSide = effectiveSide ?? 'white';
    let result: 'win' | 'loss' | 'draw' = 'draw';
    if (gameState.status === 'white_won') result = humanSide === 'white' ? 'win' : 'loss';
    else if (gameState.status === 'black_won') result = humanSide === 'black' ? 'win' : 'loss';

    const humanCaptures = gameState.history
      .filter((h) => h.side === humanSide)
      .reduce((acc, h) => acc + h.move.captured.length, 0);

    onSaveMatch(gameState, result);
    onCompleteMatch(result, humanCaptures, gameState.rules, mode === 'ai' ? difficulty : undefined);
  }, [gameState, effectiveSide, mode, difficulty, soundEnabled, onSaveMatch, onCompleteMatch]);

  const playMoveAudio = useCallback(
    (move: DraughtsMove) => {
      if (move.promoted) playPromoteSound(soundEnabled);
      else if (move.isCapture) playCaptureSound(soundEnabled);
      else playMoveSound(soundEnabled);
    },
    [soundEnabled]
  );

  // Trigger AI move automatically when it's AI's turn
  useEffect(() => {
    if (mode !== 'ai' || paused || gameState.status !== 'playing') return;
    if (gameState.turn === playerSide) return;

    let cancelled = false;
    setAiThinking(true);

    const runAI = async () => {
      // Natural pacing delay (280ms) so player perceives AI move clearly
      await new Promise((r) => setTimeout(r, 280));
      if (cancelled) return;

      const worker = workerRef.current;
      let result: AIAnalysisResult;

      if (worker) {
        result = await new Promise<AIAnalysisResult>((resolve, reject) => {
          const reqId = `${Date.now()}_${Math.random()}`;
          const handleMsg = (ev: MessageEvent) => {
            if (ev.data?.requestId !== reqId) return;
            worker.removeEventListener('message', handleMsg);
            if (ev.data.ok) resolve(ev.data.result);
            else reject(new Error(ev.data.error));
          };
          worker.addEventListener('message', handleMsg);
          worker.postMessage({ requestId: reqId, state: gameState, difficulty });
        }).catch(() => findBestMove(gameState, difficulty));
      } else {
        result = findBestMove(gameState, difficulty);
      }

      if (cancelled) return;
      setAiAnalysis(result);
      setAiThinking(false);

      if (result.bestMove) {
        playMoveAudio(result.bestMove);
        setGameState((prev) => applyMove(prev, result.bestMove!));
      }
    };

    void runAI();
    return () => {
      cancelled = true;
    };
  }, [mode, paused, gameState, playerSide, difficulty, playMoveAudio]);

  const handlePlayerMove = (move: DraughtsMove) => {
    if (paused || gameState.status !== 'playing') return;
    setStatusBanner(null);

    if (mode === 'online' && onlineMeta) {
      if (onlineMeta.status !== 'active') {
        setStatusBanner('Waiting for opponent to join before moving.');
        return;
      }
      playMoveAudio(move);
      // Optimistically apply locally; server authoritative broadcast reconciles
      const next = applyMove(gameState, move);
      setGameState(next);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'match:move',
            matchId: onlineMeta.matchId,
            userId: currentUserId,
            from: move.from,
            path: move.path,
          })
        );
      } else {
        void fetch(`/api/matches/${onlineMeta.matchId}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            from: move.from,
            path: move.path,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.match) {
              setOnlineMeta(data.match);
              setGameState(data.match.gameState);
            } else if (data.error) {
              setStatusBanner(data.error);
            }
          });
      }
      return;
    }

    playMoveAudio(move);
    setGameState((prev) => applyMove(prev, move));
  };

  const handleUndo = () => {
    if (mode === 'online' || aiThinking || gameState.history.length === 0) return;
    if (mode === 'ai') {
      // Revert both AI reply and player's last move if it's player's turn
      let next = revertLastMove(gameState);
      if (next.turn !== playerSide && next.history.length > 0) {
        next = revertLastMove(next);
      }
      setGameState(next);
    } else {
      setGameState((prev) => revertLastMove(prev));
    }
  };

  const handleRestart = () => {
    if (mode === 'online') return;
    reportedCompletionRef.current = false;
    setGameState(createInitialGameState(gameState.rules));
    setWhiteClockMs(timeControlSeconds * 1000);
    setBlackClockMs(timeControlSeconds * 1000);
    setAiAnalysis(null);
    setPaused(false);
  };

  const handleOnlineResign = async () => {
    if (!onlineMeta) return;
    const res = await fetch(`/api/matches/${onlineMeta.matchId}/resign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId }),
    });
    const data = await res.json();
    if (data.match) {
      setOnlineMeta(data.match);
      setGameState(data.match.gameState);
    }
  };

  const handleOnlineDraw = async (action: 'offer' | 'accept' | 'decline') => {
    if (!onlineMeta) return;
    const res = await fetch(`/api/matches/${onlineMeta.matchId}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, action }),
    });
    const data = await res.json();
    if (data.match) {
      setOnlineMeta(data.match);
      setGameState(data.match.gameState);
    }
  };

  const handleRematch = async () => {
    if (!onlineMeta) return;
    const res = await fetch(`/api/matches/${onlineMeta.matchId}/rematch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId }),
    });
    const data = await res.json();
    if (data.match) {
      reportedCompletionRef.current = false;
      setOnlineMeta(data.match);
      setGameState(data.match.gameState);
      setWhiteClockMs(data.match.whiteTimeRemainingMs);
      setBlackClockMs(data.match.blackTimeRemainingMs);
    }
  };

  const handleCopyRoomCode = () => {
    if (!onlineMeta?.roomCode) return;
    void navigator.clipboard?.writeText(onlineMeta.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const diffProfile = AI_DIFFICULTIES[difficulty];
  const displayWhiteName = onlineMeta ? onlineMeta.whitePlayerName : whiteName;
  const displayBlackName = onlineMeta ? onlineMeta.blackPlayerName : blackName;
  const flipBoard = effectiveSide === 'black';

  const topSide: PlayerSide = flipBoard ? 'white' : 'black';
  const bottomSide: PlayerSide = flipBoard ? 'black' : 'white';

  const renderPlayerStrip = (side: PlayerSide) => {
    const isTurn = gameState.turn === side && gameState.status === 'playing';
    const name = side === 'white' ? displayWhiteName : displayBlackName;
    const men = side === 'white' ? pieceCounts.whiteMen : pieceCounts.blackMen;
    const kings = side === 'white' ? pieceCounts.whiteKings : pieceCounts.blackKings;
    const clockMs = side === 'white' ? whiteClockMs : blackClockMs;
    const showClock =
      (mode !== 'online' && timeControlSeconds > 0) ||
      (mode === 'online' && onlineMeta?.mode === 'realtime' && onlineMeta.timeControlSeconds > 0);

    return (
      <div
        className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl border transition-colors ${
          isTurn
            ? 'border-amber-500/70 bg-amber-500/10'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-4 h-4 rounded-full border shrink-0 ${
              side === 'white'
                ? 'bg-stone-100 border-stone-400'
                : 'bg-slate-900 border-slate-600'
            }`}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {men} Men · {kings} Kings {isTurn ? '· Active Turn' : ''}
            </div>
          </div>
        </div>
        {showClock && (
          <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatClock(clockMs)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Arena Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Leave Match
          </button>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {effectiveRules.name}
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'ai'
                ? `vs ${diffProfile.label} AI (Elo ~${diffProfile.eloEstimate})`
                : mode === 'local'
                  ? 'Local Pass & Play'
                  : `Online ${onlineMeta?.mode === 'turn_based' ? 'Turn-Based' : 'Real-Time'}`}
              {' · '}
              {effectiveRules.flyingKings ? 'Flying Kings' : '1-Sq Kings'}
              {' · '}
              {effectiveRules.maximumCapture ? 'Max Capture' : 'Standard Capture'}
            </div>
          </div>
        </div>

        {/* Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'online' && onlineMeta && (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mr-2">
                {wsConnected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                )}
                {wsConnected ? 'Live Sync' : 'HTTP Sync'}
              </span>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedCode ? 'Copied' : `Room ${onlineMeta.roomCode}`}
              </button>
            </>
          )}

          {mode !== 'online' && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                disabled={gameState.history.length === 0 || aiThinking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>
              <button
                type="button"
                onClick={() => {
                  const res =
                    gameState.status === 'playing'
                      ? 'playing'
                      : gameState.status === 'draw'
                        ? 'draw'
                        : (gameState.status === 'white_won' && (effectiveSide ?? 'white') === 'white') ||
                            (gameState.status === 'black_won' && (effectiveSide ?? 'white') === 'black')
                          ? 'win'
                          : 'loss';
                  onSaveMatch(gameState, res);
                  setStatusBanner('Match saved locally for offline resume and analysis.');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {statusBanner && (
        <div className="px-4 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
          {statusBanner}
        </div>
      )}

      {/* Main 2-Column Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Center: Board & Player Strips */}
        <div className="lg:col-span-7 space-y-3">
          {renderPlayerStrip(topSide)}

          <div className="relative">
            <DraughtsBoard
              boardSize={gameState.boardSize}
              board={gameState.board}
              turn={gameState.turn}
              interactive={
                !paused &&
                gameState.status === 'playing' &&
                !aiThinking &&
                (mode !== 'online' || onlineMeta?.status === 'active')
              }
              allowedSide={effectiveSide}
              legalMoves={legalMoves}
              flipped={flipBoard}
              boardThemeId={boardThemeId}
              pieceThemeId={pieceThemeId}
              lastMove={lastMove}
              onExecuteMove={handlePlayerMove}
            />

            {paused && (
              <div className="absolute inset-0 z-30 rounded-xl bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center">
                <h3 className="text-xl font-semibold text-white">Match Paused</h3>
                <p className="text-xs text-slate-300">Timers and AI turns are suspended.</p>
                <button
                  type="button"
                  onClick={() => setPaused(false)}
                  className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
                >
                  Resume Play
                </button>
              </div>
            )}
          </div>

          {renderPlayerStrip(bottomSide)}
        </div>

        {/* Right Column: Match Status, AI Thinking, Actions, Move History */}
        <div className="lg:col-span-5 space-y-4">
          {/* End-of-Match Summary Card */}
          {gameState.status !== 'playing' && (
            <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 p-5 space-y-3">
              <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Match Concluded · Saved to Archive · {gameState.endReason?.replace(/_/g, ' ') ?? 'Finished'}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {gameState.status === 'white_won'
                  ? `${displayWhiteName} Wins`
                  : gameState.status === 'black_won'
                    ? `${displayBlackName} Wins`
                    : 'Match Drawn'}
              </h3>
              <div className="flex flex-wrap gap-2 pt-1">
                {mode !== 'online' ? (
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    Play Again
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRematch}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    Rematch (Swap Colors)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onOpenAnalysis(
                      gameState,
                      `${displayWhiteName} vs ${displayBlackName}`,
                      displayWhiteName,
                      displayBlackName,
                      false
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <History className="w-3.5 h-3.5 text-amber-500" />
                  Watch Replay
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenAnalysis(
                      gameState,
                      `${displayWhiteName} vs ${displayBlackName}`,
                      displayWhiteName,
                      displayBlackName,
                      true
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  <Film className="w-3.5 h-3.5" />
                  Share Video
                </button>
              </div>
            </div>
          )}

          {/* Online Actions (Draw Offer / Resign) */}
          {mode === 'online' && onlineMeta && gameState.status === 'playing' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-4 space-y-3">
              {onlineMeta.status === 'waiting' ? (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Waiting for an opponent to join. Share room code{' '}
                  <span className="font-mono font-semibold text-amber-500">
                    {onlineMeta.roomCode}
                  </span>{' '}
                  so a friend can join immediately.
                </p>
              ) : (
                <div className="space-y-2">
                  {onlineMeta.drawOfferBy && onlineMeta.drawOfferBy !== effectiveSide && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        Opponent offers a draw
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOnlineDraw('accept')}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-medium"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOnlineDraw('decline')}
                          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOnlineDraw('offer')}
                      disabled={onlineMeta.drawOfferBy === effectiveSide}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      {onlineMeta.drawOfferBy === effectiveSide ? 'Draw Offered' : 'Offer Draw'}
                    </button>
                    <button
                      type="button"
                      onClick={handleOnlineResign}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-rose-500/40 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Resign
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Thinking Display */}
          {mode === 'ai' && (
            <AIThinkingPanel
              analysis={aiAnalysis}
              thinking={aiThinking}
              difficultyLabel={diffProfile.label}
              visible={showAIThinking}
              onToggleVisible={onToggleAIThinking}
            />
          )}

          {/* Mandatory Capture Hint Notice */}
          {legalMoves.some((m) => m.isCapture) && effectiveRules.mandatoryCapture && (
            <div className="px-4 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
              {effectiveRules.maximumCapture
                ? 'Mandatory Maximum Capture active: choose a highlighted sequence with the highest capture count.'
                : 'Mandatory Capture active: select a piece with an amber capture target.'}
            </div>
          )}

          {/* Move Notation History */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Move History
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {gameState.moveCount} ply
              </span>
            </div>
            {gameState.history.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                No moves played yet. {gameState.turn === 'white' ? 'White' : 'Black'} opens.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70 text-xs font-mono tabular-nums">
                {gameState.history.map((rec) => (
                  <div key={rec.ply} className="flex items-center justify-between py-1.5 px-1">
                    <span className="text-slate-400 w-10">#{rec.ply}</span>
                    <span className="capitalize text-slate-600 dark:text-slate-300 w-16">
                      {rec.side}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 flex-1">
                      {rec.move.notation}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {rec.move.promoted
                        ? 'King'
                        : rec.move.captured.length > 0
                          ? `-${rec.move.captured.length}`
                          : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
