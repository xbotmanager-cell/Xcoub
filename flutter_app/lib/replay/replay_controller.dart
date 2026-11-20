import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/services/sound_haptic_service.dart';
import '../gameplay/engine/draughts_engine.dart';
import 'replay_session.dart';

class ReplayController extends ChangeNotifier {
  ReplayController(this.session) {
    _currentState = DraughtsEngine.reconstructAtPly(session.finalState, 0);
  }

  final ReplaySession session;
  late GameState _currentState;
  int _plyIndex = 0;
  bool _isPlaying = false;
  double _speed = 1.0;
  Timer? _timer;

  GameState get currentState => _currentState;
  int get plyIndex => _plyIndex;
  int get totalPlies => session.totalPlies;
  bool get isPlaying => _isPlaying;
  double get speed => _speed;

  void setSpeed(double nextSpeed) {
    _speed = nextSpeed;
    if (_isPlaying) {
      _restartTimer();
    }
    notifyListeners();
  }

  void play() {
    if (totalPlies == 0) return;
    if (_plyIndex >= totalPlies) {
      seekTo(0);
    }
    _isPlaying = true;
    _restartTimer();
    notifyListeners();
  }

  void pause() {
    _isPlaying = false;
    _timer?.cancel();
    _timer = null;
    notifyListeners();
  }

  void togglePlayPause() {
    if (_isPlaying) {
      pause();
    } else {
      play();
    }
  }

  void restart() {
    seekTo(0);
    play();
  }

  void first() {
    pause();
    seekTo(0);
  }

  void previous() {
    pause();
    seekTo((_plyIndex - 1).clamp(0, totalPlies));
  }

  void next() {
    pause();
    seekTo((_plyIndex + 1).clamp(0, totalPlies));
  }

  void last() {
    pause();
    seekTo(totalPlies);
  }

  void seekTo(int ply) {
    final clamped = ply.clamp(0, totalPlies);
    _plyIndex = clamped;
    _currentState = DraughtsEngine.reconstructAtPly(session.finalState, clamped);
    if (clamped > 0 && clamped <= session.finalState.history.length) {
      final move = session.finalState.history[clamped - 1].move;
      if (move.promoted) {
        SoundHapticService.onPromote();
      } else if (move.isCapture) {
        SoundHapticService.onCapture();
      } else {
        SoundHapticService.onMove();
      }
    }
    notifyListeners();
  }

  void _restartTimer() {
    _timer?.cancel();
    final intervalMs = (750 / _speed).round().clamp(150, 2000);
    _timer = Timer.periodic(Duration(milliseconds: intervalMs), (_) {
      if (_plyIndex >= totalPlies) {
        pause();
        return;
      }
      seekTo(_plyIndex + 1);
      if (_plyIndex >= totalPlies) {
        pause();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
