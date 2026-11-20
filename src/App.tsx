import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Cpu,
  Crown,
  Gamepad2,
  History,
  Play,
  SlidersHorizontal,
  Swords,
  Trophy,
  UserCircle2,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  AI_DIFFICULTIES,
  AI_DIFFICULTY_LIST,
  DRAFT_MASTER_8X8_RULES,
  INTERNATIONAL_10X10_RULES,
} from './engine/presets.ts';
import { applyMove, createInitialGameState, generateLegalMoves } from './engine/rules.ts';
import type {
  AIDifficultyId,
  DraughtsMove,
  GameState,
  PlayerSide,
  RuleConfig,
} from './engine/types.ts';
import {
  ensureCloudProfile,
  signInWithGoogle,
  signOutUser,
  subscribeAuth,
  updateCloudProfileStats,
} from './services/firebase.ts';
import {
  calculateLevelFromXp,
  computeEloDelta,
  loadLocalPlayerData,
  saveLocalPlayerData,
  type LocalPlayerData,
  type SavedMatchRecord,
} from './services/localStore.ts';
import { playMoveSound } from './services/sound.ts';
import { CompeteHubView } from './components/CompeteHubView.tsx';
import { DraughtsBoard } from './components/DraughtsBoard.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { MatchArena, type OnlineMatchContext } from './components/MatchArena.tsx';
import { ProfileSettingsView } from './components/ProfileSettingsView.tsx';
import { ReplayAnalysisView, type ReplayTargetState } from './components/ReplayAnalysisView.tsx';
import { RulesSettingsPanel } from './components/RulesSettingsPanel.tsx';
import { TutorialCoachView } from './components/TutorialCoachView.tsx';

type NavTab = 'home' | 'play' | 'compete' | 'coach' | 'replay' | 'rules' | 'profile';

interface ActiveMatchSession {
  mode: 'ai' | 'local' | 'online';
  rules: RuleConfig;
  initialState?: GameState;
  playerSide?: PlayerSide;
  difficulty?: AIDifficultyId;
  timeControlSeconds?: number;
  whiteName?: string;
  blackName?: string;
  onlineMatch?: OnlineMatchContext;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [localData, setLocalData] = useState<LocalPlayerData>(() => loadLocalPlayerData());
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Match Setup state (Default: Draft Master 8x8 Flying Kings)
  const [setupMode, setSetupMode] = useState<'ai' | 'local'>('ai');
  const [setupRules, setSetupRules] = useState<RuleConfig>({ ...DRAFT_MASTER_8X8_RULES });
  const [setupDifficulty, setSetupDifficulty] = useState<AIDifficultyId>('medium');
  const [setupColorChoice, setSetupColorChoice] = useState<'white' | 'black' | 'random'>('black');
  const [setupTimerSec, setSetupTimerSec] = useState<number>(0);
  const [localWhiteName, setLocalWhiteName] = useState('Player 1');
  const [localBlackName, setLocalBlackName] = useState('Player 2');

  const [activeMatch, setActiveMatch] = useState<ActiveMatchSession | null>(null);
  const [replayTarget, setReplayTarget] = useState<ReplayTargetState | null>(null);

  // Instant playable Lobby board state (8x8 Flying Kings)
  const lobbyInitialState = useMemo(() => createInitialGameState(DRAFT_MASTER_8X8_RULES), []);
  const lobbyLegalMoves = useMemo(
    () =>
      generateLegalMoves(
        lobbyInitialState.board,
        lobbyInitialState.turn,
        lobbyInitialState.rules
      ),
    [lobbyInitialState]
  );

  // Sync dark/light class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (localData.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [localData.themeMode]);

  // Persist local data changes
  useEffect(() => {
    saveLocalPlayerData(localData);
  }, [localData]);

