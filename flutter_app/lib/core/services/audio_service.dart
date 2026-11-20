import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/widgets.dart';

import '../../settings/app_settings.dart';

enum MusicTrack {
  none,
  menu,
  game,
  victory,
  defeat,
  tournament,
}

enum SoundEffectType {
  select,
  move,
  capture,
  promote,
  button,
  matchStart,
  victory,
  defeat,
  notify,
}

/// Manages looping background music, polyphonic SFX, volume mixing,
/// and Android AudioFocus / app-lifecycle interruptions.
class AudioService with WidgetsBindingObserver {
  AudioService._();

  static final AudioService instance = AudioService._();

  AudioPlayer? _bgmPlayer;
  AudioPlayer? _sfxPlayer;
  bool _initialized = false;
  bool _pausedByLifecycle = false;

  MusicTrack _currentTrack = MusicTrack.none;
  double _masterVolume = 0.75;
  double _musicVolume = 0.40;
  double _sfxVolume = 0.80;
  bool _musicEnabled = true;
  bool _inGameMusicEnabled = true;
  bool _sfxEnabled = true;

  double get _effectiveMusicVolume =>
      (_masterVolume * _musicVolume).clamp(0.0, 1.0);
  double get _effectiveSfxVolume =>
      (_masterVolume * _sfxVolume).clamp(0.0, 1.0);

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      WidgetsBinding.instance.addObserver(this);
      _bgmPlayer = AudioPlayer(playerId: 'dm_bgm');
      _sfxPlayer = AudioPlayer(playerId: 'dm_sfx');

      await AudioPlayer.global.setAudioContext(
        AudioContext(
          android: const AudioContextAndroid(
            isSpeakerphoneOn: false,
            stayAwake: false,
            contentType: AndroidContentType.music,
            usageType: AndroidUsageType.game,
            audioFocus: AndroidAudioFocus.gain,
          ),
          iOS: AudioContextIOS(
            category: AVAudioSessionCategory.ambient,
            options: const {},
          ),
        ),
      );
      await _sfxPlayer?.setAudioContext(
        AudioContext(
          android: const AudioContextAndroid(
            contentType: AndroidContentType.sonification,
            usageType: AndroidUsageType.game,
            audioFocus: AndroidAudioFocus.gainTransientMayDuck,
          ),
        ),
      );
      await _bgmPlayer?.setReleaseMode(ReleaseMode.loop);
      await _sfxPlayer?.setReleaseMode(ReleaseMode.stop);
    } catch (_) {
      // Safe fallback inside unit tests or headless environments without platform audio
    }
  }

  void applySettings(AppSettings settings) {
    _masterVolume = settings.masterVolume;
    _musicVolume = settings.musicVolume;
    _sfxVolume = settings.sfxVolume;
    _musicEnabled = settings.musicEnabled;
    _inGameMusicEnabled = settings.inGameMusicEnabled;
    _sfxEnabled = settings.soundEnabled;

    try {
      _bgmPlayer?.setVolume(_effectiveMusicVolume);
      if (!_musicEnabled ||
          (_currentTrack == MusicTrack.game && !_inGameMusicEnabled)) {
        _bgmPlayer?.pause();
      } else if (_currentTrack != MusicTrack.none && !_pausedByLifecycle) {
        _bgmPlayer?.resume();
      }
    } catch (_) {}
  }

  Future<void> playMusic(MusicTrack track) async {
    await init();
    if (track == _currentTrack) return;
    _currentTrack = track;

    if (track == MusicTrack.none ||
        !_musicEnabled ||
        (track == MusicTrack.game && !_inGameMusicEnabled)) {
      try {
        await _bgmPlayer?.stop();
      } catch (_) {}
      return;
    }

    final assetPath = switch (track) {
      MusicTrack.menu => 'audio/bgm_menu.mp3',
      MusicTrack.game => 'audio/bgm_game.mp3',
      MusicTrack.victory => 'audio/bgm_victory.mp3',
      MusicTrack.defeat => 'audio/bgm_defeat.mp3',
      MusicTrack.tournament => 'audio/bgm_tournament.mp3',
      MusicTrack.none => '',
    };
    if (assetPath.isEmpty) return;

    final loop = track == MusicTrack.menu ||
        track == MusicTrack.game ||
        track == MusicTrack.tournament;

    try {
      await _bgmPlayer?.stop();
      await _bgmPlayer?.setReleaseMode(
        loop ? ReleaseMode.loop : ReleaseMode.release,
      );
      await _bgmPlayer?.setVolume(_effectiveMusicVolume);
      await _bgmPlayer?.play(AssetSource(assetPath));
    } catch (_) {}
  }

  Future<void> playSfx(SoundEffectType type) async {
    if (!_sfxEnabled) return;
    await init();

    final assetPath = switch (type) {
      SoundEffectType.select => 'audio/sfx_select.mp3',
      SoundEffectType.move => 'audio/sfx_move.mp3',
      SoundEffectType.capture => 'audio/sfx_capture.mp3',
      SoundEffectType.promote => 'audio/sfx_promote.mp3',
      SoundEffectType.button => 'audio/sfx_button.mp3',
      SoundEffectType.matchStart => 'audio/sfx_match_start.mp3',
      SoundEffectType.victory => 'audio/bgm_victory.mp3',
      SoundEffectType.defeat => 'audio/bgm_defeat.mp3',
      SoundEffectType.notify => 'audio/sfx_notify.mp3',
    };

    try {
      await _sfxPlayer?.stop();
      await _sfxPlayer?.setVolume(_effectiveSfxVolume);
      await _sfxPlayer?.play(AssetSource(assetPath));
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    try {
      if (state == AppLifecycleState.paused ||
          state == AppLifecycleState.inactive ||
          state == AppLifecycleState.hidden) {
        _pausedByLifecycle = true;
        _bgmPlayer?.pause();
      } else if (state == AppLifecycleState.resumed) {
        _pausedByLifecycle = false;
        if (_musicEnabled && _currentTrack != MusicTrack.none) {
          _bgmPlayer?.resume();
        }
      }
    } catch (_) {}
  }

  Future<void> dispose() async {
    try {
      WidgetsBinding.instance.removeObserver(this);
      await _bgmPlayer?.dispose();
      await _sfxPlayer?.dispose();
    } catch (_) {}
  }
}
