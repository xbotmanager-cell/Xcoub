import 'package:flutter/material.dart';

/// Custom-painted DRAFT MASTER Crowned Flying King emblem matching the Android
/// launcher icon, web favicon, splash branding, and video export badge.
class DraftMasterLogo extends StatelessWidget {
  const DraftMasterLogo({
    super.key,
    this.size = 44,
    this.showRays = true,
  });

  final double size;
  final bool showRays;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _DraftMasterEmblemPainter(showRays: showRays),
      ),
    );
  }
}

class _DraftMasterEmblemPainter extends CustomPainter {
  const _DraftMasterEmblemPainter({required this.showRays});

  final bool showRays;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width * 0.42;

    if (showRays) {
      final rayPaint = Paint()
        ..color = const Color(0xFFD97706).withValues(alpha: 0.65)
        ..strokeWidth = size.width * 0.065
        ..strokeCap = StrokeCap.square;
      final dOut = size.width * 0.43;
      canvas.drawLine(c + Offset(-dOut, -dOut), c + Offset(dOut, dOut), rayPaint);
      canvas.drawLine(c + Offset(dOut, -dOut), c + Offset(-dOut, dOut), rayPaint);
    }

    // Outer bronze-gold disc rim
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFBBF24), Color(0xFFB45309)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    // Dark machined inner groove
    canvas.drawCircle(c, r * 0.85, Paint()..color = const Color(0xFF131A26));

    // Inner amber ring
    canvas.drawCircle(
      c,
      r * 0.74,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * 0.036
        ..color = const Color(0xFFF59E0B),
    );

    // Inner sapphire-obsidian core
    canvas.drawCircle(c, r * 0.67, Paint()..color = const Color(0xFF0B0F17));

    // 3-point Sovereign Crown
    final crown = Path()
      ..moveTo(c.dx - r * 0.36, c.dy + r * 0.22)
      ..lineTo(c.dx - r * 0.42, c.dy - r * 0.16)
      ..lineTo(c.dx - r * 0.18, c.dy + r * 0.02)
      ..lineTo(c.dx, c.dy - r * 0.34)
      ..lineTo(c.dx + r * 0.18, c.dy + r * 0.02)
      ..lineTo(c.dx + r * 0.42, c.dy - r * 0.16)
      ..lineTo(c.dx + r * 0.36, c.dy + r * 0.22)
      ..close();

    canvas.drawPath(
      crown,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFCD34D), Color(0xFFD97706)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    // Crown base bar
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(c.dx, c.dy + r * 0.31),
          width: r * 0.74,
          height: r * 0.10,
        ),
        const Radius.circular(2),
      ),
      Paint()..color = const Color(0xFFF59E0B),
    );

    // Jewel tips
    final jewelPaint = Paint()..color = const Color(0xFFFEF3C7);
    final jr = size.width * 0.028;
    canvas.drawCircle(Offset(c.dx - r * 0.42, c.dy - r * 0.18), jr, jewelPaint);
    canvas.drawCircle(Offset(c.dx, c.dy - r * 0.36), jr, jewelPaint);
    canvas.drawCircle(Offset(c.dx + r * 0.42, c.dy - r * 0.18), jr, jewelPaint);
  }

  @override
  bool shouldRepaint(covariant _DraftMasterEmblemPainter old) =>
      old.showRays != showRays;
}
