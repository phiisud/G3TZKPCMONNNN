import React, { useState, useEffect } from 'react';
import { UserPlus, Check, X, Bell } from 'lucide-react';
import { peerContactService, ConnectionRequest } from '../services/PeerContactService';

interface ConnectionRequestNotificationProps {
  onRequestHandled?: () => void;
}

export const ConnectionRequestNotification: React.FC<ConnectionRequestNotificationProps> = ({
  onRequestHandled
}) => {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    setRequests(peerContactService.getPendingRequests());
    
    const unsubscribe = peerContactService.subscribeToRequests((newRequests) => {
      setRequests(newRequests);
    });

    return unsubscribe;
  }, []);

  const handleAccept = async (peerId: string) => {
    setProcessing(peerId);
    try {
      await peerContactService.acceptRequest(peerId);
      onRequestHandled?.();
    } catch (error) {
      console.error('Failed to accept request:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (peerId: string) => {
    setProcessing(peerId);
    try {
      await peerContactService.denyRequest(peerId);
      onRequestHandled?.();
    } catch (error) {
      console.error('Failed to deny request:', error);
    } finally {
      setProcessing(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
      {requests.map((request) => (
        <div
          key={request.peerId}
          className="bg-gray-900 border border-cyan-500/50 rounded-xl p-4 shadow-2xl animate-in slide-in-from-right"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-900/50 border border-cyan-500 flex items-center justify-center flex-shrink-0">
              <UserPlus size={20} className="text-cyan-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} className="text-cyan-400" />
                <span className="text-xs text-cyan-400 font-medium">Connection Request</span>
              </div>
              
              <p className="text-white font-medium truncate">{request.peerName}</p>
              <p className="text-gray-500 text-xs font-mono truncate">{request.peerId}</p>
              
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAccept(request.peerId)}
                  disabled={processing === request.peerId}
                  className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-1 transition"
                >
                  {processing === request.peerId ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={16} />
                      Accept
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleDeny(request.peerId)}
                  disabled={processing === request.peerId}
                  className="flex-1 py-2 px-3 bg-red-900 hover:bg-red-800 disabled:bg-gray-700 rounded-lg text-red-300 text-sm font-medium flex items-center justify-center gap-1 transition"
                >
                  <X size={16} />
                  Deny
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConnectionRequestNotification;
