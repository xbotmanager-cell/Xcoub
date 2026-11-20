import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Globe, Plus, Search, Shield, Swords, Trophy, Users } from 'lucide-react';
import { DRAFT_MASTER_8X8_RULES } from '../engine/presets.ts';
import type { RuleConfig, VariantPreset } from '../engine/types.ts';
import type { OnlineMatchContext } from './MatchArena.tsx';
import { RulesSettingsPanel } from './RulesSettingsPanel.tsx';

interface MatchSummary {
  matchId: string;
  mode: 'realtime' | 'turn_based' | 'league' | 'tournament';
  variantPreset: VariantPreset;
  rules: RuleConfig;
  whitePlayerId: string | null;
  whitePlayerName: string;
  blackPlayerId: string | null;
  blackPlayerName: string;
  status: string;
  turn: string;
  moveCount: number;
  roomCode: string;
  isPrivate: boolean;
  timeControlSeconds: number;
  turnDeadlineHours: number;
  turnDeadlineAt: number | null;
}

interface LeagueMember {
  userId: string;
  username: string;
  role: string;
  status: 'pending' | 'approved' | 'removed';
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

interface LeagueFixture {
  fixtureId: string;
  round: number;
  whiteUserId: string;
  whiteUsername: string;
  blackUserId: string;
  blackUsername: string;
  result: 'pending' | 'white' | 'black' | 'draw';
}

interface LeagueItem {
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
  status: 'pending' | 'ready' | 'completed';
}

interface TournamentItem {
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
  participants: Array<{
    userId: string;
    username: string;
    elo: number;
    seed: number;
    eliminated: boolean;
  }>;
  bracket: BracketSlot[];
}

interface CompeteHubViewProps {
  currentUserId: string;
  currentUsername: string;
  currentElo: number;
  isOnline: boolean;
  onEnterOnlineMatch: (match: OnlineMatchContext) => void;
}

export const CompeteHubView: React.FC<CompeteHubViewProps> = ({
  currentUserId,
  currentUsername,
  currentElo,
  isOnline,
  onEnterOnlineMatch,
}) => {
  const [subTab, setSubTab] = useState<'multiplayer' | 'leagues' | 'tournaments'>('multiplayer');
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [leagues, setLeagues] = useState<LeagueItem[]>([]);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multiplayer creation & matchmaking state
  const [mpMode, setMpMode] = useState<'realtime' | 'turn_based'>('realtime');
  const [mpRules, setMpRules] = useState<RuleConfig>({ ...DRAFT_MASTER_8X8_RULES });
  const [mpPrivate, setMpPrivate] = useState(false);
  const [mpTimeControl, setMpTimeControl] = useState(600);
  const [mpDeadlineHours, setMpDeadlineHours] = useState(48);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [queuing, setQueuing] = useState(false);
  const mmWsRef = useRef<WebSocket | null>(null);

  // League creation & selection state
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [leagueSearch, setLeagueSearch] = useState('');
  const [leagueInviteInput, setLeagueInviteInput] = useState('');
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueDesc, setNewLeagueDesc] = useState('');
  const [newLeagueVis, setNewLeagueVis] = useState<'public' | 'private'>('public');
  const [newLeagueFormat, setNewLeagueFormat] = useState<'round_robin' | 'knockout'>('round_robin');
  const [newLeagueRules, setNewLeagueRules] = useState<RuleConfig>({ ...DRAFT_MASTER_8X8_RULES });
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [announcementInput, setAnnouncementInput] = useState('');

