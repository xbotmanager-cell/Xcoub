import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Globe, LogIn, LogOut, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import type { User } from 'firebase/auth';
import { fetchGlobalLeaderboard, type CloudPlayerProfile } from '../services/firebase.ts';
import {
  BOARD_THEMES,
  PIECE_THEMES,
  type LocalPlayerData,
} from '../services/localStore.ts';

interface ProfileSettingsViewProps {
  user: User | null;
  localData: LocalPlayerData;
  isOnline: boolean;
  onUpdateLocalData: (patch: Partial<LocalPlayerData>) => void;
  onClaimChallenge: (challengeId: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  user,
  localData,
  isOnline,
  onUpdateLocalData,
  onClaimChallenge,
  onSignIn,
  onSignOut,
}) => {
  const [usernameInput, setUsernameInput] = useState(localData.username);
  const [countryInput, setCountryInput] = useState(localData.country);
  const [leaderboard, setLeaderboard] = useState<CloudPlayerProfile[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    setUsernameInput(localData.username);
    setCountryInput(localData.country);
  }, [localData.username, localData.country]);

  useEffect(() => {
    if (!user || !isOnline) return;
    setLbLoading(true);
    fetchGlobalLeaderboard()
      .then((rows) => setLeaderboard(rows))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [user, isOnline]);

  const winRate =
    localData.totalGames > 0 ? Math.round((localData.wins / localData.totalGames) * 100) : 0;
  const xpIntoLevel = localData.xp % 250;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Player Profile, Progression & Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Ratings per variant, fair cosmetic unlocks, challenges, and global standings
          </p>
        </div>

        {user ? (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out ({user.email})
          </button>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            disabled={!isOnline}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In with Google to Sync Cloud
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile & Stats */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4">
            <div className="flex items-center gap-4">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={localData.username}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-lg font-bold text-amber-500">
                  {localData.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {localData.username}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Level {localData.level} · {localData.country} · ID{' '}
                  <span className="font-mono">{(user?.uid ?? localData.guestId).slice(0, 10)}</span>
                </div>
              </div>
            </div>

            {/* XP Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono tabular-nums text-slate-500">
                <span>XP {localData.xp.toLocaleString()}</span>
                <span>Next Level</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((xpIntoLevel / 250) * 100))}%` }}
                />
              </div>
            </div>

            {/* Ratings & Totals */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-slate-500">English 8×8</div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {localData.eloEnglish}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Intl 10×10</div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {localData.eloInternational}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Win Rate</div>
                <div className="text-base font-bold text-emerald-500">{winRate}%</div>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {localData.totalGames} Games · {localData.wins} Wins · {localData.draws} Draws ·{' '}
              {localData.losses} Losses · Peak Elo {localData.peakElo}
            </div>

            {/* Edit Identity */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  maxLength={32}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Username"
                  className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                />
                <input
                  type="text"
                  value={countryInput}
                  maxLength={40}
                  onChange={(e) => setCountryInput(e.target.value)}
                  placeholder="Country"
                  className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateLocalData({
                    username: usernameInput.trim() || 'Tactician',
                    country: countryInput.trim() || 'Global',
                  })
                }
                className="w-full py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Save Profile Details
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Platform Preferences
            </h3>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/70">
              <span className="text-xs text-slate-700 dark:text-slate-300">Appearance Theme</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateLocalData({
                    themeMode: localData.themeMode === 'dark' ? 'light' : 'dark',
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium"
              >
                {localData.themeMode === 'dark' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-amber-400" /> Dark
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> Light
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/70">
              <span className="text-xs text-slate-700 dark:text-slate-300">Board Audio FX</span>
              <button
                type="button"
                onClick={() => onUpdateLocalData({ soundEnabled: !localData.soundEnabled })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium"
              >
                {localData.soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> Enabled
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" /> Muted
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-slate-700 dark:text-slate-300">AI Analysis Panel</span>
              <button
                type="button"
                onClick={() => onUpdateLocalData({ showAIThinking: !localData.showAIThinking })}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium"
              >
                {localData.showAIThinking ? 'Visible' : 'Hidden'}
              </button>
            </div>
          </div>
        </div>

        {/* Challenges, Cosmetics & Global Leaderboard */}
        <div className="lg:col-span-7 space-y-5">
          {/* Challenges */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Daily & Weekly Challenges
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {localData.challenges.map((ch) => {
                const done = ch.progress >= ch.target;
                return (
                  <div
                    key={ch.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {ch.title}
                      </span>
                      <span className="text-[11px] font-mono text-amber-500">
                        +{ch.xpReward} XP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {ch.description}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        {Math.min(ch.progress, ch.target)} / {ch.target} · {ch.period}
                      </span>
                      {ch.claimed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                        </span>
                      ) : done ? (
                        <button
                          type="button"
                          onClick={() => onClaimChallenge(ch.id)}
                          className="px-2.5 py-1 rounded bg-amber-600 text-white text-[11px] font-medium"
                        >
                          Claim XP
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cosmetic Board & Piece Themes */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Board & Piece Themes (Cosmetic Progression)
              </h3>
              <span className="text-xs text-slate-500">Unlocked purely via Level & Play</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {BOARD_THEMES.map((bt) => {
                const unlocked = localData.level >= bt.unlockLevel;
                const selected = localData.selectedBoardTheme === bt.id;
                return (
                  <button
                    key={bt.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onUpdateLocalData({ selectedBoardTheme: bt.id })}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? 'border-amber-500 bg-amber-500/10'
                        : unlocked
                          ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          : 'opacity-45 cursor-not-allowed border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <span
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: bt.lightSquare }}
                      />
                      <span
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: bt.darkSquare }}
                      />
                    </div>
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {bt.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {unlocked ? (selected ? 'Equipped' : 'Available') : `Level ${bt.unlockLevel}`}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PIECE_THEMES.map((pt) => {
                const unlocked = localData.level >= pt.unlockLevel;
                const selected = localData.selectedPieceTheme === pt.id;
                return (
                  <button
                    key={pt.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onUpdateLocalData({ selectedPieceTheme: pt.id })}
                    className={`p-3 rounded-lg border text-left ${
                      selected
                        ? 'border-amber-500 bg-amber-500/10'
                        : unlocked
                          ? 'border-slate-200 dark:border-slate-800'
                          : 'opacity-45 cursor-not-allowed border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {pt.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {unlocked ? (selected ? 'Equipped' : 'Available') : `Level ${pt.unlockLevel}`}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-medium text-slate-500 mb-1.5">Earned Badges</div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-800 dark:text-slate-200">
                {localData.badges.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Global Firestore Leaderboard */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Global Cloud Standings
                </h3>
              </div>
              {!user && (
                <span className="text-xs text-slate-500">Sign in to view & join cloud rankings</span>
              )}
            </div>

            {user && (
              <div className="overflow-x-auto">
                {lbLoading ? (
                  <p className="text-xs text-slate-500 py-4">Loading leaderboard...</p>
                ) : leaderboard.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">
                    No cloud profiles ranked yet. Complete a match while signed in!
                  </p>
                ) : (
                  <table className="w-full text-xs text-left tabular-nums">
                    <thead className="text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Player</th>
                        <th className="py-2 px-2">8×8 Elo</th>
                        <th className="py-2 px-2">10×10 Elo</th>
                        <th className="py-2 pl-2 text-right">Games</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {leaderboard.map((row, i) => (
                        <tr key={row.uid}>
                          <td className="py-2 pr-2 font-mono text-slate-400">{i + 1}</td>
                          <td className="py-2 pr-2 font-medium text-slate-900 dark:text-slate-100">
                            {row.username}
                          </td>
                          <td className="py-2 px-2 font-mono font-semibold text-amber-500">
                            {row.eloEnglish}
                          </td>
                          <td className="py-2 px-2 font-mono">{row.eloInternational}</td>
                          <td className="py-2 pl-2 text-right font-mono">{row.totalGames}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
