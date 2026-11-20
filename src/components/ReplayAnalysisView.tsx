import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Film,
  Link2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { findBestMove } from '../ai/search.ts';
import { applyMove, createInitialGameState, decompressBoard } from '../engine/rules.ts';
import type { AIAnalysisResult, GameState } from '../engine/types.ts';
import type { SavedMatchRecord } from '../services/localStore.ts';
import { playCaptureSound, playMoveSound, playPromoteSound } from '../services/sound.ts';
import {
  exportMatchAsVideo,
  type ExportedVideoResult,
  type VideoExportProgress,
} from '../services/videoExporter.ts';
import { AIThinkingPanel } from './AIThinkingPanel.tsx';
import { DraughtsBoard, type BoardLastMove } from './DraughtsBoard.tsx';

export interface ReplayTargetState {
  state: GameState;
  title: string;
  whiteName?: string;
  blackName?: string;
  autoExportVideo?: boolean;
}

interface ReplayAnalysisViewProps {
  savedMatches: SavedMatchRecord[];
  initialReplayState?: ReplayTargetState | null;
  boardThemeId: string;
  pieceThemeId: string;
  soundEnabled?: boolean;
  onResumeSavedMatch: (record: SavedMatchRecord) => void;
  onDeleteSavedMatch: (id: string) => void;
}

const SPEED_OPTIONS = [
  { label: '0.5×', value: 0.5, intervalMs: 1400 },
  { label: '1×', value: 1, intervalMs: 750 },
  { label: '2×', value: 2, intervalMs: 380 },
  { label: '4×', value: 4, intervalMs: 190 },
] as const;

