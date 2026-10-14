import Character from "./character.js";

let socket;
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
canvas.width = 1024;
canvas.height = 576;
const GRAVITY = 0.7;
const GROUND_LEVEL = canvas.height - 150;
const matchmakingContainer = document.getElementById('matchmaking-container');
const matchmakingStatus = document.getElementById('matchmaking-status');
const createRoomButton = document.getElementById('create-room-button');
const joinRoomButton = document.getElementById('join-room-button');
const roomCodeInput = document.getElementById('room-code-input');
const roomControls = document.getElementById('room-controls');
const roomCodeDisplay = document.getElementById('room-code-display');
const roomJoin = document.querySelector('.room-join');
const countdownEl = document.getElementById('countdown');
const countdownNumber = document.getElementById('countdown-number');
const countdownLabel = document.getElementById('countdown-label');
const bgimg = new Image();
bgimg.src = 'https://i.pinimg.com/736x/d1/48/4d/d1484dae779822c963b264fab4790f1e.jpg';

let countdownTimeout;
let hideTimeout;

function showCountdown(seconds) {
    clearTimeout(countdownTimeout);
    clearTimeout(hideTimeout);
    countdownEl.classList.remove('fade', 'flash');
    countdownEl.classList.add('show');
    countdownLabel.textContent = 'Hazards incoming';
    countdownNumber.textContent = seconds;
    countdownNumber.classList.remove('tick');
    void countdownNumber.offsetWidth;
    countdownNumber.classList.add('tick');
}

function finishCountdown() {
    countdownNumber.textContent = '!';
    countdownLabel.textContent = 'Hazards!';
    countdownEl.classList.add('flash');
    hideTimeout = setTimeout(() => {
        countdownEl.classList.add('fade');
        setTimeout(() => countdownEl.classList.remove('show', 'flash', 'fade'), 700);
    }, 900);
}

function hideCountdown() {
    clearTimeout(countdownTimeout);
    clearTimeout(hideTimeout);
    countdownEl.classList.remove('show', 'flash', 'fade');
}

let rocks = [], fires = [];
let timeLeft = 10;
let characters = {};
let isQueued = false;

function resetMatchmakingUI(message) {
    isQueued = false;
    createRoomButton.textContent = 'Create Private Room';
    roomControls.style.display = 'flex';
    roomJoin.style.display = 'flex';
    roomCodeDisplay.style.display = 'none';
    roomCodeInput.value = '';
    matchmakingStatus.classList.remove('searching');
    matchmakingStatus.textContent = message || 'Create a private room or join one with a code';
}
function init(){
    socket = io();

    socket.on('connect_error', () => {
        console.warn('Connection error. Retrying in 1s...');
        setTimeout(() => init(), 1000);
    });

    socket.on('gameStart', () => {
        matchmakingContainer.style.display = 'none';
        matchmakingStatus.classList.remove('searching');
        isQueued = false;
        
        document.getElementById('winner-text').style.display = 'none';
        rocks = [];
        fires = [];
        timeLeft = 10;

        showCountdown(timeLeft);
        updateTimer();
    });

    socket.on('playerPositionUpdate', (playerData) => {
        const character = characters[playerData.id];
        if (!character) return;

        character.targetX = playerData.x;
        character.targetY = playerData.y;
        character.velocity.x = playerData.velocityX;
        character.velocity.y = playerData.velocityY;
        character.facing = playerData.facing;
    });

    socket.on('playerLeft', (playerId) => {
        if (characters[playerId]) {
            delete characters[playerId];
            hideCountdown();
            matchmakingContainer.style.display = 'block';
            resetMatchmakingUI('Opponent disconnected. Create or join a room to play again.');
        }
    });

    socket.on('lobbyCreated', (data) => {
        isQueued = true;
        roomJoin.style.display = 'none';
        roomCodeDisplay.style.display = 'block';
        roomCodeDisplay.textContent = `Room code: ${data.code}`;
        matchmakingStatus.textContent = `Waiting for opponent to join with code ${data.code}`;
        matchmakingStatus.classList.add('searching');
        createRoomButton.textContent = 'Cancel Room';
    });

    socket.on('lobbyJoined', () => {
        matchmakingStatus.textContent = 'Opponent found! Starting match...';
        matchmakingStatus.classList.remove('searching');
    });

    socket.on('lobbyError', (data) => {
        resetMatchmakingUI(data?.message || 'Unable to join room');
    });

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
        char.targetX = playerData.x;
        char.targetY = playerData.y;
        char.velocity.x = playerData.velocityX;
        char.velocity.y = playerData.velocityY;
        char.facing = playerData.facing;
        char.isAttacking = playerData.isAttacking;
        char.isBlocking = playerData.isBlocking;
        char.isDodging = playerData.isDodging;
        char.isKicking = playerData.isKicking;
        char.health = playerData.health;

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

        hideCountdown();
        rocks = [];
        fires = [];

        setTimeout(() => {
            matchmakingContainer.style.display = 'block';
            resetMatchmakingUI('Create or join a room to play again.');
        }, 3000);
    });

    socket.on('removePlayer', (id) => {
        delete characters[id];
    });

    socket.on('connect', () => {
        console.log(`Connected to ${window.location.origin}`);
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
            healthBar.style.backgroundColor = 'red';
            setTimeout(() => {
                healthBar.style.backgroundColor = data.color === 'darkblue' ? 'limegreen' : 'red';
            }, 200);
        }
    });

    socket.on('hazardsUpdate', (data) => {
        rocks = data.rocks;
        fires = data.fires;
    });

    socket.on('hazardHit', (data) => {
        const char = characters[data.playerId];
        if (char) char.blink();
    });
}

