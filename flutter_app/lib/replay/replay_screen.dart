import 'package:flutter/material.dart';

import '../gameplay/widgets/draughts_board.dart';
import '../video_export/video_share_sheet.dart';
import 'replay_controller.dart';
import 'replay_controls_bar.dart';
import 'replay_session.dart';

class ReplayScreen extends StatefulWidget {
  const ReplayScreen({
    super.key,
    required this.session,
    this.paletteId = 'walnut',
  });

  final ReplaySession session;
  final String paletteId;

  @override
  State<ReplayScreen> createState() => _ReplayScreenState();
}

class _ReplayScreenState extends State<ReplayScreen> {
  late final ReplayController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ReplayController(widget.session);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.session.title,
          style: const TextStyle(fontSize: 15),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: 'Share Match as Video',
            icon: const Icon(Icons.movie_creation_outlined),
            onPressed: () {
              _controller.pause();
              showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => VideoShareSheet(
                  session: widget.session,
                  paletteId: widget.paletteId,
                ),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: ListenableBuilder(
                listenable: _controller,
                builder: (context, _) {
                  final st = _controller.currentState;
                  return Column(
                    children: [
                      Expanded(
                        child: Center(
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              final dim = constraints.biggest.shortestSide;
                              return SizedBox(
                                width: dim,
                                height: dim,
                                child: DraughtsBoardWidget(
                                  state: st,
                                  legalMoves: const [],
                                  interactive: false,
                                  paletteId: widget.paletteId,
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      ReplayControlsBar(controller: _controller),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 44,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: widget.session.finalState.history.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 6),
                          itemBuilder: (context, idx) {
                            final rec = widget.session.finalState.history[idx];
                            final active = _controller.plyIndex == idx + 1;
                            return ChoiceChip(
                              selected: active,
                              label: Text(
                                '#${rec.ply} ${rec.move.notation}',
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                ),
                              ),
                              onSelected: (_) {
                                _controller.pause();
                                _controller.seekTo(idx + 1);
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}
