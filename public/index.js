import Character from "./character.js";

const socket = io('ws://localhost:5000');
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
canvas.width = 1024;
canvas.height = 576;

// Game constants
const GRAVITY = 0.7;
const GROUND_LEVEL = canvas.height - 150;

// Game assets
const bgimg = new Image();
bgimg.src = 'https://i.pinimg.com/736x/d1/48/4d/d1484dae779822c963b264fab4790f1e.jpg';
let rocks = [], fires = [];
let timeLeft = 10;
let rockSpawnStart = null;
let rockInterval, fireInterval;
// Game state
let characters = {};
let lastUpdateTime = 0;
let currentLobbyId = null;
let playerIndex = null;
const matchmakingContainer = document.getElementById('matchmaking-container');
const matchmakingButton = document.getElementById('matchmaking-button');
const matchmakingStatus = document.getElementById('matchmaking-status');
let isFindingMatch = false;

// In the matchmaking button click handler:
matchmakingButton.addEventListener('click', () => {
    if (isFindingMatch) {
        // Cancel matchmaking
        socket.emit('cancelMatchmaking');
        matchmakingButton.textContent = 'Find Match';
        matchmakingStatus.textContent = 'Matchmaking cancelled';
        matchmakingStatus.classList.remove('searching'); // Remove the class
        isFindingMatch = false;
    } else {
        // Start matchmaking
        matchmakingButton.textContent = 'Cancel';
        matchmakingStatus.textContent = 'Searching for opponent';
        matchmakingStatus.classList.add('searching'); // Add the class
        socket.emit('joinMatchmaking');
        isFindingMatch = true;
    }
});

socket.on('gameStart', (data) => {
    currentLobbyId = data.lobbyId;
    playerIndex = data.playerIndex;
    matchmakingContainer.style.display = 'none';
    matchmakingStatus.classList.remove('searching');
    
    // Reset game state
    document.getElementById('winner-text').style.display = 'none';
    rocks = [];
    fires = [];
    timeLeft = 10;
    clearInterval(rockInterval);
    clearInterval(fireInterval);
    rockSpawnStart = null;
    
    updateTimer();
});

// In the playerLeft handler:
socket.on('playerLeft', (playerId) => {
    if (characters[playerId]) {
        delete characters[playerId];
        matchmakingContainer.style.display = 'block';
        document.getElementById('matchmaking-button').textContent = 'Find Match';
        document.getElementById('matchmaking-status').textContent = 'Opponent disconnected. Press "Find Match" to start a new game.';
        matchmakingStatus.classList.remove('searching'); // Remove when opponent leaves
    }
});

function interpolatePlayers() {
    for (let id in characters) {
        if (id !== socket.id) {
            const char = characters[id];
            const lerpFactor = 0.2;
            
            // Predict position based on velocity
            const predictedX = char.x + char.velocity.x * 0.1;
            const predictedY = char.y + char.velocity.y * 0.1;
            
            char.x += (predictedX - char.x) * lerpFactor;
            char.y += (predictedY - char.y) * lerpFactor;
        }
    }
}

// Update keys object to be consistent
const keys = {
    left: { pressed: false, sent: false },
    right: { pressed: false, sent: false },
    up: { pressed: false, sent: false }
};
// Replace the existing key event handlers with these:
window.addEventListener('keydown', (e) => {
    if (!characters[socket.id]) return;

    switch(e.key) {
        case 'a':
        case 'ArrowLeft':
            keys.left.pressed = true;
            keys.left.sent = false;
            break;
        case 'd':
        case 'ArrowRight':
            keys.right.pressed = true;
            keys.right.sent = false;
            break;
        case 'w':
        case 'ArrowUp':
            if (!keys.up.pressed) {
                keys.up.pressed = true;
                keys.up.sent = false;
            }
            break;

            case 'f': // Punch
            console.log('Attack key pressed');
            socket.emit('attack');
            characters[socket.id].attack(); 
            break;
        
        case 'g': // Kick
            console.log('Kick key pressed');
            socket.emit('kick');
            characters[socket.id].kick(); 
            break;
        

        case 'h': // Block
            characters[socket.id].block();
            break;

        case 'j': // Dodge
            characters[socket.id].dodge();
            break;
    }
});

