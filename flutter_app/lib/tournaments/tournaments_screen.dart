import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class TournamentsScreen extends StatefulWidget {
  const TournamentsScreen({
    super.key,
    this.serverBaseUrl = 'http://localhost:3000',
  });

  final String serverBaseUrl;

  @override
  State<TournamentsScreen> createState() => _TournamentsScreenState();
}

class _TournamentsScreenState extends State<TournamentsScreen> {
  List<dynamic> _tournaments = const [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp =
          await http.get(Uri.parse('${widget.serverBaseUrl}/api/tournaments'));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        setState(() =>
            _tournaments = data['tournaments'] as List<dynamic>? ?? const []);
      }
    } catch (_) {
      // Offline graceful state
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_tournaments.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.account_tree_rounded,
                size: 42, color: Colors.amber),
            const SizedBox(height: 10),
            const Text('No active bracket tournaments.'),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _load, child: const Text('Refresh')),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _tournaments.length,
      itemBuilder: (context, idx) {
        final trn = _tournaments[idx] as Map<String, dynamic>;
        return Card(
          child: ListTile(
            title: Text(trn['name'] as String? ?? 'Tournament'),
            subtitle: Text('${trn['status'] ?? 'registration'}'),
          ),
        );
      },
    );
  }
}
