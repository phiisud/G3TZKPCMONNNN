import express from 'express';
import path from 'path';
import fs from 'fs';
import { nameRegistry } from './name-registry.js';

let server = null;

export async function startGateway(port = 8080) {
  if (server) {
    console.log('Gateway already running');
    return;
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
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>G3TZKP Gateway</title>
          <style>
            body {
              background: #000;
              color: #00f3ff;
              font-family: 'Courier New', monospace;
              padding: 40px;
              text-align: center;
            }
            h1 { font-size: 48px; margin-bottom: 20px; }
            .logo { font-size: 80px; margin-bottom: 20px; }
            .info { color: #4caf50; margin: 20px 0; }
            a { color: #00f3ff; }
            .apps { margin-top: 40px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto; }
            .app { background: #111; padding: 15px; margin: 10px 0; border: 1px solid #00f3ff; }
            .app-name { font-size: 18px; font-weight: bold; }
            .app-url { color: #4caf50; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="logo">&#x2B22;</div>
          <h1>G3TZKP GATEWAY</h1>
          <p class="info">Local Access Gateway v1.0.0</p>
          <p>Access deployed apps at: <code>http://localhost:${port}/APP_NAME</code></p>
          <div class="apps" id="apps">Loading deployed apps...</div>
          <script>
            fetch('/api/apps')
              .then(r => r.json())
              .then(apps => {
                const container = document.getElementById('apps');
                if (apps.length === 0) {
                  container.innerHTML = '<p style="color: #666;">No apps deployed yet</p>';
                  return;
                }
                container.innerHTML = apps.map(app => 
                  '<div class="app">' +
                  '<div class="app-name">' + app.name + '</div>' +
                  '<div class="app-url"><a href="/' + app.name + '">http://localhost:${port}/' + app.name + '</a></div>' +
                  '</div>'
                ).join('');
              });
          </script>
        </body>
      </html>
    `);
  });

  app.get('/api/apps', (req, res) => {
    const deployDir = path.join(process.env.HOME || process.env.USERPROFILE, '.g3tzkp', 'deployments');
    
    if (!fs.existsSync(deployDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(deployDir).filter(f => f.endsWith('.json'));
    const apps = files.map(file => {
      const data = JSON.parse(fs.readFileSync(path.join(deployDir, file), 'utf8'));
      return {
        name: data.manifest.name,
        appId: data.manifest.appId,
        version: data.manifest.version,
        deployedAt: data.deployedAt
      };
    });
    
    res.json(apps);
  });

  app.get('/api/resolve/:name', (req, res) => {
    const name = req.params.name.toUpperCase();
    const hash = nameRegistry.nameToHashCode(name);
    res.json({ name, hash, url: `g3tzkp://${name}` });
  });

  app.get('/:appName', (req, res) => {
    serveApp(req, res, req.params.appName, 'index.html');
  });

  app.get('/:appName/*', (req, res) => {
    const appName = req.params.appName;
    const filePath = req.params[0] || 'index.html';
    serveApp(req, res, appName, filePath);
  });

  function serveApp(req, res, appName, filePath) {
    const normalizedName = nameRegistry.sanitizeName(appName);
    const deployDir = path.join(process.env.HOME || process.env.USERPROFILE, '.g3tzkp', 'deployments');
    const deployPath = path.join(deployDir, `${normalizedName}.json`);
    
    if (!fs.existsSync(deployPath)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>App Not Found</title>
          <style>
            body { background: #000; color: #ff4444; font-family: monospace; padding: 40px; text-align: center; }
          </style></head>
          <body>
            <h1>404 - App Not Found</h1>
            <p>No app deployed with name: ${appName}</p>
            <p><a href="/" style="color: #00f3ff;">Back to Gateway</a></p>
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
        f.path === targetPath.replace(/^\//, '') ||
        f.path === 'index.html' && targetPath === ''
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
      res.status(500).send('Error loading app');
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

  return new Promise((resolve, reject) => {
    server = app.listen(port, '0.0.0.0', () => {
      console.log(`G3TZKP Gateway running on http://localhost:${port}`);
      resolve(server);
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${port} already in use, gateway may already be running`);
        resolve(null);
      } else {
        reject(error);
      }
    });
  });
}

export async function stopGateway() {
  if (server) {
    server.close();
    server = null;
  }
}

if (process.argv[1]?.endsWith('gateway.js')) {
  const port = parseInt(process.env.PORT || '48080');
  startGateway(port).then(() => {
    console.log('Gateway started in standalone mode');
  });
}
