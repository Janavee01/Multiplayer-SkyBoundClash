import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import process from 'process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Character from "../public/character.js";
import path from 'path';

try {
    process.loadEnvFile('.env');
} catch {
    // No .env file present; fall back to the real environment.
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const PORT = process.env.SERVER_PORT || 5000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const io = new Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, '../public')));
const MAX_PLAYERS_PER_LOBBY = 2;

const GRAVITY = 0.7;
const GROUND_Y = 426;
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

const HAZARD_START_DELAY = 10000;
const ROCK_SPAWN_INTERVAL = 2000;
const FIRE_PHASE_DELAY = 10000;
const FIRE_SPAWN_INTERVAL = 3000;
const ROCK_DAMAGE = 20;
const FIRE_DAMAGE = 0.1;

const lobbies = {};
const players = {};
const lobbyCodes = {};

function generateLobbyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (lobbyCodes[code]);
    return code;
}

function releaseLobbyCode(lobby) {
    if (lobby && lobby.code) {
        delete lobbyCodes[lobby.code];
    }
}

class Lobby {
    constructor(id, code = null) {
        this.id = id;
        this.code = code;
        this.isPrivate = !!code;
        this.players = [];
        this.status = 'waiting';
        this.gameOver = false;
        this.startTime = null;
        this.rocks = [];
        this.fires = [];
        this.lastRockSpawn = 0;
        this.lastFireSpawn = 0;
    }
    
    addPlayer(player) {
        this.players.push(player);
        player.lobbyId = this.id;
        console.log(`[Lobby ${this.id}] Added player ${player.id}, total: ${this.players.length}`);
    
        if (this.players.length === MAX_PLAYERS_PER_LOBBY) {
            this.status = 'playing';
            this.startGame();
            return true;
        }
    
        return false;
    }
    
    removePlayer(playerId) {
        const removed = this.players.find(p => p.id === playerId);
        this.players = this.players.filter(p => p.id !== playerId);
        if (removed) {
            removed.lobbyId = null;
            removed.character = null;
        }
        console.log(`[Lobby ${this.id}] Player ${playerId} removed. Remaining: ${this.players.length}`);

        if (this.status === 'playing' && !this.gameOver) {
            checkGameOver(this);
            return;
        }

        if (this.players.length === 0) {
            setTimeout(() => {
                const stillEmpty = this.players.length === 0;
                if (stillEmpty) {
                    delete lobbies[this.id];
                    releaseLobbyCode(this);
                    console.log(`[Lobby ${this.id}] Deleted due to 0 players.`);
                } else {
                    console.log(`[Lobby ${this.id}] Not empty after timeout, not deleted.`);
                }
            }, 1000); 
        } else {
            io.to(this.id).emit('playerLeft', playerId);
        }
    }
    
    
    
    startGame() {
        this.startTime = Date.now();

        this.players.forEach((player, index) => {
            const startX = index === 0 ? 100 : CANVAS_WIDTH - 150;
            const color = index === 0 ? "darkblue" : "red";
            
            player.character = new Character(
                player.id,
                startX,
                GROUND_Y,
                color,
                GRAVITY,
                GROUND_Y
            );
            
            player.socket.join(this.id);
            player.socket.emit('gameStart', {
                playerIndex: index,
                lobbyId: this.id,
                character: player.character.serialize()
            });
        });
        
        io.to(this.id).emit('currentPlayers', 
            this.players.map(p => p.character.serialize())
        );
    }
}

