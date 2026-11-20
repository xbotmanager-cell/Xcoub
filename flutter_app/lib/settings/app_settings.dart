import 'dart:convert';

import '../gameplay/ai/minimax.dart';
import '../gameplay/models/rule_config.dart';

enum AppThemePreference {
  dark,
  light,
  system;

  String get label {
    switch (this) {
      case AppThemePreference.dark:
        return 'Dark';
      case AppThemePreference.light:
        return 'Light';
      case AppThemePreference.system:
        return 'Auto';
    }
  }
}

enum AnimationIntensity {
  subtle,
  smooth,
  dynamic;

  String get label {
    switch (this) {
      case AnimationIntensity.subtle:
        return 'Subtle';
      case AnimationIntensity.smooth:
        return 'Smooth';
      case AnimationIntensity.dynamic:
        return 'Dynamic';
    }
  }

  int get glideMs {
    switch (this) {
      case AnimationIntensity.subtle:
        return 130;
      case AnimationIntensity.smooth:
        return 220;
      case AnimationIntensity.dynamic:
        return 300;
    }
  }
}

class AppSettings {
  const AppSettings({
    // Gameplay
    this.rules = RuleConfig.draftMaster8x8,
    this.moveHints = true,
    this.moveConfirmation = false,
    this.defaultDifficulty = AiDifficulty.medium,
    this.matchTimerMinutes = 0,
    // Display
    this.themePreference = AppThemePreference.dark,
    this.boardPaletteId = 'walnut',
    this.pieceThemeId = 'ivory_obsidian',
    this.boardAnimations = true,
    this.animationIntensity = AnimationIntensity.smooth,
    this.highlightLegalMoves = true,
    this.highlightLastMove = true,
    this.showMoveLabels = true,
    // Audio & Haptics
    this.masterVolume = 0.75,
    this.musicVolume = 0.40,
    this.sfxVolume = 0.80,
    this.musicEnabled = true,
    this.inGameMusicEnabled = true,
    this.soundEnabled = true,
    this.hapticsEnabled = true,
    // Notifications
    this.notifyMatches = true,
    this.notifyLeagues = true,
    this.notifyTournaments = true,
    this.notifyFriendInvites = true,
    this.notifyTurnReminders = true,
    this.notifyDailyChallenges = false,
    // Accessibility
    this.largerControls = false,
    this.highContrastBoard = false,
    this.reducedMotion = false,
    // Account & Privacy
    this.playerName = 'Tactician',
    this.serverUrl = 'http://localhost:3000',
    this.publicProfile = true,
    this.allowFriendInvites = true,
    this.allowVideoSharing = true,
    this.deletionRequested = false,
  });

  // Gameplay
  final RuleConfig rules;
  final bool moveHints;
  final bool moveConfirmation;
  final AiDifficulty defaultDifficulty;
  final int matchTimerMinutes; // 0 = untimed

  // Display
  final AppThemePreference themePreference;
  final String boardPaletteId;
  final String pieceThemeId;
  final bool boardAnimations;
  final AnimationIntensity animationIntensity;
  final bool highlightLegalMoves;
  final bool highlightLastMove;
  final bool showMoveLabels;

  // Audio & Haptics
  final double masterVolume;
  final double musicVolume;
  final double sfxVolume;
  final bool musicEnabled;
  final bool inGameMusicEnabled;
  final bool soundEnabled;
  final bool hapticsEnabled;

  // Notifications
  final bool notifyMatches;
  final bool notifyLeagues;
  final bool notifyTournaments;
  final bool notifyFriendInvites;
  final bool notifyTurnReminders;
  final bool notifyDailyChallenges;

  // Accessibility
  final bool largerControls;
  final bool highContrastBoard;
  final bool reducedMotion;

  // Account & Privacy
  final String playerName;
  final String serverUrl;
  final bool publicProfile;
  final bool allowFriendInvites;
  final bool allowVideoSharing;
  final bool deletionRequested;

  bool get isCustomRuleset => rules.preset == VariantPreset.custom;

