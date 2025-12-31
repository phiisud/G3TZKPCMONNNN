# G3TZKP Protocol Technical Specification v1.0

## Part 1: LibP2P Limitations for G3TZKP Messenger

### 1.1 NAT Traversal Failure Points

| Issue | Technical Detail | Impact |
|-------|------------------|--------|
| **No TURN Server Hosting** | Browser nodes cannot host TURN servers. LibP2P relies on circuit-relay-v2 which requires external relay infrastructure. | Peers behind symmetric NAT cannot connect without public relays |
| **Hole Punching Unreliable** | DCUtR (Direct Connection Upgrade through Relay) fails 30-50% of the time on carrier-grade NAT | Connection establishment is a coin flip |
| **STUN Dependency** | Public STUN servers can rate-limit or block requests | No fallback when STUN fails |
| **Relay Bandwidth** | Public relays throttle data; no SLA or guarantees | Messages delayed or dropped during high traffic |

### 1.2 Dependency Complexity

```
LibP2P Dependency Tree (40+ packages):
├── libp2p@3.1.2 (core)
├── @chainsafe/libp2p-gossipsub@14.x (pubsub)
├── @chainsafe/libp2p-noise@16.x (encryption)
├── @chainsafe/libp2p-yamux@7.x (stream muxer)
├── @libp2p/bootstrap@12.x
├── @libp2p/circuit-relay-v2@4.x
├── @libp2p/identify@3.x
├── @libp2p/kad-dht@16.x
├── @libp2p/peer-id@6.x
├── @libp2p/webrtc@5.x
├── @libp2p/websockets@9.x
├── @multiformats/multiaddr@12.x
└── 30+ transitive dependencies...
```

**Problems:**
- Bundle size: 1.1MB just for libp2p-bundle.js
- Security audit nightmare: 40+ packages to audit
- Version conflicts: Constant peer dependency hell
- Breaking changes: Major version bumps every 3-6 months
- Documentation: Spread across dozens of repos, often outdated

### 1.3 Unreliable Public Infrastructure

| Component | Status | Risk |
|-----------|--------|------|
| **Bootstrap Nodes** | Community-operated | Go offline without warning |
| **Public Relays** | No SLA | Throttled, overloaded, or blocked |
| **DHT Network** | Shared with all libp2p apps | Polluted with unrelated traffic |
| **IPFS Gateways** | Rate-limited | 429 errors common |

**Reality:** G3TZKP's P2P connectivity depends entirely on infrastructure we don't control.

### 1.4 Connection Establishment Overhead

```
LibP2P Connection Handshake (5-15 seconds):
1. Multiaddr resolution (DNS lookup)
2. Transport negotiation (WebRTC/WebSocket/WebTransport)
3. Security handshake (Noise XX pattern)
4. Stream multiplexer negotiation (yamux/mplex)
5. Identify protocol exchange
6. KadDHT routing table update
7. GossipSub subscription
8. Circuit relay reservation (if needed)
9. DCUtR hole punch attempt (if needed)
10. Finally: message delivery
```

**For a simple "send message to peer" operation, LibP2P adds 5-15 seconds of protocol overhead.**

### 1.5 Browser Sandbox Limitations

| Limitation | Impact |
|------------|--------|
| **Tab closure = peer death** | No background execution; closing tab disconnects immediately |
| **Service Worker limitations** | Cannot run libp2p in SW; no WebRTC in SW |
| **No persistent listeners** | Cannot receive incoming connections when app closed |
| **Memory pressure** | Browsers kill long-running WebRTC connections |
| **Mobile browsers** | Background tabs suspended after ~30 seconds |

### 1.6 Overcomplicated for Messaging

LibP2P was designed for IPFS file distribution. For a messaging app:

| LibP2P Feature | Needed for G3TZKP? | Overhead |
|----------------|-------------------|----------|
| KadDHT | No (we use direct peer exchange) | DHT maintenance traffic, routing table bloat |
| GossipSub | No (direct messages, not broadcast) | Subscription overhead, mesh maintenance |
| Content Routing | No (not a file system) | Unnecessary abstraction |
| Multiaddr | No (we know our endpoints) | Address parsing complexity |
| Protocol Negotiation | Minimal | Adds latency to every connection |

**Conclusion:** LibP2P is a 10-ton bulldozer for a job requiring a hand shovel.

