import 'package:flutter/material.dart';

import '../../core/widgets/draft_master_logo.dart';

class StartupLoadStep {
  const StartupLoadStep({
    required this.label,
    required this.progress,
  });

  final String label;
  final double progress;
}

class LoadingScreen extends StatefulWidget {
  const LoadingScreen({
    super.key,
    required this.step,
    this.errorMessage,
    this.onRetry,
  });

  final StartupLoadStep step;
  final String? errorMessage;
  final VoidCallback? onRetry;

  @override
  State<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<LoadingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorMessage != null;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F17),
      body: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _BackdropBoardGridPainter(),
            ),
          ),
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedBuilder(
                        animation: _pulseCtrl,
                        builder: (context, child) {
                          final glow = 0.22 + _pulseCtrl.value * 0.25;
                          final scale = 0.98 + _pulseCtrl.value * 0.05;
                          return Transform.scale(
                            scale: scale,
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFF59E0B)
                                        .withValues(alpha: glow),
                                    blurRadius: 36,
                                    spreadRadius: 4,
                                  ),
                                ],
                              ),
                              child: child,
                            ),
                          );
                        },
                        child: const DraftMasterLogo(size: 112),
                      ),
                      const SizedBox(height: 22),
                      const Text(
                        'DRAFT MASTER',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 3.2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'THINK AHEAD. PLAY SMART. RULE THE BOARD.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFFF59E0B),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 40),
                      if (hasError) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF43F5E).withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: const Color(0xFFF43F5E).withValues(alpha: 0.5),
                            ),
                          ),
                          child: Column(
                            children: [
                              const Icon(
                                Icons.warning_amber_rounded,
                                color: Color(0xFFF43F5E),
                                size: 30,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                widget.errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 14),
                              FilledButton.icon(
                                onPressed: widget.onRetry,
                                icon: const Icon(Icons.refresh_rounded),
                                label: const Text('Retry Initialization'),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: TweenAnimationBuilder<double>(
                            tween: Tween<double>(end: widget.step.progress),
                            duration: const Duration(milliseconds: 220),
                            builder: (context, value, _) =>
                                LinearProgressIndicator(
                              value: value,
                              minHeight: 7,
                              backgroundColor: const Color(0xFF1E293B),
                              valueColor: const AlwaysStoppedAnimation<Color>(
                                Color(0xFFF59E0B),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          widget.step.label,
                          style: const TextStyle(
                            color: Color(0xFF94A3B8),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BackdropBoardGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()
      ..shader = const RadialGradient(
        center: Alignment(0, -0.2),
        radius: 1.0,
        colors: [Color(0xFF172033), Color(0xFF0B0F17)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bg);

    final tilePaint = Paint()
      ..color = const Color(0xFFF59E0B).withValues(alpha: 0.03);
    const cols = 8;
    final cell = size.width / cols;
    final rows = (size.height / cell).ceil();
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        if ((r + c) % 2 == 1) {
          canvas.drawRect(Rect.fromLTWH(c * cell, r * cell, cell, cell), tilePaint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
