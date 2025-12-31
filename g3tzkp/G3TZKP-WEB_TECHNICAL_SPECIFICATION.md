# G3TZKP-WEB Technical Specification v1.0

## EXECUTIVE SUMMARY

G3TZKP-WEB is a protocol extension for deploying, hosting, and serving web applications over the G3TZKP peer-to-peer network without any centralized servers. Applications are distributed across the peer network, cached locally by visitors, and served peer-to-peer with real-time state synchronization.

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    G3TZKP-WEB STACK                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Web Application (React/Vue/Vanilla)               │
│           ↕ State sync via G3TZKPWebApp API                 │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: G3TZKPWebService (Deployment & Hosting)           │
│           ↕ App distribution & version control              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: G3TZKPWebCache (Content Distribution)             │
│           ↕ Chunking, verification, P2P serving             │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: G3TZKPService (P2P Protocol)                      │
│           ↕ WebRTC connections, encryption                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: Browser APIs (WebRTC, IndexedDB, Crypto)          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
Developer → Deploy → Genesis Node → Broadcast → Peer Network → Visitor
    ↓                    ↓              ↓            ↓            ↓
  Build              Package        Distribute    Cache        Render
  Assets             Manifest       Chunks        Locally      App
```

---

## 2. PROTOCOL SPECIFICATION

### 2.1 App Identifier Format

```
g3tzkp://<appId>/<route>?<params>

Components:
- appId: 43-character base58 peer ID (same as G3TZKP peer ID)
- route: Standard URL path (optional)
- params: Standard URL query parameters (optional)

Examples:
g3tzkp://G3-BmFqexLpTonUiYP4YzRLqphG3QLfnWZYjaqFQ6gW
g3tzkp://G3-BmFqexLpTonUiYP4YzRLqphG3QLfnWZYjaqFQ6gW/products
g3tzkp://G3-BmFqexLpTonUiYP4YzRLqphG3QLfnWZYjaqFQ6gW/product/123
```

### 2.2 Message Types

All G3TZKP-WEB messages are JSON objects with a `type` field:

#### 2.2.1 APP_DEPLOYMENT
```typescript
{
  type: 'APP_DEPLOYMENT',
  appId: string,              // Unique app identifier (peer ID)
  version: string,            // Semantic version (e.g., "1.0.0")
  manifest: AppManifest,      // App metadata and file list
  timestamp: number,          // Deployment timestamp
  signature: string           // Cryptographic signature
}
```

#### 2.2.2 APP_CHUNK_REQUEST
```typescript
{
  type: 'APP_CHUNK_REQUEST',
  appId: string,
  chunkHash: string,          // SHA-256 hash of requested chunk
  requesterId: string         // Peer ID of requester
}
```

#### 2.2.3 APP_CHUNK_RESPONSE
```typescript
{
  type: 'APP_CHUNK_RESPONSE',
  appId: string,
  chunkHash: string,
  chunkData: ArrayBuffer,     // Actual chunk data
  chunkIndex: number          // Position in file
}
```

#### 2.2.4 APP_STATE_UPDATE
```typescript
{
  type: 'APP_STATE_UPDATE',
  appId: string,
  stateKey: string,           // State namespace
  stateData: any,             // Application state
  timestamp: number,
  senderId: string
}
```

#### 2.2.5 APP_MANIFEST_REQUEST
```typescript
{
  type: 'APP_MANIFEST_REQUEST',
  appId: string,
  requesterId: string
}
```

#### 2.2.6 APP_MANIFEST_RESPONSE
```typescript
{
  type: 'APP_MANIFEST_RESPONSE',
  appId: string,
  manifest: AppManifest
}
```

### 2.3 App Manifest Structure

```typescript
interface AppManifest {
  appId: string;
  version: string;
  name: string;
  description: string;
  author: string;
  
  // Entry points
  entryPoint: string;         // Main HTML file (e.g., "index.html")
  
  // File list with integrity hashes
  files: AppFile[];
  
  // Dependencies
  dependencies: string[];
  
  // Permissions required
  permissions: string[];
  
  // Cache strategy
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
  cacheDuration: number;      // Milliseconds
  
  // Deployment info
  deployedAt: number;
  deployedBy: string;
  previousVersion?: string;
  
  // Signature
  manifestHash: string;
  signature: string;
}

interface AppFile {
  path: string;               // Relative path (e.g., "css/style.css")
  size: number;               // Bytes
  mimeType: string;           // MIME type
  hash: string;               // SHA-256 hash
  chunks: ChunkInfo[];        // For files > 256KB
}

