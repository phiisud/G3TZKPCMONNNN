import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Activity, Zap } from 'lucide-react';

interface ProtocolEvent {
  id: string;
  type: 'encryption' | 'decryption' | 'ratchet' | 'zkp' | 'network' | 'key' | 'system';
  message: string;
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
}

const ProtocolMonitor: React.FC = () => {
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [isLive, setIsLive] = useState(true);
  const eventIdCounter = useRef(0);
  const lastKeyCheck = useRef<string | null>(null);

  const addEvent = useCallback((type: ProtocolEvent['type'], message: string, level: ProtocolEvent['level'] = 'info') => {
    const newEvent: ProtocolEvent = {
      id: `evt_${Date.now()}_${eventIdCounter.current++}`,
      type,
      message,
      timestamp: Date.now(),
      level
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    addEvent('system', 'Protocol Monitor initialized', 'info');
    addEvent('network', `Online status: ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}`, navigator.onLine ? 'success' : 'warning');

    const identityKey = localStorage.getItem('g3zkp_identity_key');
    if (identityKey) {
      addEvent('key', 'X3DH: Identity key loaded from storage', 'success');
      lastKeyCheck.current = identityKey.substring(0, 16);
    } else {
      addEvent('key', 'X3DH: No identity key found - awaiting initialization', 'warning');
    }

    const signedPreKey = localStorage.getItem('g3zkp_signed_prekey');
    if (signedPreKey) {
      addEvent('key', 'X3DH: Signed pre-key available', 'success');
    }

    const oneTimeKeys = localStorage.getItem('g3zkp_onetime_keys');
    if (oneTimeKeys) {
      try {
        const keys = JSON.parse(oneTimeKeys);
        addEvent('key', `X3DH: ${keys.length} one-time pre-keys available`, 'info');
      } catch (e) {
        addEvent('key', 'X3DH: One-time keys storage corrupted', 'error');
      }
    }
  }, [addEvent]);

  useEffect(() => {
    if (!isLive) return;

    const handleOnline = () => addEvent('network', 'Network: Connection restored', 'success');
    const handleOffline = () => addEvent('network', 'Network: Connection lost', 'error');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isLive, addEvent]);

  useEffect(() => {
    if (!isLive) return;

    const checkStorageChanges = () => {
      const currentKey = localStorage.getItem('g3zkp_identity_key');
      if (currentKey && currentKey.substring(0, 16) !== lastKeyCheck.current) {
        if (lastKeyCheck.current === null) {
          addEvent('key', 'X3DH: Identity key generated', 'success');
        } else {
          addEvent('key', 'X3DH: Identity key rotated', 'success');
        }
        lastKeyCheck.current = currentKey.substring(0, 16);
      }

      const sessions = localStorage.getItem('g3zkp_active_sessions');
      if (sessions) {
        try {
          const sessionData = JSON.parse(sessions);
          const sessionCount = Object.keys(sessionData).length;
          if (sessionCount > 0) {
            addEvent('encryption', `AEAD: ${sessionCount} active session(s)`, 'info');
          }
        } catch (e) {}
      }
    };

    const interval = setInterval(checkStorageChanges, 5000);
    return () => clearInterval(interval);
  }, [isLive, addEvent]);

  useEffect(() => {
    if (!isLive) return;

    const checkZKPStatus = async () => {
      try {
        const response = await fetch('/api/zkp/status');
        if (response.ok) {
          const data = await response.json();
          addEvent('zkp', `ZKP: Engine ${data.mode} - ${data.initialized ? 'Ready' : 'Initializing'}`, 
            data.initialized ? 'success' : 'info');
        }
      } catch (e) {
        addEvent('zkp', 'ZKP: Backend unavailable', 'warning');
      }
    };

    checkZKPStatus();
    const interval = setInterval(checkZKPStatus, 30000);
    return () => clearInterval(interval);
  }, [isLive, addEvent]);

  useEffect(() => {
    if (!isLive) return;

    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          if (data.connectedPeers > 0) {
            addEvent('network', `P2P: ${data.connectedPeers} peer(s) connected via WebSocket`, 'success');
          }
        }
      } catch (e) {
        addEvent('network', 'P2P: Health check failed', 'warning');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [isLive, addEvent]);

  const getLevelColor = (level: ProtocolEvent['level']) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-cyan-400';
    }
  };

  const getTypeIcon = (type: ProtocolEvent['type']) => {
    switch (type) {
      case 'encryption':
      case 'decryption':
        return '[ENC]';
      case 'ratchet':
        return '[DR]';
      case 'zkp':
        return '[ZKP]';
      case 'network':
        return '[NET]';
      case 'key':
        return '[KEY]';
      case 'system':
        return '[SYS]';
    }
  };

  return (
    <div className="bg-black border border-cyan-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-mono flex items-center gap-2">
          <Activity size={18} />
          LIVE PROTOCOL EVENTS
        </h3>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`px-3 py-1 rounded text-xs font-mono ${
            isLive 
              ? 'bg-green-900 text-green-400' 
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          {isLive ? 'LIVE' : 'PAUSED'}
        </button>
      </div>

      <div className="h-64 overflow-y-auto space-y-1 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Waiting for protocol events...
          </div>
        ) : (
          events.map((event) => (
            <div 
              key={event.id} 
              className="flex items-start gap-2 py-1 border-b border-gray-900"
            >
              <span className="text-gray-600 whitespace-nowrap">
                [{new Date(event.timestamp).toLocaleTimeString()}]
              </span>
              <span className="text-gray-500">{getTypeIcon(event.type)}</span>
              <span className={getLevelColor(event.level)}>
                {event.message}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-xs font-mono text-gray-500">
        <span>Events: {events.length}</span>
        <span className="flex items-center gap-1">
          <Zap size={12} className="text-cyan-400" />
          Real-time monitoring (no simulation)
        </span>
      </div>
    </div>
  );
};

export default ProtocolMonitor;