function broadcastPlayerPosition(player, lobbyId) {
    io.to(lobbyId).emit('playerPositionUpdate', player.serialize());
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function circleIntersectsRect(cx, cy, radius, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < radius * radius;
}

class Rock {
    constructor(elapsedSeconds = 0) {
        this.radius = 15 + elapsedSeconds;
        this.x = Math.random() * (CANVAS_WIDTH - 30) + 15;
        this.y = -15;
        this.velocityY = 0;
        this.offScreen = false;
    }

    update() {
        this.velocityY += GRAVITY * 0.5;
        this.y += this.velocityY;
        if (this.y - this.radius > CANVAS_HEIGHT) this.offScreen = true;
    }

    intersects(rect) {
        return circleIntersectsRect(this.x, this.y, this.radius, rect);
    }

    serialize() {
        return { x: this.x, y: this.y, radius: this.radius };
    }
}

class FireWall {
    constructor() {
        this.width = 110;
        this.height = 230;
        this.x = Math.random() * (CANVAS_WIDTH - this.width);
        this.y = CANVAS_HEIGHT - this.height;
        this.spawnTime = Date.now();
        this.lifetime = 4000;
    }

    isExpired() {
        return Date.now() - this.spawnTime > this.lifetime;
    }

    getBounds() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    serialize() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
}

function checkGameOver(lobby) {
    if (lobby.gameOver) return true;

    const alivePlayers = lobby.players.filter(p => p.character.health > 0);
    if (alivePlayers.length === 1) {
        lobby.gameOver = true;

        const winner = alivePlayers[0];
        const loser = lobby.players.find(p => p !== winner);

        io.to(lobby.id).emit('gameOver', {
            winnerId: winner.id,
            loserId: loser?.id
        });

        setTimeout(() => {
            lobby.players.forEach(p => {
                p.socket.leave(lobby.id);
                p.lobbyId = null;
                p.character = null;
            });
            releaseLobbyCode(lobby);
            delete lobbies[lobby.id];
        }, 5000);

        return true;
    } else if (alivePlayers.length === 0) {
        lobby.gameOver = true;

        io.to(lobby.id).emit('gameOver', {
            winnerId: null,
            loserId: null
        });

        setTimeout(() => {
            lobby.players.forEach(p => {
                p.socket.leave(lobby.id);
                p.lobbyId = null;
                p.character = null;
            });
            releaseLobbyCode(lobby);
            delete lobbies[lobby.id];
        }, 5000);

        return true;
    }
    return false;
}

function spawnRockBatch(lobby, elapsedSeconds) {
    const baseRocks = 2;
    const additionalRocks = Math.min(5, Math.floor(elapsedSeconds / 10));
    for (let i = 0; i < baseRocks + additionalRocks; i++) {
        lobby.rocks.push(new Rock(elapsedSeconds));
    }
}

function applyHazardDamage(lobby, player, amount) {
    const char = player.character;
    if (!char || char.health <= 0) return;

    const wasAlive = char.health > 0;
    const isAlive = char.takeDamage(amount);

    io.to(lobby.id).emit('updateHealth', {
        playerId: player.id,
        health: char.health,
        color: char.color
    });
    io.to(lobby.id).emit('hazardHit', { playerId: player.id });

    if (wasAlive && !isAlive) {
        checkGameOver(lobby);
    }
}

function updateHazards(lobby) {
    if (!lobby.startTime || lobby.gameOver) return;

    const elapsed = Date.now() - lobby.startTime;

    if (elapsed >= HAZARD_START_DELAY) {
        if (elapsed < HAZARD_START_DELAY + FIRE_PHASE_DELAY &&
            elapsed - lobby.lastRockSpawn >= ROCK_SPAWN_INTERVAL) {
            spawnRockBatch(lobby, (elapsed - HAZARD_START_DELAY) / 1000);
            lobby.lastRockSpawn = elapsed;
        }

        if (elapsed >= HAZARD_START_DELAY + FIRE_PHASE_DELAY &&
            elapsed - lobby.lastFireSpawn >= FIRE_SPAWN_INTERVAL) {
            lobby.fires.push(new FireWall());
            lobby.lastFireSpawn = elapsed;
        }
    }

    for (const rock of lobby.rocks) {
        rock.update();
        if (lobby.gameOver) break;

        for (const player of lobby.players) {
            const char = player.character;
            if (!char || char.health <= 0) continue;
            if (rock.intersects(char.getBounds())) {
                applyHazardDamage(lobby, player, ROCK_DAMAGE);
                rock.offScreen = true;
                break;
            }
        }
    }
    lobby.rocks = lobby.rocks.filter(r => !r.offScreen);

    for (const fire of lobby.fires) {
        if (lobby.gameOver) break;

        for (const player of lobby.players) {
            const char = player.character;
            if (!char || char.health <= 0) continue;
            if (isColliding(fire.getBounds(), char.getBounds())) {
                applyHazardDamage(lobby, player, FIRE_DAMAGE);
            }
        }
    }
    lobby.fires = lobby.fires.filter(f => !f.isExpired());

    if (lobby.gameOver || elapsed < HAZARD_START_DELAY) return;

    io.to(lobby.id).emit('hazardsUpdate', {
        rocks: lobby.rocks.map(r => r.serialize()),
        fires: lobby.fires.map(f => f.serialize())
    });
}

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    players[socket.id] = {
        id: socket.id,
        socket: socket,
        lobbyId: null,
        character: null,
        input: { left: false, right: false }
    };

    socket.on('createPrivateLobby', () => {
        const player = players[socket.id];
        if (player.lobbyId) {
            socket.emit('lobbyError', { message: 'Already in a lobby' });
            return;
        }

        const code = generateLobbyCode();
        const lobbyId = `lobby_${Date.now()}_${code}`;
        const lobby = new Lobby(lobbyId, code);
        lobbies[lobbyId] = lobby;
        lobbyCodes[code] = lobbyId;

        lobby.addPlayer(player);
        socket.emit('lobbyCreated', { code, lobbyId });
        console.log(`[Lobby ${lobbyId}] Private room created with code ${code} by ${socket.id}`);
    });

    socket.on('joinPrivateLobby', (data) => {
        const player = players[socket.id];
        if (player.lobbyId) {
            socket.emit('lobbyError', { message: 'Already in a lobby' });
            return;
        }

        const code = String(data?.code || '').trim().toUpperCase();
        const lobbyId = lobbyCodes[code];
        const lobby = lobbyId ? lobbies[lobbyId] : null;

        if (!lobby) {
            socket.emit('lobbyError', { message: 'No room found with that code' });
            return;
        }
        if (lobby.status !== 'waiting' || lobby.players.length >= MAX_PLAYERS_PER_LOBBY) {
            socket.emit('lobbyError', { message: 'That room is already full' });
            return;
        }

        lobby.addPlayer(player);
        socket.emit('lobbyJoined', { code, lobbyId });
        console.log(`[Lobby ${lobbyId}] Player ${socket.id} joined private room ${code}`);
    });

    socket.on('playerInput', (data) => {
        const player = players[socket.id];
        if (!player) return;

        player.input.left = !!data.left;
        player.input.right = !!data.right;
    });

    socket.on('playerJump', () => {
        const player = players[socket.id];
        if (!player?.lobbyId || !player.character) return;
        
        const char = player.character;
        if (char.onGround) {
            char.velocity.y = -15;
            char.onGround = false;
        }
    });

    socket.on('block', () => {
        const player = players[socket.id];
        if (!player?.lobbyId || !player.character) return;

        const lobby = lobbies[player.lobbyId];
        if (lobby.gameOver) return;

        const char = player.character;
        char.update();
        char.block();
        io.to(lobby.id).emit('updatePlayer', char.serialize());
    });

    socket.on('dodge', () => {
        const player = players[socket.id];
        if (!player?.lobbyId || !player.character) return;

        const lobby = lobbies[player.lobbyId];
        if (lobby.gameOver) return;

        const char = player.character;
        char.update();
        char.dodge();
        io.to(lobby.id).emit('updatePlayer', char.serialize());
    });

socket.on('attack', () => {
    const player = players[socket.id];
    if (!player?.lobbyId || !player.character) return;
    
    const lobby = lobbies[player.lobbyId];
    if (lobby.gameOver) return; 
    const hitbox = player.character.attack();
    
    if (hitbox) {
        lobby.players.forEach(otherPlayer => {
            if (otherPlayer.id !== socket.id && otherPlayer.character) {
                const otherBounds = otherPlayer.character.getBounds();
                if (isColliding(hitbox, otherBounds)) {
                    const isAlive = otherPlayer.character.takeDamage(8);
                    
                    io.to(lobby.id).emit('updateHealth', {
                        playerId: otherPlayer.id,
                        health: otherPlayer.character.health,
                        color: otherPlayer.character.color
                    });
                    
                    if (!isAlive) {
                        checkGameOver(lobby);
                    }
                }
            }
        });
    }
    
    io.to(lobby.id).emit('updatePlayer', player.character.serialize());
});

socket.on('kick', () => {
    const player = players[socket.id];
    if (!player?.lobbyId || !player.character) return;

    const lobby = lobbies[player.lobbyId];
    if (lobby.gameOver) return;
    const kickHitbox = player.character.kick();

    if (kickHitbox) {
        lobby.players.forEach(otherPlayer => {
            if (otherPlayer.id !== socket.id && otherPlayer.character) {
                const otherBounds = otherPlayer.character.getBounds();
                if (isColliding(kickHitbox, otherBounds)) {
                    const isAlive = otherPlayer.character.takeDamage(15);
                    
                    io.to(lobby.id).emit('updateHealth', {
                        playerId: otherPlayer.id,
                        health: otherPlayer.character.health,
                        color: otherPlayer.character.color
                    });
                    
                    if (!isAlive) {
                        checkGameOver(lobby);
                    }
                }
            }
        });
    }

    io.to(lobby.id).emit('updatePlayer', player.character.serialize());
});

    socket.on('cancelMatchmaking', () => {
        const player = players[socket.id];
        if (!player?.lobbyId) return;
        
        const lobby = lobbies[player.lobbyId];
        if (lobby) {
            lobby.removePlayer(socket.id);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        const player = players[socket.id];
        if (!player) return;
        
        if (player.lobbyId && lobbies[player.lobbyId]) {
            const lobby = lobbies[player.lobbyId];
                lobby.removePlayer(socket.id);
            console.log(`[Lobby ${lobby.id}] Player ${socket.id} removed. Remaining: ${lobby.players.length}`);

        }
        
        delete players[socket.id];
    });
});