export const ReplayAnalysisView: React.FC<ReplayAnalysisViewProps> = ({
  savedMatches,
  initialReplayState = null,
  boardThemeId,
  pieceThemeId,
  soundEnabled = true,
  onResumeSavedMatch,
  onDeleteSavedMatch,
}) => {
  const [activeMatch, setActiveMatch] = useState<ReplayTargetState | null>(() => {
    if (initialReplayState) return initialReplayState;
    if (savedMatches[0]) {
      return {
        state: savedMatches[0].state,
        title: savedMatches[0].title,
        whiteName: savedMatches[0].playerSide === 'white' ? 'You' : savedMatches[0].opponentName,
        blackName: savedMatches[0].playerSide === 'black' ? 'You' : savedMatches[0].opponentName,
      };
    }
    return null;
  });

  const [plyIndex, setPlyIndex] = useState<number>(() =>
    initialReplayState ? 0 : activeMatch?.state.history.length ?? 0
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Video export & sharing state
  const [videoModalOpen, setVideoModalOpen] = useState<boolean>(
    Boolean(initialReplayState?.autoExportVideo)
  );
  const [exportProgress, setExportProgress] = useState<VideoExportProgress | null>(null);
  const [exportedVideo, setExportedVideo] = useState<ExportedVideoResult | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const prevUrlRef = useRef<string | null>(null);

  // Sync when caller provides a new initialReplayState
  useEffect(() => {
    if (!initialReplayState) return;
    setActiveMatch(initialReplayState);
    setPlyIndex(0);
    setIsPlaying(!initialReplayState.autoExportVideo);
    setAnalysis(null);
    setExportedVideo(null);
    setShareLinkUrl(null);
    setVideoError(null);
    if (initialReplayState.autoExportVideo) {
      setVideoModalOpen(true);
    }
  }, [initialReplayState]);

  // Clean up object URL when replaced or unmounted
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, []);

  const totalPlies = activeMatch?.state.history.length ?? 0;

  // Auto-playback interval
  useEffect(() => {
    if (!isPlaying || !activeMatch) return;
    if (plyIndex >= totalPlies) {
      setIsPlaying(false);
      return;
    }
    const opt = SPEED_OPTIONS.find((s) => s.value === speed) ?? SPEED_OPTIONS[1];
    const timer = setInterval(() => {
      setPlyIndex((prev) => {
        if (prev >= totalPlies) {
          setIsPlaying(false);
          return prev;
        }
        const nextPly = prev + 1;
        const rec = activeMatch.state.history[nextPly - 1];
        if (rec) {
          if (rec.move.promoted) playPromoteSound(soundEnabled);
          else if (rec.move.isCapture) playCaptureSound(soundEnabled);
          else playMoveSound(soundEnabled);
        }
        if (nextPly >= totalPlies) {
          setIsPlaying(false);
        }
        return nextPly;
      });
    }, opt.intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, activeMatch, plyIndex, totalPlies, speed, soundEnabled]);

  const reconstructedState = useMemo(() => {
    if (!activeMatch) return null;
    const base = activeMatch.state;
    let cur: GameState;
    if (base.initialBoardCompressed) {
      const dec = decompressBoard(base.initialBoardCompressed);
      const turn = base.initialTurn ?? base.rules.firstPlayer;
      cur = {
        boardSize: dec.boardSize,
        board: dec.board,
        initialBoardCompressed: base.initialBoardCompressed,
        initialTurn: turn,
        turn,
        rules: base.rules,
        moveCount: 0,
        noProgressCount: 0,
        positionCounts: { [`${turn}:${base.initialBoardCompressed}`]: 1 },
        status: 'playing',
        history: [],
      };
    } else {
      cur = createInitialGameState(base.rules);
    }
    const maxPly = Math.min(plyIndex, base.history.length);
    for (let i = 0; i < maxPly; i++) {
      cur = applyMove(cur, base.history[i].move);
    }
    return cur;
  }, [activeMatch, plyIndex]);

  const lastMoveAtPly: BoardLastMove | null = useMemo(() => {
    if (!activeMatch || plyIndex <= 0) return null;
    const rec = activeMatch.state.history[plyIndex - 1];
    return rec
      ? {
          from: rec.move.from,
          to: rec.move.to,
          path: rec.move.path,
          captured: rec.move.captured,
          promoted: rec.move.promoted,
          ply: rec.ply,
        }
      : null;
  }, [activeMatch, plyIndex]);

  const runPositionAnalysis = () => {
    if (!reconstructedState || reconstructedState.status !== 'playing') return;
    setAnalyzing(true);
    setTimeout(() => {
      const res = findBestMove(reconstructedState, 'master', 500);
      setAnalysis(res);
      setAnalyzing(false);
    }, 30);
  };

  const handleGenerateVideo = async () => {
    if (!activeMatch) return;
    setIsPlaying(false);
    setVideoError(null);
    setExportedVideo(null);
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setVideoPreviewUrl(null);
    setExportProgress({ phase: 'rendering', percent: 2 });

    try {
      const result = await exportMatchAsVideo(
        activeMatch.state,
        activeMatch.title,
        activeMatch.whiteName || 'White',
        activeMatch.blackName || 'Black',
        boardThemeId,
        (p) => setExportProgress(p)
      );
      const url = URL.createObjectURL(result.blob);
      prevUrlRef.current = url;
      setVideoPreviewUrl(url);
      setExportedVideo(result);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Unable to generate match video.');
      setExportProgress(null);
    }
  };

  const handleDownloadVideo = () => {
    if (!exportedVideo || !videoPreviewUrl) return;
    const a = document.createElement('a');
    a.href = videoPreviewUrl;
    a.download = exportedVideo.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleNativeShareVideo = async () => {
    if (!exportedVideo || !activeMatch) return;
    const file = new File([exportedVideo.blob], exportedVideo.filename, {
      type: exportedVideo.mimeType,
    });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    if (typeof nav.share === 'function') {
      try {
        if (!nav.canShare || nav.canShare({ files: [file] })) {
          await nav.share({
            title: `Draft Master — ${activeMatch.title}`,
            text: `Watch my Draughts match replay (${activeMatch.state.moveCount} moves).`,
            files: [file],
          });
          return;
        }
      } catch {
        // user cancelled or file share rejected; fallback to download
      }
    }
    handleDownloadVideo();
  };

  const handleCreateShareLink = async () => {
    if (!activeMatch) return;
    setCreatingLink(true);
    setVideoError(null);
    try {
      const resp = await fetch('/api/replays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeMatch.title,
          whiteName: activeMatch.whiteName || 'White',
          blackName: activeMatch.blackName || 'Black',
          gameState: activeMatch.state,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.replayId) {
        throw new Error(data.error || 'Could not create replay link.');
      }
      const shareUrl = `${window.location.origin}/?replay=${encodeURIComponent(data.replayId)}`;
      setShareLinkUrl(shareUrl);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to create replay link.');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLinkUrl) return;
    await navigator.clipboard?.writeText(shareLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const playedMoveFeedback = useMemo(() => {
    if (!activeMatch || !analysis || !reconstructedState) return null;
    const nextPlayed = activeMatch.state.history[plyIndex];
    if (!nextPlayed || !analysis.bestMove) return null;
    const playedNotation = nextPlayed.move.notation;
    const bestNotation = analysis.bestMove.notation;
    if (playedNotation === bestNotation) {
      return {
        label: 'Best Move Played',
        detail: `${playedNotation} matches the Master engine top choice.`,
        tone: 'good',
      };
    }
    const cand = analysis.candidateMoves.find((c) => c.notation === playedNotation);
    const lossCp = cand ? analysis.scoreCp - cand.scoreCp : 120;
    if (lossCp >= 180) {
      return {
        label: 'Critical Mistake Detected',
        detail: `Played ${playedNotation}. Engine recommends ${bestNotation} instead.`,
        tone: 'blunder',
      };
    }
    return {
      label: 'Alternative Available',
      detail: `Played ${playedNotation}. Engine slightly favors ${bestNotation}.`,
      tone: 'neutral',
    };
  }, [activeMatch, analysis, reconstructedState, plyIndex]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Match Replay & Video Studio
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Watch full move-by-move playback, adjust speed, inspect engine lines, or export a shareable match video.
          </p>
        </div>

        {activeMatch && (
          <button
            type="button"
            onClick={() => setVideoModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
          >
            <Film className="w-4 h-4" />
            Share Match as Video
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Saved Matches Sidebar */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-3.5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Match Archive ({savedMatches.length})
          </h2>
          {savedMatches.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              Finished matches are saved automatically so you can replay or share them here.
            </p>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto">
              {savedMatches.map((rec) => {
                const isSelected = activeMatch?.state === rec.state;
                return (
                  <div
                    key={rec.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setActiveMatch({
                          state: rec.state,
                          title: rec.title,
                          whiteName: rec.playerSide === 'white' ? 'You' : rec.opponentName,
                          blackName: rec.playerSide === 'black' ? 'You' : rec.opponentName,
                        });
                        setPlyIndex(0);
                        setAnalysis(null);
                        setExportedVideo(null);
                        setShareLinkUrl(null);
                      }}
                      className="w-full text-left"
                    >
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {rec.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {rec.rules.boardSize}×{rec.rules.boardSize} · {rec.state.moveCount} ply ·{' '}
                        <span className="capitalize">{rec.result}</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                      {rec.result === 'playing' && (
                        <button
                          type="button"
                          onClick={() => onResumeSavedMatch(rec)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          <Play className="w-3 h-3" />
                          Resume
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteSavedMatch(rec.id)}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Replay Board & Player Controls */}
        <div className="lg:col-span-9 space-y-4">
          {activeMatch && reconstructedState ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              <div className="md:col-span-7 space-y-3">
                <DraughtsBoard
                  boardSize={reconstructedState.boardSize}
                  board={reconstructedState.board}
                  turn={reconstructedState.turn}
                  interactive={false}
                  legalMoves={[]}
                  boardThemeId={boardThemeId}
                  pieceThemeId={pieceThemeId}
                  lastMove={lastMoveAtPly}
                  onExecuteMove={() => {}}
                />

                {/* Complete Replay Player Dock */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-3 space-y-3">
                  {/* Interactive Timeline Scrubber */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 w-16">
                      {plyIndex} / {totalPlies}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={totalPlies}
                      value={plyIndex}
                      onChange={(e) => {
                        setIsPlaying(false);
                        setPlyIndex(Number(e.target.value));
                        setAnalysis(null);
                      }}
                      aria-label="Replay move timeline"
                      className="flex-1 accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Transport & Speed Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaying(false);
                          setPlyIndex(0);
                          setAnalysis(null);
                        }}
                        disabled={plyIndex === 0}
                        aria-label="First move"
                        title="Jump to start"
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaying(false);
                          setPlyIndex((p) => Math.max(0, p - 1));
                          setAnalysis(null);
                        }}
                        disabled={plyIndex === 0}
                        aria-label="Previous move"
                        title="Previous move"
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (plyIndex >= totalPlies) {
                            setPlyIndex(0);
                            setIsPlaying(true);
                          } else {
                            setIsPlaying((p) => !p);
                          }
                        }}
                        disabled={totalPlies === 0}
                        aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-40"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isPlaying ? 'Pause' : plyIndex >= totalPlies ? 'Replay' : 'Play'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaying(false);
                          setPlyIndex((p) => Math.min(totalPlies, p + 1));
                          setAnalysis(null);
                        }}
                        disabled={plyIndex >= totalPlies}
                        aria-label="Next move"
                        title="Next move"
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaying(false);
                          setPlyIndex(totalPlies);
                          setAnalysis(null);
                        }}
                        disabled={plyIndex >= totalPlies}
                        aria-label="Last move"
                        title="Jump to end"
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlyIndex(0);
                          setIsPlaying(true);
                          setAnalysis(null);
                        }}
                        disabled={totalPlies === 0}
                        aria-label="Replay from beginning"
                        title="Replay from beginning"
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Speed Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0B0F17] p-1 rounded-lg">
                      {SPEED_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSpeed(opt.value)}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                            speed === opt.value
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Evaluation, Video Share & Timeline */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runPositionAnalysis}
                    disabled={analyzing || reconstructedState.status !== 'playing'}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] hover:border-amber-500/60 text-xs font-semibold disabled:opacity-50"
                  >
                    <BrainCircuit className="w-4 h-4 text-amber-500" />
                    {analyzing ? 'Analyzing...' : 'Evaluate Position'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoModalOpen(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Video
                  </button>
                </div>

                <AIThinkingPanel
                  analysis={analysis}
                  thinking={analyzing}
                  difficultyLabel="Master Reviewer"
                  visible={true}
                  onToggleVisible={() => {}}
                />

                {playedMoveFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs ${
                      playedMoveFeedback.tone === 'blunder'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                        : playedMoveFeedback.tone === 'good'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold">{playedMoveFeedback.label}</div>
                    <p className="mt-1">{playedMoveFeedback.detail}</p>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-4">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Notation Timeline
                  </h3>
                  <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-xs tabular-nums">
                    {activeMatch.state.history.map((rec, idx) => (
                      <button
                        key={rec.ply}
                        type="button"
                        onClick={() => {
                          setIsPlaying(false);
                          setPlyIndex(idx + 1);
                          setAnalysis(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left ${
                          plyIndex === idx + 1
                            ? 'bg-amber-500/20 text-amber-500 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>
                          #{rec.ply} {rec.side === 'white' ? 'W' : 'B'}: {rec.move.notation}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {rec.move.promoted
                            ? 'Crown'
                            : rec.move.captured.length > 0
                              ? `×${rec.move.captured.length}`
                              : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-10 text-center text-sm text-slate-500">
              Select a match from the archive or finish a game to open replay playback and video export.
            </div>
          )}
        </div>
      </div>

      {/* Share Match as Video Modal */}
      {videoModalOpen && activeMatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Share Match as Video
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Renders the complete {activeMatch.state.boardSize}×{activeMatch.state.boardSize} board with animated moves, captures, King promotions, and winner banner into an MP4/WebM replay clip.
              </div>

              {videoError && (
                <div className="px-3.5 py-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-200">
                  {videoError}
                </div>
              )}

              {/* Render progress */}
              {exportProgress && exportProgress.phase !== 'done' && (
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>
                      {exportProgress.phase === 'rendering'
                        ? 'Animating match frames...'
                        : 'Transcoding MP4 video...'}
                    </span>
                    <span className="font-mono text-amber-500">{exportProgress.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-200"
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Video Preview */}
              {videoPreviewUrl && exportedVideo && (
                <div className="space-y-3">
                  <video
                    src={videoPreviewUrl}
                    controls
                    playsInline
                    className="w-full max-h-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-black"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleNativeShareVideo}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                    >
                      <Share2 className="w-4 h-4" />
                      Share Video ({exportedVideo.extension.toUpperCase()})
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadVideo}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Download className="w-4 h-4" />
                      Save File
                    </button>
                  </div>
                </div>
              )}

              {(!exportProgress || exportProgress.phase === 'done') && !exportedVideo && (
                <button
                  type="button"
                  onClick={handleGenerateVideo}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                >
                  <Film className="w-4 h-4" />
                  Generate Match Video
                </button>
              )}

              {/* Shareable Replay Link */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Interactive Replay Link
                </div>
                {shareLinkUrl ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareLinkUrl}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateShareLink}
                    disabled={creatingLink}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5 text-amber-500" />
                    {creatingLink ? 'Creating Replay Link...' : 'Create Shareable Replay URL'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
