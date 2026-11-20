import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../gameplay/engine/draughts_engine.dart';
import '../replay/replay_session.dart';

class VideoExportProgress {
  const VideoExportProgress({
    required this.stage,
    required this.progress,
  });

  final String stage;
  final double progress;
}

class VideoExportService {
  VideoExportService._();

  static const MethodChannel _channel =
      MethodChannel('com.draftmaster.app/video_exporter');

  /// Renders the match frame-by-frame into an MP4 video on Android via
  /// native MediaCodec/MediaMuxer Canvas pipeline, or creates a shareable
  /// interactive replay link when running on Web or desktop.
  static Future<String?> exportMatchMp4(
    ReplaySession session, {
    required String paletteId,
    required ValueChanged<VideoExportProgress> onProgress,
  }) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return null;
    }

    onProgress(
        const VideoExportProgress(stage: 'Preparing frames...', progress: 0.1));

    final dir = await getTemporaryDirectory();
    final outPath =
        '${dir.path}/draft_master_${DateTime.now().millisecondsSinceEpoch}.mp4';

    // Build ordered ply snapshots for native Android Canvas+MediaCodec renderer
    final frames = <Map<String, dynamic>>[];
    final total = session.totalPlies;
    for (int ply = 0; ply <= total; ply++) {
      final st = DraughtsEngine.reconstructAtPly(session.finalState, ply);
      final move = ply > 0 ? session.finalState.history[ply - 1].move : null;
      frames.add({
        'ply': ply,
        'boardCompressed': st.board.compress(),
        'notation': move?.notation ?? 'Opening',
        'fromRow': move?.from.row ?? -1,
        'fromCol': move?.from.col ?? -1,
        'toRow': move?.to.row ?? -1,
        'toCol': move?.to.col ?? -1,
        'promoted': move?.promoted ?? false,
      });
    }

    onProgress(const VideoExportProgress(
        stage: 'Encoding MP4 video...', progress: 0.55));

    final resultPath = await _channel.invokeMethod<String>('exportMatchVideo', {
      'outputPath': outPath,
      'title': session.title,
      'subtitle': '${session.whiteName} vs ${session.blackName}',
      'winnerLabel': session.winnerLabel,
      'boardSize': session.finalState.board.size,
      'paletteId': paletteId,
      'frames': frames,
    });

    onProgress(const VideoExportProgress(stage: 'Complete', progress: 1.0));
    return resultPath;
  }

  static Future<void> shareMp4File(
    String filePath,
    ReplaySession session,
  ) async {
    await Share.shareXFiles(
      [XFile(filePath, mimeType: 'video/mp4')],
      subject: 'Draft Master — ${session.title}',
      text:
          'Watch my ${session.finalState.rules.name} match (${session.totalPlies} moves) — ${session.winnerLabel}',
    );
  }

  static Future<String> createShareableReplayLink(
    ReplaySession session, {
    String serverBaseUrl = 'http://localhost:3000',
  }) async {
    final resp = await http.post(
      Uri.parse('$serverBaseUrl/api/replays'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'title': session.title,
        'whiteName': session.whiteName,
        'blackName': session.blackName,
        'gameState': session.finalState.toJson(),
      }),
    );
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final replayId = body['replayId'] as String;
      return '$serverBaseUrl/?replay=$replayId';
    }
    throw Exception('Server returned ${resp.statusCode}');
  }
}
