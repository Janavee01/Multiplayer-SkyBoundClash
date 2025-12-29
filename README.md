# Skybound Clash

Skybound Clash is a real-time 2D multiplayer fighting game built with **Node.js**, **Express**, and **Socket.IO**. It features a scalable server architecture using the Node.js **cluster module** to handle multiple game lobbies and distribute player load efficiently.

---

## Features

- **Real-Time Multiplayer Combat**: Engage in fast-paced fights against another player.  
- **Scalable Server Architecture**: Automatically spawns new server processes on different ports as player count grows, ensuring smooth performance.  
- **Automated Matchmaking**: Simple matchmaking system that places players into available game lobbies.  
- **Dynamic In-Game Events**: After an initial countdown, the arena becomes hazardous with falling rocks and erupting fire walls to intensify the endgame.  
- **Basic Combat System**: Includes punching, kicking, and health mechanics.  
- **Client-Side Rendering**: Uses HTML5 Canvas to render the game, managed by client-side JavaScript.  

---

## Tech Stack

**Backend**: Node.js, Express, Socket.IO, Node.js Cluster Module  
**Frontend**: HTML5 Canvas, JavaScript (ES Modules), CSS  
**Development**: nodemon for automatic server restarts  

---

## How It Works

### Server Scaling (`src/cluster.js`)
- When the application starts, a primary cluster process is initiated.  
- The primary process spawns an initial worker process (`src/index.js`) on a base port (e.g., 5000).  
- The primary process monitors messages from its workers. If a worker reports it is full, the primary process spawns a new worker on the next available port (e.g., 5001).  

### Matchmaking & Redirection (`src/index.js`)
- Players are handled by one of the worker processes when they connect.  
- Clicking "Find Match" joins the matchmaking queue.  
- The server tries to find a lobby with a waiting player. If none exists, a new lobby is created.  
- If a server instance reaches maximum lobby capacity, it sends a `requestNewServer` message to the primary cluster process.  
- The primary process creates a new server and sends the new port number back to the worker.  
- The worker emits a `redirectToServer` event to the player's client, instructing them to reconnect to the new server port.  

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
│ ├── cluster.js # Primary process for spawning and managing servers
│ └── index.js # Main game server logic (lobbies, player state)
├── .gitignore
├── package.json
└── package-lock.json
```


---

## Setup and Installation

### Prerequisites
- **Node.js** (v14 or higher)  
- **npm** (included with Node.js)  

### Instructions
1. Clone the repository:
```bash
git clone https://github.com/Janavee01/Multiplayer-SkyBoundClash.git
cd Multiplayer-SkyBoundClash

Install dependencies:
npm install
Start the server:

Using nodemon (recommended for development):
npm run dev

Without nodemon:
node src/cluster.js
```

## Play the game:
Open your web browser and navigate to http://localhost:5000.

## To test multiplayer, open a second browser tab/window and navigate to the same address.

## Click "Find Match" in both windows to be paired against each other.

## Game Controls
Move Left: A or Left Arrow

Move Right: D or Right Arrow

Jump: W or Up Arrow

Punch: F key

Kick: G key
