import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, ChevronRight, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { applyMove, generateLegalMoves } from '../engine/rules.ts';
import type { DraughtsMove, GameState, VariantPreset } from '../engine/types.ts';
import { playCaptureSound, playMoveSound, playPromoteSound } from '../services/sound.ts';
import { TUTORIAL_LESSONS, createLessonGameState, type TutorialLesson } from '../tutorial/lessons.ts';
import { DraughtsBoard } from './DraughtsBoard.tsx';

interface TutorialCoachViewProps {
  completedByTrack: {
    draft_master_8x8: string[];
    english_8x8: string[];
    international_10x10: string[];
    custom: string[];
  };
  voiceEnabled: boolean;
  soundEnabled: boolean;
  boardThemeId: string;
  pieceThemeId: string;
  onToggleVoice: () => void;
  onMarkLessonComplete: (track: VariantPreset, lessonId: string) => void;
  onSkipTutorial: () => void;
}

const TRACK_LABELS: Record<VariantPreset, { title: string; subtitle: string }> = {
  draft_master_8x8: {
    title: 'Draft Master 8×8',
    subtitle: 'Default · 32 squares · Flying Kings',
  },
  english_8x8: {
    title: 'English Draughts (8×8)',
    subtitle: 'Classic · 32 squares · 1-step kings',
  },
  international_10x10: {
    title: 'International (10×10)',
    subtitle: '50 squares · Flying kings · Max capture',
  },
  custom: {
    title: 'Custom Variants',
    subtitle: 'Optional capture & hybrid boards',
  },
};