---

## Part 2: G3TZKP Protocol Specification

### 2.1 Design Philosophy

```
G3TZKP Protocol Principles:
1. SIMPLE - Minimal moving parts
2. DIRECT - Peer-to-peer with no intermediaries where possible
3. SELF-SOVEREIGN - Each node is its own server
4. ORGANIC - Network grows from 2 nodes outward
5. ZERO EXTERNAL DEPENDENCY - No public infrastructure required
```

### 2.2 Node Architecture

Each G3TZKP node consists of three layers:

```
┌─────────────────────────────────────────────────────┐
│                    PWA LAYER                         │
│  React UI + Service Worker + IndexedDB Storage      │
├─────────────────────────────────────────────────────┤
│                 COMPANION NODE                       │
│  Local Server (Electron/Capacitor/WASM)             │
│  - WebSocket listener on localhost:PORT             │
│  - WebRTC signaling broker                          │
│  - Background persistence                           │
├─────────────────────────────────────────────────────┤
│                  PEER IDENTITY                       │
│  Post-Quantum Keypair (Kyber KEM + Dilithium Sig)  │
│  Peer ID = Base58(SHA256(PublicKey))               │
└─────────────────────────────────────────────────────┘
```

### 2.3 Peer Identity Scheme

```typescript
interface G3TZKPIdentity {
  peerId: string;              // "G3-" + Base58(SHA256(publicKey))[0:40]
  publicKey: {
    kyber: Uint8Array;         // Kyber-1024 public key (1568 bytes)
    dilithium: Uint8Array;     // Dilithium3 public key (1952 bytes)
  };
  privateKey: {
    kyber: Uint8Array;         // Kyber-1024 secret key (encrypted, stored locally)
    dilithium: Uint8Array;     // Dilithium3 secret key (encrypted, stored locally)
  };
  created: number;             // Unix timestamp
  endpoints: string[];         // Known reachable addresses
}
```

**Peer ID Format:**
```
G3-7xK9mNpQrStUvWxYz2AbCdEfGhIjKlMnOpQr
   └── 40 chars of Base58-encoded truncated hash
```

### 2.4 Message Envelope

```typescript
interface G3TZKPMessage {
  version: 1;
  id: string;                  // UUID v4
  timestamp: number;           // Unix milliseconds
  from: string;                // Sender Peer ID
  to: string;                  // Recipient Peer ID
  type: 'TEXT' | 'FILE' | 'SIGNAL' | 'PRESENCE' | 'RELAY';
  
  // Encrypted payload (Kyber KEM + AES-256-GCM)
  encapsulatedKey: Uint8Array; // Kyber encapsulated shared secret
  ciphertext: Uint8Array;      // AES-256-GCM encrypted content
  nonce: Uint8Array;           // 12-byte nonce
  
  // ZKP proof attachment
  proof?: {
    circuit: string;           // e.g., 'authentication', 'forward_secrecy'
    pi: string;                // Groth16 proof
    publicSignals: string[];   // Public inputs
  };
  
  // Signature
  signature: Uint8Array;       // Dilithium3 signature over message hash
}
```

### 2.5 Signaling Handshake (Without Central Server)

```
PEER A (Initiator)                    PEER B (Responder)
     │                                      │
     │  1. Create WebRTC PeerConnection     │
     │  2. Generate SDP Offer               │
     │                                      │
     ├───── QR CODE / MANUAL COPY ─────────►│
     │      {                               │
     │        peerId: "G3-xxx",             │
     │        offer: "<SDP>",               │
     │        candidates: [...]             │
     │      }                               │
     │                                      │
     │                    3. Create Answer  │
     │                    4. Generate SDP   │
     │                                      │
     │◄──── QR CODE / MANUAL COPY ──────────┤
     │      {                               │
     │        peerId: "G3-yyy",             │
     │        answer: "<SDP>",              │
     │        candidates: [...]             │
     │      }                               │
     │                                      │
     │  5. ICE Candidate Exchange           │
     │  6. DTLS Handshake                   │
     │  7. DataChannel Established          │
     │◄════════ CONNECTED ════════════════►│
```

**No Server Required:** SDP exchange via QR code, copy/paste, or existing peer relay.

### 2.6 Signaling via Trusted Peer Relay

Once two peers are connected, they can relay signaling for new peers:

