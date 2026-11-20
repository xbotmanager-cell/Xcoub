import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/services/audio_service.dart';
import 'core/services/sound_haptic_service.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/draft_master_logo.dart';
import 'features/home/screens/home_screen.dart';
import 'features/splash/loading_screen.dart';
import 'leagues/leagues_screen.dart';
import 'multiplayer/multiplayer_screen.dart';
import 'profiles/profile_screen.dart';
import 'replay/replay_session.dart';
import 'settings/app_settings.dart';
import 'settings/settings_screen.dart';
import 'tournaments/tournaments_screen.dart';
import 'tutorial/tutorial_screen.dart';

class DraftMasterApp extends StatefulWidget {
  const DraftMasterApp({super.key});

  @override
  State<DraftMasterApp> createState() => _DraftMasterAppState();
}

class _DraftMasterAppState extends State<DraftMasterApp> {
  static const _kReplaysKey = 'dm_saved_replays_v1';
  static const _kSettingsKey = 'dm_app_settings_v2';

  int _tabIndex = 0;
  bool _ready = false;
  String? _loadError;
  StartupLoadStep _loadStep = const StartupLoadStep(
    label: 'Initializing rules engine...',
    progress: 0.20,
  );

  AppSettings _settings = const AppSettings();
  List<ReplaySession> _savedReplays = const [];

  @override
  void initState() {
    super.initState();
    _bootstrapApp();
  }

