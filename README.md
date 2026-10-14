# Skybound Clash

Skybound Clash is a real-time 2D multiplayer fighting game built with **Node.js**, **Express**, and **Socket.IO**. A single authoritative server process hosts all game lobbies and runs the game simulation.

---

## Features

- **Real-Time Multiplayer Combat**: Engage in fast-paced fights against another player.  
- **Private Lobby Matchmaking**: Create a room and share its code, or join a friend's room with a code.  
- **Server-Authoritative Simulation**: The server owns player positions, physics, combat, health, and hazards; clients only send inputs and render the result.  
- **Dynamic In-Game Events**: After an initial countdown, the arena becomes hazardous with falling rocks and erupting fire walls to intensify the endgame.  
- **Basic Combat System**: Includes punching, kicking, blocking, dodging, and health mechanics.  
- **Client-Side Rendering**: Uses HTML5 Canvas to render the game, managed by client-side JavaScript.  

---

## Tech Stack

**Backend**: Node.js, Express, Socket.IO  
**Frontend**: HTML5 Canvas, JavaScript (ES Modules), CSS  
**Development**: nodemon for automatic restarts, ESLint for linting, Node's built-in test runner  

---

## How It Works

### Lobby & Matchmaking (`src/index.js`)
- The server hosts every lobby in a single process.  
- **Create Private Room** generates a unique 6-character code and a waiting lobby.  
- **Join** looks up the lobby by code and adds the second player.  
- When a lobby reaches two players, the server starts the match and runs the simulation for it.  
- If a player cancels while waiting, or disconnects mid-match, the server cleans up the lobby and (mid-match) awards the win to the remaining player.

### Gameplay (`public/index.js` & `src/index.js`)
- Once two players are in a lobby, the game begins.  
- The server acts as the authoritative source for game state (player positions, health, actions).  
- Client-side JavaScript captures keyboard inputs (movement, attacks) and sends them to the server via Socket.IO events.  
- The server processes these actions, updates the game state, and broadcasts changes to all clients in the lobby.  
- The client receives state updates and re-renders the game on the HTML5 Canvas.  

---

## Project Structure
```
Multiplayer-SkyBoundClash/
├── public/
│ ├── character.js # Player character class (state and actions)
│ ├── index.html # Main HTML file, game canvas, UI
│ └── index.js # Client-side logic, rendering, socket communication
├── src/
│ └── index.js # Main game server logic (lobbies, player state, physics, hazards)
├── test/
│ └── character.test.js # Unit tests for character mechanics
├── eslint.config.js # ESLint flat config
├── .env.example # Example environment variables
├── .gitignore
├── package.json
└── package-lock.json
```


---

## Setup and Installation

### Prerequisites
- **Node.js** (v20 or higher)  
- **npm** (included with Node.js)  

### Instructions
1. Clone the repository:
```bash
git clone https://github.com/Janavee01/Multiplayer-SkyBoundClash.git
cd Multiplayer-SkyBoundClash
```

2. Install dependencies:
```bash
npm install
```

3. Start the server (loads `.env` automatically when present):
```bash
npm run dev    # nodemon, restarts on file changes
npm start      # or: node src/index.js
```

### Configuration
Copy `.env.example` to `.env` to override defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `5000` | Port the server listens on. |
| `ALLOWED_ORIGINS` | `http://localhost:${SERVER_PORT}` | Comma-separated origins allowed to open a Socket.IO connection. Set this to your deployed origin(s). |

### Development scripts
```bash
npm test     # run the unit tests (Node's built-in test runner)
npm run lint # lint the source with ESLint
```

## Play the game:
Open your web browser and navigate to http://localhost:5000.

## To test multiplayer, open a second browser tab/window and navigate to the same address.

## Create a Private Room in one window, then enter its code in the other window to join.

## Game Controls
Move Left: A or Left Arrow

Move Right: D or Right Arrow

Jump: W or Up Arrow

Punch: F key

Kick: G key

Block: H key

Dodge: J key