window.addEventListener('keyup', (e) => {
    if (!characters[socket.id]) return;
    
    switch(e.key) {
        case 'a':
        case 'ArrowLeft':
            keys.left.pressed = false;
            // Explicitly send stop when left key is released
            socket.emit('playerMove', {
                moving: false,
                direction: 'left',
                x: characters[socket.id].x,
                y: characters[socket.id].y,
                velocityX: 0,
                velocityY: characters[socket.id].velocity.y,
                facing: characters[socket.id].facing
            });
            break;
        case 'd':
        case 'ArrowRight':
            keys.right.pressed = false;
            // Explicitly send stop when right key is released
            socket.emit('playerMove', {
                moving: false,
                direction: 'right',
                x: characters[socket.id].x,
                y: characters[socket.id].y,
                velocityX: 0,
                velocityY: characters[socket.id].velocity.y,
                facing: characters[socket.id].facing
            });
            break;
        case 'w':
        case 'ArrowUp':
            keys.up.pressed = false;
            break;
    }
});

socket.on('matchmakingStatus', (data) => {
    matchmakingStatus.textContent = `Status: ${data.status}. Players: ${data.playersInLobby}/${data.playersNeeded + data.playersInLobby}`;
    
    if (data.status === 'waiting') {
        matchmakingButton.disabled = false;
        matchmakingButton.textContent = 'Cancel Matchmaking';
    } else {
        matchmakingButton.style.display = 'none';
    }
});

function handleMovement() {
    if (!characters[socket.id]) return;
    
    const player = characters[socket.id];
    const speed = 5;
    let moving = false;
    let direction = null;

    // Handle horizontal movement
    if (keys.left.pressed) {
        player.velocity.x = -speed;
        player.facing = 'left';
        moving = true;
        direction = 'left';
    } else if (keys.right.pressed) {
        player.velocity.x = speed;
        player.facing = 'right';
        moving = true;
        direction = 'right';
    } else {
        player.velocity.x = 0;
    }
    
    // Handle jump (only send once per press)
    if (keys.up.pressed && !keys.up.sent && player.onGround) {
        player.velocity.y = -15;
        player.onGround = false;
        socket.emit('playerJump');
        keys.up.sent = true;
    }
    
    // Only send movement updates if something changed
    if (moving && (!keys.left.sent || !keys.right.sent)) {
        socket.emit('playerMove', {
            moving: true,
            direction: direction,
            x: player.x,
            y: player.y,
            velocityX: player.velocity.x,
            velocityY: player.velocity.y,
            facing: player.facing
        });
        if (direction === 'left') keys.left.sent = true;
        if (direction === 'right') keys.right.sent = true;
    }
}

socket.on('playerPositionUpdate', (playerData) => {
    if (!characters[playerData.id]) return;
    
    // Only update remote players (not current client)
    if (playerData.id !== socket.id) {
        const character = characters[playerData.id];
        character.x = playerData.x;
        character.y = playerData.y;
        character.velocity.x = playerData.velocityX;
        character.velocity.y = playerData.velocityY;
        character.facing = playerData.facing;
    }
});

// Initialize player
const player = new Character(
    socket.id, 
    100, 
    GROUND_LEVEL, 
    undefined,
    GRAVITY,
    GROUND_LEVEL
);

// Socket event handlers
socket.on('currentPlayers', (players) => {
    characters = {};
    players.forEach(playerData => {
        characters[playerData.id] = new Character(
            playerData.id,
            playerData.x,
            playerData.y,
            playerData.color,
            GRAVITY,
            GROUND_LEVEL
        );
    });
});

socket.on('newPlayer', (playerData) => {
    if (!characters[playerData.id]) {
        characters[playerData.id] = new Character(
            playerData.id,
            playerData.x,
            playerData.y,
            playerData.color,
            GRAVITY,
            GROUND_LEVEL
        );
    }
});

