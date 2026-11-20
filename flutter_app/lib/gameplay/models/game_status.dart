enum GameStatus {
  playing,
  whiteWon,
  blackWon,
  draw;

  String get label {
    switch (this) {
      case GameStatus.playing:
        return 'In Progress';
      case GameStatus.whiteWon:
        return 'White Wins';
      case GameStatus.blackWon:
        return 'Black Wins';
      case GameStatus.draw:
        return 'Draw';
    }
  }
}

enum EndReason {
  noMoves,
  noPieces,
  repetition,
  noProgress,
  resignation,
  timeout,
  agreement,
}
