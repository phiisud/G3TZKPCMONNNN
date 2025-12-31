import { createLibp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import * as filters from '@libp2p/websockets';
import http from 'http';

const PORT = process.env.RELAY_PORT || 3003;

async function startRelayServer() {
  console.log('[RelayServer] Starting G3ZKP Circuit Relay Server...');
  
  try {
    const node = await createLibp2p({
      addresses: {
        listen: [
          `/ip4/0.0.0.0/tcp/${PORT}`
        ]
      },
      transports: [
        tcp(),
        webSockets({
          filter: filters.all
        })
      ],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: {
        identify: identify(),
        relay: circuitRelayServer({
          reservations: {
            maxReservations: 128,
            reservationClearInterval: 300 * 1000,
            applyDefaultLimit: true,
            defaultDurationLimit: 2 * 60 * 1000,
            defaultDataLimit: BigInt(2 << 20)
          }
        }),
        pubsub: gossipsub({
          emitSelf: false,
          allowPublishToZeroTopicPeers: true
        })
      },
      connectionManager: {
        maxConnections: 500,
        minConnections: 5
      }
    });

    await node.start();
    
    const peerId = node.peerId.toString();
    const addrs = node.getMultiaddrs().map(ma => ma.toString());
    
    console.log('[RelayServer] Started successfully!');
    console.log('[RelayServer] Peer ID:', peerId);
    console.log('[RelayServer] Listening on:');
    addrs.forEach(addr => console.log('  -', addr));
    
    node.addEventListener('peer:connect', (evt) => {
      console.log('[RelayServer] Peer connected:', evt.detail.toString());
    });
    
    node.addEventListener('peer:disconnect', (evt) => {
      console.log('[RelayServer] Peer disconnected:', evt.detail.toString());
    });
    
    const statusServer = http.createServer((req, res) => {
      if (req.url === '/status') {
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          peerId,
          addresses: addrs,
          connections: node.getConnections().length,
          uptime: process.uptime()
        }));
      } else if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    const httpPort = Number(PORT) + 1000;
    statusServer.listen(httpPort, '0.0.0.0', () => {
      console.log(`[RelayServer] Status endpoint: http://0.0.0.0:${httpPort}/status`);
    });
    
    process.on('SIGINT', async () => {
      console.log('[RelayServer] Shutting down...');
      await node.stop();
      statusServer.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('[RelayServer] Shutting down...');
      await node.stop();
      statusServer.close();
      process.exit(0);
    });
    
  } catch (err) {
    console.error('[RelayServer] Fatal error:', err);
    process.exit(1);
  }
}

startRelayServer();
