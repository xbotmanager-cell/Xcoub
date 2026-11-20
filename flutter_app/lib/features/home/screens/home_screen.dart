import 'package:flutter/material.dart';

import '../../../core/services/sound_haptic_service.dart';
import '../../../core/widgets/draft_master_logo.dart';
import '../../../gameplay/ai/minimax.dart';
import '../../../gameplay/engine/draughts_engine.dart';
import '../../../gameplay/models/piece_model.dart';
import '../../../gameplay/models/rule_config.dart';
import '../../../gameplay/screens/game_screen.dart';
import '../../../gameplay/widgets/draughts_board.dart';
import '../../../replay/replay_screen.dart';
import '../../../replay/replay_session.dart';
import '../../../settings/app_settings.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.savedReplays,
    required this.settings,
    required this.onMatchSaved,
    required this.onNavigateTab,
  });

  final List<ReplaySession> savedReplays;
  final AppSettings settings;
  final ValueChanged<ReplaySession> onMatchSaved;
  final ValueChanged<int> onNavigateTab;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late AiDifficulty _difficulty;
  PlayerSide _playerSide = PlayerSide.black;

  @override
  void initState() {
    super.initState();
    _difficulty = widget.settings.defaultDifficulty;
  }

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.settings.defaultDifficulty !=
        widget.settings.defaultDifficulty) {
      _difficulty = widget.settings.defaultDifficulty;
    }
  }

  void _launchMatch({required RuleConfig rules, required bool vsAi}) {
    SoundHapticService.onButtonTap();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GameScreen(
          rules: rules,
          settings: widget.settings,
          vsAi: vsAi,
          playerSide: _playerSide,
          difficulty: _difficulty,
          onMatchSaved: widget.onMatchSaved,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final previewState = DraughtsEngine.createInitialState(s.rules);

    return SafeArea(
      top: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              // Centerpiece Game Studio Arena Card with Board Showcase
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const DraftMasterLogo(size: 46),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'DRAFT MASTER',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1.2,
                                    ),
                              ),
                              Text(
                                s.rules.name,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFF59E0B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (s.matchTimerMinutes > 0)
                          Chip(
                            label: Text('${s.matchTimerMinutes}m'),
                            visualDensity: VisualDensity.compact,
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: SizedBox(
                        width: 240,
                        child: DraughtsBoardWidget(
                          state: previewState,
                          legalMoves: const [],
                          interactive: false,
                          flipped: _playerSide == PlayerSide.black,
                          paletteId: s.boardPaletteId,
                          pieceThemeId: s.pieceThemeId,
                          highContrast: s.highContrastBoard,
                          showSquareNumbers: false,
                          animateMoves: false,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'AI Skill Tier (1–8)',
                      style:
                          TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: AiDifficulty.values.map((diff) {
                        final active = _difficulty == diff;
                        return ChoiceChip(
                          selected: active,
                          label: Text('${diff.level}. ${diff.label}'),
                          onSelected: (_) {
                            SoundHapticService.onButtonTap();
                            setState(() => _difficulty = diff);
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Text('Play As:', style: TextStyle(fontSize: 12)),
                        const SizedBox(width: 10),
                        SegmentedButton<PlayerSide>(
                          segments: const [
                            ButtonSegment(
                                value: PlayerSide.black, label: Text('Black')),
                            ButtonSegment(
                                value: PlayerSide.white, label: Text('White')),
                          ],
                          selected: {_playerSide},
                          onSelectionChanged: (set) {
                            SoundHapticService.onButtonTap();
                            setState(() => _playerSide = set.first);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          padding: EdgeInsets.symmetric(
                            vertical: s.largerControls ? 16 : 13,
                          ),
                        ),
                        onPressed: () => _launchMatch(
                          rules: s.rules,
                          vsAi: true,
                        ),
                        icon: const Icon(Icons.play_arrow_rounded),
                        label: Text(
                            'Play ${s.rules.boardSize}×${s.rules.boardSize} vs AI'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _launchMatch(
                              rules: s.rules,
                              vsAi: false,
                            ),
                            icon:
                                const Icon(Icons.people_alt_rounded, size: 18),
                            label: const Text('Pass & Play 2P'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _launchMatch(
                              rules: RuleConfig.international10x10,
                              vsAi: true,
                            ),
                            icon: const Icon(Icons.grid_on_rounded, size: 18),
                            label: const Text('10×10 Intl AI'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _QuickTile(
                      icon: Icons.school_rounded,
                      title: 'Academy',
                      subtitle: 'Flying King drills',
                      onTap: () {
                        SoundHapticService.onButtonTap();
                        widget.onNavigateTab(2);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _QuickTile(
                      icon: Icons.public_rounded,
                      title: 'Compete',
                      subtitle: 'Online & Leagues',
                      onTap: () {
                        SoundHapticService.onButtonTap();
                        widget.onNavigateTab(1);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                'Recent Match Replays (${widget.savedReplays.length})',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              if (widget.savedReplays.isEmpty)
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Text(
                    'Finish a match to auto-record it here for step-by-step replay & MP4 video sharing.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                )
              else
                ...widget.savedReplays.take(5).map(
                      (session) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: const Icon(Icons.history_rounded,
                              color: Color(0xFFF59E0B)),
                          title: Text(
                            session.title,
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            '${session.totalPlies} moves · ${session.winnerLabel}',
                            style: const TextStyle(fontSize: 11),
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () {
                            SoundHapticService.onButtonTap();
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ReplayScreen(
                                  session: session,
                                  paletteId: s.boardPaletteId,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFFF59E0B)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 13)),
                  Text(subtitle,
                      style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