  // Hydrate shared replay from /?replay=<id> URL if opened via link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const replayId = params.get('replay');
    if (!replayId) return;
    fetch(`/api/replays/${encodeURIComponent(replayId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.replay?.gameState) {
          setReplayTarget({
            state: data.replay.gameState,
            title: data.replay.title || 'Shared Replay',
            whiteName: data.replay.whiteName || 'White',
            blackName: data.replay.blackName || 'Black',
          });
          setActiveTab('replay');
        }
      })
      .catch(() => {});
  }, []);

  // Monitor browser online/offline status
  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  // Subscribe Firebase Auth and hydrate cloud profile
  useEffect(() => {
    const unsub = subscribeAuth(async (u) => {
      setUser(u);
      if (u) {
        try {
          const cloud = await ensureCloudProfile(u, {
            username: localData.username,
            country: localData.country,
            eloEnglish: localData.eloEnglish,
            eloInternational: localData.eloInternational,
            eloCustom: localData.eloCustom,
            peakElo: localData.peakElo,
            xp: localData.xp,
            level: localData.level,
            totalGames: localData.totalGames,
            wins: localData.wins,
            draws: localData.draws,
            losses: localData.losses,
          });
          setLocalData((prev) => ({
            ...prev,
            username: cloud.username || prev.username,
            country: cloud.country || prev.country,
            eloEnglish: Math.max(prev.eloEnglish, cloud.eloEnglish),
            eloInternational: Math.max(prev.eloInternational, cloud.eloInternational),
            eloCustom: Math.max(prev.eloCustom, cloud.eloCustom),
            peakElo: Math.max(prev.peakElo, cloud.peakElo),
            xp: Math.max(prev.xp, cloud.xp),
            level: Math.max(prev.level, cloud.level),
            totalGames: Math.max(prev.totalGames, cloud.totalGames),
            wins: Math.max(prev.wins, cloud.wins),
            draws: Math.max(prev.draws, cloud.draws),
            losses: Math.max(prev.losses, cloud.losses),
            badges: Array.from(new Set([...prev.badges, ...cloud.badges])),
          }));
        } catch (err) {
          console.warn('Cloud profile hydration notice:', err);
        }
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLocalData = useCallback(
    (patch: Partial<LocalPlayerData>) => {
      setLocalData((prev) => {
        const next = { ...prev, ...patch };
        if (user && isOnline) {
          void updateCloudProfileStats(user.uid, {
            username: next.username,
            country: next.country,
            selectedBoardTheme: next.selectedBoardTheme,
            selectedPieceTheme: next.selectedPieceTheme,
          }).catch(() => {});
        }
        return next;
      });
    },
    [user, isOnline]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in cancelled or failed.');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const startConfiguredMatch = (
    overrideRules?: RuleConfig,
    overrideDifficulty?: AIDifficultyId,
    overrideMode?: 'ai' | 'local',
    overrideInitialState?: GameState
  ) => {
    const rules = overrideRules ?? setupRules;
    const mode = overrideMode ?? setupMode;
    const diff = overrideDifficulty ?? setupDifficulty;
    const chosenSide: PlayerSide =
      overrideInitialState
        ? 'black'
        : setupColorChoice === 'random'
          ? Math.random() < 0.5
            ? 'white'
            : 'black'
          : setupColorChoice;

    const aiLabel = `${AI_DIFFICULTIES[diff].label} AI`;
    const whiteName =
      mode === 'ai' ? (chosenSide === 'white' ? localData.username : aiLabel) : localWhiteName;
    const blackName =
      mode === 'ai' ? (chosenSide === 'black' ? localData.username : aiLabel) : localBlackName;

    setActiveMatch({
      mode,
      rules,
      initialState: overrideInitialState ?? createInitialGameState(rules),
      playerSide: chosenSide,
      difficulty: diff,
      timeControlSeconds: setupTimerSec,
      whiteName,
      blackName,
    });
  };

  const handleLobbyFirstMove = (move: DraughtsMove) => {
    playMoveSound(localData.soundEnabled);
    const nextState = applyMove(lobbyInitialState, move);
    startConfiguredMatch({ ...DRAFT_MASTER_8X8_RULES }, setupDifficulty, 'ai', nextState);
  };

  const handleEnterOnlineMatch = (match: OnlineMatchContext) => {
    setActiveMatch({
      mode: 'online',
      rules: match.gameState.rules,
      onlineMatch: match,
    });
  };

  const handleSaveMatch = useCallback(
    (state: GameState, result: 'playing' | 'win' | 'loss' | 'draw') => {
      if (!activeMatch) return;
      const id = `saved_${Date.now().toString(36)}`;
      const oppName =
        activeMatch.mode === 'ai'
          ? `${AI_DIFFICULTIES[activeMatch.difficulty ?? 'medium'].label} AI`
          : activeMatch.mode === 'local'
            ? `${activeMatch.whiteName} vs ${activeMatch.blackName}`
            : activeMatch.onlineMatch
              ? `${activeMatch.onlineMatch.whitePlayerName} vs ${activeMatch.onlineMatch.blackPlayerName}`
              : 'Online Opponent';
      const rec: SavedMatchRecord = {
        id,
        title: `${state.rules.name} · ${oppName}`,
        mode: activeMatch.mode,
        variantPreset: state.rules.preset,
        rules: state.rules,
        difficulty: activeMatch.difficulty,
        playerSide: activeMatch.playerSide,
        opponentName: oppName,
        result,
        state,
        updatedAt: Date.now(),
      };
      setLocalData((prev) => {
        // Avoid duplicate save of identical finished history back-to-back
        const head = prev.savedMatches[0];
        if (
          head &&
          head.result === result &&
          head.state.moveCount === state.moveCount &&
          head.title === rec.title &&
          Date.now() - head.updatedAt < 5000
        ) {
          return prev;
        }
        return {
          ...prev,
          savedMatches: [rec, ...prev.savedMatches].slice(0, 30),
        };
      });
    },
    [activeMatch]
  );

  const handleCompleteMatch = useCallback(
    (
      result: 'win' | 'loss' | 'draw',
      capturesCount: number,
      rules: RuleConfig,
      difficulty?: AIDifficultyId
    ) => {
      setLocalData((prev) => {
        const oppElo = difficulty ? AI_DIFFICULTIES[difficulty].eloEstimate : 1200;
        const score: 1 | 0.5 | 0 = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;

        let eloEnglish = prev.eloEnglish;
        let eloInternational = prev.eloInternational;
        let eloCustom = prev.eloCustom;

        if (rules.preset === 'english_8x8' || rules.preset === 'draft_master_8x8') {
          eloEnglish = Math.max(400, eloEnglish + computeEloDelta(eloEnglish, oppElo, score));
        } else if (rules.preset === 'international_10x10') {
          eloInternational = Math.max(
            400,
            eloInternational + computeEloDelta(eloInternational, oppElo, score)
          );
        } else {
          eloCustom = Math.max(400, eloCustom + computeEloDelta(eloCustom, oppElo, score));
        }

        const peakElo = Math.max(prev.peakElo, eloEnglish, eloInternational, eloCustom);
        const xpGain = result === 'win' ? 95 : result === 'draw' ? 50 : 25;
        const nextXp = prev.xp + xpGain;
        const nextLevel = calculateLevelFromXp(nextXp);

        const nextBadges = new Set(prev.badges);
        if (result === 'win' && prev.wins === 0) nextBadges.add('First Victory');
        if (result === 'win' && rules.preset === 'international_10x10')
          nextBadges.add('10×10 Victor');
        if (result === 'win' && difficulty === 'legendary')
          nextBadges.add('Legendary Conqueror');

        const nextChallenges = prev.challenges.map((c) => {
          if (c.id === 'daily_play_2') return { ...c, progress: c.progress + 1 };
          if (c.id === 'daily_captures_5') return { ...c, progress: c.progress + capturesCount };
          if (
            c.id === 'weekly_intl_win' &&
            result === 'win' &&
            rules.preset === 'international_10x10'
          ) {
            return { ...c, progress: c.progress + 1 };
          }
          if (
            c.id === 'weekly_hard_ai' &&
            result === 'win' &&
            difficulty &&
            AI_DIFFICULTIES[difficulty].level >= 5
          ) {
            return { ...c, progress: c.progress + 1 };
          }
          return c;
        });

        const updated: LocalPlayerData = {
          ...prev,
          eloEnglish,
          eloInternational,
          eloCustom,
          peakElo,
          xp: nextXp,
          level: nextLevel,
          totalGames: prev.totalGames + 1,
          wins: prev.wins + (result === 'win' ? 1 : 0),
          draws: prev.draws + (result === 'draw' ? 1 : 0),
          losses: prev.losses + (result === 'loss' ? 1 : 0),
          badges: Array.from(nextBadges),
          challenges: nextChallenges,
        };

        if (user && isOnline) {
          void updateCloudProfileStats(user.uid, {
            eloEnglish,
            eloInternational,
            eloCustom,
            peakElo,
            xp: nextXp,
            level: nextLevel,
            totalGames: updated.totalGames,
            wins: updated.wins,
            draws: updated.draws,
            losses: updated.losses,
            badges: updated.badges,
          }).catch(() => {});
        }

        return updated;
      });
    },
    [user, isOnline]
  );

  const handleClaimChallenge = (challengeId: string) => {
    setLocalData((prev) => {
      const target = prev.challenges.find((c) => c.id === challengeId);
      if (!target || target.claimed || target.progress < target.target) return prev;
      const nextXp = prev.xp + target.xpReward;
      return {
        ...prev,
        xp: nextXp,
        level: calculateLevelFromXp(nextXp),
        challenges: prev.challenges.map((c) =>
          c.id === challengeId ? { ...c, claimed: true } : c
        ),
      };
    });
  };

  const currentUserId = user?.uid ?? localData.guestId;
  const winRate = useMemo(
    () =>
      localData.totalGames > 0
        ? Math.round((localData.wins / localData.totalGames) * 100)
        : 0,
    [localData.totalGames, localData.wins]
  );

  const navItems = [
    { id: 'home', label: 'Arena', icon: Gamepad2 },
    { id: 'play', label: 'Modes', icon: Swords },
    { id: 'compete', label: 'Compete', icon: Trophy },
    { id: 'coach', label: 'Coach', icon: BookOpen },
    { id: 'replay', label: 'Replays', icon: History },
    { id: 'rules', label: 'Rules', icon: SlidersHorizontal },
  ] as const;

  return (
    <ErrorBoundary>
      <div className="min-h-dvh flex flex-col md:flex-row bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100">
        {/* Desktop Left Game Studio Rail */}
        <aside className="hidden md:flex md:w-20 lg:w-56 shrink-0 flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#101622] p-3">
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => {
                setActiveMatch(null);
                setActiveTab('home');
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800/60"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center text-white shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div className="hidden lg:block min-w-0">
                <div className="text-sm font-display font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  DRAFT MASTER
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                  8×8 Flying Kings
                </div>
              </div>
            </button>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id && !activeMatch;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveMatch(null);
                      setActiveTab(item.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveMatch(null);
              setActiveTab('profile');
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
              activeTab === 'profile' && !activeMatch
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <UserCircle2 className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="hidden lg:block min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {localData.username}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Lv.{localData.level} · {localData.eloEnglish} Elo
              </div>
            </div>
          </button>
        </aside>

        {/* Main Game Stage */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          {/* Compact Mobile Game HUD Header */}
          <header className="md:hidden flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101622]">
            <button
              type="button"
              onClick={() => {
                setActiveMatch(null);
                setActiveTab('home');
              }}
              className="flex items-center gap-2 font-display font-bold text-sm text-slate-900 dark:text-white"
            >
              <Crown className="w-4 h-4 text-amber-500" />
              DRAFT MASTER
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMatch(null);
                setActiveTab('profile');
              }}
              className="text-xs font-mono font-semibold text-amber-500"
            >
              {localData.username} · {localData.eloEnglish}
            </button>
          </header>

          {!isOnline && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2">
              <WifiOff className="w-3.5 h-3.5" />
              Offline mode active: AI Battles, Local Play, Coach, and Replays ready.
            </div>
          )}

          {authError && (
            <div className="max-w-7xl mx-auto w-full px-4 pt-3">
              <div className="px-4 py-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-200">
                {authError}
              </div>
            </div>
          )}

          <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6">
            {activeMatch ? (
              <MatchArena
                mode={activeMatch.mode}
                initialState={activeMatch.initialState}
                rules={activeMatch.rules}
                playerSide={activeMatch.playerSide}
                difficulty={activeMatch.difficulty}
                timeControlSeconds={activeMatch.timeControlSeconds}
                whiteName={activeMatch.whiteName}
                blackName={activeMatch.blackName}
                currentUserId={currentUserId}
                onlineMatch={activeMatch.onlineMatch}
                boardThemeId={localData.selectedBoardTheme}
                pieceThemeId={localData.selectedPieceTheme}
                soundEnabled={localData.soundEnabled}
                showAIThinking={localData.showAIThinking}
                onToggleAIThinking={() =>
                  updateLocalData({ showAIThinking: !localData.showAIThinking })
                }
                onSaveMatch={handleSaveMatch}
                onCompleteMatch={handleCompleteMatch}
                onOpenAnalysis={(st, title, whiteName, blackName, autoExportVideo) => {
                  setReplayTarget({ state: st, title, whiteName, blackName, autoExportVideo });
                  setActiveMatch(null);
                  setActiveTab('replay');
                }}
                onExit={() => setActiveMatch(null)}
              />
            ) : (
              <>
                {/* GAME LOBBY / PLAY-FIRST WORKSPACE */}
                {activeTab === 'home' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Live Interactive 8x8 Flying Kings Board */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div>
                          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                            Instant Board · Black Moves First
                          </div>
                          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                            8×8 Draft Master (Flying Kings)
                          </h1>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {AI_DIFFICULTIES[setupDifficulty].label} AI · {AI_DIFFICULTIES[setupDifficulty].eloEstimate}
                        </span>
                      </div>

                      <DraughtsBoard
                        boardSize={lobbyInitialState.boardSize}
                        board={lobbyInitialState.board}
                        turn={lobbyInitialState.turn}
                        interactive={true}
                        allowedSide="black"
                        legalMoves={lobbyLegalMoves}
                        flipped={true}
                        boardThemeId={localData.selectedBoardTheme}
                        pieceThemeId={localData.selectedPieceTheme}
                        onExecuteMove={handleLobbyFirstMove}
                      />

                      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                        Tap any dark black piece above to make your opening move and start immediately.
                      </p>
                    </div>

                    {/* Game Studio Control Deck */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-slate-500">Commander</div>
                            <div className="text-base font-bold text-slate-900 dark:text-white">
                              {localData.username}
                            </div>
                          </div>
                          <div className="flex gap-4 font-mono tabular-nums text-right">
                            <div>
                              <div className="text-[11px] text-slate-500">8×8 Elo</div>
                              <div className="text-sm font-bold text-amber-500">
                                {localData.eloEnglish}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-slate-500">Win%</div>
                              <div className="text-sm font-bold text-emerald-500">{winRate}%</div>
                            </div>
                          </div>
                        </div>

                        {/* Quick AI Tier Selector */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              AI Opponent Level
                            </span>
                            <span className="font-mono text-amber-500">
                              Level {AI_DIFFICULTIES[setupDifficulty].level}/8
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {AI_DIFFICULTY_LIST.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => setSetupDifficulty(d.id)}
                                className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold truncate transition-colors ${
                                  setupDifficulty === d.id
                                    ? 'border-amber-500 bg-amber-500/15 text-amber-500'
                                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Direct Mode Launchers */}
                        <div className="space-y-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              startConfiguredMatch({ ...DRAFT_MASTER_8X8_RULES }, setupDifficulty, 'ai')
                            }
                            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            Play 8×8 Flying Kings
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startConfiguredMatch(
                                  { ...INTERNATIONAL_10X10_RULES },
                                  setupDifficulty,
                                  'ai'
                                )
                              }
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 text-xs font-semibold"
                            >
                              <Cpu className="w-3.5 h-3.5 text-amber-500" />
                              10×10 Intl AI
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                startConfiguredMatch(
                                  { ...DRAFT_MASTER_8X8_RULES },
                                  setupDifficulty,
                                  'local'
                                )
                              }
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 text-xs font-semibold"
                            >
                              <Users className="w-3.5 h-3.5 text-amber-500" />
                              Pass & Play 2P
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveTab('compete')}
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 text-xs font-semibold"
                            >
                              <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              Online & Leagues
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab('play')}
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 text-xs font-semibold"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                              Custom Setup
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Replay Archive Strip */}
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Recent Match Replays
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('replay')}
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-500 hover:underline"
                          >
                            <History className="w-3.5 h-3.5" />
                            Replay Studio
                          </button>
                        </div>
                        {localData.savedMatches.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">
                            Finish any match to auto-record its replay & export gameplay videos.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {localData.savedMatches.slice(0, 3).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setReplayTarget({
                                    state: m.state,
                                    title: m.title,
                                    whiteName: m.playerSide === 'white' ? localData.username : m.opponentName,
                                    blackName: m.playerSide === 'black' ? localData.username : m.opponentName,
                                  });
                                  setActiveTab('replay');
                                }}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] hover:border-amber-500/50 border border-slate-200 dark:border-slate-800 text-left text-xs"
                              >
                                <span className="font-medium truncate">{m.title}</span>
                                <span className="font-mono text-amber-500 shrink-0">
                                  {m.state.moveCount} ply · {m.result}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* PLAY SETUP SCREEN */}
                {activeTab === 'play' && (
                  <div className="space-y-5">
                    <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Match Setup & Rule Selection
                      </h1>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Default is 8×8 Draft Master (Flying Kings). Switch anytime to International 10×10, Classic English 8×8, or Custom rules.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-7 space-y-5">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4">
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            1. Opponent Mode
                          </h2>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setSetupMode('ai')}
                              className={`p-3.5 rounded-lg border text-left flex items-center gap-3 ${
                                setupMode === 'ai'
                                  ? 'border-amber-500 bg-amber-500/10'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <Swords className="w-5 h-5 text-amber-500 shrink-0" />
                              <div>
                                <div className="text-sm font-semibold">AI Opponent</div>
                                <div className="text-xs text-slate-500">8 skill levels offline</div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSetupMode('local')}
                              className={`p-3.5 rounded-lg border text-left flex items-center gap-3 ${
                                setupMode === 'local'
                                  ? 'border-amber-500 bg-amber-500/10'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <Users className="w-5 h-5 text-amber-500 shrink-0" />
                              <div>
                                <div className="text-sm font-semibold">Local Pass & Play</div>
                                <div className="text-xs text-slate-500">2 players on one device</div>
                              </div>
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5">
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            2. Board Size & Ruleset
                          </h2>
                          <RulesSettingsPanel rules={setupRules} onChange={setSetupRules} />
                        </div>
                      </div>

                      <div className="lg:col-span-5 space-y-5">
                        {setupMode === 'ai' ? (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-3">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              3. AI Difficulty Level
                            </h2>
                            <div className="grid grid-cols-2 gap-2">
                              {AI_DIFFICULTY_LIST.map((d) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => setSetupDifficulty(d.id)}
                                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                                    setupDifficulty === d.id
                                      ? 'border-amber-500 bg-amber-500/10'
                                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                      {d.level}. {d.label}
                                    </span>
                                    <span className="text-[11px] font-mono text-amber-500">
                                      {d.eloEstimate}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                              {AI_DIFFICULTIES[setupDifficulty].description}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-3">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              3. Local Player Names
                            </h2>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={localWhiteName}
                                onChange={(e) => setLocalWhiteName(e.target.value)}
                                placeholder="White player name"
                                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                              />
                              <input
                                type="text"
                                value={localBlackName}
                                onChange={(e) => setLocalBlackName(e.target.value)}
                                placeholder="Black player name"
                                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                              />
                            </div>
                          </div>
                        )}

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4">
                          {setupMode === 'ai' && (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                                4. Your Piece Color
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {(['black', 'white', 'random'] as const).map((side) => (
                                  <button
                                    key={side}
                                    type="button"
                                    onClick={() => setSetupColorChoice(side)}
                                    className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize ${
                                      setupColorChoice === side
                                        ? 'border-amber-500 bg-amber-500/15 text-amber-500'
                                        : 'border-slate-200 dark:border-slate-800'
                                    }`}
                                  >
                                    {side}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                              Match Timer
                            </label>
                            <select
                              value={setupTimerSec}
                              onChange={(e) => setSetupTimerSec(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                            >
                              <option value={0}>Untimed (Casual / Study)</option>
                              <option value={180}>3 Minutes Blitz</option>
                              <option value={300}>5 Minutes Rapid</option>
                              <option value={600}>10 Minutes Classic</option>
                              <option value={900}>15 Minutes Championship</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => startConfiguredMatch()}
                            className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
                          >
                            Start {setupRules.name} Match
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DEDICATED RULES & BOARD SETTINGS */}
                {activeTab === 'rules' && (
                  <div className="max-w-4xl mx-auto space-y-5">
                    <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Rules & Board Settings
                      </h1>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Switch between 8×8 Flying Kings, Classic English 8×8, International 10×10, or custom mechanics.
                      </p>
                    </div>
                    <RulesSettingsPanel rules={setupRules} onChange={setSetupRules} />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => startConfiguredMatch(setupRules)}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold"
                      >
                        Play with Selected Rules
                      </button>
                    </div>
                  </div>
                )}

