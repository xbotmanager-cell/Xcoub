import 'package:flutter/services.dart';

import '../../settings/app_settings.dart';
import 'audio_service.dart';

class SoundHapticService {
  SoundHapticService._();

  static bool soundEnabled = true;
  static bool hapticsEnabled = true;

  static void syncSettings(AppSettings settings) {
    soundEnabled = settings.soundEnabled;
    hapticsEnabled = settings.hapticsEnabled;
    AudioService.instance.applySettings(settings);
  }

  static Future<void> onButtonTap() async {
    if (soundEnabled) {
      await AudioService.instance.playSfx(SoundEffectType.button);
    }
    if (hapticsEnabled) {
      try {
        await HapticFeedback.selectionClick();
      } catch (_) {}
    }
  }

  static Future<void> onPieceSelect() async {
    if (soundEnabled) {
      await AudioService.instance.playSfx(SoundEffectType.select);
    }
    if (hapticsEnabled) {
      try {
        await HapticFeedback.selectionClick();
      } catch (_) {}
    }
  }

  static Future<void> onMove() async {
    if (soundEnabled) {
      await AudioService.instance.playSfx(SoundEffectType.move);
    }
    if (hapticsEnabled) {
      try {
        await HapticFeedback.lightImpact();
      } catch (_) {}
    }
  }

  static Future<void> onCapture() async {
    if (soundEnabled) {
      await AudioService.instance.playSfx(SoundEffectType.capture);
    }
    if (hapticsEnabled) {
      try {
        await HapticFeedback.mediumImpact();
      } catch (_) {}
    }
  }

  static Future<void> onPromote() async {
    if (soundEnabled) {
      await AudioService.instance.playSfx(SoundEffectType.promote);
    }
    if (hapticsEnabled) {
      try {
        await HapticFeedback.heavyImpact();
      } catch (_) {}
    }
  }

  static Future<void> onMatchStart() async {
    if (soundEnabled) {
      await AudioService.instance.playSfx(SoundEffectType.matchStart);
    }
    if (hapticsEnabled) {
      try {
        await HapticFeedback.mediumImpact();
      } catch (_) {}
    }
  }

  static Future<void> onVictory() async {
    await AudioService.instance.playMusic(MusicTrack.victory);
    if (hapticsEnabled) {
      try {
        await HapticFeedback.heavyImpact();
      } catch (_) {}
    }
  }

  static Future<void> onDefeat() async {
    await AudioService.instance.playMusic(MusicTrack.defeat);
  }

  static Future<void> onNotification() async {
    if (soundEnabled) {
      await AudioService.instance.playSfx(SoundEffectType.notify);
    }
  }
}
