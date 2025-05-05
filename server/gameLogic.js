'use strict';

const path = require('path');
const fs = require('fs').promises;
const { broadcast } = require("./utilsWebSockets");

const COLORS = ["blue", "red", "green", "yellow"];
const SPEED = 0.2;

const MAX_PLAYERS = 4;

const TILE_SIZE = 16; // Tamaño de cada tile en píxeles
const WIDTH_IN_TILES = 48; // Ancho del mapa en tiles
const HEIGHT_IN_TILES = 48; // Alto del mapa en tiles
const CHARACTER_SIZE = 32;
const FLAG_SIZE = 16;

const DIRECTIONS = {
    "up": { dx: 0, dy: -1 },
    "left": { dx: -1, dy: 0 },
    "down": { dx: 0, dy: 1 },
    "right": { dx: 1, dy: 0 },
    "none": { dx: 0, dy: 0 }
};

const POSITIONS = {
    red: { dx: 32, dy: 720},
    blue: { dx: 32, dy: 40},
    green: { dx: 720, dy: 40},
    yellow: { dx: 720, dy: 720}
};

const CHESTS = {
    red: {
        dx: 48 / (TILE_SIZE * WIDTH_IN_TILES),
        dy: 736 / (TILE_SIZE * HEIGHT_IN_TILES),
        width: 24 / (TILE_SIZE * WIDTH_IN_TILES),
        height: 24 / (TILE_SIZE * HEIGHT_IN_TILES)
    },
    blue: {
        dx: 48 / (TILE_SIZE * WIDTH_IN_TILES),
        dy: 56 / (TILE_SIZE * HEIGHT_IN_TILES),
        width: 24 / (TILE_SIZE * WIDTH_IN_TILES),
        height: 24 / (TILE_SIZE * HEIGHT_IN_TILES)
    },
    green: {
        dx: 688 / (TILE_SIZE * WIDTH_IN_TILES),
        dy: 56 / (TILE_SIZE * HEIGHT_IN_TILES),
        width: 24 / (TILE_SIZE * WIDTH_IN_TILES),
        height: 24 / (TILE_SIZE * HEIGHT_IN_TILES)
    },
    yellow: {
        dx: 688 / (TILE_SIZE * WIDTH_IN_TILES),
        dy: 736 / (TILE_SIZE * HEIGHT_IN_TILES),
        width: 24 / (TILE_SIZE * WIDTH_IN_TILES),
        height: 24 / (TILE_SIZE * HEIGHT_IN_TILES)
    }
}

const FLAG_ZONE = {
    dx: 288 / (TILE_SIZE * WIDTH_IN_TILES),
    dy: 288 / (TILE_SIZE * HEIGHT_IN_TILES),
    width: 192 / (TILE_SIZE * WIDTH_IN_TILES),
    height: 192 / (TILE_SIZE * HEIGHT_IN_TILES)
};

class GameLogic {

    constructor() {
        this.gameStarted = false;
        this.waitingToStart = false;
        this.timeToStart = 0;
        this.players = new Map();
        this.clients = new Map();
        this.elapsedTime = 120;
    }

    async loadGameData() {
        do {
            this.flag = {
                available: true,
                dx: Math.random(),
                dy: Math.random()
            }
        }
        while (!this.areRectColliding(
            this.flag.dx,
            this.flag.dy,
            FLAG_SIZE / (TILE_SIZE * WIDTH_IN_TILES),
            FLAG_SIZE / (TILE_SIZE * HEIGHT_IN_TILES),
            FLAG_ZONE.dx,
            FLAG_ZONE.dy,
            FLAG_ZONE.width,
            FLAG_ZONE.height)
        )
    }

    async fetchGameData() {
        const filePath = path.join(__dirname, '../public', 'game_data.json'); 
        return fs.readFile(filePath, 'utf-8')
            .then(data => {
                if(process.env.NODE_ENV === "development") console.log(data);
                return JSON.parse(data);
            })
            .catch(error => {
                console.error("Error cargando game_data.json:", error);
                return null;
            });
    }

    // Es connecta un client/jugador
    addClient(id) {
        try {
            this.clients.set(id, {
                id,
                ready: false,
                x: 0,
                y: 0,
                speed: SPEED,
                direction: "down",
                moving: false,
                zone: "", 
                hasFlag: false,
                points: 0,
                
                color: "none",
            });
            return this.clients.get(id);
        } catch(e) {
            console.error(e);
        }
    }

