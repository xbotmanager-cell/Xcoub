import 'package:flutter/material.dart';

import 'replay_controller.dart';

class ReplayControlsBar extends StatelessWidget {
  const ReplayControlsBar({
    super.key,
    required this.controller,
  });

  final ReplayController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final total = controller.totalPlies;
        final ply = controller.plyIndex;
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.grey.withValues(alpha: 0.25)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  SizedBox(
                    width: 56,
                    child: Text(
                      '$ply / $total',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Slider(
                      value: ply.toDouble(),
                      min: 0,
                      max: total > 0 ? total.toDouble() : 1,
                      divisions: total > 0 ? total : 1,
                      onChanged: total > 0
                          ? (val) {
                              controller.pause();
                              controller.seekTo(val.round());
                            }
                          : null,
                    ),
                  ),
                ],
              ),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 4,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'First move',
                        onPressed: ply > 0 ? controller.first : null,
                        icon: const Icon(Icons.first_page_rounded),
                      ),
                      IconButton(
                        tooltip: 'Previous move',
                        onPressed: ply > 0 ? controller.previous : null,
                        icon: const Icon(Icons.chevron_left_rounded),
                      ),
                      FilledButton.icon(
                        onPressed: total > 0 ? controller.togglePlayPause : null,
                        icon: Icon(
                          controller.isPlaying
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                        ),
                        label: Text(
                          controller.isPlaying
                              ? 'Pause'
                              : (ply >= total ? 'Replay' : 'Play'),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Next move',
                        onPressed: ply < total ? controller.next : null,
                        icon: const Icon(Icons.chevron_right_rounded),
                      ),
                      IconButton(
                        tooltip: 'Last move',
                        onPressed: ply < total ? controller.last : null,
                        icon: const Icon(Icons.last_page_rounded),
                      ),
                      IconButton(
                        tooltip: 'Restart from beginning',
                        onPressed: total > 0 ? controller.restart : null,
                        icon: const Icon(Icons.replay_rounded),
                      ),
                    ],
                  ),
                  SegmentedButton<double>(
                    segments: const [
                      ButtonSegment(value: 0.5, label: Text('0.5×')),
                      ButtonSegment(value: 1.0, label: Text('1×')),
                      ButtonSegment(value: 2.0, label: Text('2×')),
                      ButtonSegment(value: 4.0, label: Text('4×')),
                    ],
                    selected: {controller.speed},
                    onSelectionChanged: (set) =>
                        controller.setSpeed(set.first),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