                {/* ONLINE MULTIPLAYER, LEAGUES & TOURNAMENTS */}
                {activeTab === 'compete' && (
                  <CompeteHubView
                    currentUserId={currentUserId}
                    currentUsername={localData.username}
                    currentElo={localData.eloEnglish}
                    isOnline={isOnline}
                    onEnterOnlineMatch={handleEnterOnlineMatch}
                  />
                )}

                {/* TUTORIAL MASTER */}
                {activeTab === 'coach' && (
                  <TutorialCoachView
                    completedByTrack={localData.tutorialCompleted}
                    voiceEnabled={localData.voiceCoachEnabled}
                    soundEnabled={localData.soundEnabled}
                    boardThemeId={localData.selectedBoardTheme}
                    pieceThemeId={localData.selectedPieceTheme}
                    onToggleVoice={() =>
                      updateLocalData({ voiceCoachEnabled: !localData.voiceCoachEnabled })
                    }
                    onMarkLessonComplete={(track, lessonId) => {
                      setLocalData((prev) => {
                        const cur = prev.tutorialCompleted[track];
                        if (cur.includes(lessonId)) return prev;
                        const nextXp = prev.xp + 40;
                        return {
                          ...prev,
                          xp: nextXp,
                          level: calculateLevelFromXp(nextXp),
                          tutorialCompleted: {
                            ...prev.tutorialCompleted,
                            [track]: [...cur, lessonId],
                          },
                        };
                      });
                    }}
                    onSkipTutorial={() => setActiveTab('play')}
                  />
                )}

