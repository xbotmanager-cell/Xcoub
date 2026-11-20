# DRAFT MASTER

**Think Ahead. Play Smart. Rule the Board.**

Multi-variant Draughts gaming platform built with a **Flutter/Dart mobile & web application (`flutter_app/`)** and an **interactive Web Arena & Multiplayer Backend (`src/` + `server.ts`)**.

## Default Gameplay & Rules Variants

- **Draft Master 8×8 — Flying Kings (Default)**: 8×8 board, 32 playable dark squares, 12 pieces per player, Black moves first, mandatory captures, multi-capture chains, and **long-range Flying Kings** that glide and capture across any number of empty diagonal squares.
- **English Draughts (8×8 Classic)**: Traditional 1-step King movement with standard forward captures.
- **International Draughts (10×10)**: 50 playable dark squares, 20 pieces per player, White moves first, backward captures by men, maximum capture enforcement, and Flying Kings.
- **Custom Rules**: Configurable board size, king distance, mandatory/maximum capture rules, and promotion mode.

## Flutter Application (`flutter_app/`)

- **Android Portrait Orientation & Responsive Web**: Android is strictly locked to portrait mode via `AndroidManifest.xml` (`android:screenOrientation="portrait"`) and `main.dart` (`SystemChrome.setPreferredOrientations` gated on Android), while Flutter Web retains responsive multi-layout scaling.
- **Brand Identity & Splash/Loading**: Original geometric Crowned Flying King emblem across Android `mipmap-*` launcher icons, adaptive icon layers (`mipmap-anydpi-v26`), native `LaunchTheme` splash screen, `LoadingScreen` with tagline & retry UI, `web/icons/`, and exported MP4 video headers.
- **Original Audio & Haptics (`lib/core/services/audio_service.dart`, `assets/audio/`)**: Royalty-free synthesized background music (`bgm_menu.mp3`, `bgm_game.mp3`, `bgm_victory.mp3`, `bgm_defeat.mp3`, `bgm_tournament.mp3`) and sound effects (`sfx_*`) using `audioplayers` with Android AudioFocus and lifecycle interruption handling.
- **Complete Persisted Settings (`lib/settings/`)**: Gameplay (presets, board size, Flying Kings, mandatory/max/multi captures, hints, move confirmation, AI difficulty, match timer), Display (Dark/Light/Auto theme, board & piece themes, animations & intensity, highlights), Audio/Haptics (Master/Music/SFX volumes & toggles), Notifications, Accessibility (larger controls, high contrast, move labels, reduced motion), and Account/Privacy.
- **Modular Rules & 8-Level AI (`lib/gameplay/`)**: Pure-Dart multi-variant rules engine, Iterative Deepening Alpha-Beta/PVS/Zobrist AI, `GameScreen` clocks, `ReplayScreen`, and native Android `MediaCodec`/`MediaMuxer` MP4 video exporter (`MainActivity.kt`).

## GitHub Actions & Release Signing

- **Android APK & AAB Workflow**: `.github/workflows/android-build.yml` runs `flutter pub get`, `dart format`, `flutter analyze`, `flutter test`, builds `flutter_app/build/app/outputs/flutter-apk/app-release.apk` and `flutter_app/build/app/outputs/bundle/release/app-release.aab`, uploads both as workflow artifacts, and creates GitHub Releases on `v*` tags.
- **Optional Signed Release Secrets**: Configure `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` in GitHub Repository Secrets. When omitted, `android/app/build.gradle.kts` cleanly builds debug-signed test releases.
- **Web & Firebase Hosting Workflow**: `.github/workflows/ci-deploy.yml` runs Node/TypeScript/Firestore checks and builds `flutter_app/build/web/` (`draft-master-flutter-web` artifact).

## Commands

- **Web Dev Server (Express + WebSockets + Vite)**: `npm run dev` (port `3000`)
- **Web Engine Tests**: `npm test`
- **Web Build & Lint**: `npm run build` / `npm run lint`
- **Firestore Rules Lint**: `npx eslint firestore.rules`
- **Flutter Local Build (requires Flutter & Android SDK)**: `cd flutter_app && flutter pub get && dart format lib test && flutter analyze && flutter test && flutter build apk --release && flutter build appbundle --release && flutter build web --release`
