import 'package:flutter/material.dart';

import '../../replay/replay_session.dart';
import '../../replay/replay_screen.dart';
import '../../video_export/video_share_sheet.dart';
import '../engine/draughts_engine.dart';
import '../models/game_status.dart';

class GameResultScreen extends StatelessWidget {
  const GameResultScreen({
    super.key,
    required this.finalState,
    required this.whiteName,
    required this.blackName,
    required this.replaySession,
    required this.onPlayAgain,
  });

  final GameState finalState;
  final String whiteName;
  final String blackName;
  final ReplaySession replaySession;
  final VoidCallback onPlayAgain;

  @override
  Widget build(BuildContext context) {
    final headline = switch (finalState.status) {
      GameStatus.whiteWon => '$whiteName Wins!',
      GameStatus.blackWon => '$blackName Wins!',
      GameStatus.draw => 'Match Drawn',
      GameStatus.playing => 'Match Concluded',
    };

    return Scaffold(
      appBar: AppBar(title: const Text('Match Complete')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD97706).withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.emoji_events_rounded,
                    color: Color(0xFFF59E0B),
                    size: 38,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  headline,
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  '${finalState.rules.name} · ${finalState.moveCount} moves',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey,
                      ),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.of(context).pop();
                      onPlayAgain();
                    },
                    icon: const Icon(Icons.replay_rounded),
                    label: const Text('Play Again'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute(
                          builder: (_) => ReplayScreen(session: replaySession),
                        ),
                      );
                    },
                    icon: const Icon(Icons.history_rounded),
                    label: const Text('Watch Match Replay'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      showModalBottomSheet<void>(
                        context: context,
                        isScrollControlled: true,
                        builder: (_) => VideoShareSheet(session: replaySession),
                      );
                    },
                    icon: const Icon(Icons.movie_creation_outlined),
                    label: const Text('Share Match as Video'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
