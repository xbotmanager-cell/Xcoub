import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../replay/replay_session.dart';
import 'video_export_service.dart';

class VideoShareSheet extends StatefulWidget {
  const VideoShareSheet({
    super.key,
    required this.session,
    this.paletteId = 'walnut',
  });

  final ReplaySession session;
  final String paletteId;

  @override
  State<VideoShareSheet> createState() => _VideoShareSheetState();
}

class _VideoShareSheetState extends State<VideoShareSheet> {
  bool _busy = false;
  VideoExportProgress? _progress;
  String? _exportedPath;
  String? _shareUrl;
  String? _statusMessage;

  Future<void> _exportMp4() async {
    setState(() {
      _busy = true;
      _statusMessage = null;
      _progress =
          const VideoExportProgress(stage: 'Initializing...', progress: 0.05);
    });
    try {
      final path = await VideoExportService.exportMatchMp4(
        widget.session,
        paletteId: widget.paletteId,
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
      );
      if (!mounted) return;
      if (path == null) {
        setState(() {
          _busy = false;
          _statusMessage =
              'Direct MP4 encoding runs natively on Android. Use Share Replay Link below on Web/Desktop.';
        });
      } else {
        setState(() {
          _busy = false;
          _exportedPath = path;
          _statusMessage = 'MP4 ready: $path';
        });
      }
    } catch (err) {
      if (mounted) {
        setState(() {
          _busy = false;
          _statusMessage = 'Video export failed: $err';
        });
      }
    }
  }

  Future<void> _createLink() async {
    setState(() {
      _busy = true;
      _statusMessage = null;
    });
    try {
      final url =
          await VideoExportService.createShareableReplayLink(widget.session);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _shareUrl = url;
      });
    } catch (err) {
      if (mounted) {
        setState(() {
          _busy = false;
          _statusMessage = 'Could not generate replay URL: $err';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.movie_creation_outlined,
                    color: Color(0xFFF59E0B)),
                const SizedBox(width: 10),
                Text(
                  'Share Match as Video',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Generates an MP4 video of ${widget.session.title} showing every move, capture, King promotion, and final result.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.grey),
            ),
            const SizedBox(height: 16),
            if (_progress != null && _busy) ...[
              LinearProgressIndicator(value: _progress!.progress),
              const SizedBox(height: 6),
              Text(_progress!.stage, style: const TextStyle(fontSize: 12)),
              const SizedBox(height: 12),
            ],
            if (_statusMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child:
                    Text(_statusMessage!, style: const TextStyle(fontSize: 12)),
              ),
              const SizedBox(height: 12),
            ],
            if (_exportedPath != null)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => VideoExportService.shareMp4File(
                    _exportedPath!,
                    widget.session,
                  ),
                  icon: const Icon(Icons.share_rounded),
                  label: const Text('Share MP4 Video'),
                ),
              )
            else
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _exportMp4,
                  icon: const Icon(Icons.video_file_rounded),
                  label: const Text('Generate MP4 Video'),
                ),
              ),
            const SizedBox(height: 10),
            if (_shareUrl != null)
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _shareUrl!,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Copy link',
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: _shareUrl!));
                    },
                    icon: const Icon(Icons.copy_rounded, size: 18),
                  ),
                  IconButton(
                    tooltip: 'Share link',
                    onPressed: () => Share.share(_shareUrl!),
                    icon: const Icon(Icons.share_rounded, size: 18),
                  ),
                ],
              )
            else
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _createLink,
                  icon: const Icon(Icons.link_rounded),
                  label: const Text('Create Shareable Replay Link'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
