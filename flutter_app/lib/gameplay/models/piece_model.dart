enum PlayerSide {
  white,
  black;

  PlayerSide get opponent =>
      this == PlayerSide.white ? PlayerSide.black : PlayerSide.white;

  String get code => this == PlayerSide.white ? 'white' : 'black';

  static PlayerSide fromCode(String code) =>
      code == 'black' ? PlayerSide.black : PlayerSide.white;
}

enum PieceType { man, king }

class DraughtsPiece {
  const DraughtsPiece({required this.side, required this.type});

  final PlayerSide side;
  final PieceType type;

  bool get isKing => type == PieceType.king;

  DraughtsPiece promote() => DraughtsPiece(side: side, type: PieceType.king);

  String get charCode {
    if (side == PlayerSide.white) {
      return isKing ? 'W' : 'w';
    }
    return isKing ? 'B' : 'b';
  }

  static DraughtsPiece? fromChar(String ch) {
    switch (ch) {
      case 'w':
        return const DraughtsPiece(side: PlayerSide.white, type: PieceType.man);
      case 'W':
        return const DraughtsPiece(
            side: PlayerSide.white, type: PieceType.king);
      case 'b':
        return const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);
      case 'B':
        return const DraughtsPiece(
            side: PlayerSide.black, type: PieceType.king);
      default:
        return null;
    }
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DraughtsPiece && side == other.side && type == other.type;

  @override
  int get hashCode => Object.hash(side, type);
}
