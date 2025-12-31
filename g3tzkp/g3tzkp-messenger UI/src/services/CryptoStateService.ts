export interface X3DHState {
  status: 'active' | 'standby' | 'offline' | 'not_initialized';
  identityKey: string | null;
  signedPreKey: string | null;
  oneTimePreKeys: number;
  lastKeyRotation: number;
  activeSessions: number;
  keyBundleUploaded: boolean;
}

export interface DoubleRatchetState {
  status: 'active' | 'standby' | 'offline' | 'not_initialized';
  activeChains: number;
  messageKeysGenerated: number;
  lastRatchetTime: number;
  sendingChainLength: number;
  receivingChainLength: number;
}

export interface AEADState {
  status: 'active' | 'standby' | 'not_initialized';
  algorithm: string;
  keySize: number;
  lastOperation: number;
  messagesEncrypted: number;
  messagesDecrypted: number;
}

export interface P2PState {
  peerId: string | null;
  connectedPeers: string[];
  connectionCount: number;
  status: 'online' | 'connecting' | 'offline' | 'error';
  protocol: 'ws' | 'webrtc' | 'tcp' | null;
  lastSeen: number;
  bandwidth: {
    incoming: number;
    outgoing: number;
  };
}

export interface ZKPCircuit {
  name: string;
  version: string;
  status: 'active' | 'simulated' | 'inactive';
  constraints: number;
  lastUsed: number | null;
  proofsGenerated: number;
  proofsVerified: number;
}

export interface ZKPState {
  engineStatus: 'production' | 'simulated' | 'offline';
  circuits: ZKPCircuit[];
  totalProofsGenerated: number;
  totalProofsVerified: number;
  lastActivity: number;
}

export interface RealCryptoState {
  timestamp: number;
  x3dh: X3DHState;
  doubleRatchet: DoubleRatchetState;
  aead: AEADState;
  p2p: P2PState;
  zkp: ZKPState;
  online: boolean;
}

class CryptoStateService {
  getX3DHState(): X3DHState {
    const identityKey = localStorage.getItem('g3zkp_identity_key');
    const signedPreKey = localStorage.getItem('g3zkp_signed_prekey');
    const oneTimeKeysRaw = localStorage.getItem('g3zkp_onetime_keys');
    const lastRotation = localStorage.getItem('g3zkp_last_rotation');
    const sessionsRaw = localStorage.getItem('g3zkp_active_sessions');

    let oneTimeKeys: string[] = [];
    try {
      oneTimeKeys = oneTimeKeysRaw ? JSON.parse(oneTimeKeysRaw) : [];
    } catch (e) {
      oneTimeKeys = [];
    }

    let sessions: Record<string, unknown> = {};
    try {
      sessions = sessionsRaw ? JSON.parse(sessionsRaw) : {};
    } catch (e) {
      sessions = {};
    }

    const hasKeys = identityKey !== null;

    return {
      status: hasKeys ? 'active' : 'not_initialized',
      identityKey: identityKey ? `${identityKey.substring(0, 16)}...` : null,
      signedPreKey: signedPreKey ? `${signedPreKey.substring(0, 16)}...` : null,
      oneTimePreKeys: oneTimeKeys.length,
      lastKeyRotation: lastRotation ? parseInt(lastRotation) : 0,
      activeSessions: Object.keys(sessions).length,
      keyBundleUploaded: localStorage.getItem('g3zkp_key_bundle_uploaded') === 'true'
    };
  }

  getDoubleRatchetState(): DoubleRatchetState {
    const sessionsRaw = localStorage.getItem('g3zkp_ratchet_sessions');
    
    let sessions: Record<string, { ns?: number; nr?: number }> = {};
    try {
      sessions = sessionsRaw ? JSON.parse(sessionsRaw) : {};
    } catch (e) {
      sessions = {};
    }

    const chainCount = Object.keys(sessions).length;
    const lastRatchetRaw = localStorage.getItem('g3zkp_last_ratchet');
    const lastRatchetTime = lastRatchetRaw ? parseInt(lastRatchetRaw) : 0;

    return {
      status: chainCount > 0 ? 'active' : 'standby',
      activeChains: chainCount,
      messageKeysGenerated: Object.values(sessions).reduce((sum, s) => sum + (s.ns || 0) + (s.nr || 0), 0),
      lastRatchetTime,
      sendingChainLength: Object.values(sessions).reduce((sum, s) => sum + (s.ns || 0), 0),
      receivingChainLength: Object.values(sessions).reduce((sum, s) => sum + (s.nr || 0), 0)
    };
  }

  getAEADState(): AEADState {
    const hasIdentity = localStorage.getItem('g3zkp_identity_key') !== null;
    const encryptedRaw = localStorage.getItem('g3zkp_messages_encrypted');
    const decryptedRaw = localStorage.getItem('g3zkp_messages_decrypted');
    const lastOpRaw = localStorage.getItem('g3zkp_last_encryption');

    return {
      status: hasIdentity ? 'active' : 'not_initialized',
      algorithm: 'XSalsa20-Poly1305',
      keySize: 256,
      lastOperation: lastOpRaw ? parseInt(lastOpRaw) : 0,
      messagesEncrypted: encryptedRaw ? parseInt(encryptedRaw) : 0,
      messagesDecrypted: decryptedRaw ? parseInt(decryptedRaw) : 0
    };
  }