    // Es desconnecta un client/jugador
    removeClient(id) {
        try {
            if (this.players.has(id)) {
                this.players.delete(id);
            }
            if (this.clients.has(id)) {
                this.clients.delete(id);
            }
        }catch(e) {
            console.error("Error removing client: " + id)
        }
        
        
    }

    // Tractar un missatge d'un client/jugador
    handleMessage(id, msg) {
        try {
            let obj = JSON.parse(msg);
            if (!obj.type) return;
            switch (obj.type) {
                case "direction":
                    if (this.players.has(id)) {
                        if(obj.value != "none") {
                            this.players.get(id).direction = obj.value;
                            this.players.get(id).moving = true;
                        } else {
                            this.players.get(id).moving = false;
                        }
                    }
                    break;
                case "spectator":
                    let spectatorId = id.replace("S", "C")
                    broadcast(JSON.stringify({ type: "spectator", id: id, newId: spectatorId}));
                    break;
                case "ready":

                    if (this.players.has(id)) {
                        console.info(`Not ready player ${id}`);
                        const player = this.players.get(id);
                        if (!player) return;
                        this.players.delete(id);

                    } else {
                        console.info(`Ready player ${id}`);

                        const wp = this.clients.get(id);
                        if (!wp) {
                            console.info(`[WARN] Player ${id} not found in clients.`);
                            return;
                        }

                        if (this.players.size >= MAX_PLAYERS) {
                            console.info(`[WARN] Max players reached`);
                            return;
                        }
                        const color = COLORS[this.players.size];
                        console.info("[COLOR] The color chosen is "+color+", at position "+this.players.size);
                        const newPlayer = {
                            ...wp,
                            color: color,
                            x: POSITIONS[color].dx / WIDTH_IN_TILES / TILE_SIZE,
                            y: POSITIONS[color].dy / HEIGHT_IN_TILES / TILE_SIZE
                        };
                        
                        this.players.set(id, newPlayer);
                    }

                    break;
                default:
                    break;
            }
        } catch (error) { 
            console.error(`Error en handleMessage de ${id} con msg ${msg}:`, error);
        }
    }

    // Blucle de joc (funció que s'executa contínuament)
    updateGame(fps) {
        try {
            if(this.gameStarted) {
                if(this.players.size <= 1) {
                    this.gameStarted = false;
                    this.players.clear();
                    this.restartGameData();
                    return;
                }
                let deltaTime = 1 / fps;
                this.elapsedTime -= deltaTime;
    
                if(this.elapsedTime <= 0) {
                    this.gameStarted = false;
                    this.restartGameData();
                    this.elapsedTime = 120;
                    return;
                }
    
                // Actualitzar la posició dels clients
                this.players.forEach(client => {
                    if (!client) return;
    
                    // Check if player and flag are colliding
                    if(this.areRectColliding(
                        client.x * TILE_SIZE * WIDTH_IN_TILES, 
                        client.y * TILE_SIZE * HEIGHT_IN_TILES, 
                        CHARACTER_SIZE, 
                        CHARACTER_SIZE, 
                        this.flag.dx * TILE_SIZE * WIDTH_IN_TILES, 
                        this.flag.dy * TILE_SIZE * HEIGHT_IN_TILES, 
                        FLAG_SIZE, 
                        FLAG_SIZE
                    ) && this.flag.available) {
                        client.points += 50;
                        client.hasFlag = true;
                        this.flag.available = false;
                    }
    
                    // Check if player and chest are colliding, and user has flag
                    if(this.areRectColliding(
                        client.x,
                        client.y,
                        CHARACTER_SIZE / (TILE_SIZE * WIDTH_IN_TILES),
                        CHARACTER_SIZE / (TILE_SIZE * HEIGHT_IN_TILES),
                        CHESTS[client.color].dx,
                        CHESTS[client.color].dy,
                        CHESTS[client.color].width,
                        CHESTS[client.color].height
                    ) && client.hasFlag) {
                        if(process.env.NODE_ENV === "development") console.log("DEJANDO BANDERA")
                        client.hasFlag = false;
                        client.points += 500;
                        do {
                            this.flag = {
                                available: true,
                                dx: Math.random(),
                                dy: Math.random()
                            }
                        }
                        while (!this.areRectColliding(
                            this.flag.dx,
                            this.flag.dy,
                            FLAG_SIZE / (TILE_SIZE * WIDTH_IN_TILES),
                            FLAG_SIZE / (TILE_SIZE * HEIGHT_IN_TILES),
                            FLAG_ZONE.dx,
                            FLAG_ZONE.dy,
                            FLAG_ZONE.width,
                            FLAG_ZONE.height)
                        )
    
                    }
                    
                    if (client.moving) {
                        let nextX = client.x + (DIRECTIONS[client.direction].dx * client.speed * deltaTime);
                        let nextY = client.y + (DIRECTIONS[client.direction].dy * client.speed * deltaTime);
                    
                        if (this.checkValidPosition(nextX, nextY, client)) {
                            client.x = nextX;
                            client.y = nextY;
                        }
                    }
                    
                    // console.log(`Client ${client.id} - X: ${client.x}, Y: ${client.y}`);
                });
            }else {
                if(this.players.size >= 2 && !this.waitingToStart) {
                    if(process.env.NODE_ENV === "development") console.log("Starting game...");
                    this.waitingToStart = true;
                    this.timeToStart = 15;
                    const interval = setInterval(() => {
                        if(this.players.size < 2) {
                            this.timeToStart = 0;
                        }
                        if (this.timeToStart <= 0) {
                            clearInterval(interval);
                            this.waitingToStart = false;
                    
                            if (this.players.size >= 1) {
                                this.gameStarted = true;
                                
                                if(process.env.NODE_ENV === "development") console.log("Game started!");
                            }
                    
                            return; 
                        }
                    
                        this.timeToStart--;
                    }, 1000);
                    
                }
            }
        } catch (e) {
            console.log(e)
        }
        
        
    }

