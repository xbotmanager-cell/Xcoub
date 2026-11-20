import '../models/board_coord.dart';
import '../models/piece_model.dart';
import '../models/rule_config.dart';

class PieceCounts {
  const PieceCounts({
    required this.whiteMen,
    required this.whiteKings,
    required this.blackMen,
    required this.blackKings,
  });

  final int whiteMen;
  final int whiteKings;
  final int blackMen;
  final int blackKings;

  int get whiteTotal => whiteMen + whiteKings;
  int get blackTotal => blackMen + blackKings;
}

class BoardState {
  BoardState(this.size, this.grid);

  final int size;
  final List<List<DraughtsPiece?>> grid;

  bool inBounds(int row, int col) =>
      row >= 0 && row < size && col >= 0 && col < size;

  bool isPlayableSquare(int row, int col) =>
      inBounds(row, col) && (row + col) % 2 == 1;

  DraughtsPiece? pieceAt(int row, int col) =>
      inBounds(row, col) ? grid[row][col] : null;

  BoardState clone() => BoardState(
        size,
        List<List<DraughtsPiece?>>.generate(
          size,
          (r) => List<DraughtsPiece?>.from(grid[r]),
        ),
      );

  int coordToSquareNumber(BoardCoord coord) {
    final rowIndex = coord.row;
    final colHalf = coord.col ~/ 2;
    return rowIndex * (size ~/ 2) + colHalf + 1;
  }

  String compress() {
    final buf = StringBuffer('$size:');
    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        if ((r + c) % 2 == 1) {
          final p = grid[r][c];
          buf.write(p == null ? '.' : p.charCode);
        }
      }
    }
    return buf.toString();
  }

  static BoardState decompress(String compressed) {
    final parts = compressed.split(':');
    final size = int.tryParse(parts[0]) == 10 ? 10 : 8;
    final data = parts.length > 1 ? parts[1] : '';
    final grid = List<List<DraughtsPiece?>>.generate(
      size,
      (_) => List<DraughtsPiece?>.filled(size, null),
    );
    int idx = 0;
    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        if ((r + c) % 2 == 1 && idx < data.length) {
          grid[r][c] = DraughtsPiece.fromChar(data[idx++]);
        }
      }
    }
    return BoardState(size, grid);
  }

  static BoardState empty(int size) => BoardState(
        size,
        List<List<DraughtsPiece?>>.generate(
          size,
          (_) => List<DraughtsPiece?>.filled(size, null),
        ),
      );

  static BoardState initial(RuleConfig rules) {
    final size = rules.boardSize;
    final rows = rules.startingRows;
    final board = BoardState.empty(size);
    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        if ((r + c) % 2 != 1) continue;
        if (r < rows) {
          board.grid[r][c] =
              const DraughtsPiece(side: PlayerSide.black, type: PieceType.man);
        } else if (r >= size - rows) {
          board.grid[r][c] =
              const DraughtsPiece(side: PlayerSide.white, type: PieceType.man);
        }
      }
    }
    return board;
  }

  PieceCounts countPieces() {
    int wm = 0, wk = 0, bm = 0, bk = 0;
    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        final p = grid[r][c];
        if (p == null) continue;
        if (p.side == PlayerSide.white) {
          if (p.isKing) {
            wk++;
          } else {
            wm++;
          }
        } else {
          if (p.isKing) {
            bk++;
          } else {
            bm++;
          }
        }
      }
    }
    return PieceCounts(
      whiteMen: wm,
      whiteKings: wk,
      blackMen: bm,
      blackKings: bk,
    );
  }
}