  AppSettings copyWith({
    RuleConfig? rules,
    bool? moveHints,
    bool? moveConfirmation,
    AiDifficulty? defaultDifficulty,
    int? matchTimerMinutes,
    AppThemePreference? themePreference,
    String? boardPaletteId,
    String? pieceThemeId,
    bool? boardAnimations,
    AnimationIntensity? animationIntensity,
    bool? highlightLegalMoves,
    bool? highlightLastMove,
    bool? showMoveLabels,
    double? masterVolume,
    double? musicVolume,
    double? sfxVolume,
    bool? musicEnabled,
    bool? inGameMusicEnabled,
    bool? soundEnabled,
    bool? hapticsEnabled,
    bool? notifyMatches,
    bool? notifyLeagues,
    bool? notifyTournaments,
    bool? notifyFriendInvites,
    bool? notifyTurnReminders,
    bool? notifyDailyChallenges,
    bool? largerControls,
    bool? highContrastBoard,
    bool? reducedMotion,
    String? playerName,
    String? serverUrl,
    bool? publicProfile,
    bool? allowFriendInvites,
    bool? allowVideoSharing,
    bool? deletionRequested,
  }) {
    return AppSettings(
      rules: rules ?? this.rules,
      moveHints: moveHints ?? this.moveHints,
      moveConfirmation: moveConfirmation ?? this.moveConfirmation,
      defaultDifficulty: defaultDifficulty ?? this.defaultDifficulty,
      matchTimerMinutes: matchTimerMinutes ?? this.matchTimerMinutes,
      themePreference: themePreference ?? this.themePreference,
      boardPaletteId: boardPaletteId ?? this.boardPaletteId,
      pieceThemeId: pieceThemeId ?? this.pieceThemeId,
      boardAnimations: boardAnimations ?? this.boardAnimations,
      animationIntensity: animationIntensity ?? this.animationIntensity,
      highlightLegalMoves: highlightLegalMoves ?? this.highlightLegalMoves,
      highlightLastMove: highlightLastMove ?? this.highlightLastMove,
      showMoveLabels: showMoveLabels ?? this.showMoveLabels,
      masterVolume: masterVolume ?? this.masterVolume,
      musicVolume: musicVolume ?? this.musicVolume,
      sfxVolume: sfxVolume ?? this.sfxVolume,
      musicEnabled: musicEnabled ?? this.musicEnabled,
      inGameMusicEnabled: inGameMusicEnabled ?? this.inGameMusicEnabled,
      soundEnabled: soundEnabled ?? this.soundEnabled,
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
      notifyMatches: notifyMatches ?? this.notifyMatches,
      notifyLeagues: notifyLeagues ?? this.notifyLeagues,
      notifyTournaments: notifyTournaments ?? this.notifyTournaments,
      notifyFriendInvites: notifyFriendInvites ?? this.notifyFriendInvites,
      notifyTurnReminders: notifyTurnReminders ?? this.notifyTurnReminders,
      notifyDailyChallenges:
          notifyDailyChallenges ?? this.notifyDailyChallenges,
      largerControls: largerControls ?? this.largerControls,
      highContrastBoard: highContrastBoard ?? this.highContrastBoard,
      reducedMotion: reducedMotion ?? this.reducedMotion,
      playerName: playerName ?? this.playerName,
      serverUrl: serverUrl ?? this.serverUrl,
      publicProfile: publicProfile ?? this.publicProfile,
      allowFriendInvites: allowFriendInvites ?? this.allowFriendInvites,
      allowVideoSharing: allowVideoSharing ?? this.allowVideoSharing,
      deletionRequested: deletionRequested ?? this.deletionRequested,
    );
  }

  Map<String, dynamic> toJson() => {
        'rules': rules.toJson(),
        'moveHints': moveHints,
        'moveConfirmation': moveConfirmation,
        'defaultDifficulty': defaultDifficulty.level,
        'matchTimerMinutes': matchTimerMinutes,
        'themePreference': themePreference.name,
        'boardPaletteId': boardPaletteId,
        'pieceThemeId': pieceThemeId,
        'boardAnimations': boardAnimations,
        'animationIntensity': animationIntensity.name,
        'highlightLegalMoves': highlightLegalMoves,
        'highlightLastMove': highlightLastMove,
        'showMoveLabels': showMoveLabels,
        'masterVolume': masterVolume,
        'musicVolume': musicVolume,
        'sfxVolume': sfxVolume,
        'musicEnabled': musicEnabled,
        'inGameMusicEnabled': inGameMusicEnabled,
        'soundEnabled': soundEnabled,
        'hapticsEnabled': hapticsEnabled,
        'notifyMatches': notifyMatches,
        'notifyLeagues': notifyLeagues,
        'notifyTournaments': notifyTournaments,
        'notifyFriendInvites': notifyFriendInvites,
        'notifyTurnReminders': notifyTurnReminders,
        'notifyDailyChallenges': notifyDailyChallenges,
        'largerControls': largerControls,
        'highContrastBoard': highContrastBoard,
        'reducedMotion': reducedMotion,
        'playerName': playerName,
        'serverUrl': serverUrl,
        'publicProfile': publicProfile,
        'allowFriendInvites': allowFriendInvites,
        'allowVideoSharing': allowVideoSharing,
        'deletionRequested': deletionRequested,
      };