    checkValidPosition(x, y) {
        if(
            x*TILE_SIZE*WIDTH_IN_TILES + CHARACTER_SIZE >= 1*TILE_SIZE*WIDTH_IN_TILES || 
            x <= 0 || 
            y >= 1 || 
            y*TILE_SIZE*WIDTH_IN_TILES - CHARACTER_SIZE <= 0){
            return false;
        }
        return true;
    }

    // Detectar si dos rectangles es sobreposen
    areRectColliding(x1, y1, w1, h1, x2, y2, w2, h2) {
        return (
            x1 < x2 + w2 &&
            x1 + w1 > x2 &&
            y1 < y2 + h2 &&
            y1 + h1 > y2
        );
    }

    restartGameData() {
        this.gameStarted = false;
        this.waitingToStart = false;
        this.timeToStart = 0;
        this.elapsedTime = 120;

        this.players.forEach(player => {
            const colorPos = POSITIONS[player.color];
            player.x = colorPos.dx / WIDTH_IN_TILES / TILE_SIZE;
            player.y = colorPos.dy / HEIGHT_IN_TILES / TILE_SIZE;
            player.speed = SPEED;
            player.direction = "down";
            player.moving = false;
            player.zone = ""; // Colisión con objetos o zonas
            player.hasFlag = false;
            player.points = 0;
        });

        do {
            this.flag = {
                available: true,
                dx: Math.random(),
                dy: Math.random()
            }
        }
        while (!this.areRectColliding(
            this.flag.dx,
            this.flag.dy,
            FLAG_SIZE / (TILE_SIZE * WIDTH_IN_TILES),
            FLAG_SIZE / (TILE_SIZE * HEIGHT_IN_TILES),
            FLAG_ZONE.dx,
            FLAG_ZONE.dy,
            FLAG_ZONE.width,
            FLAG_ZONE.height)
        )
    }

    // Retorna l'estat del joc (per enviar-lo als clients/jugadors)
    getGameState() {
        const gameState = {
            started: this.gameStarted,
            timeToStart: this.timeToStart,
            time: Math.trunc(this.elapsedTime),
            players: Array.from(this.players.values()),
            flag: this.flag,
        }
        if(process.env.NODE_ENV === "development") console.log(`GameState: ${JSON.stringify(gameState)}`);
        
        return gameState;
    }
}

module.exports = GameLogic;