interface ChunkInfo {
  index: number;
  hash: string;               // SHA-256 of this chunk
  size: number;               // Bytes
}
```

---

## 3. CONTENT DISTRIBUTION

### 3.1 Chunking Strategy

```
File Size      Chunks      Strategy
---------      ------      --------
< 256 KB       1           Single chunk, inline in manifest response
256KB - 5MB    2-20        Sequential download from fastest peer
> 5 MB         20+         Parallel download from multiple peers
```

### 3.2 Chunk Size

```
Standard chunk size: 256 KB (262,144 bytes)
Last chunk: Variable (remaining bytes)
```

### 3.3 Verification

```typescript
// Every chunk verified before caching
async function verifyChunk(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
  const actualHash = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(actualHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex === expectedHash;
}
```

### 3.4 Cache Storage

```
IndexedDB Structure:

Database: g3tzkp-web-cache
  
  Object Store: apps
    Key: appId
    Value: {
      manifest: AppManifest,
      installedAt: number,
      lastUsed: number,
      cacheExpiry: number
    }
  
  Object Store: chunks
    Key: chunkHash
    Value: {
      data: ArrayBuffer,
      appId: string,
      cachedAt: number,
      accessCount: number
    }
  
  Object Store: state
    Key: `${appId}:${stateKey}`
    Value: {
      data: any,
      updatedAt: number,
      version: number
    }
```

---

## 4. DEPLOYMENT PROCESS

### 4.1 Developer Workflow

```bash
# 1. Build app
npm run build

# 2. Deploy to G3TZKP network
g3tzkp-web deploy ./dist --name "My App"

# Output:
✅ App deployed successfully!
📱 App ID: G3-BmFqexLpTonUiYP4YzRLqphG3QLfnWZYjaqFQ6gW
🌐 URL: g3tzkp://G3-BmFqexLpTonUiYP4YzRLqphG3QLfnWZYjaqFQ6gW
📦 Size: 2.4 MB (9 chunks)
⏱️  Broadcast to 42 peers in 1.2s
```

### 4.2 Deployment Algorithm

```
1. Scan build directory
2. Generate file list with hashes
3. Split files into 256KB chunks
4. Create manifest with chunk metadata
5. Sign manifest with deployer's key
6. Broadcast APP_DEPLOYMENT to network
7. Serve chunks to requesting peers
8. Monitor peer adoption (optional)
```

---

## 5. VISITOR EXPERIENCE

### 5.1 App Loading Flow

```
User enters: g3tzkp://G3-xxx...
    ↓
Browser checks cache
    ↓
If cached and fresh → Load instantly
    ↓
If not cached → Discovery phase
    ↓
1. Request manifest from network
2. Find peers with app chunks
3. Download chunks (parallel)
4. Verify each chunk
5. Assemble files
6. Cache locally
7. Render app
    ↓
Total time: 0.5s - 3s (first visit)
            <100ms (cached)
```

### 5.2 Loading States

```typescript
enum AppLoadState {
  CHECKING_CACHE = 'Checking cache...',
  DISCOVERING_PEERS = 'Finding peers...',
  DOWNLOADING = 'Downloading... (X%)',
  VERIFYING = 'Verifying integrity...',
  READY = 'Ready',
  ERROR = 'Load failed'
}
```

---

## 6. STATE SYNCHRONIZATION

### 6.1 Real-Time State Updates

Apps can sync state across all active users:

```typescript
// Developer API
await g3tzkpWeb.syncState('shopping-cart', {
  items: [...],
  total: 123.45
});

// All peers with this app open receive update
// Triggers callback: onStateUpdate('shopping-cart', data)
```

### 6.2 Conflict Resolution

```
Strategy: Last-Write-Wins (LWW)

Conflict scenario:
- Peer A updates state at T=100
- Peer B updates state at T=105
- Both broadcast updates

Resolution:
- All peers accept update with highest timestamp (T=105)
- Peer A's update discarded

Alternative: Application-level CRDT (optional)
```

---

## 7. SECURITY

### 7.1 App Integrity

```
1. Manifest signed by deployer
2. Each file hash verified
3. Each chunk hash verified
4. Tampered content rejected
5. Only verified chunks cached
```

### 7.2 Permissions Model

```typescript
interface AppPermissions {
  network: boolean;           // Can make external HTTP requests?
  storage: boolean;           // Can use localStorage/IndexedDB?
  camera: boolean;            // Can access camera?
  microphone: boolean;        // Can access microphone?
  location: boolean;          // Can access geolocation?
  notifications: boolean;     // Can send notifications?
}

// User must approve permissions on first run
```

### 7.3 Sandboxing

Apps run in isolated contexts:

```typescript
// Each app gets isolated environment
const appFrame = document.createElement('iframe');
appFrame.sandbox = 'allow-scripts allow-same-origin';
appFrame.srcdoc = appHTML;

// Apps cannot access:
// - Parent window
// - Other apps' storage
// - G3TZKP service directly (only via API)
```

---

## 8. PERFORMANCE SPECIFICATIONS

### 8.1 Target Metrics

```
Metric                    Target              Measurement
------                    ------              -----------
Initial load (cached)     < 100ms             Time to interactive
Initial load (uncached)   < 3s                Time to interactive
Chunk download            < 50ms/chunk        Average per 256KB
State sync latency        < 100ms             Update propagation
Memory usage              < 50MB/app          Runtime footprint
Cache size                < 500MB total       All apps combined
```

### 8.2 Optimization Strategies

```
1. Aggressive caching (cache-first strategy)
2. Parallel chunk downloads (max 6 simultaneous)
3. Compression (gzip for text assets)
4. Delta updates (only changed files)
5. Lazy loading (load chunks on demand)
```

---

## 9. API SPECIFICATION

### 9.1 Deployment API

```typescript
interface G3TZKPWebDeployAPI {
  deploy(buildDir: string, options: DeployOptions): Promise<AppDeployment>;
  update(appId: string, buildDir: string): Promise<AppDeployment>;
  undeploy(appId: string): Promise<boolean>;
  getDeploymentInfo(appId: string): Promise<AppDeployment>;
}

interface DeployOptions {
  name: string;
  description?: string;
  version?: string;
  permissions?: AppPermissions;
  cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';
}
```

### 9.2 Runtime API (Available to Apps)

```typescript
interface G3TZKPWebAppAPI {
  // State management
  getState(key: string): Promise<any>;
  setState(key: string, value: any): Promise<void>;
  onStateUpdate(callback: (key: string, value: any) => void): void;
  
  // Peer info
  getPeerId(): string;
  getConnectedPeers(): string[];
  
  // Messaging
  sendToPeer(peerId: string, message: any): Promise<void>;
  broadcast(message: any): Promise<void>;
  onMessage(callback: (from: string, message: any) => void): void;
  
  // App metadata
  getAppId(): string;
  getVersion(): string;
  getManifest(): AppManifest;
}
```

---

## 10. EXAMPLE IMPLEMENTATIONS

### 10.1 Simple Chat App

```typescript
// app.ts
import { G3TZKPWebApp } from 'g3tzkp-web';

class ChatApp extends G3TZKPWebApp {
  async onMount() {
    // Listen for chat messages
    this.onMessage((from, msg) => {
      this.addMessage(from, msg.text);
    });
    
    // Load chat history from shared state
    const history = await this.getState('chat-history');
    this.renderHistory(history);
  }
  
  async sendMessage(text: string) {
    const msg = { text, sender: this.getPeerId(), time: Date.now() };
    
    // Broadcast to all peers
    await this.broadcast(msg);
    
    // Update shared state
    const history = await this.getState('chat-history') || [];
    history.push(msg);
    await this.setState('chat-history', history);
  }
}
```

### 10.2 Collaborative Whiteboard

```typescript
class WhiteboardApp extends G3TZKPWebApp {
  async onMount() {
    // Sync drawing state
    this.onStateUpdate('canvas', (canvasData) => {
      this.renderCanvas(canvasData);
    });
  }
  
  async onDraw(x: number, y: number) {
    const canvas = await this.getState('canvas') || [];
    canvas.push({ x, y, time: Date.now(), peer: this.getPeerId() });
    
    // Real-time sync to all viewers
    await this.setState('canvas', canvas);
  }
}
```

---

## 11. COMPARISON WITH ALTERNATIVES

```
Feature               G3TZKP-WEB    IPFS       Traditional
-------               ----------    ----       -----------
Server required       No            No         Yes
Deployment cost       $0            $0         $5-500/mo
Real-time state sync  Yes           No         Yes (server)
Cold start time       0.5-3s        2-10s      0.1-1s
Censorship resistant  Yes           Yes        No
Domain names          Peer IDs      CIDs       DNS
Update propagation    Instant       Manual     Instant
Browser support       Any (WebRTC)  Gateway    Any
```

---

## 12. LIMITATIONS & CONSTRAINTS

### 12.1 Known Limitations

```
1. Initial load slower than traditional hosting (first visit)
2. Requires JavaScript enabled
3. Apps must be under 100MB (practical limit)
4. No server-side rendering (SSR)
5. Limited to browser APIs (no Node.js APIs)
```

### 12.2 Not Suitable For

```
- Apps requiring server-side logic (use G3TZKP + backend)
- Apps with large media libraries (use hybrid approach)
- Apps requiring SEO (use gateway with pre-rendering)
- Mission-critical services needing 99.99% uptime
```

---

## 13. FUTURE EXTENSIONS

### 13.1 Planned Features

```
- Delta updates (only transfer changed files)
- Progressive Web App (PWA) integration
- Service Worker caching
- WebAssembly support
- Multi-version support (A/B testing)
- Analytics (privacy-preserving)
- Monetization layer (optional payments)
```

### 13.2 Research Areas

```
- CRDT-based state synchronization
- Content-addressed storage (like IPFS)
- Proof-of-storage for long-term availability
- Integration with blockchain for app registry
```

---

## 14. IMPLEMENTATION REQUIREMENTS

### 14.1 Minimum Browser Requirements

```
Chrome/Edge:  88+
Firefox:      78+
Safari:       14+
Opera:        74+

Required APIs:
- WebRTC
- IndexedDB
- Web Crypto API
- Service Workers (optional)
- WebAssembly (optional)
```

### 14.2 Dependencies

```json
{
  "dependencies": {
    "none": "Pure JavaScript implementation"
  },
  "peerDependencies": {
    "G3TZKPService": "^1.0.0"
  }
}
```

---

## 15. COMPLIANCE & STANDARDS

### 15.1 Standards Adherence

```
- WebRTC 1.0 (W3C Recommendation)
- IndexedDB 3.0 (W3C Recommendation)
- Web Crypto API (W3C Recommendation)
- Semantic Versioning 2.0.0
- JSON Schema Draft 7
```

### 15.2 License

```
MIT License - Free for commercial and personal use
```

---

## APPENDIX A: MESSAGE FLOW DIAGRAMS

### A.1 App Deployment Flow

```
Developer                 Genesis Node              Peer Network
    │                           │                         │
    │──deploy(app)─────────────>│                         │
    │                           │                         │
    │                           │──APP_DEPLOYMENT────────>│
    │                           │   (broadcast)           │
    │                           │                         │
    │                           │<──chunk requests────────│
    │                           │                         │
    │                           │──chunks────────────────>│
    │                           │                         │
    │<──deployment complete─────│                         │
```

### A.2 Visitor Load Flow

```
Visitor                   Peer Network              Cache
   │                           │                       │
   │──g3tzkp://app-id─────────>│                       │
   │                           │                       │
   │                           │──check cache─────────>│
   │                           │<──not found───────────│
   │                           │                       │
   │                           │──REQUEST_MANIFEST────>│
   │                           │<──manifest────────────│
   │                           │                       │
   │                           │──REQUEST_CHUNKS──────>│
   │                           │<──chunks──────────────│
   │                           │                       │
   │                           │──verify & cache──────>│
   │                           │                       │
   │<──render app──────────────│                       │
```

---

## APPENDIX B: CODE EXAMPLES

### B.1 Complete Deployment Script

```typescript
import { g3tzkpWeb } from 'g3tzkp-web';

async function deployMyApp() {
  const deployment = await g3tzkpWeb.deploy('./dist', {
    name: 'My Awesome App',
    version: '1.0.0',
    permissions: {
      network: true,
      storage: true
    }
  });
  
  console.log(`Deployed: ${deployment.url}`);
  console.log(`App ID: ${deployment.appId}`);
}
```

### B.2 Complete App Implementation

```typescript
import { G3TZKPWebApp } from 'g3tzkp-web';

class MyApp extends G3TZKPWebApp {
  async onMount() {
    this.render();
    this.onStateUpdate('counter', (count) => {
      this.updateDisplay(count);
    });
  }
  
  async incrementCounter() {
    const current = await this.getState('counter') || 0;
    await this.setState('counter', current + 1);
  }
  
  render() {
    document.body.innerHTML = `
      <h1>Distributed Counter</h1>
      <div id="count">0</div>
      <button onclick="app.incrementCounter()">+1</button>
    `;
  }
}

const app = new MyApp();
app.start();
```

---

**END OF SPECIFICATION**

Version: 1.0.0  
Date: 2024-12-30  
Status: Implementation Ready  