  // Tournament creation & selection state
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [newTrnName, setNewTrnName] = useState('');
  const [newTrnDesc, setNewTrnDesc] = useState('');
  const [newTrnMax, setNewTrnMax] = useState(8);
  const [newTrnRules, setNewTrnRules] = useState<RuleConfig>({ ...DRAFT_MASTER_8X8_RULES });
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [mRes, lRes, tRes] = await Promise.all([
        fetch(`/api/matches?userId=${encodeURIComponent(currentUserId)}`),
        fetch('/api/leagues'),
        fetch('/api/tournaments'),
      ]);
      const mData = await mRes.json();
      const lData = await lRes.json();
      const tData = await tRes.json();
      setMatches(mData.matches ?? []);
      setLeagues(lData.leagues ?? []);
      setTournaments(tData.tournaments ?? []);
    } catch {
      setErrorMsg('Unable to reach multiplayer server right now.');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isOnline]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    return () => {
      mmWsRef.current?.close();
    };
  }, []);

  const handleToggleQuickMatch = () => {
    if (queuing) {
      mmWsRef.current?.send(JSON.stringify({ type: 'matchmaking:leave', userId: currentUserId }));
      mmWsRef.current?.close();
      mmWsRef.current = null;
      setQueuing(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    mmWsRef.current = ws;
    setQueuing(true);
    setErrorMsg(null);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'matchmaking:join',
          userId: currentUserId,
          username: currentUsername,
          variantPreset: mpRules.preset === 'custom' ? 'draft_master_8x8' : mpRules.preset,
          timeControlSeconds: mpTimeControl,
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'matchmaking:matched' && msg.match) {
          setQueuing(false);
          ws.close();
          onEnterOnlineMatch(msg.match);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      setQueuing(false);
      setErrorMsg('Matchmaking connection error.');
    };
  };

  const handleCreateMatch = async () => {
    setErrorMsg(null);
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        username: currentUsername,
        mode: mpMode,
        variantPreset: mpRules.preset,
        customRules: mpRules.preset === 'custom' ? mpRules : undefined,
        isPrivate: mpPrivate,
        timeControlSeconds: mpTimeControl,
        turnDeadlineHours: mpDeadlineHours,
      }),
    });
    const data = await res.json();
    if (data.match) {
      onEnterOnlineMatch(data.match);
    } else {
      setErrorMsg(data.error || 'Could not create match.');
    }
  };

  const handleJoinMatch = async (matchId: string) => {
    const res = await fetch(`/api/matches/${matchId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, username: currentUsername }),
    });
    const data = await res.json();
    if (data.match) onEnterOnlineMatch(data.match);
    else setErrorMsg(data.error || 'Failed to join match.');
  };

  const handleJoinByCode = async () => {
    if (!roomCodeInput.trim()) return;
    const res = await fetch('/api/matches/join-by-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: roomCodeInput.trim(),
        userId: currentUserId,
        username: currentUsername,
      }),
    });
    const data = await res.json();
    if (data.match) onEnterOnlineMatch(data.match);
    else setErrorMsg(data.error || 'Room code not found.');
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;
    const res = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newLeagueName.trim(),
        description: newLeagueDesc.trim(),
        visibility: newLeagueVis,
        ownerId: currentUserId,
        ownerName: currentUsername,
        variantPreset: newLeagueRules.preset,
        customRules: newLeagueRules.preset === 'custom' ? newLeagueRules : undefined,
        format: newLeagueFormat,
      }),
    });
    const data = await res.json();
    if (data.league) {
      setLeagues((prev) => [data.league, ...prev]);
      setSelectedLeagueId(data.league.leagueId);
      setShowCreateLeague(false);
      setNewLeagueName('');
      setNewLeagueDesc('');
    } else {
      setErrorMsg(data.error || 'Failed to create league.');
    }
  };

  const handleJoinLeague = async (leagueId: string) => {
    const res = await fetch(`/api/leagues/${leagueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        username: currentUsername,
        inviteCode: leagueInviteInput.trim(),
      }),
    });
    const data = await res.json();
    if (data.league) {
      setLeagues((prev) => prev.map((l) => (l.leagueId === leagueId ? data.league : l)));
      setSelectedLeagueId(leagueId);
    } else {
      setErrorMsg(data.error || 'Could not join league.');
    }
  };

  const handleManageLeague = async (
    leagueId: string,
    payload: Record<string, unknown>
  ) => {
    const res = await fetch(`/api/leagues/${leagueId}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: currentUserId, ...payload }),
    });
    const data = await res.json();
    if (data.league) {
      setLeagues((prev) => prev.map((l) => (l.leagueId === leagueId ? data.league : l)));
    } else if (data.error) {
      setErrorMsg(data.error);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrnName.trim()) return;
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTrnName.trim(),
        description: newTrnDesc.trim(),
        ownerId: currentUserId,
        ownerName: currentUsername,
        ownerElo: currentElo,
        variantPreset: newTrnRules.preset,
        customRules: newTrnRules.preset === 'custom' ? newTrnRules : undefined,
        maxParticipants: newTrnMax,
      }),
    });
    const data = await res.json();
    if (data.tournament) {
      setTournaments((prev) => [data.tournament, ...prev]);
      setSelectedTournamentId(data.tournament.tournamentId);
      setShowCreateTournament(false);
      setNewTrnName('');
      setNewTrnDesc('');
    }
  };

  const handleJoinTournament = async (tournamentId: string) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, username: currentUsername, elo: currentElo }),
    });
    const data = await res.json();
    if (data.tournament) {
      setTournaments((prev) => prev.map((t) => (t.tournamentId === tournamentId ? data.tournament : t)));
      setSelectedTournamentId(tournamentId);
    } else if (data.error) setErrorMsg(data.error);
  };

  const handleStartTournament = async (tournamentId: string) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: currentUserId }),
    });
    const data = await res.json();
    if (data.tournament) {
      setTournaments((prev) => prev.map((t) => (t.tournamentId === tournamentId ? data.tournament : t)));
    } else if (data.error) setErrorMsg(data.error);
  };

  const handleAdvanceBracket = async (tournamentId: string, slotId: string, winnerUserId: string) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: currentUserId, slotId, winnerUserId }),
    });
    const data = await res.json();
    if (data.tournament) {
      setTournaments((prev) => prev.map((t) => (t.tournamentId === tournamentId ? data.tournament : t)));
    } else if (data.error) setErrorMsg(data.error);
  };

  const selectedLeague = leagues.find((l) => l.leagueId === selectedLeagueId) ?? null;
  const selectedTournament = tournaments.find((t) => t.tournamentId === selectedTournamentId) ?? null;

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-8 text-center space-y-3">
        <Globe className="w-8 h-8 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Connectivity Required for Online Competition
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          You are currently offline. You can continue playing AI Battles, Local Pass & Play, Tutorial Master, and Match Replays without interruption.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Segmented Sub-Nav */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Competitive Arena
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Server-authoritative multiplayer, seasonal leagues, and bracket tournaments
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#131A26] border border-slate-200 dark:border-slate-800">
          {(
            [
              { id: 'multiplayer', label: 'Multiplayer' },
              { id: 'leagues', label: 'Leagues' },
              { id: 'tournaments', label: 'Tournaments' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                subTab === t.id
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="px-4 py-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: MULTIPLAYER */}
      {subTab === 'multiplayer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create / Quick Match */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create or Queue Online Match
              </h2>
              <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0F17]">
                <button
                  type="button"
                  onClick={() => setMpMode('realtime')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    mpMode === 'realtime' ? 'bg-amber-600 text-white' : 'text-slate-500'
                  }`}
                >
                  Real-Time
                </button>
                <button
                  type="button"
                  onClick={() => setMpMode('turn_based')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    mpMode === 'turn_based' ? 'bg-amber-600 text-white' : 'text-slate-500'
                  }`}
                >
                  Turn-Based
                </button>
              </div>
            </div>

            <RulesSettingsPanel rules={mpRules} onChange={setMpRules} compact />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mpMode === 'realtime' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Clock per Player
                  </label>
                  <select
                    value={mpTimeControl}
                    onChange={(e) => setMpTimeControl(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                  >
                    <option value={180}>3 min Blitz</option>
                    <option value={300}>5 min Rapid</option>
                    <option value={600}>10 min Classic</option>
                    <option value={900}>15 min Tournament</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Turn Deadline
                  </label>
                  <select
                    value={mpDeadlineHours}
                    onChange={(e) => setMpDeadlineHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                  >
                    <option value={24}>24 Hours per Turn</option>
                    <option value={48}>48 Hours per Turn</option>
                    <option value={72}>72 Hours per Turn</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Room Visibility
                </label>
                <button
                  type="button"
                  onClick={() => setMpPrivate((v) => !v)}
                  className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-left font-medium"
                >
                  {mpPrivate ? 'Private Room (Invite Code Only)' : 'Public Lobby Match'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreateMatch}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Create Match Room
              </button>
              {mpMode === 'realtime' && (
                <button
                  type="button"
                  onClick={handleToggleQuickMatch}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-xs font-semibold ${
                    queuing
                      ? 'border-amber-500 bg-amber-500/15 text-amber-500'
                      : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Swords className="w-4 h-4" />
                  {queuing ? 'Searching Opponent (Cancel)' : 'Quick Matchmaking'}
                </button>
              )}
            </div>

            {/* Join by Room Code */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter 6-character room code"
                maxLength={8}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-mono uppercase border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
              />
              <button
                type="button"
                onClick={handleJoinByCode}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Join Room
              </button>
            </div>
          </div>

          {/* Open Lobby & Active Turn-Based Matches */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Open Rooms & Your Active Matches
              </h2>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {matches.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                No open lobbies or active matches yet. Create a room or queue Quick Matchmaking to begin.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
                {matches.map((m) => {
                  const isParticipant =
                    m.whitePlayerId === currentUserId || m.blackPlayerId === currentUserId;
                  return (
                    <div
                      key={m.matchId}
                      className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {m.whitePlayerName} vs {m.blackPlayerName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {m.rules.name} · {m.mode === 'turn_based' ? `${m.turnDeadlineHours}h Turn-Based` : `${Math.round(m.timeControlSeconds / 60)}m Real-Time`} ·{' '}
                          {m.rules.flyingKings ? 'Flying Kings' : '1-Sq Kings'} ·{' '}
                          {m.rules.mandatoryCapture ? 'Mandatory Capture' : 'Optional Capture'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Room {m.roomCode} · Status: {m.status} · {m.moveCount} ply
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJoinMatch(m.matchId)}
                        className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shrink-0"
                      >
                        {isParticipant ? 'Resume' : m.status === 'waiting' ? 'Join Match' : 'Spectate'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LEAGUES */}
      {subTab === 'leagues' && (
        <div className="space-y-6">
          {/* Banner + Actions */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src="/src/assets/images/trophy_championship_1795174869654.jpg"
                alt="Championship Trophy"
                referrerPolicy="no-referrer"
                className="w-16 h-12 rounded-lg object-cover border border-slate-700 hidden sm:block"
              />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Competitive Leagues
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Seasonal round-robin and knockout divisions with configurable variants and verified standings.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={leagueSearch}
                  onChange={(e) => setLeagueSearch(e.target.value)}
                  placeholder="Search leagues"
                  className="pl-8 pr-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateLeague((v) => !v)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Create League
              </button>
            </div>
          </div>

          {showCreateLeague && (
            <form
              onSubmit={handleCreateLeague}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                New League Setup
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  placeholder="League name (e.g. Continental Premier)"
                  className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                />
                <select
                  value={newLeagueVis}
                  onChange={(e) => setNewLeagueVis(e.target.value as 'public' | 'private')}
                  className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                >
                  <option value="public">Public Discovery</option>
                  <option value="private">Private (Invite / Approval)</option>
                </select>
                <select
                  value={newLeagueFormat}
                  onChange={(e) => setNewLeagueFormat(e.target.value as 'round_robin' | 'knockout')}
                  className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                >
                  <option value="round_robin">Round-Robin Season</option>
                  <option value="knockout">Knockout Cup</option>
                </select>
              </div>
              <input
                type="text"
                value={newLeagueDesc}
                onChange={(e) => setNewLeagueDesc(e.target.value)}
                placeholder="League description & rules notes"
                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
              />
              <RulesSettingsPanel rules={newLeagueRules} onChange={setNewLeagueRules} compact />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateLeague(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                >
                  Launch League
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-3">
              {leagues
                .filter((l) =>
                  l.name.toLowerCase().includes(leagueSearch.trim().toLowerCase())
                )
                .map((l) => {
                  const isSelected = selectedLeague?.leagueId === l.leagueId;
                  return (
                    <button
                      key={l.leagueId}
                      type="button"
                      onClick={() => setSelectedLeagueId(l.leagueId)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {l.name}
                        </span>
                        <span className="text-xs font-mono text-amber-500 capitalize">
                          {l.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {l.rules.name} · {l.format.replace('_', ' ')} · {l.members.length}/{l.maxMembers} players
                      </div>
                    </button>
                  );
                })}
              {leagues.length === 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-6 text-center text-xs text-slate-500">
                  No leagues created yet. Click Create League to launch Season 1.
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              {selectedLeague ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {selectedLeague.name}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedLeague.rules.name} · Season {selectedLeague.seasonNumber} · Invite Code:{' '}
                        <span className="font-mono text-amber-500">{selectedLeague.inviteCode}</span>
                      </div>
                      {selectedLeague.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          {selectedLeague.description}
                        </p>
                      )}
                    </div>

                    {!selectedLeague.members.some((m) => m.userId === currentUserId) && (
                      <div className="flex gap-2">
                        {selectedLeague.visibility === 'private' && (
                          <input
                            type="text"
                            value={leagueInviteInput}
                            onChange={(e) => setLeagueInviteInput(e.target.value.toUpperCase())}
                            placeholder="Invite code"
                            className="w-24 px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleJoinLeague(selectedLeague.leagueId)}
                          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                        >
                          {selectedLeague.visibility === 'public' ? 'Join League' : 'Request Entry'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Announcement */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      Commissioner Notice:{' '}
                    </span>
                    {selectedLeague.announcement}
                  </div>

                  {/* Owner Management Controls */}
                  {selectedLeague.ownerId === currentUserId && (
                    <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        <Shield className="w-4 h-4 text-amber-500" />
                        League Commissioner Controls
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedLeague.status === 'open' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleManageLeague(selectedLeague.leagueId, { action: 'start_season' })
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                          >
                            Start Season & Generate Fixtures
                          </button>
                        )}
                        <div className="flex flex-1 gap-2 min-w-[220px]">
                          <input
                            type="text"
                            value={announcementInput}
                            onChange={(e) => setAnnouncementInput(e.target.value)}
                            placeholder="Publish announcement..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void handleManageLeague(selectedLeague.leagueId, {
                                action: 'announce',
                                announcement: announcementInput,
                              });
                              setAnnouncementInput('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                      {selectedLeague.members.some((m) => m.status === 'pending') && (
                        <div className="space-y-1.5 pt-2">
                          <div className="text-[11px] font-medium text-slate-500">Pending Requests</div>
                          {selectedLeague.members
                            .filter((m) => m.status === 'pending')
                            .map((m) => (
                              <div key={m.userId} className="flex items-center justify-between text-xs">
                                <span>{m.username}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleManageLeague(selectedLeague.leagueId, {
                                      action: 'approve',
                                      targetUserId: m.userId,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px]"
                                >
                                  Approve
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standings Leaderboard */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Standings
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left tabular-nums">
                        <thead className="text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2 pr-2">#</th>
                            <th className="py-2 pr-2">Player</th>
                            <th className="py-2 px-2">P</th>
                            <th className="py-2 px-2">W</th>
                            <th className="py-2 px-2">D</th>
                            <th className="py-2 px-2">L</th>
                            <th className="py-2 px-2">Win%</th>
                            <th className="py-2 pl-2 text-right">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {selectedLeague.members
                            .filter((m) => m.status === 'approved')
                            .slice()
                            .sort((a, b) => b.points - a.points || b.wins - a.wins)
                            .map((m, i) => {
                              const winPct = m.played > 0 ? Math.round((m.wins / m.played) * 100) : 0;
                              return (
                                <tr key={m.userId}>
                                  <td className="py-2 pr-2 font-mono text-slate-400">{i + 1}</td>
                                  <td className="py-2 pr-2 font-medium text-slate-900 dark:text-slate-100">
                                    {m.username}
                                  </td>
                                  <td className="py-2 px-2 font-mono">{m.played}</td>
                                  <td className="py-2 px-2 font-mono text-emerald-500">{m.wins}</td>
                                  <td className="py-2 px-2 font-mono">{m.draws}</td>
                                  <td className="py-2 px-2 font-mono text-rose-500">{m.losses}</td>
                                  <td className="py-2 px-2 font-mono">{winPct}%</td>
                                  <td className="py-2 pl-2 text-right font-mono font-bold text-amber-500">
                                    {m.points}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Scheduled Fixtures */}
                  {selectedLeague.fixtures.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Fixtures
                      </h4>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {selectedLeague.fixtures.map((fx) => (
                          <div
                            key={fx.fixtureId}
                            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-mono text-slate-400 mr-2">R{fx.round}</span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {fx.whiteUsername} vs {fx.blackUsername}
                              </span>
                            </div>
                            {fx.result === 'pending' && selectedLeague.ownerId === currentUserId ? (
                              <div className="flex gap-1">
                                {(['white', 'draw', 'black'] as const).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() =>
                                      handleManageLeague(selectedLeague.leagueId, {
                                        action: 'record_fixture',
                                        fixtureId: fx.fixtureId,
                                        result: r,
                                      })
                                    }
                                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-amber-500/20 text-[11px] capitalize"
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="font-mono text-amber-500 capitalize">{fx.result}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-8 text-center text-xs text-slate-500">
                  Select a league on the left to inspect its rules, standings, and fixtures.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TOURNAMENTS */}
      {subTab === 'tournaments' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-7 h-7 text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Knockout & Championship Tournaments
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automated bracket seeding, rules verification before registration, and champion crowning.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateTournament((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Tournament
            </button>
          </div>

          {showCreateTournament && (
            <form
              onSubmit={handleCreateTournament}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={newTrnName}
                  onChange={(e) => setNewTrnName(e.target.value)}
                  placeholder="Tournament name (e.g. Grandmaster Open)"
                  className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                />
                <select
                  value={newTrnMax}
                  onChange={(e) => setNewTrnMax(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
                >
                  <option value={4}>4-Player Bracket</option>
                  <option value={8}>8-Player Bracket</option>
                  <option value={16}>16-Player Bracket</option>
                </select>
              </div>
              <input
                type="text"
                value={newTrnDesc}
                onChange={(e) => setNewTrnDesc(e.target.value)}
                placeholder="Description and tie-break details"
                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]"
              />
              <RulesSettingsPanel rules={newTrnRules} onChange={setNewTrnRules} compact />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTournament(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                >
                  Open Registration
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-3">
              {tournaments.map((t) => (
                <button
                  key={t.tournamentId}
                  type="button"
                  onClick={() => setSelectedTournamentId(t.tournamentId)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selectedTournament?.tournamentId === t.tournamentId
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.name}
                    </span>
                    <span className="text-xs font-mono text-amber-500 capitalize">
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t.rules.name} · {t.participants.length}/{t.maxParticipants} entered
                  </div>
                </button>
              ))}
              {tournaments.length === 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-6 text-center text-xs text-slate-500">
                  No tournaments open yet. Create one to generate an elimination bracket.
                </div>
              )}
            </div>

            <div className="lg:col-span-8">
              {selectedTournament ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {selectedTournament.name}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedTournament.rules.name} ·{' '}
                        {selectedTournament.rules.flyingKings ? 'Flying Kings' : '1-Sq Kings'} ·{' '}
                        {selectedTournament.rules.maximumCapture ? 'Max Capture' : 'Standard Capture'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedTournament.status === 'registration' &&
                        !selectedTournament.participants.some((p) => p.userId === currentUserId) && (
                          <button
                            type="button"
                            onClick={() => handleJoinTournament(selectedTournament.tournamentId)}
                            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                          >
                            Register
                          </button>
                        )}
                      {selectedTournament.status === 'registration' &&
                        selectedTournament.ownerId === currentUserId && (
                          <button
                            type="button"
                            onClick={() => handleStartTournament(selectedTournament.tournamentId)}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                          >
                            Generate Bracket & Start
                          </button>
                        )}
                    </div>
                  </div>

                  {selectedTournament.championName && (
                    <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 flex items-center gap-3">
                      <Crown className="w-6 h-6 text-amber-500 shrink-0" />
                      <div>
                        <div className="text-xs text-amber-600 dark:text-amber-300 font-medium">
                          Tournament Champion
                        </div>
                        <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {selectedTournament.championName}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Registered Roster */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      <Users className="w-3.5 h-3.5" />
                      Registered Competitors ({selectedTournament.participants.length}/
                      {selectedTournament.maxParticipants})
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {selectedTournament.participants.map((p) => (
                        <span
                          key={p.userId}
                          className={`${
                            p.eliminated ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          #{p.seed} {p.username} ({p.elo})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Visual Single-Elimination Bracket */}
                  {selectedTournament.bracket.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Tournament Bracket
                      </h4>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {Array.from(
                          new Set(selectedTournament.bracket.map((b) => b.round))
                        )
                          .sort((a, b) => a - b)
                          .map((roundNum) => {
                            const slots = selectedTournament.bracket.filter(
                              (b) => b.round === roundNum
                            );
                            return (
                              <div key={roundNum} className="min-w-[210px] space-y-3">
                                <div className="text-xs font-mono font-semibold text-slate-500">
                                  Round {roundNum}
                                </div>
                                {slots.map((slot) => (
                                  <div
                                    key={slot.slotId}
                                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] space-y-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className={
                                          slot.winnerUserId && slot.winnerUserId === slot.whiteUserId
                                            ? 'font-bold text-amber-500'
                                            : 'text-slate-800 dark:text-slate-200'
                                        }
                                      >
                                        {slot.whiteUsername ?? 'TBD'}
                                      </span>
                                      {slot.status === 'ready' &&
                                        selectedTournament.ownerId === currentUserId &&
                                        slot.whiteUserId && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleAdvanceBracket(
                                                selectedTournament.tournamentId,
                                                slot.slotId,
                                                slot.whiteUserId!
                                              )
                                            }
                                            className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px]"
                                          >
                                            Win
                                          </button>
                                        )}
                                    </div>
                                    <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex items-center justify-between gap-2">
                                      <span
                                        className={
                                          slot.winnerUserId && slot.winnerUserId === slot.blackUserId
                                            ? 'font-bold text-amber-500'
                                            : 'text-slate-800 dark:text-slate-200'
                                        }
                                      >
                                        {slot.blackUsername ?? 'BYE'}
                                      </span>
                                      {slot.status === 'ready' &&
                                        selectedTournament.ownerId === currentUserId &&
                                        slot.blackUserId && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleAdvanceBracket(
                                                selectedTournament.tournamentId,
                                                slot.slotId,
                                                slot.blackUserId!
                                              )
                                            }
                                            className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px]"
                                          >
                                            Win
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-8 text-center text-xs text-slate-500">
                  Select a tournament to view participants, ruleset, and live elimination bracket.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
