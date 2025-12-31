import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { nameRegistry } from './name-registry.js';

const CHUNK_SIZE = 256 * 1024;

export class Deployer {
  constructor() {
    this.keyPair = null;
    this.peerId = null;
  }

  async initialize() {
    const keyPath = path.join(process.env.HOME || process.env.USERPROFILE, '.g3tzkp', 'keys.json');
    
    try {
      if (fs.existsSync(keyPath)) {
        const data = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        this.keyPair = {
          publicKey: naclUtil.decodeBase64(data.publicKey),
          secretKey: naclUtil.decodeBase64(data.secretKey)
        };
        this.peerId = data.peerId;
      } else {
        this.keyPair = nacl.sign.keyPair();
        this.peerId = 'G3-' + naclUtil.encodeBase64(this.keyPair.publicKey).slice(0, 43);
        
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
        fs.writeFileSync(keyPath, JSON.stringify({
          publicKey: naclUtil.encodeBase64(this.keyPair.publicKey),
          secretKey: naclUtil.encodeBase64(this.keyPair.secretKey),
          peerId: this.peerId
        }));
      }
    } catch (error) {
      this.keyPair = nacl.sign.keyPair();
      this.peerId = 'G3-' + naclUtil.encodeBase64(this.keyPair.publicKey).slice(0, 43);
    }
  }

  scanDirectory(dirPath) {
    const files = new Map();
    
    const scan = (currentPath, relativePath = '') => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relPath = path.join(relativePath, entry.name).replace(/\\/g, '/');
        
        if (entry.isDirectory()) {
          scan(fullPath, relPath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          files.set(relPath, content);
        }
      }
    };
    
    scan(dirPath);
    return files;
  }

  hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  chunkFile(content) {
    const chunks = [];
    const buffer = Buffer.from(content);
    
    for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
      const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
      const hash = this.hashContent(chunk);
      chunks.push({
        index: chunks.length,
        hash,
        size: chunk.length,
        data: chunk.toString('base64')
      });
    }
    
    return chunks;
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  signManifest(manifest) {
    const data = JSON.stringify({
      appId: manifest.appId,
      name: manifest.name,
      version: manifest.version,
      files: manifest.files.map(f => ({ path: f.path, hash: f.hash })),
      deployedAt: manifest.deployedAt,
      deployer: manifest.deployer
    });
    
    const signature = nacl.sign.detached(
      naclUtil.decodeUTF8(data),
      this.keyPair.secretKey
    );
    
    return naclUtil.encodeBase64(signature);
  }

  async deploy(dirPath, options = {}) {
    await this.initialize();
    
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }

    const files = this.scanDirectory(dirPath);
    if (files.size === 0) {
      throw new Error('No files found in directory');
    }

    const appName = options.name ? nameRegistry.sanitizeName(options.name) : 'APP';
    const claim = nameRegistry.registerName(appName, this.peerId);

    const manifestFiles = [];
    const allChunks = new Map();
    let totalSize = 0;

    for (const [filePath, content] of files) {
      const hash = this.hashContent(content);
      const chunks = this.chunkFile(content);
      
      for (const chunk of chunks) {
        allChunks.set(chunk.hash, chunk);
      }

      manifestFiles.push({
        path: filePath,
        hash,
        size: content.length,
        mimeType: this.getMimeType(filePath),
        chunks: chunks.map(c => ({
          index: c.index,
          hash: c.hash,
          size: c.size
        }))
      });

      totalSize += content.length;
    }

    const manifest = {
      appId: claim.hash,
      name: appName,
      shortName: appName,
      version: options.version || '1.0.0',
      description: options.description || `${appName} - Deployed on G3TZKP Web`,
      deployer: this.peerId,
      deployedAt: Date.now(),
      files: manifestFiles,
      entryPoint: this.findEntryPoint(manifestFiles),
      signature: ''
    };

    manifest.signature = this.signManifest(manifest);

    return {
      manifest,
      chunks: allChunks,
      claim,
      stats: {
        totalSize,
        fileCount: files.size,
        chunkCount: allChunks.size,
        appId: claim.hash,
        url: `g3tzkp://${appName}`,
        webUrl: `http://localhost:8080/${appName}`
      }
    };
  }

  findEntryPoint(files) {
    const priorities = ['index.html', 'index.htm', 'default.html', 'main.html'];
    
    for (const priority of priorities) {
      const file = files.find(f => f.path === priority || f.path.endsWith('/' + priority));
      if (file) return file.path;
    }
    
    const htmlFile = files.find(f => f.path.endsWith('.html'));
    if (htmlFile) return htmlFile.path;
    
    return files[0]?.path || 'index.html';
  }
}

export const deployer = new Deployer();
