import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || process.env.GATEWAY_PORT || 5000;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NAME_LENGTH = 9;

function sanitizeName(name) {
  let result = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  result = result.replace(/0/g, '').replace(/1/g, '').replace(/8/g, 'B').replace(/9/g, 'G');
  return result.slice(0, MAX_NAME_LENGTH);
}

function nameToHashCode(name) {
  const normalized = sanitizeName(name);
  const padded = normalized.padEnd(MAX_NAME_LENGTH, 'A');
  
  let value = BigInt(normalized.length);
  
  for (let i = 0; i < MAX_NAME_LENGTH; i++) {
    const charIndex = ALPHABET.indexOf(padded[i]);
    value = value * BigInt(32) + BigInt(charIndex);
  }

  const chars = [];
  let remaining = value;
  
  for (let i = 0; i < 10; i++) {
    const idx = Number(remaining % BigInt(32));
    chars.unshift(ALPHABET[idx]);
    remaining = remaining / BigInt(32);
  }
  
  return 'G3-' + chars.join('');
}

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

app.get('/', (req, res) => {
  const deployDir = getDeployDir();
  let appsHtml = '';
  
  if (fs.existsSync(deployDir)) {
    const files = fs.readdirSync(deployDir).filter(f => f.endsWith('.json'));
    appsHtml = files.map(file => {
      const data = JSON.parse(fs.readFileSync(path.join(deployDir, file), 'utf8'));
      return `
        <div class="app">
          <div class="app-name">${data.manifest.name}</div>
          <div class="app-url"><a href="/${data.manifest.name}">localhost:${PORT}/${data.manifest.name}</a></div>
        </div>
      `;
    }).join('');
  }
  
  if (!appsHtml) {
    appsHtml = '<p style="color: #666;">No apps deployed yet. Use: g3tzkp-web deploy ./dist --name "MYAPP"</p>';
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>G3TZKP Gateway</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body {
            background: #000;
            color: #00f3ff;
            font-family: 'Courier New', monospace;
            padding: 40px;
            margin: 0;
            min-height: 100vh;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
          }
          .logo {
            font-size: 80px;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          h1 { font-size: 36px; margin-bottom: 10px; letter-spacing: 4px; }
          .subtitle { color: #4caf50; margin-bottom: 30px; }
          .info-box {
            background: #111;
            border: 1px solid #00f3ff;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
          }
          .info-box h3 { margin-top: 0; color: #4caf50; }
          code {
            background: #222;
            padding: 2px 6px;
            border-radius: 3px;
            color: #fff;
          }
          .apps { margin-top: 30px; text-align: left; }
          .apps h3 { color: #4caf50; }
          .app {
            background: #111;
            padding: 15px;
            margin: 10px 0;
            border: 1px solid #333;
            border-left: 3px solid #00f3ff;
          }
          .app:hover { border-color: #00f3ff; }
          .app-name { font-size: 18px; font-weight: bold; }
          .app-url { color: #4caf50; font-size: 14px; margin-top: 5px; }
          .app-url a { color: #4caf50; text-decoration: none; }
          .app-url a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">&#x2B22;</div>
          <h1>G3TZKP GATEWAY</h1>
          <p class="subtitle">Local Access Gateway v1.0.0</p>
          
          <div class="info-box">
            <h3>Access Apps</h3>
            <p>Open any deployed app in your browser:</p>
            <p><code>http://localhost:${PORT}/APP_NAME</code></p>
            <p>Example: <code>http://localhost:${PORT}/MESSENGER</code></p>
          </div>
          
          <div class="info-box">
            <h3>Deploy Apps</h3>
            <p>Use the CLI to deploy your web apps:</p>
            <p><code>g3tzkp-web deploy ./dist --name "MYAPP"</code></p>
          </div>
          
          <div class="apps">
            <h3>Deployed Apps</h3>
            ${appsHtml}
          </div>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', port: PORT });
});

app.get('/api/apps', (req, res) => {
  const deployDir = getDeployDir();
  
  if (!fs.existsSync(deployDir)) {
    return res.json({ apps: [] });
  }
  
  const files = fs.readdirSync(deployDir).filter(f => f.endsWith('.json'));
  const apps = files.map(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(deployDir, file), 'utf8'));
      let totalSize = 0;
      if (data.chunks) {
        Object.values(data.chunks).forEach((chunk) => {
          if (chunk.data) totalSize += Buffer.from(chunk.data, 'base64').length;
        });
      }
      return {
        name: data.manifest.name,
        appId: data.manifest.appId,
        version: data.manifest.version,
        fileCount: data.manifest.files.length,
        size: totalSize,
        deployedAt: data.deployedAt
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
  
  res.json({ apps });
});

app.get('/api/resolve/:name', (req, res) => {
  const name = sanitizeName(req.params.name);
  const hash = nameToHashCode(name);
  res.json({ 
    name, 
    hash, 
    url: `g3tzkp://${name}`,
    webUrl: `http://localhost:${PORT}/${name}`
  });
});

app.get('/api/manifest/:name', (req, res) => {
  const name = sanitizeName(req.params.name);
  const deployDir = getDeployDir();
  const deployPath = path.join(deployDir, `${name}.json`);
  
  if (!fs.existsSync(deployPath)) {
    return res.status(404).json({ error: 'App not found' });
  }
  
  const deployment = JSON.parse(fs.readFileSync(deployPath, 'utf8'));
  res.json(deployment.manifest);
});

const activePeers = new Map();

app.use(express.json());

app.post('/api/peers/announce', (req, res) => {
  const { peerId, port, apps, timestamp } = req.body;
  
  if (!peerId) {
    return res.status(400).json({ error: 'Missing peerId' });
  }
  
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.socket.remoteAddress?.replace('::ffff:', '') || 
             'unknown';
  
  activePeers.set(peerId, {
    peerId,
    ip,
    port: port || 47777,
    apps: apps || [],
    timestamp: timestamp || Date.now(),
    lastSeen: Date.now()
  });
  
  console.log(`[P2P] Peer announced: ${peerId} (${ip}:${port}) with ${apps?.length || 0} apps`);
  
  res.json({ 
    success: true, 
    peerId,
    totalPeers: activePeers.size
  });
});

app.get('/api/peers/list', (req, res) => {
  const now = Date.now();
  const timeout = 120000;
  
  const peers = [];
  for (const [id, peer] of activePeers) {
    if (now - peer.lastSeen > timeout) {
      activePeers.delete(id);
    } else {
      peers.push(peer);
    }
  }
  
  res.json({ 
    peers,
    total: peers.length,
    timestamp: now
  });
});

app.get('/api/peers/find/:appName', (req, res) => {
  const appName = sanitizeName(req.params.appName);
  const now = Date.now();
  const timeout = 120000;
  
  const peers = [];
  for (const [id, peer] of activePeers) {
    if (now - peer.lastSeen > timeout) {
      activePeers.delete(id);
      continue;
    }
    
    if (peer.apps && peer.apps.includes(appName)) {
      peers.push(peer);
    }
  }
  
  res.json({ 
    appName,
    peers,
    total: peers.length
  });
});

const daemonFiles = {
  'daemon.js': path.join(__dirname, '../../g3tzkp-daemon/src/daemon.js'),
  'peer-network.js': path.join(__dirname, '../../g3tzkp-daemon/src/peer-network.js'),
  'install.js': path.join(__dirname, '../../g3tzkp-daemon/scripts/install.js'),
  'protocol-handler.js': path.join(__dirname, '../../g3tzkp-daemon/scripts/protocol-handler.js')
};

app.get('/api/daemon-files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = daemonFiles[filename];
  
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(fs.readFileSync(filePath, 'utf8'));
});

app.get('/download', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Download G3TZKP Daemon</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body {
            background: #000;
            color: #00f3ff;
            font-family: 'Courier New', monospace;
            padding: 40px 20px;
            margin: 0;
            min-height: 100vh;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
          }
          .logo { font-size: 80px; margin-bottom: 20px; }
          h1 { font-size: 32px; letter-spacing: 3px; margin-bottom: 10px; }
          .subtitle { color: #4caf50; margin-bottom: 40px; }
          .download-box {
            background: #111;
            border: 2px solid #00f3ff;
            padding: 30px;
            margin: 20px 0;
            text-align: left;
          }
          .download-box h2 { color: #4caf50; margin-top: 0; }
          .btn {
            display: inline-block;
            background: #00f3ff;
            color: #000;
            padding: 15px 30px;
            text-decoration: none;
            font-weight: bold;
            margin: 10px;
            border: none;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
          }
          .btn:hover { background: #4caf50; }
          .btn-secondary {
            background: transparent;
            border: 2px solid #00f3ff;
            color: #00f3ff;
          }
          pre {
            background: #222;
            padding: 15px;
            overflow-x: auto;
            text-align: left;
            font-size: 14px;
            border-left: 3px solid #00f3ff;
          }
          code { color: #4caf50; }
          .steps { text-align: left; margin: 20px 0; }
          .steps li { margin: 15px 0; line-height: 1.6; }
          .network-info {
            background: #0a1a0a;
            border: 1px solid #4caf50;
            padding: 20px;
            margin: 30px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">&#x2B22;</div>
          <h1>G3TZKP PROTOCOL DAEMON</h1>
          <p class="subtitle">Join the P2P Mesh Network</p>
          
          <div class="download-box">
            <h2>Quick Install</h2>
            <p>Requires <a href="https://nodejs.org" style="color:#4caf50">Node.js 18+</a></p>
            
            <h3 style="color:#fff">Linux / macOS:</h3>
            <pre>curl -sL https://${req.headers.host}/install.sh | bash</pre>
            
            <h3 style="color:#fff">Windows (PowerShell as Admin):</h3>
            <pre>irm https://${req.headers.host}/install.ps1 | iex</pre>
          </div>
          
          <div class="download-box">
            <h2>Manual Download</h2>
            <a href="/install.sh" class="btn">Download for Linux/macOS</a>
            <a href="/install.ps1" class="btn">Download for Windows</a>
          </div>
          
          <div class="download-box">
            <h2>After Installation</h2>
            <ol class="steps">
              <li>Start the daemon: <code>cd ~/.g3tzkp/daemon && npm start</code></li>
              <li>Open in browser: <code>g3tzkp://MESSENGER</code></li>
              <li>Or visit: <code>http://127.0.0.1:47777/open/MESSENGER</code></li>
            </ol>
          </div>
          
          <div class="network-info">
            <h3 style="color:#4caf50;margin-top:0">Network Status</h3>
            <p>Bootstrap Node: <code>Online</code></p>
            <p>Active Peers: <code id="peerCount">Loading...</code></p>
            <p>Available Apps: <code id="appCount">Loading...</code></p>
          </div>
          
          <p style="margin-top:40px">
            <a href="/" class="btn btn-secondary">Back to Gateway</a>
          </p>
        </div>
        
        <script>
          fetch('/api/peers/list').then(r => r.json()).then(d => {
            document.getElementById('peerCount').textContent = d.total || 0;
          }).catch(() => {
            document.getElementById('peerCount').textContent = '0';
          });
          fetch('/api/apps').then(r => r.json()).then(d => {
            document.getElementById('appCount').textContent = d.apps?.length || 0;
          }).catch(() => {
            document.getElementById('appCount').textContent = '0';
          });
        </script>
      </body>
    </html>
  `);
});

app.get('/install.sh', (req, res) => {
  const installPath = path.join(__dirname, '../../g3tzkp-daemon/install-g3tzkp.sh');
  if (fs.existsSync(installPath)) {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="install-g3tzkp.sh"');
    res.send(fs.readFileSync(installPath, 'utf8'));
  } else {
    res.status(404).send('Installer not found');
  }
});

app.get('/install.ps1', (req, res) => {
  const installPath = path.join(__dirname, '../../g3tzkp-daemon/install-g3tzkp.ps1');
  if (fs.existsSync(installPath)) {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="install-g3tzkp.ps1"');
    res.send(fs.readFileSync(installPath, 'utf8'));
  } else {
    res.status(404).send('Installer not found');
  }
});

app.get('/:appName', (req, res) => {
  serveApp(req, res, req.params.appName, '');
});

app.get('/:appName/*', (req, res) => {
  const appName = req.params.appName;
  const filePath = req.params[0] || '';
  serveApp(req, res, appName, filePath);
});

function getDeployDir() {
  return path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.g3tzkp', 'deployments');
}

function serveApp(req, res, appName, filePath) {
  if (appName === 'api') return;
  
  const normalizedName = sanitizeName(appName);
  const deployDir = getDeployDir();
  const deployPath = path.join(deployDir, `${normalizedName}.json`);
  
  if (!fs.existsSync(deployPath)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>App Not Found - G3TZKP</title>
          <style>
            body {
              background: #000;
              color: #ff4444;
              font-family: 'Courier New', monospace;
              padding: 40px;
              text-align: center;
            }
            h1 { font-size: 48px; }
            a { color: #00f3ff; }
            code { background: #222; padding: 2px 8px; }
          </style>
        </head>
        <body>
          <h1>404</h1>
          <p>No app deployed with name: <code>${appName}</code></p>
          <p style="margin-top: 30px;">
            <a href="/">Back to Gateway</a>
          </p>
        </body>
      </html>
    `);
  }
  
  try {
    const deployment = JSON.parse(fs.readFileSync(deployPath, 'utf8'));
    const manifest = deployment.manifest;
    
    let targetPath = filePath;
    if (!targetPath || targetPath === '' || targetPath === '/') {
      targetPath = manifest.entryPoint || 'index.html';
    }
    
    const fileEntry = manifest.files.find(f => 
      f.path === targetPath || 
      f.path === targetPath.replace(/^\//, '')
    );
    
    if (!fileEntry) {
      const indexFile = manifest.files.find(f => f.path === 'index.html');
      if (indexFile) {
        return serveFileFromChunks(res, indexFile, deployment.chunks);
      }
      return res.status(404).send('File not found: ' + targetPath);
    }
    
    serveFileFromChunks(res, fileEntry, deployment.chunks);
    
  } catch (error) {
    console.error('Error serving app:', error);
    res.status(500).send('Error loading app: ' + error.message);
  }
}

function serveFileFromChunks(res, fileEntry, chunks) {
  const buffers = [];
  
  for (const chunkInfo of fileEntry.chunks) {
    const chunk = chunks[chunkInfo.hash];
    if (!chunk) {
      return res.status(500).send('Missing chunk: ' + chunkInfo.hash);
    }
    buffers.push(Buffer.from(chunk.data, 'base64'));
  }
  
  const content = Buffer.concat(buffers);
  res.setHeader('Content-Type', fileEntry.mimeType);
  res.setHeader('Content-Length', content.length);
  res.send(content);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[G3TZKP Gateway] Running on http://localhost:${PORT}`);
  console.log(`[G3TZKP Gateway] Access apps at: http://localhost:${PORT}/APP_NAME`);
});
