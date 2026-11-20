import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../models/piece_model.dart';

class DraughtsPieceWidget extends StatelessWidget {
  const DraughtsPieceWidget({
    super.key,
    required this.piece,
    this.pieceThemeId = 'ivory_obsidian',
    this.highContrast = false,
    this.isSelected = false,
    this.justPromoted = false,
    this.reducedMotion = false,
  });

  final DraughtsPiece piece;
  final String pieceThemeId;
  final bool highContrast;
  final bool isSelected;
  final bool justPromoted;
  final bool reducedMotion;

  @override
  Widget build(BuildContext context) {
    final isWhite = piece.side == PlayerSide.white;
    final theme = AppTheme.pieceThemeById(
      pieceThemeId,
      highContrast: highContrast,
    );

    final topColor = isWhite ? theme.whiteTop : theme.blackTop;
    final bottomColor = isWhite ? theme.whiteBottom : theme.blackBottom;
    final borderColor = isSelected
        ? const Color(0xFFF59E0B)
        : (isWhite ? theme.whiteBorder : theme.blackBorder);
    final crownColor = isWhite ? theme.whiteCrown : theme.blackCrown;

    return AnimatedScale(
      scale: isSelected ? 1.09 : 1.0,
      duration: Duration(milliseconds: reducedMotion ? 0 : 140),
      curve: Curves.easeOutBack,
      child: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            center: const Alignment(-0.3, -0.35),
            radius: 0.9,
            colors: [topColor, bottomColor],
          ),
          border: Border.all(
            color: borderColor,
            width: isSelected ? 2.8 : (highContrast ? 2.4 : 1.8),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.48),
              blurRadius: 6,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: crownColor.withValues(alpha: 0.36),
                width: 1.3,
              ),
            ),
            child: piece.isKing
                ? TweenAnimationBuilder<double>(
                    tween: Tween(
                      begin: (justPromoted && !reducedMotion) ? 0.45 : 1.0,
                      end: 1.0,
                    ),
                    duration: Duration(milliseconds: reducedMotion ? 0 : 340),
                    curve: Curves.elasticOut,
                    builder: (context, scale, child) =>
                        Transform.scale(scale: scale, child: child),
                    child: Center(
                      child: Icon(
                        Icons.workspace_premium_rounded,
                        size: 20,
                        color: crownColor,
                      ),
                    ),
                  )
                : null,
          ),
        ),
      ),
    );
  }
}
