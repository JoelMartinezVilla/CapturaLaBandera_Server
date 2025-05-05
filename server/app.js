const express = require('express');
const GameLogic = require('./gameLogic.js');
const webSockets = require('./utilsWebSockets.js');
const GameLoop = require('./utilsGameLoop.js');
require('dotenv').config();

const debug = true;
const port = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
});

let ws, game, gameLoop;

try {
    // Inicialitzar WebSockets i la lògica del joc
    ws = new webSockets();
    game = new GameLogic();
    gameLoop = new GameLoop();
} catch (err) {
    console.error('[INIT ERROR] Error inicializando módulos:', err);
    process.exit(1);
}

const app = express();
app.use(express.static('public'));
app.use(express.json());

// Carregar dades del joc i començar el loop
(async () => {
    try {
        await game.loadGameData(); 
        gameLoop.start();
    } catch (err) {
        console.error('[ASYNC INIT ERROR] Error en loadGameData o gameLoop.start():', err);
        process.exit(1);
    }
})();

let httpServer;

try {
    httpServer = app.listen(port, '0.0.0.0', () => {
        console.log(`Servidor HTTP escoltant a: http://localhost:${port}`);
    });
} catch (err) {
    console.error('[SERVER ERROR] Error iniciant el servidor HTTP:', err);
    process.exit(1);
}

try {
    ws.init(httpServer, port);
} catch (err) {
    console.error('[WS INIT ERROR] Error inicialitzant WebSocket server:', err);
    process.exit(1);
}

// Client connectat
ws.onConnection = (socket, id) => {
    try {
        if (debug) console.log("[WS CONNECTED] Client: " + id);
        game.addClient(id);
    } catch (err) {
        console.error(`[WS CONNECT ERROR] Error afegint client ${id}:`, err);
    }
};

// Missatge rebut del client
ws.onMessage = (socket, id, msg) => {
    try {
        game.handleMessage(id, msg);
    } catch (err) {
        console.error(`[WS MESSAGE ERROR] Error gestionant missatge de ${id}: ${msg}`, err);
    }
};

// Client desconnectat
ws.onClose = (socket, id) => {
    try {
        if (debug) console.log("[WS DISCONNECTED] Client: " + id);
        game.removeClient(id);
        ws.broadcast(JSON.stringify({ type: "disconnected", from: "server" }));
    } catch (err) {
        console.error(`[WS CLOSE ERROR] Error desconnectant client ${id}:`, err);
    }
};

// Game Loop
gameLoop.run = (fps) => {
    try {
        game.updateGame(fps);
    } catch (err) {
        console.error('[GAME LOOP ERROR] Error en updateGame():', err);
    }

    try {
        ws.broadcast(JSON.stringify({ type: "update", gameState: game.getGameState() }));
    } catch (err) {
        console.error('[GAME LOOP BROADCAST ERROR] Error enviant gameState:', err);
    }
};

// Tancament controlat
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
    try {
        console.log('[SHUTDOWN] Rebuda senyal de tancament, aturant el servidor...');
        httpServer.close(() => {
            console.log('[HTTP] Servidor tancat correctament.');
        });
        ws.end();
        gameLoop.stop();
        process.exit(0);
    } catch (err) {
        console.error('[SHUTDOWN ERROR] Error durant el tancament:', err);
        process.exit(1);
    }
}
