import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class LeaguesScreen extends StatefulWidget {
  const LeaguesScreen({
    super.key,
    this.serverBaseUrl = 'http://localhost:3000',
  });

  final String serverBaseUrl;

  @override
  State<LeaguesScreen> createState() => _LeaguesScreenState();
}

class _LeaguesScreenState extends State<LeaguesScreen> {
  List<dynamic> _leagues = const [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadLeagues();
  }

  Future<void> _loadLeagues() async {
    setState(() => _loading = true);
    try {
      final resp =
          await http.get(Uri.parse('${widget.serverBaseUrl}/api/leagues'));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        setState(
            () => _leagues = data['leagues'] as List<dynamic>? ?? const []);
      }
    } catch (_) {
      // Offline fallback keeps empty state clean
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_leagues.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.emoji_events_outlined,
                size: 42, color: Colors.amber),
            const SizedBox(height: 10),
            const Text('No leagues fetched yet.'),
            const SizedBox(height: 8),
            OutlinedButton(
                onPressed: _loadLeagues, child: const Text('Refresh')),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _leagues.length,
      itemBuilder: (context, idx) {
        final league = _leagues[idx] as Map<String, dynamic>;
        return Card(
          child: ListTile(
            title: Text(league['name'] as String? ?? 'League'),
            subtitle: Text(
              'Season ${league['seasonNumber'] ?? 1} · ${league['status'] ?? 'open'}',
            ),
          ),
        );
      },
    );
  }
}
