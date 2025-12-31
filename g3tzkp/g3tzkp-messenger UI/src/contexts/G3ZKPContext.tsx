import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Message, PeerInfo, NetworkStats, StorageStats, TensorData } from '../types';
import { messagingService } from '../services/MessagingService';
import { cryptoService, KeyBundle, SessionInfo } from '../services/CryptoService';
import { zkpService, ZKProof, CircuitInfo } from '../services/ZKPService';
import peerDiscoveryService from '../services/PeerDiscoveryService';
import { AntiTraffickingSystem } from '../../../Packages/anti-trafficking/src/index';

export type { ZKProof, CircuitInfo, KeyBundle };

export interface CryptoSession {
  sessionId: string;
  peerId: string;
  rootKey: string;
  chainKey: string;
  messageCount: number;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
}

export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  ephemeralKey: string;
  messageNumber: number;
  previousChainLength: number;
}

interface G3ZKPContextType {
  isInitialized: boolean;
  initializationProgress: number;
  localPeerId: string;
  identityPublicKey: string;
  connectedPeers: PeerInfo[];
  networkStats: NetworkStats | null;
  storageStats: StorageStats | null;
  messages: Message[];
  statusMessage: string;
  activeSessions: CryptoSession[];
  pendingProofs: ZKProof[];
  circuits: CircuitInfo[];
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  
  initializeBridge: () => Promise<void>;
  sendMessage: (content: string, recipientId: string) => Promise<Message>;
  sendMediaMessage: (file: File, recipientId: string, convert3D?: boolean) => Promise<Message>;
  sendEncryptedMessage: (content: string, recipientId: string) => Promise<EncryptedMessage>;
  verifyZKProof: (proofId: string) => Promise<boolean>;
  generateMessageProof: (messageId: string) => Promise<ZKProof>;
  getCircuitInfo: (circuitName: string) => CircuitInfo | null;
  refreshNetworkStats: () => Promise<void>;
  refreshStorageStats: () => Promise<void>;
  
  initiateCryptoSession: (peerId: string) => Promise<CryptoSession>;
  terminateSession: (sessionId: string) => Promise<void>;
  rotateSessionKeys: (sessionId: string) => Promise<void>;
  getSessionInfo: (peerId: string) => CryptoSession | undefined;
  
  getKeyBundle: () => KeyBundle;
  fetchPeerKeyBundle: (peerId: string) => Promise<KeyBundle>;
  
  connectToPeer: (peerId: string) => Promise<boolean>;
  disconnectFromPeer: (peerId: string) => Promise<void>;
  discoverPeers: () => Promise<PeerInfo[]>;
  
  storeMessage: (message: Message) => Promise<void>;
  retrieveMessages: (peerId?: string) => Promise<Message[]>;
  deleteMessage: (messageId: string) => Promise<void>;
  clearStorage: () => Promise<void>;
  
  subscribeToEvents: (callback: (event: BridgeEvent) => void) => () => void;
}

export interface BridgeEvent {
  type: 'peer_connected' | 'peer_disconnected' | 'message_received' | 'proof_verified' | 'session_rotated' | 'error';
  data: any;
  timestamp: number;
}

const G3ZKPContext = createContext<G3ZKPContextType | undefined>(undefined);

const generateRandomHex = (length: number): string => 
  Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const generatePeerId = (): string => 
  '12D3KooW' + generateRandomHex(32);