```
NEW PEER C                    PEER A                    PEER B
     │                           │                          │
     │  (wants to connect to B)  │                          │
     │                           │                          │
     ├──── SIGNAL_REQUEST ──────►│                          │
     │     { target: "G3-B" }    │                          │
     │                           ├──── RELAY_SIGNAL ───────►│
     │                           │     { from: "G3-C",      │
     │                           │       offer: "..." }     │
     │                           │                          │
     │                           │◄─── RELAY_SIGNAL ────────┤
     │                           │     { to: "G3-C",        │
     │◄──── SIGNAL_RESPONSE ─────┤       answer: "..." }    │
     │                           │                          │
     │◄═══════════════ DIRECT CONNECTION ══════════════════►│
```

### 2.7 Network Topology

**Opportunistic Partial Mesh:**

```
     ┌─────┐
     │  A  │───────┐
     └──┬──┘       │
        │          │
     ┌──▼──┐    ┌──▼──┐
     │  B  │◄───│  C  │
     └──┬──┘    └──┬──┘
        │          │
     ┌──▼──┐    ┌──▼──┐
     │  D  │    │  E  │
     └─────┘    └─────┘
```

**Rules:**
1. Prefer direct connections (A↔B)
2. Max 2-hop relay for unreachable peers (A→C→E)
3. Each peer maintains routing table of known peers and their relays
4. No broadcast/flooding; targeted message delivery only

### 2.8 Routing Table

```typescript
interface RoutingTable {
  peers: Map<string, PeerRoute>;
}

interface PeerRoute {
  peerId: string;
  directConnection?: RTCDataChannel;
  relays: string[];            // Peer IDs that can relay to this peer
  lastSeen: number;
  endpoints: string[];         // Last known network endpoints
  publicKey: Uint8Array;
}
```

### 2.9 Companion Node Implementation

**Desktop (Electron):**
```typescript
// Main process runs persistent WebSocket server
const server = new WebSocketServer({ port: findFreePort() });

// Bridges PWA ↔ WebRTC
server.on('connection', (ws) => {
  // PWA connects here
  // Companion manages WebRTC connections
  // Stays alive when browser tab closed
});
```

**Mobile (Capacitor Plugin):**
```typescript
// Native plugin maintains background service
@CapacitorPlugin({ name: 'G3TZKPCompanion' })
class G3TZKPCompanionPlugin {
  async startService() { /* Background WebRTC manager */ }
  async getLocalEndpoint() { /* Return ws://localhost:PORT */ }
}
```

**Web-Only Fallback (Service Worker + SharedWorker):**
```typescript
// SharedWorker keeps connections alive across tabs
// Limited: dies when all tabs closed
const worker = new SharedWorker('g3tzkp-worker.js');
worker.port.postMessage({ type: 'CONNECT', peerId: '...' });
```

### 2.10 Security Model

| Layer | Mechanism |
|-------|-----------|
| **Identity** | Post-Quantum Keypair (Kyber + Dilithium) |
| **Key Exchange** | Kyber KEM (quantum-resistant) |
| **Encryption** | AES-256-GCM |
| **Authentication** | Dilithium digital signatures |
| **Forward Secrecy** | Double Ratchet (existing cryptoService) |
| **Zero-Knowledge** | Groth16 proofs for message authorization |

### 2.11 Persistence Strategy

| Platform | Strategy |
|----------|----------|
| **Desktop (Electron)** | Background process keeps WebRTC alive |
| **Mobile (Capacitor)** | Native service with push notification wakeup |
| **Web-Only** | Limited; rely on peer relays + push notifications |

---

## Part 3: Implementation Plan

### Phase 1: Foundation (2 Nodes)

**Goal:** Two G3TZKP nodes can exchange messages directly.

```
Tasks:
├── 1.1 Create G3TZKPService.ts (replace LibP2PService)
│   ├── Peer ID generation (Kyber + Dilithium keypair)
│   ├── WebRTC connection management
│   ├── Message encryption/decryption
│   └── DataChannel message handling
│
├── 1.2 Build Signaling Exchange UI
│   ├── Generate SDP offer as QR code
│   ├── Scan peer's answer QR code
│   ├── Manual copy/paste fallback
│   └── ICE candidate bundling
│
├── 1.3 Create Message Envelope Format
│   ├── Kyber KEM encapsulation
│   ├── AES-256-GCM encryption
│   ├── Dilithium signature
│   └── ZKP proof attachment
│
└── 1.4 Test: Two browser tabs exchange encrypted messages
```

