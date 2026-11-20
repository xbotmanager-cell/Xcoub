class BoardCoord {
  const BoardCoord(this.row, this.col);

  final int row;
  final int col;

  Map<String, dynamic> toJson() => {'row': row, 'col': col};

  factory BoardCoord.fromJson(Map<String, dynamic> json) =>
      BoardCoord(json['row'] as int, json['col'] as int);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BoardCoord && row == other.row && col == other.col;

  @override
  int get hashCode => Object.hash(row, col);

  @override
  String toString() => '($row,$col)';
}
