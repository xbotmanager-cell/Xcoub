import 'package:flutter/material.dart';

import '../gameplay/models/game_status.dart';
import '../replay/replay_screen.dart';
import '../replay/replay_session.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.savedReplays,
    required this.paletteId,
    this.playerName = 'Tactician',
  });

  final List<ReplaySession> savedReplays;
  final String paletteId;
  final String playerName;

  @override
  Widget build(BuildContext context) {
    final total = savedReplays.length;
    final wins = savedReplays
        .where((s) =>
            s.finalState.status == GameStatus.blackWon ||
            s.finalState.status == GameStatus.whiteWon)
        .length;

    return SafeArea(
      top: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const CircleAvatar(
                      radius: 26,
                      backgroundColor: Color(0xFFD97706),
                      child: Icon(Icons.person_rounded, color: Colors.white),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            playerName,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '$total Recorded Matches · $wins Decisive Results',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Match Replay Vault',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 8),
              if (savedReplays.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No saved matches yet. Completed games appear here automatically.',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                )
              else
                ...savedReplays.map(
                  (s) => Card(
                    child: ListTile(
                      leading: const Icon(
                        Icons.history_rounded,
                        color: Color(0xFFF59E0B),
                      ),
                      title: Text(s.title, style: const TextStyle(fontSize: 13)),
                      subtitle: Text('${s.totalPlies} moves · ${s.winnerLabel}'),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                ReplayScreen(session: s, paletteId: paletteId),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