### Phase 2: Companion Node (Persistence)

**Goal:** Peers stay online when browser is minimized/closed.

```
Tasks:
├── 2.1 Electron Companion (Desktop)
│   ├── Background WebSocket server
│   ├── WebRTC connection persistence
│   ├── System tray integration
│   └── Auto-start on boot option
│
├── 2.2 Capacitor Plugin (Mobile)
│   ├── iOS background service
│   ├── Android foreground service
│   ├── Push notification integration
│   └── Battery optimization handling
│
└── 2.3 Web Fallback (SharedWorker)
    ├── SharedWorker for multi-tab
    ├── Graceful degradation messaging
    └── "Install app for better connectivity" prompt
```

### Phase 3: Relay Network (Scaling)

**Goal:** Peers can relay signaling and messages for others.

```
Tasks:
├── 3.1 Implement Relay Protocol
│   ├── SIGNAL_REQUEST message type
│   ├── RELAY message type
│   ├── Hop count limit (max 2)
│   └── Relay authorization (trusted peers only)
│
├── 3.2 Routing Table
│   ├── Peer discovery via connected peers
│   ├── Relay path calculation
│   └── Dead peer cleanup
│
└── 3.3 Test: A→B→C message relay
```

### Phase 4: Production Hardening

**Goal:** Stable, secure, battle-tested protocol.

```
Tasks:
├── 4.1 Security Audit
│   ├── Kyber/Dilithium implementation review
│   ├── WebRTC security settings
│   └── Message envelope integrity
│
├── 4.2 Performance Optimization
│   ├── Connection pooling
│   ├── Message batching
│   └── Bandwidth management
│
├── 4.3 Failure Recovery
│   ├── Connection retry logic
│   ├── Message queue persistence
│   └── Offline message delivery
│
└── 4.4 Documentation
    ├── Protocol specification (public)
    ├── Peer implementation guide
    └── Security whitepaper
```

---

## Part 4: Migration Path from LibP2P

### Step 1: Parallel Implementation
- Build G3TZKPService alongside LibP2PService
- Feature flag to switch between protocols
- Same MessagingService interface

### Step 2: Pilot Testing
- Two nodes test new protocol
- Verify message delivery, encryption, persistence
- Compare performance vs LibP2P

### Step 3: Gradual Rollout
- New installs default to G3TZKP protocol
- Existing users offered migration
- LibP2P fallback for interoperability period

### Step 4: LibP2P Removal
- Remove all @libp2p/* dependencies
- Delete libp2p-bundle.js (1.1MB savings)
- Clean protocol-only implementation

---

## Appendix A: File Structure

```
g3tzkp-messenger UI/
├── src/
│   ├── services/
│   │   ├── G3TZKPService.ts       # NEW: Core protocol implementation
│   │   ├── G3TZKPSignaling.ts     # NEW: WebRTC signaling
│   │   ├── G3TZKPCrypto.ts        # NEW: Kyber/Dilithium crypto
│   │   ├── G3TZKPRouter.ts        # NEW: Message routing
│   │   ├── MessagingService.ts    # Updated: Uses G3TZKP instead of LibP2P
│   │   └── [deprecated] LibP2PService.ts
│   │
│   └── companion/
│       ├── electron/              # Desktop companion
│       ├── capacitor/             # Mobile companion
│       └── worker/                # Web fallback
│
├── electron/                      # Electron main process
├── capacitor/                     # Capacitor native project
└── packages/
    └── g3tzkp-protocol/           # Protocol package (publishable)
```

## Appendix B: Comparison

| Feature | LibP2P | G3TZKP Protocol |
|---------|--------|-----------------|
| Dependencies | 40+ packages | 3-5 packages |
| Bundle Size | 1.1MB | ~100KB |
| Connection Time | 5-15 seconds | <2 seconds |
| External Infra | Required (bootstrap, relay) | None |
| NAT Traversal | Relies on public relays | Direct WebRTC + peer relay |
| Persistence | None (browser closes = dead) | Companion Node |
| Complexity | Very High | Low |
| Auditability | Difficult | Simple |

---

**Document Version:** 1.0
**Date:** 2024-12-29
**Author:** G3TZKP Development Team