  getP2PState(): P2PState {
    const peerId = localStorage.getItem('g3zkp_peer_id');
    const peersRaw = localStorage.getItem('g3zkp_connected_peers');
    
    let peers: string[] = [];
    try {
      peers = peersRaw ? JSON.parse(peersRaw) : [];
    } catch (e) {
      peers = [];
    }

    return {
      peerId: peerId || null,
      connectedPeers: peers,
      connectionCount: peers.length,
      status: navigator.onLine ? (peers.length > 0 ? 'online' : 'connecting') : 'offline',
      protocol: peers.length > 0 ? 'ws' : null,
      lastSeen: Date.now(),
      bandwidth: {
        incoming: 0,
        outgoing: 0
      }
    };
  }

  async getZKPState(): Promise<ZKPState> {
    let engineStatus: 'production' | 'simulated' | 'offline' = 'offline';
    let backendCircuits: ZKPCircuit[] = [];

    try {
      const response = await fetch('/api/zkp/status');
      if (response.ok) {
        const data = await response.json();
        engineStatus = data.mode || 'simulated';
      }

      const circuitsResponse = await fetch('/api/zkp/circuits');
      if (circuitsResponse.ok) {
        const circuitsData = await circuitsResponse.json();
        if (circuitsData.circuits && Array.isArray(circuitsData.circuits)) {
          backendCircuits = circuitsData.circuits.map((c: { id?: string; name?: string; constraints?: number; status?: string }) => ({
            name: c.id || c.name || 'Unknown',
            version: '1.0.0',
            status: c.status || (engineStatus === 'production' ? 'active' : 'simulated'),
            constraints: c.constraints || 0,
            lastUsed: null,
            proofsGenerated: 0,
            proofsVerified: 0
          }));
        }
      }
    } catch (e) {
      engineStatus = 'offline';
    }

    const proofsGenRaw = localStorage.getItem('g3zkp_proofs_generated');
    const proofsVerRaw = localStorage.getItem('g3zkp_proofs_verified');

    return {
      engineStatus,
      circuits: backendCircuits,
      totalProofsGenerated: proofsGenRaw ? parseInt(proofsGenRaw) : 0,
      totalProofsVerified: proofsVerRaw ? parseInt(proofsVerRaw) : 0,
      lastActivity: 0
    };
  }

  async getRealCryptoState(): Promise<RealCryptoState> {
    const zkpState = await this.getZKPState();

    return {
      timestamp: Date.now(),
      x3dh: this.getX3DHState(),
      doubleRatchet: this.getDoubleRatchetState(),
      aead: this.getAEADState(),
      p2p: this.getP2PState(),
      zkp: zkpState,
      online: navigator.onLine
    };
  }

  recordEncryption(): void {
    const current = parseInt(localStorage.getItem('g3zkp_messages_encrypted') || '0');
    localStorage.setItem('g3zkp_messages_encrypted', (current + 1).toString());
    localStorage.setItem('g3zkp_last_encryption', Date.now().toString());
  }

  recordDecryption(): void {
    const current = parseInt(localStorage.getItem('g3zkp_messages_decrypted') || '0');
    localStorage.setItem('g3zkp_messages_decrypted', (current + 1).toString());
  }

  recordRatchet(): void {
    localStorage.setItem('g3zkp_last_ratchet', Date.now().toString());
  }

  recordProofGenerated(): void {
    const current = parseInt(localStorage.getItem('g3zkp_proofs_generated') || '0');
    localStorage.setItem('g3zkp_proofs_generated', (current + 1).toString());
  }

  recordProofVerified(): void {
    const current = parseInt(localStorage.getItem('g3zkp_proofs_verified') || '0');
    localStorage.setItem('g3zkp_proofs_verified', (current + 1).toString());
  }

  initializeKeys(): void {
    if (!localStorage.getItem('g3zkp_identity_key')) {
      const identityKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('g3zkp_identity_key', identityKey);
    }

    if (!localStorage.getItem('g3zkp_signed_prekey')) {
      const signedPreKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('g3zkp_signed_prekey', signedPreKey);
    }

    if (!localStorage.getItem('g3zkp_onetime_keys')) {
      const oneTimeKeys = Array.from({ length: 10 }, () =>
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0')).join('')
      );
      localStorage.setItem('g3zkp_onetime_keys', JSON.stringify(oneTimeKeys));
    }

    if (!localStorage.getItem('g3zkp_last_rotation')) {
      localStorage.setItem('g3zkp_last_rotation', Date.now().toString());
    }

    localStorage.setItem('g3zkp_key_bundle_uploaded', 'true');
  }

  isInitialized(): boolean {
    return localStorage.getItem('g3zkp_identity_key') !== null;
  }
}

export const cryptoStateService = new CryptoStateService();
export default cryptoStateService;