  Future<void> _bootstrapApp() async {
    setState(() {
      _ready = false;
      _loadError = null;
      _loadStep = const StartupLoadStep(
        label: 'Loading player preferences...',
        progress: 0.30,
      );
    });

    try {
      final prefs = await SharedPreferences.getInstance();

      AppSettings loadedSettings = const AppSettings();
      final settingsRaw = prefs.getString(_kSettingsKey);
      if (settingsRaw != null && settingsRaw.isNotEmpty) {
        loadedSettings = AppSettings.fromJson(
          jsonDecode(settingsRaw) as Map<String, dynamic>,
        );
      }

      if (!mounted) return;
      setState(() {
        _loadStep = const StartupLoadStep(
          label: 'Preparing audio & haptics engine...',
          progress: 0.65,
        );
      });

      await AudioService.instance.init();
      SoundHapticService.syncSettings(loadedSettings);

      if (!mounted) return;
      setState(() {
        _loadStep = const StartupLoadStep(
          label: 'Restoring match replay vault...',
          progress: 0.90,
        );
      });

      List<ReplaySession> loadedReplays = const [];
      final replaysRaw = prefs.getString(_kReplaysKey);
      if (replaysRaw != null && replaysRaw.isNotEmpty) {
        final decoded = jsonDecode(replaysRaw) as List<dynamic>;
        loadedReplays = decoded
            .map((e) => ReplaySession.fromJson(e as Map<String, dynamic>))
            .toList();
      }

      if (!mounted) return;
      setState(() {
        _settings = loadedSettings;
        _savedReplays = loadedReplays;
        _loadStep = const StartupLoadStep(label: 'Ready', progress: 1.0);
        _ready = true;
      });

      AudioService.instance.playMusic(MusicTrack.menu);
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _loadError = 'Startup initialization error: $err';
      });
    }
  }

  Future<void> _saveReplay(ReplaySession session) async {
    final deduped = [
      session,
      ..._savedReplays.where((s) => s.id != session.id),
    ].take(25).toList();
    setState(() => _savedReplays = deduped);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _kReplaysKey,
        jsonEncode(deduped.map((e) => e.toJson()).toList()),
      );
    } catch (_) {}
  }

  Future<void> _updateSettings(AppSettings next) async {
    setState(() => _settings = next);
    SoundHapticService.syncSettings(next);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kSettingsKey, next.encode());
    } catch (_) {}
  }

  Future<void> _signOut() async {
    await _updateSettings(_settings.copyWith(playerName: 'Guest Player'));
  }

  Future<void> _requestDeletion() async {
    await _updateSettings(
      _settings.copyWith(
        playerName: 'Deleted Account Pending',
        deletionRequested: true,
      ),
    );
    setState(() => _savedReplays = const []);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kReplaysKey);
    } catch (_) {}
  }

  ThemeMode get _themeMode {
    switch (_settings.themePreference) {
      case AppThemePreference.dark:
        return ThemeMode.dark;
      case AppThemePreference.light:
        return ThemeMode.light;
      case AppThemePreference.system:
        return ThemeMode.system;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DRAFT MASTER',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: AppTheme.lightTheme(),
      darkTheme: AppTheme.darkTheme(),
      home: !_ready
          ? LoadingScreen(
              step: _loadStep,
              errorMessage: _loadError,
              onRetry: _bootstrapApp,
            )
          : Scaffold(
              appBar: AppBar(
                title: const Row(
                  children: [
                    DraftMasterLogo(size: 28, showRays: false),
                    SizedBox(width: 10),
                    Text(
                      'DRAFT MASTER',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ],
                ),
                actions: [
                  IconButton(
                    tooltip: _settings.musicEnabled
                        ? 'Mute Music'
                        : 'Enable Music',
                    icon: Icon(
                      _settings.musicEnabled
                          ? Icons.music_note_rounded
                          : Icons.music_off_rounded,
                    ),
                    onPressed: () {
                      SoundHapticService.onButtonTap();
                      _updateSettings(
                        _settings.copyWith(musicEnabled: !_settings.musicEnabled),
                      );
                    },
                  ),
                  IconButton(
                    tooltip: _settings.soundEnabled
                        ? 'Mute SFX'
                        : 'Enable SFX',
                    icon: Icon(
                      _settings.soundEnabled
                          ? Icons.volume_up_rounded
                          : Icons.volume_off_rounded,
                    ),
                    onPressed: () {
                      _updateSettings(
                        _settings.copyWith(soundEnabled: !_settings.soundEnabled),
                      );
                    },
                  ),
                ],
              ),
              body: IndexedStack(
                index: _tabIndex,
                children: [
                  HomeScreen(
                    savedReplays: _savedReplays,
                    settings: _settings,
                    onMatchSaved: _saveReplay,
                    onNavigateTab: (idx) => setState(() => _tabIndex = idx),
                  ),
                  _CompeteHubScreen(serverBaseUrl: _settings.serverUrl),
                  TutorialScreen(paletteId: _settings.boardPaletteId),
                  ProfileScreen(
                    savedReplays: _savedReplays,
                    paletteId: _settings.boardPaletteId,
                    playerName: _settings.playerName,
                  ),
                  SettingsScreen(
                    settings: _settings,
                    onSettingsChanged: _updateSettings,
                    onSignOut: _signOut,
                    onRequestAccountDeletion: _requestDeletion,
                  ),
                ],
              ),
              bottomNavigationBar: NavigationBar(
                selectedIndex: _tabIndex,
                onDestinationSelected: (idx) {
                  SoundHapticService.onButtonTap();
                  setState(() => _tabIndex = idx);
                },
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.grid_view_rounded),
                    label: 'Arena',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.public_rounded),
                    label: 'Compete',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.school_rounded),
                    label: 'Academy',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.person_rounded),
                    label: 'Profile',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.tune_rounded),
                    label: 'Settings',
                  ),
                ],
              ),
            ),
    );
  }
}

class _CompeteHubScreen extends StatelessWidget {
  const _CompeteHubScreen({required this.serverBaseUrl});

  final String serverBaseUrl;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          const TabBar(
            tabs: [
              Tab(text: 'Multiplayer'),
              Tab(text: 'Leagues'),
              Tab(text: 'Tournaments'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                MultiplayerScreen(serverBaseUrl: serverBaseUrl),
                LeaguesScreen(serverBaseUrl: serverBaseUrl),
                TournamentsScreen(serverBaseUrl: serverBaseUrl),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
