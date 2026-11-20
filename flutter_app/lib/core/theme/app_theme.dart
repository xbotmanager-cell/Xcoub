import 'package:flutter/material.dart';

class BoardColorPalette {
  const BoardColorPalette({
    required this.id,
    required this.name,
    required this.lightSquare,
    required this.darkSquare,
    required this.frame,
  });

  final String id;
  final String name;
  final Color lightSquare;
  final Color darkSquare;
  final Color frame;
}

class PieceThemePreset {
  const PieceThemePreset({
    required this.id,
    required this.name,
    required this.whiteTop,
    required this.whiteBottom,
    required this.whiteBorder,
    required this.whiteCrown,
    required this.blackTop,
    required this.blackBottom,
    required this.blackBorder,
    required this.blackCrown,
  });

  final String id;
  final String name;
  final Color whiteTop;
  final Color whiteBottom;
  final Color whiteBorder;
  final Color whiteCrown;
  final Color blackTop;
  final Color blackBottom;
  final Color blackBorder;
  final Color blackCrown;
}

class AppTheme {
  static const Color bgDark = Color(0xFF0B0F17);
  static const Color surfaceDark = Color(0xFF131A26);
  static const Color surfaceAltDark = Color(0xFF1A2333);
  static const Color accentAmber = Color(0xFFD97706);
  static const Color highlightAmber = Color(0xFFF59E0B);
  static const Color legalEmerald = Color(0xFF10B981);

  static const List<BoardColorPalette> boardPalettes = [
    BoardColorPalette(
      id: 'walnut',
      name: 'Tournament Walnut',
      lightSquare: Color(0xFFE7D5B8),
      darkSquare: Color(0xFF5C3D28),
      frame: Color(0xFF2B1B12),
    ),
    BoardColorPalette(
      id: 'slate',
      name: 'Midnight Slate',
      lightSquare: Color(0xFFCBD5E1),
      darkSquare: Color(0xFF1E293B),
      frame: Color(0xFF0F172A),
    ),
    BoardColorPalette(
      id: 'emerald',
      name: 'Club Felt Emerald',
      lightSquare: Color(0xFFD1FAE5),
      darkSquare: Color(0xFF0F5132),
      frame: Color(0xFF062C1B),
    ),
    BoardColorPalette(
      id: 'obsidian_brass',
      name: 'Obsidian & Brass',
      lightSquare: Color(0xFFD4CFC7),
      darkSquare: Color(0xFF27272A),
      frame: Color(0xFF18181B),
    ),
    BoardColorPalette(
      id: 'high_contrast',
      name: 'High Contrast',
      lightSquare: Color(0xFFFFFFFF),
      darkSquare: Color(0xFF0F172A),
      frame: Color(0xFF000000),
    ),
  ];

  static const List<PieceThemePreset> pieceThemes = [
    PieceThemePreset(
      id: 'ivory_obsidian',
      name: 'Ivory & Obsidian',
      whiteTop: Color(0xFFFFFDF9),
      whiteBottom: Color(0xFFD5C6AC),
      whiteBorder: Color(0xFFA89475),
      whiteCrown: Color(0xFF9A3412),
      blackTop: Color(0xFF3E4656),
      blackBottom: Color(0xFF10141D),
      blackBorder: Color(0xFF4F586B),
      blackCrown: Color(0xFFF59E0B),
    ),
    PieceThemePreset(
      id: 'imperial_gold',
      name: 'Imperial Gold & Onyx',
      whiteTop: Color(0xFFFEF3C7),
      whiteBottom: Color(0xFFD97706),
      whiteBorder: Color(0xFF92400E),
      whiteCrown: Color(0xFF451A03),
      blackTop: Color(0xFF27272A),
      blackBottom: Color(0xFF09090B),
      blackBorder: Color(0xFFD97706),
      blackCrown: Color(0xFFFBBF24),
    ),
    PieceThemePreset(
      id: 'tournament_crimson',
      name: 'Crimson & Pearl',
      whiteTop: Color(0xFFF8FAFC),
      whiteBottom: Color(0xFFCBD5E1),
      whiteBorder: Color(0xFF64748B),
      whiteCrown: Color(0xFF0F172A),
      blackTop: Color(0xFFE11D48),
      blackBottom: Color(0xFF881337),
      blackBorder: Color(0xFFFB7185),
      blackCrown: Color(0xFFFEF08A),
    ),
    PieceThemePreset(
      id: 'high_contrast_tactile',
      name: 'Tactile Contrast',
      whiteTop: Color(0xFFFFFFFF),
      whiteBottom: Color(0xFFE2E8F0),
      whiteBorder: Color(0xFF0F172A),
      whiteCrown: Color(0xFFB45309),
      blackTop: Color(0xFF1E293B),
      blackBottom: Color(0xFF020617),
      blackBorder: Color(0xFFF59E0B),
      blackCrown: Color(0xFFFDE047),
    ),
  ];

  static BoardColorPalette paletteById(String id, {bool highContrast = false}) {
    if (highContrast) {
      return boardPalettes.last;
    }
    return boardPalettes.firstWhere(
      (p) => p.id == id,
      orElse: () => boardPalettes.first,
    );
  }

  static PieceThemePreset pieceThemeById(
    String id, {
    bool highContrast = false,
  }) {
    if (highContrast) {
      return pieceThemes.last;
    }
    return pieceThemes.firstWhere(
      (p) => p.id == id,
      orElse: () => pieceThemes.first,
    );
  }

  static ThemeData darkTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgDark,
      colorScheme: const ColorScheme.dark(
        primary: accentAmber,
        secondary: highlightAmber,
        surface: surfaceDark,
        onPrimary: Colors.white,
        onSurface: Color(0xFFF1F5F9),
      ),
      cardColor: surfaceDark,
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF101622),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
    );
  }

  static ThemeData lightTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      colorScheme: const ColorScheme.light(
        primary: accentAmber,
        secondary: highlightAmber,
        surface: Colors.white,
        onPrimary: Colors.white,
        onSurface: Color(0xFF0F172A),
      ),
      cardColor: Colors.white,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF0F172A),
        elevation: 0,
      ),
    );
  }
}
