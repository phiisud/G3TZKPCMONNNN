#!/usr/bin/env node
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PeerNetwork } from './peer-network.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BOOTSTRAP_NODES = [
  'https://fb0c92fb-c5ce-4bf2-af3c-47d838dd952b-00-1n4r8m214ay9j.worf.replit.dev'
];

const DAEMON_PORT = 47777;
const CACHE_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.g3tzkp', 'cache');

class G3TZKPDaemon {
  constructor() {
    this.app = express();
    this.cache = new Map();
    this.bootstrapUrl = BOOTSTRAP_NODES[0];
    this.peerNetwork = new PeerNetwork(this.bootstrapUrl, DAEMON_PORT);
    
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-cache');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });

    this.app.get('/resolve/:name', async (req, res) => {
      const name = req.params.name.toUpperCase();
      console.log(`[G3TZKP] Resolving: ${name}`);
      
      try {
        const appData = await this.fetchApp(name);
        if (appData) {
          res.json({ success: true, name, cached: true });
        } else {
          res.status(404).json({ error: 'App not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/app/:name', async (req, res) => {
      await this.serveApp(req, res, req.params.name, 'index.html');
    });

    this.app.get('/app/:name/*', async (req, res) => {
      const filePath = req.params[0] || 'index.html';
      await this.serveApp(req, res, req.params.name, filePath);
    });

    this.app.get('/status', (req, res) => {
      const peerStatus = this.peerNetwork.getStatus();
      res.json({
        status: 'running',
        version: '2.0.0',
        bootstrap: this.bootstrapUrl,
        cachedApps: Array.from(this.cache.keys()),
        cacheDir: CACHE_DIR,
        p2p: peerStatus
      });
    });

    this.app.get('/open/:name', async (req, res) => {
      const name = req.params.name.toUpperCase();
      console.log(`[G3TZKP] Opening: g3tzkp://${name}`);
      
      try {
        await this.fetchApp(name);
        res.redirect(`/app/${name}`);
      } catch (error) {
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head><title>G3TZKP Error</title></head>
            <body style="background:#000;color:#ff4444;font-family:monospace;padding:40px;text-align:center;">
              <h1>Failed to Load App</h1>
              <p>${error.message}</p>
              <p>Make sure the bootstrap node or peers are online.</p>
            </body>
          </html>
        `);
      }
    });

    this.app.get('/api/share/:name', (req, res) => {
      const name = req.params.name.toUpperCase();
      const cachePath = path.join(CACHE_DIR, `${name}.json`);
      
      if (fs.existsSync(cachePath)) {
        const appData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log(`[P2P] Sharing ${name} with peer`);
        res.json(appData);
      } else {
        res.status(404).json({ error: 'App not cached' });
      }
    });

    this.app.get('/api/peers', (req, res) => {
      res.json(this.peerNetwork.getStatus());
    });
  }

  async fetchApp(name) {
    const normalizedName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cachePath = path.join(CACHE_DIR, `${normalizedName}.json`);
    
    if (fs.existsSync(cachePath)) {
      console.log(`[G3TZKP] Loading from cache: ${normalizedName}`);
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      this.cache.set(normalizedName, cached);
      return cached;
    }
    
    console.log(`[G3TZKP] Fetching from P2P network: ${normalizedName}`);
    
    const peerData = await this.peerNetwork.fetchFromPeers(normalizedName);
    if (peerData) {
      fs.writeFileSync(cachePath, JSON.stringify(peerData));
      this.cache.set(normalizedName, peerData);
      console.log(`[G3TZKP] Cached from peer: ${normalizedName}`);
      return peerData;
    }
    
    console.log(`[G3TZKP] Fetching from bootstrap: ${normalizedName}`);
    
    for (const bootstrap of BOOTSTRAP_NODES) {
      try {
        const manifestUrl = `${bootstrap}/api/manifest/${normalizedName}`;
        console.log(`[G3TZKP] Trying: ${manifestUrl}`);
        
        const response = await fetch(manifestUrl);
        if (!response.ok) continue;
        
        const manifest = await response.json();
        
        const appData = { manifest, files: {} };
        
        for (const file of manifest.files) {
          const fileUrl = `${bootstrap}/${normalizedName}/${file.path}`;
          const fileResponse = await fetch(fileUrl);
          if (fileResponse.ok) {
            const buffer = await fileResponse.arrayBuffer();
            appData.files[file.path] = {
              content: Buffer.from(buffer).toString('base64'),
              mimeType: file.mimeType
            };
          }
        }
        
        fs.writeFileSync(cachePath, JSON.stringify(appData));
        this.cache.set(normalizedName, appData);
        
        console.log(`[G3TZKP] Cached from bootstrap: ${normalizedName} (${manifest.files.length} files)`);
        return appData;
        
      } catch (error) {
        console.log(`[G3TZKP] Bootstrap ${bootstrap} failed: ${error.message}`);
      }
    }
    
    throw new Error(`App "${name}" not found on network`);
  }

  async serveApp(req, res, appName, filePath) {
    const normalizedName = appName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    let appData = this.cache.get(normalizedName);
    if (!appData) {
      try {
        appData = await this.fetchApp(normalizedName);
      } catch (error) {
        return res.status(404).send(`App not found: ${normalizedName}`);
      }
    }
    
    let targetPath = filePath || 'index.html';
    if (targetPath === '' || targetPath === '/') {
      targetPath = 'index.html';
    }
    
    const file = appData.files[targetPath];
    if (!file) {
      const indexFile = appData.files['index.html'];
      if (indexFile) {
        res.setHeader('Content-Type', 'text/html');
        return res.send(Buffer.from(indexFile.content, 'base64'));
      }
      return res.status(404).send(`File not found: ${targetPath}`);
    }
    
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.send(Buffer.from(file.content, 'base64'));
  }

  async start() {
    await this.peerNetwork.start();
    
    this.app.listen(DAEMON_PORT, '127.0.0.1', () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║         G3TZKP PROTOCOL DAEMON v2.0.0                  ║');
      console.log('║              P2P MESH NETWORK EDITION                  ║');
      console.log('╠═══════════════════════════════════════════════════════╣');
      console.log(`║  Daemon running on: http://127.0.0.1:${DAEMON_PORT}             ║`);
      console.log(`║  Peer ID:           ${this.peerNetwork.peerId}  ║`);
      console.log(`║  Bootstrap node:    ${this.bootstrapUrl.substring(0, 35)}...  ║`);
      console.log('╠═══════════════════════════════════════════════════════╣');
      console.log('║  To open an app:                                       ║');
      console.log('║    g3tzkp://MESSENGER                                  ║');
      console.log('║    http://127.0.0.1:47777/open/MESSENGER               ║');
      console.log('╠═══════════════════════════════════════════════════════╣');
      console.log('║  P2P Status: http://127.0.0.1:47777/api/peers          ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('');
    });
  }
}

const daemon = new G3TZKPDaemon();
daemon.start();
