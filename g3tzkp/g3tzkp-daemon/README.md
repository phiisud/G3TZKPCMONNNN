# G3TZKP Protocol Daemon

A P2P protocol daemon that enables `g3tzkp://` URLs to work in any browser.

## How It Works

1. **You install the daemon** on your computer
2. **The daemon registers** `g3tzkp://` as a URL protocol with your OS
3. **When you open** `g3tzkp://MESSENGER`, the daemon:
   - Fetches the app from the P2P network
   - Caches it locally
   - Serves it to your browser

## Installation

```bash
# Clone or download this folder
cd g3tzkp-daemon

# Install dependencies
npm install

# Register the protocol with your OS
npm run install-protocol

# Start the daemon
npm start
```

## Usage

Once the daemon is running:

- Open in browser: `g3tzkp://MESSENGER`
- Or visit: `http://127.0.0.1:47777/open/MESSENGER`

## Available Apps

Apps deployed to the G3TZKP network are accessible by name:

| App | URL |
|-----|-----|
| MESSENGER | `g3tzkp://MESSENGER` |
| CLFACE | `g3tzkp://CLFACE` |

## API Endpoints

The daemon exposes these local endpoints:

| Endpoint | Description |
|----------|-------------|
| `/status` | Daemon status and cached apps |
| `/open/:name` | Fetch and open an app |
| `/app/:name/*` | Serve cached app files |
| `/resolve/:name` | Check if an app exists |

## Run on Startup

### Windows
Create a shortcut to `npm start` in:
`C:\Users\<You>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

### macOS
Add to Login Items in System Preferences

### Linux
Add to your desktop environment's autostart

## Network

The daemon connects to bootstrap nodes to discover and fetch apps. Currently configured bootstrap:

```
https://fb0c92fb-c5ce-4bf2-af3c-47d838dd952b-00-1n4r8m214ay9j.worf.replit.dev
```

As more people run the daemon, the network grows stronger.

## Become a Seeder

To help the network, run the daemon and keep it online. Your cached apps will be shared with other peers (coming in v2).