init();

createRoomButton.addEventListener('click', () => {
    if (isQueued) {
        socket.emit('cancelMatchmaking');
        resetMatchmakingUI('Room closed');
        return;
    }
    matchmakingStatus.textContent = 'Creating room...';
    matchmakingStatus.classList.remove('searching');
    socket.emit('createPrivateLobby');
});

joinRoomButton.addEventListener('click', () => {
    const code = roomCodeInput.value.trim();
    if (!code) {
        matchmakingStatus.textContent = 'Enter a room code to join';
        return;
    }
    matchmakingStatus.textContent = 'Joining room...';
    socket.emit('joinPrivateLobby', { code });
});

roomCodeInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter' || e.code === 'NumpadEnter') joinRoomButton.click();
});

const keys = { left: false, right: false, up: false };

function sendInput() {
    if (!socket || !characters[socket.id]) return;
    socket.emit('playerInput', {
        left: keys.left,
        right: keys.right
    });
}

function interpolateCharacters() {
    const smoothing = 0.5;
    for (const id in characters) {
        const char = characters[id];
        char.x += (char.targetX - char.x) * smoothing;
        char.y += (char.targetY - char.y) * smoothing;
        char.updateBlink();
    }
}

function drawBackground() {
    if (bgimg.complete && bgimg.naturalWidth > 0) {
        c.drawImage(bgimg, 0, 0, canvas.width, canvas.height);
        return;
    }

    const sky = c.createLinearGradient(0, 0, 0, GROUND_LEVEL);
    sky.addColorStop(0, '#0b1d3a');
    sky.addColorStop(1, '#3b6ea5');
    c.fillStyle = sky;
    c.fillRect(0, 0, canvas.width, GROUND_LEVEL);

    c.fillStyle = '#4a2f1b';
    c.fillRect(0, GROUND_LEVEL, canvas.width, canvas.height - GROUND_LEVEL);
}

function draw() {
    c.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    for (let id in characters) characters[id].draw(c);

    rocks.forEach(rock => {
        c.beginPath();
        c.fillStyle = 'brown';
        c.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2);
        c.fill();
        c.closePath();
    });

    fires.forEach(fire => {
        const flicker = Math.random() * 30;
        const gradient = c.createLinearGradient(fire.x, fire.y, fire.x, fire.y + fire.height);
        gradient.addColorStop(0, `rgb(255, ${100 + flicker}, 0)`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0.8)`);
        c.fillStyle = gradient;

        c.beginPath();
        c.moveTo(fire.x, fire.y + fire.height);
        c.quadraticCurveTo(fire.x + fire.width / 2, fire.y - 20, fire.x + fire.width, fire.y + fire.height);
        c.closePath();
        c.fill();
    });
}

function gameLoop() {
    if (document.getElementById('winner-text').style.display === 'block') {
        requestAnimationFrame(gameLoop);
        return;
    }

    interpolateCharacters();
    draw();
    requestAnimationFrame(gameLoop);
}

function updateTimer() {
    if (document.getElementById('winner-text').style.display === 'block') return;

    if (timeLeft > 0) {
        showCountdown(timeLeft);
        timeLeft--;
        countdownTimeout = setTimeout(updateTimer, 1000);
    } else {
        finishCountdown();
        shakeCanvas();
    }
}

function shakeCanvas() {
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
        }
    }
    shake();
}

window.addEventListener('keydown', (e) => {
    if (!characters[socket.id]) return;
    switch(e.code) {
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = true;
            sendInput();
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = true;
            sendInput();
            break;
        case 'KeyW':
        case 'ArrowUp':
            if (!keys.up) {
                keys.up = true;
                socket.emit('playerJump');
            }
            break;
        case 'KeyF': // Punch
            socket.emit('attack');
            characters[socket.id].attack(); 
            break;
        case 'KeyG': // Kick
            socket.emit('kick');
            characters[socket.id].kick(); 
            break;
        case 'KeyH': // Block
            socket.emit('block');
            characters[socket.id].block();
            break;
        case 'KeyJ': // Dodge
            socket.emit('dodge');
            characters[socket.id].dodge();
            break;
    }
});

window.addEventListener('keyup', (e) => {
    if (!characters[socket.id]) return;
    switch(e.code) {
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = false;
            sendInput();
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = false;
            sendInput();
            break;
        case 'KeyW':
        case 'ArrowUp':
            keys.up = false;
            break;
    }
});

let loopStarted = false;
function startGameLoop() {
    if (loopStarted) return;
    loopStarted = true;
    requestAnimationFrame(gameLoop);
}

startGameLoop();


