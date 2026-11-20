import '../gameplay/engine/draughts_engine.dart';
import '../gameplay/models/game_status.dart';

class ReplaySession {
  const ReplaySession({
    required this.id,
    required this.title,
    required this.whiteName,
    required this.blackName,
    required this.finalState,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String whiteName;
  final String blackName;
  final GameState finalState;
  final DateTime createdAt;

  int get totalPlies => finalState.history.length;

  String get winnerLabel {
    switch (finalState.status) {
      case GameStatus.whiteWon:
        return '$whiteName Wins!';
      case GameStatus.blackWon:
        return '$blackName Wins!';
      case GameStatus.draw:
        return 'Match Drawn';
      case GameStatus.playing:
        return 'In Progress';
    }
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'whiteName': whiteName,
        'blackName': blackName,
        'finalState': finalState.toJson(),
        'createdAt': createdAt.toIso8601String(),
      };

  factory ReplaySession.fromJson(Map<String, dynamic> json) => ReplaySession(
        id: json['id'] as String? ?? 'match_unknown',
        title: json['title'] as String? ?? 'Draft Master Match',
        whiteName: json['whiteName'] as String? ?? 'White',
        blackName: json['blackName'] as String? ?? 'Black',
        finalState: GameState.fromJson(
          json['finalState'] as Map<String, dynamic>? ?? const {},
        ),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );
}