                {/* MATCH REPLAY & VIDEO STUDIO */}
                {activeTab === 'replay' && (
                  <ReplayAnalysisView
                    savedMatches={localData.savedMatches}
                    initialReplayState={replayTarget}
                    boardThemeId={localData.selectedBoardTheme}
                    pieceThemeId={localData.selectedPieceTheme}
                    soundEnabled={localData.soundEnabled}
                    onResumeSavedMatch={(rec) => {
                      setActiveMatch({
                        mode: rec.mode === 'local' ? 'local' : 'ai',
                        rules: rec.rules,
                        initialState: rec.state,
                        playerSide: rec.playerSide ?? 'white',
                        difficulty: rec.difficulty ?? 'medium',
                        whiteName: localData.username,
                        blackName: rec.opponentName,
                      });
                    }}
                    onDeleteSavedMatch={(id) =>
                      setLocalData((prev) => ({
                        ...prev,
                        savedMatches: prev.savedMatches.filter((m) => m.id !== id),
                      }))
                    }
                  />
                )}

                {/* PROFILE, PROGRESSION & SETTINGS */}
                {activeTab === 'profile' && (
                  <ProfileSettingsView
                    user={user}
                    localData={localData}
                    isOnline={isOnline}
                    onUpdateLocalData={updateLocalData}
                    onClaimChallenge={handleClaimChallenge}
                    onSignIn={handleSignIn}
                    onSignOut={handleSignOut}
                  />
                )}
              </>
            )}
          </main>
        </div>

        {/* Mobile Bottom Game Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#101622]/95 backdrop-blur-md flex items-center justify-around px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id && !activeMatch;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveMatch(null);
                  setActiveTab(item.id);
                }}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
                  active ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </ErrorBoundary>
  );
}