setInterval(() => {
    for (const lobbyId in lobbies) {
        const lobby = lobbies[lobbyId];
        if (lobby.status !== 'playing' || lobby.gameOver) continue;
        
        lobby.players.forEach(player => {
            if (!player.character) return;
            
            const char = player.character;
            const input = player.input;

            char.update();

            if (char.isDodging) {
                char.velocity.x = char.facing === 'right' ? 15 : -15;
            } else {
                const speed = char.isBlocking ? 2.5 : 5;
                if (input.left && !input.right) {
                    char.velocity.x = -speed;
                    char.facing = 'left';
                } else if (input.right && !input.left) {
                    char.velocity.x = speed;
                    char.facing = 'right';
                } else {
                    char.velocity.x = 0;
                }
            }

            char.velocity.y += GRAVITY;

            char.x = Math.max(0, Math.min(CANVAS_WIDTH - char.width, char.x + char.velocity.x));
            char.y += char.velocity.y;

            if (char.y > char.groundLevel) {
                char.y = char.groundLevel;
                char.velocity.y = 0;
                char.onGround = true;
            } else {
                char.onGround = false;
            }

            broadcastPlayerPosition(char, lobbyId);
        });

        updateHazards(lobby);
    }
}, 16);

export default function startServer() {
    httpServer.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer();
