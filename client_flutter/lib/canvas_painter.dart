import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'app_data.dart';

class CanvasPainter extends CustomPainter {
  final AppData appData;
  final dynamic gameData;

  CanvasPainter(this.appData, this.gameData);

  @override
  void paint(Canvas canvas, ui.Size size) {
    final gameState = appData.gameState;
    if (gameState.isEmpty) return;

    // Fondo verde
    final backgroundPaint = Paint()..color = Colors.green;
    canvas.drawRect(
        Rect.fromLTWH(0, 0, size.width, size.height), backgroundPaint);

    // Jugadores (cuadrados azules)
    if (gameState["players"] != null) {
      for (var player in gameState["players"]) {
        final x = player["x"] * size.width;
        final y = player["y"] * size.height;
        final rect = Rect.fromLTWH(x, y, 20, 20);
        final paint = Paint()..color = Colors.blue;
        canvas.drawRect(rect, paint);
      }
    }

    // Flag (cuadrado rojo)
    if (gameState["flagPos"] != null) {
      final fx = gameState["flagPos"]["dx"] * size.width;
      final fy = gameState["flagPos"]["dy"] * size.height;
      final flagRect = Rect.fromLTWH(fx, fy, 20, 20);
      final flagPaint = Paint()..color = Colors.red;
      canvas.drawRect(flagRect, flagPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
