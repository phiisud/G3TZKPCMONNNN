import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';

interface MeshConversationItemProps {
  contact: {
    peerId: string;
    displayName?: string;
    avatar?: string;
  };
  lastMessage?: {
    content: string;
    timestamp: number;
    isMe: boolean;
    read: boolean;
  };
  unreadCount: number;
  isOnline: boolean;
  onClick: () => void;
}

export function MeshConversationItem({
  contact,
  lastMessage,
  unreadCount,
  isOnline,
  onClick
}: MeshConversationItemProps) {
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const date = new Date(timestamp);

    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 border-[0.5px] transition-all flex items-center gap-4 group ${
        unreadCount > 0 
          ? 'border-[#00f3ff]/40 bg-[#00f3ff]/5 hover:bg-[#00f3ff]/10' 
          : 'border-[#4caf50]/20 bg-black/20 hover:bg-black/40'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 border-[0.5px] border-[#4caf50]/40 flex items-center justify-center bg-black/40 text-[#00f3ff] font-black text-[10px]">
          {(contact.displayName?.[0] || contact.peerId.substring(0, 2)).toUpperCase()}
        </div>
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-[0.5px] border-black ${
          isOnline ? 'bg-[#4caf50] shadow-[0_0_8px_#4caf50]' : 'bg-[#4caf50]/20'
        }`} />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[#00f3ff] uppercase tracking-wider truncate">
              {contact.displayName || `NODE_${contact.peerId.substring(0, 8)}`}
            </span>
            {isOnline && (
              <span className="text-[6px] font-mono text-[#4caf50] uppercase">ACTIVE</span>
            )}
          </div>
          {lastMessage && (
            <span className="text-[7px] font-mono text-[#4caf50]/60 flex-shrink-0 ml-2 uppercase">
              {formatTime(lastMessage.timestamp)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[8px] font-mono text-[#4caf50]/40 truncate flex-1 uppercase">
            {lastMessage ? (
              <>
                {lastMessage.isMe && (
                  lastMessage.read ? (
                    <CheckCheck size={10} className="text-[#00f3ff] flex-shrink-0" />
                  ) : (
                    <Check size={10} className="flex-shrink-0" />
                  )
                )}
                <span className="truncate">{lastMessage.content}</span>
              </>
            ) : (
              <span className="text-[#4caf50]/20">NO_TRANSMISSIONS</span>
            )}
          </div>

          {unreadCount > 0 && (
            <div className="ml-2 min-w-[18px] h-[18px] px-1.5 bg-[#00f3ff]/20 border-[0.5px] border-[#00f3ff]/40 flex items-center justify-center flex-shrink-0">
              <span className="text-[7px] font-black text-[#00f3ff]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default MeshConversationItem;