socket.on('updatePlayer', (playerData) => {
    if (!characters[playerData.id]) return;
    
    const char = characters[playerData.id];
    
    // Update all properties including health
    char.x = playerData.x;
    char.y = playerData.y;
    char.velocity.x = playerData.velocityX;
    char.velocity.y = playerData.velocityY;
    char.facing = playerData.facing;
    char.isAttacking = playerData.isAttacking;
    char.isBlocking = playerData.isBlocking;
    char.health = playerData.health;
    
    // Explicitly update the health bar
    const classSelector = char.color === 'darkblue' ? '.player-health' : '.enemy-health';
    const healthBar = document.querySelector(classSelector);
    if (healthBar) {
        healthBar.style.width = `${char.health}%`;
    }
});

socket.on('gameOver', (data) => {
    const winnerText = document.getElementById('winner-text');
    
    if (data.winnerId === socket.id) {
        winnerText.textContent = 'YOU WIN!';
        winnerText.style.color = 'gold';
    } else {
        winnerText.textContent = 'YOU LOSE!';
        winnerText.style.color = 'red';
    }
    
    winnerText.style.display = 'block';
    
    // Clear all hazards
    clearInterval(rockInterval);
    clearInterval(fireInterval);
    rocks = [];
    fires = [];
    
    // Show matchmaking button again after 3 seconds
    setTimeout(() => {
        matchmakingContainer.style.display = 'block';
        matchmakingButton.textContent = 'Play Again';
        matchmakingStatus.textContent = 'Press "Play Again" to start a new match';
    }, 3000);
});

socket.on('removePlayer', (id) => {
    delete characters[id];
});

socket.on('connect', () => {
    console.log("Connected with socket id:", socket.id);
});

socket.on("connectionRejected", (data) => {
    alert(data.message);
    socket.disconnect();
});

socket.on('updateHealth', (data) => {
    const classSelector = data.color === 'darkblue' ? '.player-health' : '.enemy-health';
    const healthBar = document.querySelector(classSelector);
    if (healthBar) {
        healthBar.style.width = `${data.health}%`;
        // Add visual feedback when hit
        healthBar.style.backgroundColor = 'red';
        setTimeout(() => {
            healthBar.style.backgroundColor = data.color === 'darkblue' ? 'limegreen' : 'red';
        }, 200);
    }
});

class Rock {
    constructor() {
        const baseRadius = 15;
        let elapsed = rockSpawnStart ? (Date.now() - rockSpawnStart) / 1000 : 0;
        this.radius = baseRadius + elapsed * 1;
        this.position = { x: Math.random() * (canvas.width - 30) + 15, y: -15 };
        this.velocity = { x: 0, y: 0 };
        this.offScreen = false;
    }

