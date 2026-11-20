import 'piece_model.dart';

enum VariantPreset {
  draftMaster8x8,
  english8x8,
  international10x10,
  custom;

  String get id {
    switch (this) {
      case VariantPreset.draftMaster8x8:
        return 'draft_master_8x8';
      case VariantPreset.english8x8:
        return 'english_8x8';
      case VariantPreset.international10x10:
        return 'international_10x10';
      case VariantPreset.custom:
        return 'custom';
    }
  }

  static VariantPreset fromId(String id) {
    switch (id) {
      case 'english_8x8':
        return VariantPreset.english8x8;
      case 'international_10x10':
        return VariantPreset.international10x10;
      case 'custom':
        return VariantPreset.custom;
      default:
        return VariantPreset.draftMaster8x8;
    }
  }
}

enum PromotionMode { immediateStop, endOfTurnOnly }

class RuleConfig {
  const RuleConfig({
    required this.preset,
    required this.name,
    required this.boardSize,
    required this.startingRows,
    required this.firstPlayer,
    required this.menCaptureBackward,
    required this.flyingKings,
    required this.mandatoryCapture,
    required this.maximumCapture,
    required this.multipleCaptures,
    required this.promotionMode,
    required this.drawNoProgressMoves,
  });

  final VariantPreset preset;
  final String name;
  final int boardSize;
  final int startingRows;
  final PlayerSide firstPlayer;
  final bool menCaptureBackward;
  final bool flyingKings;
  final bool mandatoryCapture;
  final bool maximumCapture;
  final bool multipleCaptures;
  final PromotionMode promotionMode;
  final int drawNoProgressMoves;

  /// Default 8x8 Draft Master ruleset with Flying Kings enabled.
  static const RuleConfig draftMaster8x8 = RuleConfig(
    preset: VariantPreset.draftMaster8x8,
    name: 'Draft Master 8×8 (Flying Kings)',
    boardSize: 8,
    startingRows: 3,
    firstPlayer: PlayerSide.black,
    menCaptureBackward: false,
    flyingKings: true,
    mandatoryCapture: true,
    maximumCapture: false,
    multipleCaptures: true,
    promotionMode: PromotionMode.immediateStop,
    drawNoProgressMoves: 80,
  );

  static const RuleConfig english8x8 = RuleConfig(
    preset: VariantPreset.english8x8,
    name: 'English Draughts (8×8 Classic)',
    boardSize: 8,
    startingRows: 3,
    firstPlayer: PlayerSide.black,
    menCaptureBackward: false,
    flyingKings: false,
    mandatoryCapture: true,
    maximumCapture: false,
    multipleCaptures: true,
    promotionMode: PromotionMode.immediateStop,
    drawNoProgressMoves: 80,
  );

  static const RuleConfig international10x10 = RuleConfig(
    preset: VariantPreset.international10x10,
    name: 'International Draughts (10×10)',
    boardSize: 10,
    startingRows: 4,
    firstPlayer: PlayerSide.white,
    menCaptureBackward: true,
    flyingKings: true,
    mandatoryCapture: true,
    maximumCapture: true,
    multipleCaptures: true,
    promotionMode: PromotionMode.endOfTurnOnly,
    drawNoProgressMoves: 50,
  );

  RuleConfig copyWith({
    VariantPreset? preset,
    String? name,
    int? boardSize,
    int? startingRows,
    PlayerSide? firstPlayer,
    bool? menCaptureBackward,
    bool? flyingKings,
    bool? mandatoryCapture,
    bool? maximumCapture,
    bool? multipleCaptures,
    PromotionMode? promotionMode,
    int? drawNoProgressMoves,
  }) {
    return RuleConfig(
      preset: preset ?? this.preset,
      name: name ?? this.name,
      boardSize: boardSize ?? this.boardSize,
      startingRows: startingRows ?? this.startingRows,
      firstPlayer: firstPlayer ?? this.firstPlayer,
      menCaptureBackward: menCaptureBackward ?? this.menCaptureBackward,
      flyingKings: flyingKings ?? this.flyingKings,
      mandatoryCapture: mandatoryCapture ?? this.mandatoryCapture,
      maximumCapture: maximumCapture ?? this.maximumCapture,
      multipleCaptures: multipleCaptures ?? this.multipleCaptures,
      promotionMode: promotionMode ?? this.promotionMode,
      drawNoProgressMoves: drawNoProgressMoves ?? this.drawNoProgressMoves,
    );
  }

  Map<String, dynamic> toJson() => {
        'preset': preset.id,
        'name': name,
        'boardSize': boardSize,
        'startingRows': startingRows,
        'firstPlayer': firstPlayer.code,
        'menCaptureBackward': menCaptureBackward,
        'flyingKings': flyingKings,
        'mandatoryCapture': mandatoryCapture,
        'maximumCapture': maximumCapture,
        'multipleCaptures': multipleCaptures,
        'promotionMode': promotionMode == PromotionMode.endOfTurnOnly
            ? 'end_of_turn_only'
            : 'immediate_stop',
        'drawNoProgressMoves': drawNoProgressMoves,
      };

  factory RuleConfig.fromJson(Map<String, dynamic> json) => RuleConfig(
        preset: VariantPreset.fromId(json['preset'] as String? ?? 'draft_master_8x8'),
        name: json['name'] as String? ?? 'Draft Master 8×8 (Flying Kings)',
        boardSize: json['boardSize'] as int? ?? 8,
        startingRows: json['startingRows'] as int? ?? 3,
        firstPlayer: PlayerSide.fromCode(json['firstPlayer'] as String? ?? 'black'),
        menCaptureBackward: json['menCaptureBackward'] as bool? ?? false,
        flyingKings: json['flyingKings'] as bool? ?? true,
        mandatoryCapture: json['mandatoryCapture'] as bool? ?? true,
        maximumCapture: json['maximumCapture'] as bool? ?? false,
        multipleCaptures: json['multipleCaptures'] as bool? ?? true,
        promotionMode: json['promotionMode'] == 'end_of_turn_only'
            ? PromotionMode.endOfTurnOnly
            : PromotionMode.immediateStop,
        drawNoProgressMoves: json['drawNoProgressMoves'] as int? ?? 80,
      );
}