  String encode() => jsonEncode(toJson());

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    final diffLevel = json['defaultDifficulty'] as int? ?? 4;
    final parsedDiff = AiDifficulty.values.firstWhere(
      (d) => d.level == diffLevel,
      orElse: () => AiDifficulty.medium,
    );
    final themeName = json['themePreference'] as String? ?? 'dark';
    final parsedTheme = AppThemePreference.values.firstWhere(
      (t) => t.name == themeName,
      orElse: () => AppThemePreference.dark,
    );
    final animName = json['animationIntensity'] as String? ?? 'smooth';
    final parsedAnim = AnimationIntensity.values.firstWhere(
      (a) => a.name == animName,
      orElse: () => AnimationIntensity.smooth,
    );

    return AppSettings(
      rules: json['rules'] is Map<String, dynamic>
          ? RuleConfig.fromJson(json['rules'] as Map<String, dynamic>)
          : RuleConfig.draftMaster8x8,
      moveHints: json['moveHints'] as bool? ?? true,
      moveConfirmation: json['moveConfirmation'] as bool? ?? false,
      defaultDifficulty: parsedDiff,
      matchTimerMinutes: json['matchTimerMinutes'] as int? ?? 0,
      themePreference: parsedTheme,
      boardPaletteId: json['boardPaletteId'] as String? ?? 'walnut',
      pieceThemeId: json['pieceThemeId'] as String? ?? 'ivory_obsidian',
      boardAnimations: json['boardAnimations'] as bool? ?? true,
      animationIntensity: parsedAnim,
      highlightLegalMoves: json['highlightLegalMoves'] as bool? ?? true,
      highlightLastMove: json['highlightLastMove'] as bool? ?? true,
      showMoveLabels: json['showMoveLabels'] as bool? ?? true,
      masterVolume: (json['masterVolume'] as num?)?.toDouble() ?? 0.75,
      musicVolume: (json['musicVolume'] as num?)?.toDouble() ?? 0.40,
      sfxVolume: (json['sfxVolume'] as num?)?.toDouble() ?? 0.80,
      musicEnabled: json['musicEnabled'] as bool? ?? true,
      inGameMusicEnabled: json['inGameMusicEnabled'] as bool? ?? true,
      soundEnabled: json['soundEnabled'] as bool? ?? true,
      hapticsEnabled: json['hapticsEnabled'] as bool? ?? true,
      notifyMatches: json['notifyMatches'] as bool? ?? true,
      notifyLeagues: json['notifyLeagues'] as bool? ?? true,
      notifyTournaments: json['notifyTournaments'] as bool? ?? true,
      notifyFriendInvites: json['notifyFriendInvites'] as bool? ?? true,
      notifyTurnReminders: json['notifyTurnReminders'] as bool? ?? true,
      notifyDailyChallenges: json['notifyDailyChallenges'] as bool? ?? false,
      largerControls: json['largerControls'] as bool? ?? false,
      highContrastBoard: json['highContrastBoard'] as bool? ?? false,
      reducedMotion: json['reducedMotion'] as bool? ?? false,
      playerName: (json['playerName'] as String?)?.trim().isNotEmpty == true
          ? json['playerName'] as String
          : 'Tactician',
      serverUrl: (json['serverUrl'] as String?)?.trim().isNotEmpty == true
          ? json['serverUrl'] as String
          : 'http://localhost:3000',
      publicProfile: json['publicProfile'] as bool? ?? true,
      allowFriendInvites: json['allowFriendInvites'] as bool? ?? true,
      allowVideoSharing: json['allowVideoSharing'] as bool? ?? true,
      deletionRequested: json['deletionRequested'] as bool? ?? false,
    );
  }
}
