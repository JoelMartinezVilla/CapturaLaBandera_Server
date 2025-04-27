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

let pos;

class GameLogic {

    constructor() {
        this.gameStarted = false;
        this.waitingToStart = false;
        this.timeToStart = 0;
        this.players = new Map();
        this.waitingPlayers = new Map();
        this.elapsedTime = 0;
        this.map = "Deepwater Ruins";
        this.usedColors = new Set();
    }

    async loadGameData() {
        this.flag = {
            available: true,
            dx: Math.random(),
            dy: Math.random()
        }
    }


    async fetchGameData() {
        const filePath = path.join(__dirname, '../public', 'game_data.json'); 
        return fs.readFile(filePath, 'utf-8')
            .then(data => {
                console.log(data);
                return JSON.parse(data);
            })
            .catch(error => {
                console.error("Error cargando game_data.json:", error);
                return null;
            });
    }

    // Es connecta un client/jugador
    addClient(id) {
        pos = {
            x: 88 / (TILE_SIZE * WIDTH_IN_TILES),
            y: 160 / (TILE_SIZE * HEIGHT_IN_TILES)
        }

        this.waitingPlayers.set(id, {
            id,
            ready: false,
            x: pos.x,
            y: pos.y,
            speed: SPEED,
            direction: "down",
            moving: false,
            zone: "", // Col·lisió amb objectes o zones
            hasFlag: false,
            
            color: "none",
        });

        return this.waitingPlayers.get(id);
    }

    // Es desconnecta un client/jugador
    removeClient(id) {
        if (this.players.has(id)) {
            this.usedColors.delete(this.players.get(id).color);
            this.players.delete(id);
            
        }
        if (this.waitingPlayers.has(id)) {
            this.usedColors.delete(this.waitingPlayers.get(id).color);
            this.waitingPlayers.delete(id);
            
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
                    if(this.players.length >= MAX_PLAYERS) return;
                    let color = COLORS[Math.floor(Math.random() * COLORS.length)];
                    while (this.usedColors.has(color)) {
                        color = COLORS[Math.floor(Math.random() * COLORS.length)];
                    }
                    this.usedColors.add(color);
                    this.players.set(id, this.waitingPlayers.get(id));
                    this.players.get(id).color = color;
                    // this.waitingPlayers.delete(id);
                    break;
                default:
                    break;
            }
        } catch (error) { }
    }

    // Blucle de joc (funció que s'executa contínuament)
    updateGame(fps) {
        if(this.gameStarted) {
            if(this.players.size <= 1) {
                this.gameStarted = false;
                this.players.clear();
                this.restartGameData();
            }
            let deltaTime = 1 / fps;
            this.elapsedTime += deltaTime;

            // Actualitzar la posició dels clients
            this.players.forEach(client => {
                if (!client) return;

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
                    client.hasFlag = true;
                    this.flag.available = false;
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
                console.log("Starting game...");
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
                            console.log("Game started!");
                        }
                
                        return; // salir del callback
                    }
                
                    this.timeToStart--;
                }, 1000);
                
            }
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
        this.elapsedTime = 0;

        pos = {
            x: 88 / (TILE_SIZE * WIDTH_IN_TILES),
            y: 160 / (TILE_SIZE * HEIGHT_IN_TILES)
        }

        this.players.forEach(player => {
            player.x = pos.x;
            player.y = pos.y;
            player.speed = SPEED;
            player.direction = "down";
            player.moving = false;
            player.zone = ""; // Colisión con objetos o zonas
            player.hasFlag = false;
            player.color = "none";
        });

        this.flag = {
            available: true,
            dx: Math.random(),
            dy: Math.random()
        }
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
        console.log(`GameState: ${JSON.stringify(gameState)}`);
        return gameState;
    }
}

module.exports = GameLogic;