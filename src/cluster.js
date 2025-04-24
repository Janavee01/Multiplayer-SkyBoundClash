import cluster from 'cluster';
import { cpus } from 'os';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_PORT = 5000;
const MAX_SERVERS = 5; 
const CLIENTS_PER_SERVER = 4; 

let manager = null;

class ServerManager {
  constructor() {
    this.availablePorts = Array.from({ length: MAX_SERVERS }, (_, i) => BASE_PORT + i);
    this.activeServers = new Map(); // port -> { worker, clientCount }
  }

  start() {
    console.log(`Primary ${process.pid} is running`);
    this.spawnWorker(); // Start the initial server
  }

  spawnWorker() {
    if (this.availablePorts.length === 0) {
      console.log('Maximum number of servers reached');
      return null;
    }

    const port = this.availablePorts.shift();
    const worker = cluster.fork({ SERVER_PORT: port });

    this.activeServers.set(port, {
      worker,
      clientCount: 0
    });

    console.log(`Spawned server on port ${port}`);
    return port;
  }

  handleClientConnected(port) {
    const server = this.activeServers.get(port);
    if (server) {
      server.clientCount++;
      console.log(`Server ${port} now has ${server.clientCount}/${CLIENTS_PER_SERVER} clients`);

      if (server.clientCount >= CLIENTS_PER_SERVER &&
          this.activeServers.size < MAX_SERVERS) {
        this.spawnWorker();
      }
    }
  }

  handleClientDisconnected(port) {
    const server = this.activeServers.get(port);
    if (server) {
      server.clientCount = Math.max(0, server.clientCount - 1);
      console.log(`Server ${port} now has ${server.clientCount}/${CLIENTS_PER_SERVER} clients`);
    }
  }

  handleWorkerExit(worker) {
    for (const [port, server] of this.activeServers.entries()) {
      if (server.worker.id === worker.id) {
        this.activeServers.delete(port);
        this.availablePorts.unshift(port);
        console.log(`Worker for port ${port} died, port returned to pool`);

        if (this.activeServers.size === 0) {
          this.spawnWorker();
        }
        break;
      }
    }
  }
}

if (cluster.isPrimary) {
  manager = new ServerManager();

  cluster.on('message', (worker, message) => {
    console.log(`[CLUSTER] Received message: ${message.type}`);
    if (message.type === 'requestNewServer') {
      const newPort = manager.spawnWorker();
      if (newPort && worker && worker.send) {
        worker.send({ type: 'newServerCreated', port: newPort });
      }
    } else if (message.type === 'clientConnected') {
      manager.handleClientConnected(message.port);
    } else if (message.type === 'clientDisconnected') {
      manager.handleClientDisconnected(message.port);
    }
  });

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    manager.handleWorkerExit(worker);
  });

  manager.start();
} else {
  const { default: startServer } = await import('./index.js');
  startServer();
}
