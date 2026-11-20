import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../gameplay/models/rule_config.dart';

class MultiplayerScreen extends StatefulWidget {
  const MultiplayerScreen({
    super.key,
    this.serverBaseUrl = 'http://localhost:3000',
  });

  final String serverBaseUrl;

  @override
  State<MultiplayerScreen> createState() => _MultiplayerScreenState();
}

class _MultiplayerScreenState extends State<MultiplayerScreen> {
  final TextEditingController _roomCodeCtrl = TextEditingController();
  List<dynamic> _rooms = const [];
  bool _loading = false;
  String? _status;

  @override
  void initState() {
    super.initState();
    _loadRooms();
  }

  Future<void> _loadRooms() async {
    setState(() {
      _loading = true;
      _status = null;
    });
    try {
      final resp =
          await http.get(Uri.parse('${widget.serverBaseUrl}/api/matches'));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        setState(() {
          _rooms = data['matches'] as List<dynamic>? ?? const [];
        });
      } else {
        setState(() => _status = 'Server status ${resp.statusCode}');
      }
    } catch (_) {
      setState(() => _status = 'Connect to Draft Master server to sync rooms.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createRoom() async {
    setState(() => _loading = true);
    try {
      final resp = await http.post(
        Uri.parse('${widget.serverBaseUrl}/api/matches'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': 'flutter_player',
          'username': 'Mobile Tactician',
          'mode': 'realtime',
          'variantPreset': RuleConfig.draftMaster8x8.preset.id,
          'timeControlSeconds': 600,
        }),
      );
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        await _loadRooms();
      }
    } catch (_) {
      setState(() => _status = 'Unable to create match room offline.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _roomCodeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _loading ? null : _createRoom,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Create 8×8 Room'),
              ),
            ),
            const SizedBox(width: 10),
            IconButton(
              onPressed: _loading ? null : _loadRooms,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _roomCodeCtrl,
          decoration: const InputDecoration(
            labelText: 'Room Invite Code',
            border: OutlineInputBorder(),
            isDense: true,
          ),
        ),
        if (_status != null) ...[
          const SizedBox(height: 10),
          Text(_status!,
              style: const TextStyle(fontSize: 12, color: Colors.amber)),
        ],
        const SizedBox(height: 14),
        if (_rooms.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(
              child: Text('No active online rooms.',
                  style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          ..._rooms.map((r) {
            final room = r as Map<String, dynamic>;
            return Card(
              child: ListTile(
                title: Text(
                  '${room['whitePlayerName'] ?? 'Open'} vs ${room['blackPlayerName'] ?? 'Open'}',
                ),
                subtitle: Text(
                  'Room ${room['roomCode']} · ${room['status']} · ${room['moveCount']} ply',
                ),
              ),
            );
          }),
      ],
    );
  }
}
