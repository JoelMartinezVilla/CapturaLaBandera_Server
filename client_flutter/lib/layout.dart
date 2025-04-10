import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'app_data.dart';
import 'canvas_painter.dart';

class Layout extends StatefulWidget {
  const Layout({super.key});

  @override
  State<Layout> createState() => _LayoutState();
}

class _LayoutState extends State<Layout> {
  final Set<String> _pressedKeys = {};

  @override
  void initState() {
    super.initState();
    // Preload image assets into cache
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final appData = Provider.of<AppData>(context, listen: false);
      await appData.getImage("images/arrows.png");
    });
  }

  // Tractar què passa quan el jugador apreta una tecla
  void _onKeyEvent(KeyEvent event, AppData appData) {
    String key = event.logicalKey.keyLabel.toLowerCase();

    if (event is KeyDownEvent) {
      if (event.logicalKey == LogicalKeyboardKey.space) {
        appData.sendMessage(jsonEncode({"type": "jump"}));
        return;
      }
      _pressedKeys.add(key);
    } else if (event is KeyUpEvent) {
      _pressedKeys.remove(key);
    }

    // Enviar la direcció escollida pel jugador al servidor
    var direction = _getDirectionFromKeys();
    appData.sendMessage(jsonEncode({"type": "auth", "value": direction}));
  }

  String _getDirectionFromKeys() {
    bool up = _pressedKeys.contains("arrow up");
    bool down = _pressedKeys.contains("arrow down");
    bool left = _pressedKeys.contains("arrow left");
    bool right = _pressedKeys.contains("arrow right");

    if (up && left) return "upLeft";
    if (up && right) return "upRight";
    if (down && left) return "downLeft";
    if (down && right) return "downRight";
    if (up) return "up";
    if (down) return "down";
    if (left) return "left";
    if (right) return "right";

    return "none";
  }

  @override
  Widget build(BuildContext context) {
    final appData = Provider.of<AppData>(context);

    return CupertinoPageScaffold(
      child: SafeArea(
        child: Container(
          color: CupertinoColors.systemGrey5,
          child: Focus(
            autofocus: true,
            onKeyEvent: (node, event) {
              _onKeyEvent(event, appData);
              return KeyEventResult.handled;
            },
            child: Center(
              child: SizedBox(
                width: 300,
                height: 300,
                child: CustomPaint(
                  painter: CanvasPainter(appData, appData.gameData),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
