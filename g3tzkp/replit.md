# G3ZKP Messenger

## Overview
G3ZKP Messenger is a secure, decentralized peer-to-peer messaging platform prioritizing privacy through zero-knowledge proofs (ZKP) for message verification and end-to-end encryption (X3DH, Double Ratchet). It is local-first, P2P, operates without cloud dependencies, and includes an anti-trafficking detection system. The project aims to deliver highly secure and private communication, integrating features like 3D tensor object visualization, client-side background removal, and a privacy-focused flight tracking and anonymous booking system, all built on a strong privacy-by-design philosophy.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The project uses a Turborepo monorepo, organizing code into `core`, `crypto`, `zkp`, `network`, `storage`, `anti-trafficking` packages, and a React-based UI.

### Frontend Architecture
A React 18+ application with TypeScript, Vite, and Tailwind CSS, featuring a cyberpunk/matrix theme. State management uses React Context, integrating with backend packages via `G3ZKPContext`. Key UI components include GeodesicMap, DiegeticTerminal, ZKPVerifier, and MatrixRain.

### Cryptographic Design
Employs X3DH for key exchange, Double Ratchet for forward secrecy, HKDF for key derivation, and AEAD encryption with NaCl crypto_box (XSalsa20-Poly1305). ZKP circuits (Circom) verify message authorization and delivery, using a Node.js-based ZKP engine with `snarkjs` (supporting both production and simulation modes).

### Network Layer
Built on `libp2p`, supporting multiple transports (TCP, WebSockets, WebRTC), Noise protocol for encryption, GossipSub for pub/sub, and Kad-DHT for peer discovery.

### Storage Design
Utilizes LevelDB for local persistent, encrypted storage with an LRU cache, and IndexedDB for browser-side storage of messages, contacts, sessions, keys, settings, and media.

### Media Pipeline
Handles file transfers, conversion of image/video pixel data into 3D tensor fields via PHI-PI geodesic mapping, and rendering these as 3D tensor objects using the Acute Reality V7 raymarching manifold renderer. Includes client-side background removal.

### Flight Tracking & Anonymous Booking System
Integrates a production-grade flight search, tracking, and anonymous booking platform with multi-source aggregation, anonymous booking using URL sanitization and secure iframe isolation, and privacy-preserving mechanisms.

### Acute Reality V7 Raymarching Engine
A volumetric raymarching system for tensor visualization, featuring a custom `ShaderMaterial` with RBBRRBR stitching, rotor harmonics, luma-to-depth extrusion, and ZKP proof consistency controls.

### Navigator Node
Provides privacy-focused navigation using OpenStreetMap and OSRM, a 2D Leaflet Map, real-time European flight tracking via OpenSky Network API, live GPS tracking with privacy obfuscation, and route planning via Nominatim API.

### European Transit Integration
Supports Europe-wide transit planning through backend API proxies for providers like TfL, BVG, SBB, NS, SNCF, and OpenStreetMap fallbacks, including country detection, caching, and retry logic.

### Business Verification & Integration Protocol
A decentralized business verification system using Companies House UK as the trust anchor, offering CRN validation, API integration, business profile creation, cryptographic signing, and P2P network broadcast. Profiles are stored in IndexedDB.

### G3TZKP CLI & Gateway
Includes a CLI tool for deploying decentralized web apps and a local access gateway (`g3tzkp-gateway`) that serves these apps at `http://localhost:8080/APP_NAME`. It features a bijective base32 name registry and OS-level `g3tzkp://` protocol handler registration.

### G3TZKP CLI GUI Application
A React+Three.js GUI for the CLI, featuring a Phi-Tensor Raymarching Background, live camera uplink for bijective mapping to tensor geometry, image upload for tensor visualization, and a terminal manifold interface.

### G3TZKP Protocol Daemon
A native Node.js application (`g3tzkp-daemon`) that registers `g3tzkp://` as an OS-level URL protocol. It fetches and caches apps from a bootstrap node (this Replit) and serves them locally, enabling true P2P app access.

**P2P Mesh Networking (v2.0):**
- Daemon-to-daemon content sharing via `/api/share/:name` endpoint
- Peer announcement and discovery through bootstrap node
- Automatic peer cache with 30-second heartbeat
- Fetches from other peers first, falls back to bootstrap

**One-Line Installation:**
- Linux/macOS: `curl -sL https://[REPLIT_URL]/install.sh | bash`
- Windows: `irm https://[REPLIT_URL]/install.ps1 | iex`

**Download Page:** `/download` - Interactive installer with network status

## External Dependencies

### Core Dependencies
- **libp2p**: P2P networking stack.
- **level**: LevelDB bindings.
- **snarkjs**: ZKP generation and verification.
- **tweetnacl**: NaCl cryptographic library.

### Frontend Dependencies
- **React**: UI framework.
- **Vite**: Build tool.
- **Tailwind CSS**: CSS framework.
- **lucide-react**: Icon library.
- **framer-motion**: Animation library.
- **@google/genai**: Google AI integration.
- **@zxing/browser**: QR code scanning.
- **qrcode**: QR code generation.

### Flight Tracking Integration
- **OpenSky Network API**: Live flight data.
- **Aerodatabox (RapidAPI)**: Flight data proxy.
- **AviationStack**: Flight data proxy.

### European Transit Integration
- **TfL (UK)**
- **BVG (Germany)**
- **SBB (Switzerland)**
- **NS (Netherlands)**
- **SNCF (France)**
- **Nominatim API**: Geocoding.
- **OSRM**: Routing.
- **OSM Overpass API**: Transit data fallback.