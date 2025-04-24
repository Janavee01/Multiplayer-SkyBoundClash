import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import process from 'process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Character from "../public/character.js";
import path from 'path';
const CLIENTS_PER_SERVER = 4; 
const __dirname = dirname(fileURLToPath(import.meta.url));
let redirectedPort = null;
process.on('message', (message) => {
    if (message.type === 'newServerCreated') {
        redirectedPort = message.port;
    }
});
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { 
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, '../public')));
const PORT = process.env.SERVER_PORT || 5000;
const MAX_LOBBIES_PER_SERVER = 2; 
const MAX_PLAYERS_PER_LOBBY = 2;
const BASE_SERVER_PORT = 5000;

const availableServers = [{ port: PORT, lobbyCount: 0, available: true }];

const GRAVITY = 0.7;
const GROUND_Y = 426;
const CANVAS_WIDTH = 1024;

const lobbies = {};
const players = {};

class Lobby {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.status = 'waiting';
        this.gameOver = false;
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
        this.players = this.players.filter(p => p.id !== playerId);
        console.log(`[Lobby ${this.id}] Player ${playerId} removed. Remaining: ${this.players.length}`);
    
        if (this.players.length === 0) {
            const server = availableServers.find(s => s.port === PORT);
            if (server) server.lobbyCount = Math.max(0, server.lobbyCount - 1);

            setTimeout(() => {
                const stillEmpty = this.players.length === 0;
                if (stillEmpty) {
                    delete lobbies[this.id];
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

        setTimeout(() => {
            if (!this.gameOver && this.status === 'playing') {
                io.to(this.id).emit('pauseNotice', "⏸ 10 seconds passed! Game paused.");
                this.players.forEach(p => {
                    if (p.character) {
                        p.character.velocity.x = 0;
                        p.character.velocity.y = 0;
                    }
                });
            }
        }, 10000);
    }
}

function findAvailableLobby() {
    const localServer = availableServers.find(s => s.port === PORT);
    const currentPlayerCount = Object.keys(players).length;
   
    console.log(`Total lobbies: ${Object.keys(lobbies).length}`);

    for (const lobbyId in lobbies) {
        const lobby = lobbies[lobbyId];
        console.log(`Existing lobby ${lobby.id}: ${lobby.players.length} players, status: ${lobby.status}`);
        if (lobby.players.length < MAX_PLAYERS_PER_LOBBY && lobby.status === 'waiting') {
            return { lobby, shouldRedirect: false };
        }
    }

    const totalPlayersOnServer = Object.values(players).filter(p => {
        const lobby = p.lobbyId ? lobbies[p.lobbyId] : null;
        return lobby && !lobby.gameOver;
    }).length;

    if (totalPlayersOnServer >= MAX_LOBBIES_PER_SERVER * MAX_PLAYERS_PER_LOBBY) {
        if(process.send){
        process.send({ type: 'requestNewServer' });
        }

        const newServerPort = redirectedPort || PORT + 1; 
        return {
            lobby: null,
            shouldRedirect: true,
            newServerPort,
            message: `Server full, redirecting to new server on port ${newServerPort}`
        };
    }

    const newLobbyId = `lobby_${Date.now()}`;
    const newLobby = new Lobby(newLobbyId);
    lobbies[newLobbyId] = newLobby;

    if (localServer) {
        localServer.lobbyCount++;
    }

    return { lobby: newLobby, shouldRedirect: false };
}

function nextAvailablePort() {
    return PORT + 1;
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

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    players[socket.id] = {
        id: socket.id,
        socket: socket,
        lobbyId: null,
        character: null
    };

    socket.on('joinMatchmaking', () => {
        const player = players[socket.id];
        if (player.lobbyId) {
            socket.emit('matchmakingError', 'Already in a lobby');
            return;
        }
        
        const result = findAvailableLobby();

        if (!result.shouldRedirect && result.lobby) {
            const added = result.lobby.addPlayer(player);
            console.log(`[Matchmaking] Player ${socket.id} added to lobby ${result.lobby.id}`);
            
            io.to(socket.id).emit('matchmakingStatus', {
                status: added ? 'matched' : 'waiting',
                playersInLobby: result.lobby.players.length,
                playersNeeded: MAX_PLAYERS_PER_LOBBY - result.lobby.players.length
            });
        }
        
    });
      
    socket.on('playerMove', (data) => {
        const player = players[socket.id];
        if (!player?.lobbyId || !player.character) return;
        
        const char = player.character;
        const speed = 5;
        
        if (data.moving) {
            char.velocity.x = data.direction === 'left' ? -speed : speed;
            char.facing = data.direction;
        } else {
            char.velocity.x = 0;
        }
        
        char.x = Math.max(0, Math.min(CANVAS_WIDTH - char.width, data.x));
        char.y = data.y;
        char.velocity.y = data.velocityY;
        
        broadcastPlayerPosition(char, player.lobbyId);
    });

    socket.on('playerJump', () => {
        const player = players[socket.id];
        if (!player?.lobbyId || !player.character) return;
        
        const char = player.character;
        if (char.onGround) {
            char.velocity.y = -15;
            char.onGround = false;
            broadcastPlayerPosition(char, player.lobbyId);
        }
    });
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
                delete lobbies[lobby.id];
            }, 5000);
            
            return true;
        }
        return false;
    }

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

socket.on('playerDamaged', (data) => {
    const player = players[data.playerId];
    if (!player?.lobbyId || !player.character) return;
    
    const lobby = lobbies[player.lobbyId];
    if (lobby.gameOver) return;
    
    io.to(lobby.id).emit('updateHealth', {
        playerId: data.playerId,
        health: player.character.health,
        color: player.character.color
    });
    
    checkGameOver(lobby);
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
        if (process.send) {
            process.send({
                type: 'clientDisconnected',
                port: PORT
            });
        }
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
        
        if (lobby.gameOver) continue;
        
        lobby.players.forEach(player => {
            if (!player.character) return;
            
            const char = player.character;
            char.velocity.y += GRAVITY * (16/1000);
            
            char.x = Math.max(0, Math.min(CANVAS_WIDTH - char.width, char.x));
            if (char.y > char.groundLevel) {
                char.y = char.groundLevel;
                char.velocity.y = 0;
                char.onGround = true;
            }
            broadcastPlayerPosition(char, lobbyId);
        });
    }
}, 16);

export default function startServer() {
    httpServer.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