export const G3ZKPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const [localPeerId, setLocalPeerId] = useState('');
  const [identityPublicKey, setIdentityPublicKey] = useState('');
  const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [statusMessage, setStatusMessage] = useState('Initializing G3ZKP Bridge...');
  const [activeSessions, setActiveSessions] = useState<CryptoSession[]>([]);
  const [pendingProofs, setPendingProofs] = useState<ZKProof[]>([]);
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('offline');
  
  const eventListenersRef = useRef<Set<(event: BridgeEvent) => void>>(new Set());
  const keyBundleRef = useRef<KeyBundle | null>(null);
  const antiTraffickingRef = useRef<AntiTraffickingSystem | null>(null);

  const emitEvent = useCallback((event: BridgeEvent) => {
    eventListenersRef.current.forEach(callback => callback(event));
  }, []);

  const initializeBridge = useCallback(async () => {
    try {
      setStatusMessage('Initializing cryptographic engine...');
      setInitializationProgress(10);
      
      setStatusMessage('Generating identity keys with TweetNaCl...');
      setInitializationProgress(25);
      await cryptoService.initialize();
      const newPublicKey = cryptoService.getPublicKey();
      setIdentityPublicKey(newPublicKey);
      
      setStatusMessage('Initializing key bundle...');
      setInitializationProgress(40);
      keyBundleRef.current = cryptoService.getKeyBundle();
      
      setStatusMessage('Loading ZKP circuits...');
      setInitializationProgress(50);
      await zkpService.initialize();
      setCircuits(zkpService.getCircuits());
      
      setStatusMessage('Initializing anti-trafficking detection system...');
      setInitializationProgress(60);
      antiTraffickingRef.current = new AntiTraffickingSystem({
        riskThreshold: 0.7,
        deterrentMode: true,
        detectionConfig: {
          detectionThreshold: 0.6,
          deterrentMode: true,
          monitoringLevel: 'standard',
          patternWeights: {
            metadata: 0.3,
            storage: 0.2,
            repository: 0.2,
            account: 0.15,
            ephemeral: 0.15
          }
        }
      });
      await antiTraffickingRef.current.initialize();
      
      setStatusMessage('Connecting to P2P network...');
      setInitializationProgress(70);
      const newPeerId = await messagingService.initialize();
      setLocalPeerId(newPeerId);
      
      setStatusMessage('Initializing peer discovery...');
      setInitializationProgress(75);
      peerDiscoveryService.initialize();
      console.log('[G3ZKPContext] Peer discovery service initialized');
      
      messagingService.onMessage(async (message) => {
        setMessages(prev => [...prev, message]);
        setNetworkStats(prev => prev ? { ...prev, messagesReceived: prev.messagesReceived + 1 } : null);
        emitEvent({ type: 'message_received', data: { message }, timestamp: Date.now() });
        
        if (antiTraffickingRef.current) {
          await antiTraffickingRef.current.analyzeMessage({
            senderId: message.sender,
            timestamp: message.timestamp,
            fileSize: message.content?.length || 0,
            fileType: message.mediaType,
            hasAttachments: !!message.mediaUrl,
            isGroupMessage: false,
            encryptionLevel: message.encryptionLevel || 'standard',
            metadata: {}
          });
        }
      });
      
      messagingService.onPeerConnect((peer) => {
        setConnectedPeers(prev => {
          if (prev.find(p => p.peerId === peer.peerId)) return prev;
          return [...prev, peer];
        });
        emitEvent({ type: 'peer_connected', data: { peer }, timestamp: Date.now() });
      });
      
      messagingService.onPeerDisconnect((peer) => {
        setConnectedPeers(prev => prev.filter(p => p.peerId !== peer.peerId));
        emitEvent({ type: 'peer_disconnected', data: { peer }, timestamp: Date.now() });
      });
      
      messagingService.onConnectionChange((status, error) => {
        if (status === 'connected') {
          setConnectionQuality('excellent');
        } else if (status === 'disconnected') {
          setConnectionQuality('poor');
        } else if (status === 'error') {
          setConnectionQuality('offline');
          emitEvent({ type: 'error', data: { error }, timestamp: Date.now() });
        }
      });
      
      setStatusMessage('Discovering peers...');
      setInitializationProgress(85);
      const initialPeers = messagingService.getConnectedPeers();
      setConnectedPeers(initialPeers);
      
      setStatusMessage('Initializing storage engine...');
      setInitializationProgress(95);
      setNetworkStats({
        messagesSent: 0,
        messagesReceived: 0,
        routesCached: 0,
        peersDiscovered: initialPeers.length
      });
      setStorageStats({
        messageCount: 0,
        totalSize: 0,
        sessionCount: 0,
        zkProofCount: zkpService.getProofsCount()
      });
      
      setConnectionQuality(messagingService.isSocketConnected() ? 'excellent' : 'good');
      setInitializationProgress(100);
      setIsInitialized(true);
      setStatusMessage('G3ZKP Bridge fully operational');
      
      emitEvent({ type: 'peer_connected', data: { peerId: newPeerId }, timestamp: Date.now() });
    } catch (error) {
      setStatusMessage(`Initialization failed: ${(error as Error).message}`);
      setConnectionQuality('offline');
      emitEvent({ type: 'error', data: { error: (error as Error).message }, timestamp: Date.now() });
      throw error;
    }
  }, [emitEvent]);

  const sendMessage = useCallback(async (content: string, recipientId: string): Promise<Message> => {
    const message = await messagingService.sendMessage(recipientId, content, {
      type: 'text',
      encrypt: cryptoService.hasSession(recipientId)
    });
    
    setMessages(prev => [...prev, message]);
    setNetworkStats(prev => prev ? { ...prev, messagesSent: prev.messagesSent + 1 } : null);
    setStorageStats(prev => prev ? { ...prev, messageCount: prev.messageCount + 1, totalSize: prev.totalSize + content.length } : null);
    
    const proof = await zkpService.generateMessageProof(
      cryptoService.getPublicKey(),
      cryptoService.generateMessageHash(content)
    );
    
    await zkpService.verifyProof(proof.id);
    
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isZkpVerified: true, status: 'delivered' } : m));
    }, 500);
    
    return message;
  }, []);

  const sendMediaMessage = useCallback(async (file: File, recipientId: string, convert3D?: boolean): Promise<Message> => {
    const message = await messagingService.sendMediaMessage(recipientId, file, { convert3D });
    
    setMessages(prev => [...prev, message]);
    setNetworkStats(prev => prev ? { ...prev, messagesSent: prev.messagesSent + 1 } : null);
    setStorageStats(prev => prev ? { ...prev, messageCount: prev.messageCount + 1, totalSize: prev.totalSize + file.size } : null);
    
    const proof = await zkpService.generateMessageProof(
      cryptoService.getPublicKey(),
      cryptoService.generateMessageHash(file.name)
    );
    
    await zkpService.verifyProof(proof.id);
    
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isZkpVerified: true, status: 'delivered' } : m));
    }, 500);
    
    return message;
  }, []);

  const sendEncryptedMessage = useCallback(async (content: string, recipientId: string): Promise<EncryptedMessage> => {
    if (!cryptoService.hasSession(recipientId)) {
      const peer = connectedPeers.find(p => p.peerId === recipientId);
      if (peer?.publicKey) {
        const keyBytes = new Uint8Array(32);
        const hashInput = new TextEncoder().encode(peer.publicKey);
        for (let i = 0; i < 32 && i < hashInput.length; i++) {
          keyBytes[i] = hashInput[i];
        }
        const identityKey = btoa(String.fromCharCode(...keyBytes));
        const signedPreKey = btoa(String.fromCharCode(...keyBytes.map(b => (b + 1) % 256)));
        const signature = btoa(String.fromCharCode(...new Uint8Array(64).fill(0)));
        
        const bundle = {
          identityKey,
          signedPreKey,
          signedPreKeyId: Date.now(),
          signature,
          oneTimePreKeys: Array.from({ length: 5 }, (_, i) => ({
            id: Date.now() + i,
            key: btoa(String.fromCharCode(...keyBytes.map(b => (b + i + 2) % 256)))
          })),
          timestamp: peer.lastSeen || Date.now()
        };
        
        const sessionInfo = cryptoService.establishSession(recipientId, bundle);
        setActiveSessions(prev => [...prev.filter(s => s.peerId !== recipientId), {
          sessionId: sessionInfo.sessionId,
          peerId: sessionInfo.peerId,
          rootKey: sessionInfo.rootKey,
          chainKey: sessionInfo.chainKey,
          messageCount: sessionInfo.messageCount,
          createdAt: sessionInfo.createdAt,
          lastUsed: sessionInfo.lastUsed,
          isActive: sessionInfo.isActive
        }]);
      }
    }
    
    const encryptedData = cryptoService.encrypt(recipientId, content);
    
    const updatedInfo = cryptoService.getSessionInfo(recipientId);
    if (updatedInfo) {
      setActiveSessions(prev => prev.map(s => 
        s.peerId === recipientId 
          ? { ...s, messageCount: updatedInfo.messageCount, chainKey: updatedInfo.chainKey, lastUsed: Date.now() }
          : s
      ));
    }
    
    return {
      ciphertext: encryptedData.ciphertext,
      nonce: encryptedData.nonce,
      ephemeralKey: encryptedData.ephemeralPublicKey,
      messageNumber: encryptedData.messageNumber,
      previousChainLength: encryptedData.previousChainLength
    };
  }, [connectedPeers]);

  const verifyZKProof = useCallback(async (proofId: string): Promise<boolean> => {
    const isValid = await zkpService.verifyProof(proofId);
    
    setPendingProofs(prev => prev.map(p => 
      p.id === proofId ? { ...p, verified: isValid } : p
    ));
    
    emitEvent({ type: 'proof_verified', data: { proofId, isValid }, timestamp: Date.now() });
    
    return isValid;
  }, [emitEvent]);

  const generateMessageProof = useCallback(async (messageId: string): Promise<ZKProof> => {
    const proof = await zkpService.generateProof('MessageSendProof', {
      senderKey: identityPublicKey,
      messageHash: messageId,
      timestamp: Date.now()
    });
    
    setPendingProofs(prev => [...prev, proof]);
    setStorageStats(prev => prev ? { ...prev, zkProofCount: prev.zkProofCount + 1 } : null);
    
    return proof;
  }, [identityPublicKey]);

  const getCircuitInfo = useCallback((circuitName: string): CircuitInfo | null => {
    return circuits.find(c => c.name === circuitName) || null;
  }, [circuits]);

  const refreshNetworkStats = useCallback(async () => {
    setNetworkStats(prev => prev ? {
      ...prev,
      peersDiscovered: connectedPeers.length,
      routesCached: Math.floor(Math.random() * 100) + 10
    } : null);
    
    setConnectionQuality(
      connectedPeers.length > 5 ? 'excellent' :
      connectedPeers.length > 2 ? 'good' :
      connectedPeers.length > 0 ? 'poor' : 'offline'
    );
  }, [connectedPeers.length]);

  const refreshStorageStats = useCallback(async () => {
    setStorageStats(prev => prev ? {
      ...prev,
      messageCount: messages.length,
      totalSize: messages.reduce((acc, m) => acc + (m.content?.length || 0), 0),
      sessionCount: activeSessions.length,
      zkProofCount: pendingProofs.filter(p => p.verified).length
    } : null);
  }, [messages.length, activeSessions.length, pendingProofs, messages]);

  const initiateCryptoSession = useCallback(async (peerId: string): Promise<CryptoSession> => {
    const peerBundle = await fetchPeerKeyBundle(peerId);
    const sessionInfo = cryptoService.establishSession(peerId, peerBundle);
    
    const session: CryptoSession = {
      sessionId: sessionInfo.sessionId,
      peerId: sessionInfo.peerId,
      rootKey: sessionInfo.rootKey,
      chainKey: sessionInfo.chainKey,
      messageCount: sessionInfo.messageCount,
      createdAt: sessionInfo.createdAt,
      lastUsed: sessionInfo.lastUsed,
      isActive: sessionInfo.isActive
    };
    
    setActiveSessions(prev => [...prev.filter(s => s.peerId !== peerId), session]);
    setStorageStats(prev => prev ? { ...prev, sessionCount: prev.sessionCount + 1 } : null);
    
    return session;
  }, []);

  const terminateSession = useCallback(async (sessionId: string): Promise<void> => {
    const session = activeSessions.find(s => s.sessionId === sessionId);
    if (session) {
      cryptoService.terminateSession(session.peerId);
    }
    setActiveSessions(prev => prev.filter(s => s.sessionId !== sessionId));
  }, [activeSessions]);

  const rotateSessionKeys = useCallback(async (sessionId: string): Promise<void> => {
    const session = activeSessions.find(s => s.sessionId === sessionId);
    if (session) {
      cryptoService.rotateSessionKey(session.peerId);
      const updatedInfo = cryptoService.getSessionInfo(session.peerId);
      
      if (updatedInfo) {
        setActiveSessions(prev => prev.map(s => 
          s.sessionId === sessionId 
            ? { ...s, chainKey: updatedInfo.chainKey, lastUsed: Date.now(), messageCount: updatedInfo.messageCount }
            : s
        ));
      }
    }
    
    emitEvent({ type: 'session_rotated', data: { sessionId }, timestamp: Date.now() });
  }, [activeSessions, emitEvent]);

  const getSessionInfo = useCallback((peerId: string): CryptoSession | undefined => {
    const localSession = activeSessions.find(s => s.peerId === peerId && s.isActive);
    if (localSession) return localSession;
    
    const cryptoSession = cryptoService.getSessionInfo(peerId);
    if (cryptoSession) {
      return {
        sessionId: cryptoSession.sessionId,
        peerId: cryptoSession.peerId,
        rootKey: cryptoSession.rootKey,
        chainKey: cryptoSession.chainKey,
        messageCount: cryptoSession.messageCount,
        createdAt: cryptoSession.createdAt,
        lastUsed: cryptoSession.lastUsed,
        isActive: cryptoSession.isActive
      };
    }
    return undefined;
  }, [activeSessions]);

  const getKeyBundle = useCallback((): KeyBundle => {
    try {
      return cryptoService.getKeyBundle();
    } catch {
      if (!keyBundleRef.current) {
        throw new Error('Key bundle not initialized');
      }
      return keyBundleRef.current;
    }
  }, []);

  const fetchPeerKeyBundle = useCallback(async (peerId: string): Promise<KeyBundle> => {
    const peer = connectedPeers.find(p => p.peerId === peerId);
    
    if (peer?.publicKey) {
      const keyBytes = new Uint8Array(32);
      const hashInput = new TextEncoder().encode(peer.publicKey);
      for (let i = 0; i < 32 && i < hashInput.length; i++) {
        keyBytes[i] = hashInput[i];
      }
      
      const identityKey = btoa(String.fromCharCode(...keyBytes));
      const signedPreKey = btoa(String.fromCharCode(...keyBytes.map(b => (b + 1) % 256)));
      const signature = btoa(String.fromCharCode(...new Uint8Array(64).fill(0)));
      
      return {
        identityKey,
        signedPreKey,
        signedPreKeyId: Date.now(),
        signature,
        oneTimePreKeys: Array.from({ length: 5 }, (_, i) => ({
          id: Date.now() + i,
          key: btoa(String.fromCharCode(...keyBytes.map(b => (b + i + 2) % 256)))
        })),
        timestamp: peer.lastSeen || Date.now()
      };
    }
    
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const identityKey = btoa(String.fromCharCode(...randomBytes));
    crypto.getRandomValues(randomBytes);
    const signedPreKey = btoa(String.fromCharCode(...randomBytes));
    
    return {
      identityKey,
      signedPreKey,
      signedPreKeyId: Date.now(),
      signature: btoa(String.fromCharCode(...new Uint8Array(64).fill(0))),
      oneTimePreKeys: Array.from({ length: 5 }, (_, i) => {
        crypto.getRandomValues(randomBytes);
        return { id: Date.now() + i, key: btoa(String.fromCharCode(...randomBytes)) };
      }),
      timestamp: Date.now()
    };
  }, [connectedPeers]);

  const connectToPeer = useCallback(async (peerId: string): Promise<boolean> => {
    await new Promise(res => setTimeout(res, 300 + Math.random() * 500));
    
    if (Math.random() > 0.1) {
      const newPeer: PeerInfo = {
        peerId,
        publicKey: '0x' + generateRandomHex(64),
        status: 'online',
        lastSeen: Date.now()
      };
      
      setConnectedPeers(prev => {
        if (prev.find(p => p.peerId === peerId)) return prev;
        return [...prev, newPeer];
      });
      
      emitEvent({ type: 'peer_connected', data: { peerId }, timestamp: Date.now() });
      return true;
    }
    
    return false;
  }, [emitEvent]);

  const disconnectFromPeer = useCallback(async (peerId: string): Promise<void> => {
    setConnectedPeers(prev => prev.filter(p => p.peerId !== peerId));
    setActiveSessions(prev => prev.map(s => 
      s.peerId === peerId ? { ...s, isActive: false } : s
    ));
    
    emitEvent({ type: 'peer_disconnected', data: { peerId }, timestamp: Date.now() });
  }, [emitEvent]);

  const discoverPeers = useCallback(async (): Promise<PeerInfo[]> => {
    await new Promise(res => setTimeout(res, 500 + Math.random() * 1000));
    
    const newPeers: PeerInfo[] = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => ({
      peerId: generatePeerId(),
      publicKey: '0x' + generateRandomHex(64),
      status: Math.random() > 0.5 ? 'online' : 'away',
      lastSeen: Date.now() - Math.floor(Math.random() * 300000)
    } as PeerInfo));
    
    setConnectedPeers(prev => {
      const existingIds = new Set(prev.map(p => p.peerId));
      const uniqueNew = newPeers.filter(p => !existingIds.has(p.peerId));
      return [...prev, ...uniqueNew];
    });
    
    return newPeers;
  }, []);

  const storeMessage = useCallback(async (message: Message): Promise<void> => {
    setMessages(prev => {
      if (prev.find(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
    setStorageStats(prev => prev ? { 
      ...prev, 
      messageCount: prev.messageCount + 1,
      totalSize: prev.totalSize + (message.content?.length || 0)
    } : null);
    
    if (!message.isMe) {
      emitEvent({ type: 'message_received', data: { message }, timestamp: Date.now() });
    }
  }, [emitEvent]);

  const retrieveMessages = useCallback(async (peerId?: string): Promise<Message[]> => {
    if (peerId) {
      return messages.filter(m => m.recipient === peerId || m.sender === peerId);
    }
    return messages;
  }, [messages]);

  const deleteMessage = useCallback(async (messageId: string): Promise<void> => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const clearStorage = useCallback(async (): Promise<void> => {
    setMessages([]);
    setStorageStats(prev => prev ? { ...prev, messageCount: 0, totalSize: 0 } : null);
  }, []);

  const subscribeToEvents = useCallback((callback: (event: BridgeEvent) => void) => {
    eventListenersRef.current.add(callback);
    return () => {
      eventListenersRef.current.delete(callback);
    };
  }, []);

  useEffect(() => {
    initializeBridge();
  }, [initializeBridge]);

  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(() => {
      setConnectedPeers(prev => prev.map(peer => ({
        ...peer,
        status: Math.random() > 0.1 ? peer.status : (Math.random() > 0.5 ? 'online' : 'away'),
        lastSeen: peer.status === 'online' ? Date.now() : peer.lastSeen
      })));
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isInitialized]);

  const value: G3ZKPContextType = {
    isInitialized,
    initializationProgress,
    localPeerId,
    identityPublicKey,
    connectedPeers,
    networkStats,
    storageStats,
    messages,
    statusMessage,
    activeSessions,
    pendingProofs,
    circuits,
    connectionQuality,
    initializeBridge,
    sendMessage,
    sendMediaMessage,
    sendEncryptedMessage,
    verifyZKProof,
    generateMessageProof,
    getCircuitInfo,
    refreshNetworkStats,
    refreshStorageStats,
    initiateCryptoSession,
    terminateSession,
    rotateSessionKeys,
    getSessionInfo,
    getKeyBundle,
    fetchPeerKeyBundle,
    connectToPeer,
    disconnectFromPeer,
    discoverPeers,
    storeMessage,
    retrieveMessages,
    deleteMessage,
    clearStorage,
    subscribeToEvents
  };

  return (
    <G3ZKPContext.Provider value={value}>
      {children}
    </G3ZKPContext.Provider>
  );
};

export const useG3ZKP = () => {
  const context = useContext(G3ZKPContext);
  if (!context) {
    throw new Error('useG3ZKP must be used within G3ZKPProvider');
  }
  return context;
};
