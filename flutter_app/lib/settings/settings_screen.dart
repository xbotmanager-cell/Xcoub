import 'package:flutter/material.dart';

import '../core/services/audio_service.dart';
import '../core/services/sound_haptic_service.dart';
import '../core/theme/app_theme.dart';
import '../gameplay/ai/minimax.dart';
import '../gameplay/models/rule_config.dart';
import 'app_settings.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.settings,
    required this.onSettingsChanged,
    this.onSignOut,
    this.onRequestAccountDeletion,
  });

  final AppSettings settings;
  final ValueChanged<AppSettings> onSettingsChanged;
  final VoidCallback? onSignOut;
  final VoidCallback? onRequestAccountDeletion;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _serverCtrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.settings.playerName);
    _serverCtrl = TextEditingController(text: widget.settings.serverUrl);
  }

  @override
  void didUpdateWidget(covariant SettingsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.settings.playerName != widget.settings.playerName &&
        _nameCtrl.text != widget.settings.playerName) {
      _nameCtrl.text = widget.settings.playerName;
    }
    if (oldWidget.settings.serverUrl != widget.settings.serverUrl &&
        _serverCtrl.text != widget.settings.serverUrl) {
      _serverCtrl.text = widget.settings.serverUrl;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _serverCtrl.dispose();
    super.dispose();
  }

  void _update(AppSettings next) {
    widget.onSettingsChanged(next);
  }

  void _updateCustomRule(RuleConfig modified) {
    _update(
      widget.settings.copyWith(
        rules: modified.copyWith(
          preset: VariantPreset.custom,
          name: 'Custom (${modified.boardSize}×${modified.boardSize})',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final rules = s.rules;

    return SafeArea(
      top: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              // 1. GAMEPLAY SETTINGS
              _SectionCard(
                icon: Icons.extension_rounded,
                title: 'Gameplay Settings',
                badge: s.isCustomRuleset ? 'CUSTOM RULES' : 'OFFICIAL PRESET',
                badgeColor: s.isCustomRuleset
                    ? const Color(0xFFF59E0B)
                    : const Color(0xFF10B981),
                children: [
                  const Text(
                    'Variant Preset & Board Size',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ChoiceChip(
                        selected:
                            rules.preset == VariantPreset.draftMaster8x8,
                        label: const Text('8×8 Flying Kings (Default)'),
                        onSelected: (_) {
                          SoundHapticService.onButtonTap();
                          _update(
                              s.copyWith(rules: RuleConfig.draftMaster8x8));
                        },
                      ),
                      ChoiceChip(
                        selected: rules.preset == VariantPreset.english8x8,
                        label: const Text('English 8×8 Classic'),
                        onSelected: (_) {
                          SoundHapticService.onButtonTap();
                          _update(s.copyWith(rules: RuleConfig.english8x8));
                        },
                      ),
                      ChoiceChip(
                        selected:
                            rules.preset == VariantPreset.international10x10,
                        label: const Text('International 10×10'),
                        onSelected: (_) {
                          SoundHapticService.onButtonTap();
                          _update(s.copyWith(
                              rules: RuleConfig.international10x10));
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Text('Board Size:', style: TextStyle(fontSize: 13)),
                      const SizedBox(width: 12),
                      SegmentedButton<int>(
                        segments: const [
                          ButtonSegment(value: 8, label: Text('8×8')),
                          ButtonSegment(value: 10, label: Text('10×10')),
                        ],
                        selected: {rules.boardSize},
                        onSelectionChanged: (set) {
                          final size = set.first;
                          SoundHapticService.onButtonTap();
                          _updateCustomRule(
                            rules.copyWith(
                              boardSize: size,
                              startingRows: size == 10 ? 4 : 3,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Flying King Movement'),
                    subtitle: const Text(
                      'Long-range diagonal glide and capture across empty squares.',
                    ),
                    value: rules.flyingKings,
                    onChanged: (v) =>
                        _updateCustomRule(rules.copyWith(flyingKings: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Mandatory Captures'),
                    value: rules.mandatoryCapture,
                    onChanged: (v) =>
                        _updateCustomRule(rules.copyWith(mandatoryCapture: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Maximum Capture Rule'),
                    value: rules.maximumCapture,
                    onChanged: (v) =>
                        _updateCustomRule(rules.copyWith(maximumCapture: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Multiple Captures'),
                    value: rules.multipleCaptures,
                    onChanged: (v) =>
                        _updateCustomRule(rules.copyWith(multipleCaptures: v)),
                  ),
                  const Divider(height: 20),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Tactical Move Hints'),
                    subtitle: const Text(
                      'Show Hint button during offline matches.',
                    ),
                    value: s.moveHints,
                    onChanged: (v) => _update(s.copyWith(moveHints: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Move Confirmation'),
                    subtitle: const Text(
                      'Require a confirmation tap before executing moves.',
                    ),
                    value: s.moveConfirmation,
                    onChanged: (v) =>
                        _update(s.copyWith(moveConfirmation: v)),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<AiDifficulty>(
                    initialValue: s.defaultDifficulty,
                    decoration: const InputDecoration(
                      labelText: 'Default AI Difficulty',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    items: AiDifficulty.values
                        .map(
                          (d) => DropdownMenuItem(
                            value: d,
                            child: Text('${d.level}. ${d.label} (${d.eloEstimate} Elo)'),
                          ),
                        )
                        .toList(),
                    onChanged: (d) {
                      if (d != null) _update(s.copyWith(defaultDifficulty: d));
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    initialValue: s.matchTimerMinutes,
                    decoration: const InputDecoration(
                      labelText: 'Match Timer',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    items: const [
                      DropdownMenuItem(value: 0, child: Text('No Time Limit')),
                      DropdownMenuItem(value: 3, child: Text('3 Minutes (Blitz)')),
                      DropdownMenuItem(value: 5, child: Text('5 Minutes (Rapid)')),
                      DropdownMenuItem(value: 10, child: Text('10 Minutes (Classic)')),
                      DropdownMenuItem(value: 15, child: Text('15 Minutes (Tournament)')),
                    ],
                    onChanged: (m) {
                      if (m != null) _update(s.copyWith(matchTimerMinutes: m));
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 2. DISPLAY SETTINGS
              _SectionCard(
                icon: Icons.palette_rounded,
                title: 'Display Settings',
                children: [
                  const Text('App Theme', style: TextStyle(fontSize: 13)),
                  const SizedBox(height: 8),
                  SegmentedButton<AppThemePreference>(
                    segments: AppThemePreference.values
                        .map((t) => ButtonSegment(value: t, label: Text(t.label)))
                        .toList(),
                    selected: {s.themePreference},
                    onSelectionChanged: (set) {
                      SoundHapticService.onButtonTap();
                      _update(s.copyWith(themePreference: set.first));
                    },
                  ),
                  const SizedBox(height: 14),
                  const Text('Board Theme', style: TextStyle(fontSize: 13)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: AppTheme.boardPalettes
                        .where((p) => p.id != 'high_contrast')
                        .map((p) {
                      final active = s.boardPaletteId == p.id;
                      return ChoiceChip(
                        selected: active,
                        avatar: Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: p.darkSquare,
                            border: Border.all(color: p.lightSquare, width: 2),
                            shape: BoxShape.circle,
                          ),
                        ),
                        label: Text(p.name),
                        onSelected: (_) {
                          SoundHapticService.onButtonTap();
                          _update(s.copyWith(boardPaletteId: p.id));
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  const Text('Piece Theme', style: TextStyle(fontSize: 13)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: AppTheme.pieceThemes
                        .where((p) => p.id != 'high_contrast_tactile')
                        .map((p) {
                      final active = s.pieceThemeId == p.id;
                      return ChoiceChip(
                        selected: active,
                        avatar: CircleAvatar(
                          backgroundColor: p.blackTop,
                          radius: 8,
                        ),
                        label: Text(p.name),
                        onSelected: (_) {
                          SoundHapticService.onButtonTap();
                          _update(s.copyWith(pieceThemeId: p.id));
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Board Animations'),
                    value: s.boardAnimations,
                    onChanged: (v) => _update(s.copyWith(boardAnimations: v)),
                  ),
                  if (s.boardAnimations) ...[
                    const Text(
                      'Animation Intensity',
                      style: TextStyle(fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    SegmentedButton<AnimationIntensity>(
                      segments: AnimationIntensity.values
                          .map((a) => ButtonSegment(value: a, label: Text(a.label)))
                          .toList(),
                      selected: {s.animationIntensity},
                      onSelectionChanged: (set) =>
                          _update(s.copyWith(animationIntensity: set.first)),
                    ),
                    const SizedBox(height: 8),
                  ],
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Highlight Legal Destinations'),
                    value: s.highlightLegalMoves,
                    onChanged: (v) =>
                        _update(s.copyWith(highlightLegalMoves: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Highlight Last Move'),
                    value: s.highlightLastMove,
                    onChanged: (v) => _update(s.copyWith(highlightLastMove: v)),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 3. AUDIO SETTINGS
              _SectionCard(
                icon: Icons.music_note_rounded,
                title: 'Audio & Haptics',
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Background Music'),
                    value: s.musicEnabled,
                    onChanged: (v) => _update(s.copyWith(musicEnabled: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('In-Game Music'),
                    value: s.inGameMusicEnabled,
                    onChanged: s.musicEnabled
                        ? (v) => _update(s.copyWith(inGameMusicEnabled: v))
                        : null,
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Sound Effects'),
                    value: s.soundEnabled,
                    onChanged: (v) => _update(s.copyWith(soundEnabled: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Vibration / Haptics'),
                    value: s.hapticsEnabled,
                    onChanged: (v) => _update(s.copyWith(hapticsEnabled: v)),
                  ),
                  const SizedBox(height: 6),
                  _VolumeSlider(
                    label: 'Master Volume',
                    value: s.masterVolume,
                    onChanged: (v) => _update(s.copyWith(masterVolume: v)),
                  ),
                  _VolumeSlider(
                    label: 'Music Volume',
                    value: s.musicVolume,
                    onChanged: s.musicEnabled
                        ? (v) => _update(s.copyWith(musicVolume: v))
                        : null,
                  ),
                  _VolumeSlider(
                    label: 'Sound Effects Volume',
                    value: s.sfxVolume,
                    onChanged: s.soundEnabled
                        ? (v) => _update(s.copyWith(sfxVolume: v))
                        : null,
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        AudioService.instance.playSfx(SoundEffectType.promote);
                      },
                      icon: const Icon(Icons.volume_up_rounded, size: 17),
                      label: const Text('Test Audio'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 4. NOTIFICATION SETTINGS
              _SectionCard(
                icon: Icons.notifications_active_rounded,
                title: 'Notifications',
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Match Notifications'),
                    value: s.notifyMatches,
                    onChanged: (v) => _update(s.copyWith(notifyMatches: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('League Notifications'),
                    value: s.notifyLeagues,
                    onChanged: (v) => _update(s.copyWith(notifyLeagues: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Tournament Notifications'),
                    value: s.notifyTournaments,
                    onChanged: (v) =>
                        _update(s.copyWith(notifyTournaments: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Friend Invitations'),
                    value: s.notifyFriendInvites,
                    onChanged: (v) =>
                        _update(s.copyWith(notifyFriendInvites: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Turn Reminders'),
                    value: s.notifyTurnReminders,
                    onChanged: (v) =>
                        _update(s.copyWith(notifyTurnReminders: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Daily Challenges'),
                    value: s.notifyDailyChallenges,
                    onChanged: (v) =>
                        _update(s.copyWith(notifyDailyChallenges: v)),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 5. ACCESSIBILITY
              _SectionCard(
                icon: Icons.accessibility_new_rounded,
                title: 'Accessibility',
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Larger Controls'),
                    subtitle: const Text(
                      'Increase touch targets for game buttons and navigation.',
                    ),
                    value: s.largerControls,
                    onChanged: (v) => _update(s.copyWith(largerControls: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('High-Contrast Board & Pieces'),
                    value: s.highContrastBoard,
                    onChanged: (v) =>
                        _update(s.copyWith(highContrastBoard: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Show Square Move Labels'),
                    value: s.showMoveLabels,
                    onChanged: (v) => _update(s.copyWith(showMoveLabels: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Reduced Motion'),
                    subtitle: const Text(
                      'Minimize glide, scale, and crown bounce animations.',
                    ),
                    value: s.reducedMotion,
                    onChanged: (v) => _update(s.copyWith(reducedMotion: v)),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 6. ACCOUNT & PRIVACY
              _SectionCard(
                icon: Icons.shield_rounded,
                title: 'Account & Privacy',
                children: [
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Player Profile Name',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (val) {
                      final trimmed = val.trim();
                      if (trimmed.isNotEmpty) {
                        _update(s.copyWith(playerName: trimmed));
                      }
                    },
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _serverCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Multiplayer Server URL',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (val) {
                      final trimmed = val.trim();
                      if (trimmed.isNotEmpty) {
                        _update(s.copyWith(serverUrl: trimmed));
                      }
                    },
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Public Leaderboard Profile'),
                    value: s.publicProfile,
                    onChanged: (v) => _update(s.copyWith(publicProfile: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Allow Friend Invites'),
                    value: s.allowFriendInvites,
                    onChanged: (v) =>
                        _update(s.copyWith(allowFriendInvites: v)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Allow Match Video Sharing'),
                    value: s.allowVideoSharing,
                    onChanged: (v) =>
                        _update(s.copyWith(allowVideoSharing: v)),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            SoundHapticService.onButtonTap();
                            widget.onSignOut?.call();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Signed out and reset active handle.'),
                              ),
                            );
                          },
                          icon: const Icon(Icons.logout_rounded, size: 18),
                          label: const Text('Sign Out'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFF43F5E),
                          ),
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Request Account Deletion?'),
                                content: const Text(
                                  'This submits an account deletion request and clears local saved replays and profile data.',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.of(ctx).pop(false),
                                    child: const Text('Cancel'),
                                  ),
                                  FilledButton(
                                    onPressed: () => Navigator.of(ctx).pop(true),
                                    child: const Text('Confirm Request'),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed == true) {
                              widget.onRequestAccountDeletion?.call();
                            }
                          },
                          icon: const Icon(Icons.delete_outline_rounded, size: 18),
                          label: Text(
                            s.deletionRequested
                                ? 'Deletion Requested'
                                : 'Delete Account',
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.children,
    this.badge,
    this.badgeColor,
  });

  final IconData icon;
  final String title;
  final List<Widget> children;
  final String? badge;
  final Color? badgeColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFFF59E0B), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (badgeColor ?? Colors.amber).withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    badge!,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: badgeColor ?? Colors.amber,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _VolumeSlider extends StatelessWidget {
  const _VolumeSlider({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final double value;
  final ValueChanged<double>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 12.5)),
            Text(
              '${(value * 100).round()}%',
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
          ],
        ),
        Slider(
          value: value.clamp(0.0, 1.0),
          onChanged: onChanged,
        ),
      ],
    );
  }
}
