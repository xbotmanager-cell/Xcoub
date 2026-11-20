import 'package:flutter/material.dart';

class MoveHighlighter extends StatelessWidget {
  const MoveHighlighter({
    super.key,
    required this.isCapture,
  });

  final bool isCapture;

  @override
  Widget build(BuildContext context) {
    if (isCapture) {
      return Center(
        child: Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFFF59E0B).withValues(alpha: 0.22),
            border: Border.all(
              color: const Color(0xFFF59E0B),
              width: 3,
            ),
          ),
        ),
      );
    }

    return Center(
      child: Container(
        width: 14,
        height: 14,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF10B981).withValues(alpha: 0.85),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF10B981).withValues(alpha: 0.35),
              blurRadius: 6,
            ),
          ],
        ),
      ),
    );
  }
}
