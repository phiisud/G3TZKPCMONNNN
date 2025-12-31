import React from 'react';
import { MessageSquare, Check, CheckCheck, Clock } from 'lucide-react';

interface ConversationItemProps {
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

export function ConversationItem({
  contact,
  lastMessage,
  unreadCount,
  isOnline,
  onClick
}: ConversationItemProps) {
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
      className="w-full px-4 py-3 hover:bg-cyan-500/10 transition-colors flex items-center gap-3 border-b border-gray-800"
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
          {contact.displayName?.[0] || contact.peerId.substring(0, 2).toUpperCase()}
        </div>
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 border-2 border-black rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-white truncate">
            {contact.displayName || `Peer ${contact.peerId.substring(0, 8)}`}
          </h3>
          {lastMessage && (
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {formatTime(lastMessage.timestamp)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-gray-400 truncate flex-1">
            {lastMessage ? (
              <>
                {lastMessage.isMe && (
                  lastMessage.read ? (
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  )
                )}
                <span className="truncate">{lastMessage.content}</span>
              </>
            ) : (
              <span className="text-gray-600 italic">No messages yet</span>
            )}
          </div>

          {unreadCount > 0 && (
            <div className="ml-2 min-w-[20px] h-5 px-1.5 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-black">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default ConversationItem;
