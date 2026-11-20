import 'board_coord.dart';
import 'piece_model.dart';

class DraughtsMove {
  const DraughtsMove({
    required this.from,
    required this.to,
    required this.path,
    required this.captured,
    required this.promoted,
    required this.notation,
  });

  final BoardCoord from;
  final BoardCoord to;
  final List<BoardCoord> path;
  final List<BoardCoord> captured;
  final bool promoted;
  final String notation;

  bool get isCapture => captured.isNotEmpty;

  Map<String, dynamic> toJson() => {
        'from': from.toJson(),
        'to': to.toJson(),
        'path': path.map((c) => c.toJson()).toList(),
        'captured': captured.map((c) => c.toJson()).toList(),
        'promoted': promoted,
        'notation': notation,
      };

  factory DraughtsMove.fromJson(Map<String, dynamic> json) => DraughtsMove(
        from: BoardCoord.fromJson(json['from'] as Map<String, dynamic>),
        to: BoardCoord.fromJson(json['to'] as Map<String, dynamic>),
        path: (json['path'] as List<dynamic>)
            .map((e) => BoardCoord.fromJson(e as Map<String, dynamic>))
            .toList(),
        captured: (json['captured'] as List<dynamic>)
            .map((e) => BoardCoord.fromJson(e as Map<String, dynamic>))
            .toList(),
        promoted: json['promoted'] as bool? ?? false,
        notation: json['notation'] as String? ?? '',
      );
}

class MoveRecord {
  const MoveRecord({
    required this.ply,
    required this.side,
    required this.move,
    required this.boardAfterCompressed,
  });

  final int ply;
  final PlayerSide side;
  final DraughtsMove move;
  final String boardAfterCompressed;

  Map<String, dynamic> toJson() => {
        'ply': ply,
        'side': side.code,
        'move': move.toJson(),
        'boardAfterCompressed': boardAfterCompressed,
      };

  factory MoveRecord.fromJson(Map<String, dynamic> json) => MoveRecord(
        ply: json['ply'] as int,
        side: PlayerSide.fromCode(json['side'] as String),
        move: DraughtsMove.fromJson(json['move'] as Map<String, dynamic>),
        boardAfterCompressed: json['boardAfterCompressed'] as String,
      );
}