export const TutorialCoachView: React.FC<TutorialCoachViewProps> = ({
  completedByTrack,
  voiceEnabled,
  soundEnabled,
  boardThemeId,
  pieceThemeId,
  onToggleVoice,
  onMarkLessonComplete,
  onSkipTutorial,
}) => {
  const [activeTrack, setActiveTrack] = useState<VariantPreset>('draft_master_8x8');

  const trackLessons = useMemo(
    () => TUTORIAL_LESSONS.filter((l) => l.track === activeTrack).sort((a, b) => a.order - b.order),
    [activeTrack]
  );

  const [selectedLessonId, setSelectedLessonId] = useState<string>(trackLessons[0].id);

  // Sync selected lesson when switching tracks
  useEffect(() => {
    const firstIncomplete = trackLessons.find(
      (l) => !completedByTrack[activeTrack].includes(l.id)
    );
    setSelectedLessonId(firstIncomplete?.id ?? trackLessons[0].id);
  }, [activeTrack, trackLessons, completedByTrack]);

  const lesson: TutorialLesson = useMemo(
    () => trackLessons.find((l) => l.id === selectedLessonId) ?? trackLessons[0],
    [trackLessons, selectedLessonId]
  );

  const [gameState, setGameState] = useState<GameState>(() => createLessonGameState(lesson));
  const [feedback, setFeedback] = useState<{ status: 'idle' | 'error' | 'success'; text: string }>({
    status: 'idle',
    text: lesson.coachLine,
  });
  const [coachImgError, setCoachImgError] = useState(false);

  // Reset board whenever lesson changes
  useEffect(() => {
    setGameState(createLessonGameState(lesson));
    setFeedback({ status: 'idle', text: lesson.coachLine });
  }, [lesson]);

  // Optional Web Speech API voiceover
  useEffect(() => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(feedback.text);
    utter.rate = 1.0;
    utter.pitch = 0.96;
    window.speechSynthesis.speak(utter);
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [feedback.text, voiceEnabled]);

  const legalMoves = useMemo(
    () =>
      gameState.status === 'playing'
        ? generateLegalMoves(gameState.board, gameState.turn, gameState.rules)
        : [],
    [gameState]
  );

  const handleMove = (move: DraughtsMove) => {
    if (feedback.status === 'success') return;

    const exp = lesson.expectedMove;
    if (exp) {
      const matchesFrom = move.from.row === exp.from.row && move.from.col === exp.from.col;
      const matchesTo = move.to.row === exp.to.row && move.to.col === exp.to.col;
      const matchesCap = !exp.minCaptures || move.captured.length >= exp.minCaptures;

      if (!matchesFrom || !matchesTo || !matchesCap) {
        setFeedback({
          status: 'error',
          text: `Not quite! ${lesson.hintLine}`,
        });
        return;
      }
    }

    if (move.promoted) playPromoteSound(soundEnabled);
    else if (move.isCapture) playCaptureSound(soundEnabled);
    else playMoveSound(soundEnabled);

    setGameState((prev) => applyMove(prev, move));
    setFeedback({
      status: 'success',
      text: lesson.successLine,
    });
    onMarkLessonComplete(activeTrack, lesson.id);
  };

  const nextLesson = useMemo(() => {
    const idx = trackLessons.findIndex((l) => l.id === lesson.id);
    return idx >= 0 && idx + 1 < trackLessons.length ? trackLessons[idx + 1] : null;
  }, [trackLessons, lesson.id]);

  const completedCount = completedByTrack[activeTrack].length;

  return (
    <div className="space-y-6">
      {/* Header & Track Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Tutorial Master
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Interactive tactical academy with Coach Marcus Vance · Independent tracks per variant
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleVoice}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-500" /> : <VolumeX className="w-3.5 h-3.5" />}
            {voiceEnabled ? 'Voice On' : 'Voice Off'}
          </button>
          <button
            type="button"
            onClick={onSkipTutorial}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Skip to Quick Play
          </button>
        </div>
      </div>

      {/* Variant Track Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(['draft_master_8x8', 'english_8x8', 'international_10x10', 'custom'] as VariantPreset[]).map((track) => {
          const total = TUTORIAL_LESSONS.filter((l) => l.track === track).length;
          const done = completedByTrack[track].length;
          const active = activeTrack === track;
          return (
            <button
              key={track}
              type="button"
              onClick={() => setActiveTrack(track)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                active
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {TRACK_LABELS[track].title}
                </span>
                <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {done}/{total}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {TRACK_LABELS[track].subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Coaching Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Board */}
        <div className="lg:col-span-7 space-y-4">
          <DraughtsBoard
            boardSize={gameState.boardSize}
            board={gameState.board}
            turn={gameState.turn}
            interactive={feedback.status !== 'success'}
            allowedSide={lesson.playerSide}
            legalMoves={legalMoves}
            flipped={lesson.playerSide === 'black'}
            boardThemeId={boardThemeId}
            pieceThemeId={pieceThemeId}
            highlightSquares={feedback.status === 'success' ? [] : lesson.highlightSquares}
            onExecuteMove={handleMove}
          />
        </div>

        {/* Coach Panel & Lesson List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Coach Character Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4">
            <div className="flex items-center gap-4">
              {!coachImgError ? (
                <img
                  src="/src/assets/images/coach_marcus_vance_1795174870503.jpg"
                  alt="Coach Marcus Vance — Draft Master Coach"
                  referrerPolicy="no-referrer"
                  onError={() => setCoachImgError(true)}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Award className="w-7 h-7 text-amber-400" />
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Draft Master Coach · Lesson {lesson.order} of {trackLessons.length}
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {lesson.title}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Marcus Vance · {lesson.subtitle}
                </div>
              </div>
            </div>

            {/* Coach Dialogue / Subtitle Box */}
            <div
              className={`p-4 rounded-lg border text-sm leading-relaxed ${
                feedback.status === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                  : feedback.status === 'error'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-700 dark:text-slate-200'
              }`}
            >
              {feedback.text}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setGameState(createLessonGameState(lesson));
                  setFeedback({ status: 'idle', text: lesson.coachLine });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Drill
              </button>

              <button
                type="button"
                onClick={() => setFeedback({ status: 'idle', text: lesson.hintLine })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Show Hint
              </button>

              {feedback.status === 'success' && nextLesson && (
                <button
                  type="button"
                  onClick={() => setSelectedLessonId(nextLesson.id)}
                  className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium"
                >
                  Next Lesson
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Curriculum Checklist */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Track Syllabus
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {completedCount}/{trackLessons.length} completed
              </span>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {trackLessons.map((item, idx) => {
                const isDone = completedByTrack[activeTrack].includes(item.id);
                const isCurrent = item.id === lesson.id;
                const prevDone =
                  idx === 0 || completedByTrack[activeTrack].includes(trackLessons[idx - 1].id);
                const unlocked = isDone || prevDone || isCurrent;

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setSelectedLessonId(item.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                      isCurrent
                        ? 'bg-amber-500/15 text-slate-900 dark:text-slate-100 font-semibold'
                        : unlocked
                          ? 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                          : 'opacity-45 cursor-not-allowed text-slate-400'
                    }`}
                  >
                    <span className="truncate">
                      {String(item.order).padStart(2, '0')}. {item.title}
                    </span>
                    {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
