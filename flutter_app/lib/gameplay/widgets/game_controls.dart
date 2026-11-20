import 'package:flutter/material.dart';

class GameControlsBar extends StatelessWidget {
  const GameControlsBar({
    super.key,
    required this.canUndo,
    required this.isPaused,
    required this.onUndo,
    required this.onTogglePause,
    required this.onRestart,
    required this.onResign,
    this.showHint = false,
    this.hintLoading = false,
    this.onHint,
    this.largerControls = false,
  });

  final bool canUndo;
  final bool isPaused;
  final VoidCallback onUndo;
  final VoidCallback onTogglePause;
  final VoidCallback onRestart;
  final VoidCallback onResign;
  final bool showHint;
  final bool hintLoading;
  final VoidCallback? onHint;
  final bool largerControls;

  @override
  Widget build(BuildContext context) {
    final iconSize = largerControls ? 22.0 : 18.0;
    final fontSize = largerControls ? 13.5 : 12.0;

    return Wrap(
      alignment: WrapAlignment.spaceEvenly,
      spacing: 4,
      children: [
        _ControlBtn(
          icon: Icons.undo_rounded,
          label: 'Undo',
          iconSize: iconSize,
          fontSize: fontSize,
          onPressed: canUndo ? onUndo : null,
        ),
        if (showHint)
          _ControlBtn(
            icon: Icons.lightbulb_outline_rounded,
            label: hintLoading ? '...' : 'Hint',
            iconSize: iconSize,
            fontSize: fontSize,
            color: const Color(0xFF10B981),
            onPressed: hintLoading ? null : onHint,
          ),
        _ControlBtn(
          icon: isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
          label: isPaused ? 'Resume' : 'Pause',
          iconSize: iconSize,
          fontSize: fontSize,
          onPressed: onTogglePause,
        ),
        _ControlBtn(
          icon: Icons.refresh_rounded,
          label: 'Restart',
          iconSize: iconSize,
          fontSize: fontSize,
          onPressed: onRestart,
        ),
        _ControlBtn(
          icon: Icons.flag_rounded,
          label: 'Resign',
          iconSize: iconSize,
          fontSize: fontSize,
          onPressed: onResign,
          color: const Color(0xFFF43F5E),
        ),
      ],
    );
  }
}

class _ControlBtn extends StatelessWidget {
  const _ControlBtn({
    required this.icon,
    required this.label,
    required this.onPressed,
    required this.iconSize,
    required this.fontSize,
    this.color,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final double iconSize;
  final double fontSize;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        padding: EdgeInsets.symmetric(
          horizontal: iconSize > 20 ? 12 : 8,
          vertical: iconSize > 20 ? 10 : 6,
        ),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      icon: Icon(icon, size: iconSize, color: color),
      label: Text(
        label,
        style: TextStyle(fontSize: fontSize, color: color),
      ),
    );
  }
}