    update() {
        this.velocity.y += GRAVITY * 0.5;
        this.position.y += this.velocity.y;
        if (this.position.y - this.radius > canvas.height) this.offScreen = true;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.fillStyle = 'brown';
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    checkCollision(char) {
        const rect = char.getBounds();
        const closestX = Math.max(rect.x, Math.min(this.position.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(this.position.y, rect.y + rect.height));
        const dx = this.position.x - closestX;
        const dy = this.position.y - closestY;
        return dx * dx + dy * dy < this.radius * this.radius;
    }
}

class FireWall {
    constructor() {
        this.width = 110;
        this.height = 230;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = canvas.height - this.height;
        this.spawnTime = Date.now();
        this.lifetime = 4000;
    }

    draw(ctx) {
        const flicker = Math.random() * 30;
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, `rgb(255, ${100 + flicker}, 0)`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0.8)`);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.quadraticCurveTo(this.x + this.width / 2, this.y - 20, this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
    }

    isExpired() {
        return Date.now() - this.spawnTime > this.lifetime;
    }

    checkCollision(character) {
        const r = character.getBounds();
        const f = { x: this.x, y: this.y, width: this.width, height: this.height };
        if (
            r.x < f.x + f.width &&
            r.x + r.width > f.x &&
            r.y < f.y + f.height &&
            r.y + r.height > f.y
        ) {
            const damageTaken = character.takeDamage(0.1);
            if (damageTaken && character.id === socket.id) {
                socket.emit('playerDamaged', {
                    amount: 0.1,
                    playerId: character.id
                });
            }
            character.blink();
        }
    }
}

function draw() {
    c.clearRect(0, 0, canvas.width, canvas.height);
    
    if (bgimg.complete) {
        c.drawImage(bgimg, 0, 0, canvas.width, canvas.height);
    }
    
    for (let id in characters) {
        characters[id].draw(c);
    }

    // ROCK LOGIC
rocks.forEach((rock, i) => {
    rock.update();
    rock.draw(c);
    Object.values(characters).forEach(char => {
        if (rock.checkCollision(char)) {
            const damageTaken = char.takeDamage(20);
            if (damageTaken && char.id === socket.id) {
                socket.emit('playerDamaged', {
                    amount: 20,
                    playerId: char.id
                });
            }
            rock.offScreen = true;
        }
    });
});
rocks = rocks.filter(r => !r.offScreen);

// FIRE LOGIC
fires.forEach(fire => {
    fire.draw(c);
    Object.values(characters).forEach(char => fire.checkCollision(char));
});
fires = fires.filter(f => !f.isExpired());

}

function gameLoop(timestamp) {
    if (document.getElementById('winner-text').style.display === 'block') {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Interpolate remote players
    for (let id in characters) {
        if (id !== socket.id) {
            const char = characters[id];
            const lerpFactor = 0.2;
            
            // Only interpolate if we have a target position
            if (char.targetX !== undefined && char.targetY !== undefined) {
                char.x += (char.targetX - char.x) * lerpFactor;
                char.y += (char.targetY - char.y) * lerpFactor;
            }
            
            // Update facing direction immediately
            if (char.facing !== char.prevFacing) {
                char.facing = char.facing;
                char.prevFacing = char.facing;
            }
        }
    }

    const deltaTime = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    
    if (characters[socket.id]) {
        handleMovement();
        characters[socket.id].update(deltaTime);
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

function updateTimer() {
    // Skip if game is over
    if (document.getElementById('winner-text').style.display === 'block') {
        return;
    }

    const timerDisplay = document.getElementById("timer").querySelector(".timer-text");
    if (timeLeft > 0) {
        timerDisplay.innerText = `Time: ${timeLeft}s`;
        timeLeft--;
        setTimeout(updateTimer, 1000);
    } else {
        timerDisplay.innerText = "Time's up!";
        shakeCanvas(startRockSpawning);
    }
}

function shakeCanvas(callback) {
    let start = Date.now();
    let duration = 1000;

    function shake() {
        let elapsed = Date.now() - start;
        let x = (Math.random() - 0.5) * 20;
        let y = (Math.random() - 0.5) * 2;
        canvas.style.transform = `translate(${x}px, ${y}px)`;
        if (elapsed < duration) {
            requestAnimationFrame(shake);
        } else {
            canvas.style.transform = 'translate(0,0)';
            callback && callback();
        }
    }

    shake();
}

function startRockSpawning() {
    rockSpawnStart = Date.now();
    
    // Initial batch of rocks
    spawnRockBatch();
    
    // Set interval for spawning batches of rocks
    rockInterval = setInterval(() => {
        spawnRockBatch();
    }, 2000); // Spawn a batch every 2 seconds

    setTimeout(() => {
        clearInterval(rockInterval);
        fireInterval = setInterval(() => {
            fires.push(new FireWall());
        }, 3000);
    }, 10000);
}

function spawnRockBatch() {
    let elapsed = rockSpawnStart ? (Date.now() - rockSpawnStart) / 1000 : 0;
    const baseRocks = 2;
    const additionalRocks = Math.min(5, Math.floor(elapsed / 10)); // Add 1 rock every 10 seconds, max 5 extra
    
    for (let i = 0; i < baseRocks + additionalRocks; i++) {
        rocks.push(new Rock());
    }
}


// Start the game
bgimg.onload = () => {
    console.log("Background loaded");
    requestAnimationFrame(gameLoop);
};