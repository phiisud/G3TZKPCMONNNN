import React from 'react';
import { Users, Lock, ShieldCheck, Plus, UserPlus, MessageSquare } from 'lucide-react';
import { MeshGroup } from '../../types';

interface MeshContact {
  peerId: string;
  displayName?: string;
  avatar?: string;
  isOnline: boolean;
  lastMessage?: { content: string; timestamp: number; isMe: boolean; read: boolean };
  unreadCount: number;
}

interface ChatListPanelProps {
  activeTab: 'groups' | 'chats';
  groups: MeshGroup[];
  contacts: MeshContact[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string, type: 'contact' | 'group') => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onAddContact: (() => void) | ((contact: { peerId: string }) => void);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function ChatListPanel({
  activeTab,
  groups,
  contacts,
  selectedChatId,
  onSelectChat,
  onCreateGroup,
  onJoinGroup,
  onAddContact
}: ChatListPanelProps) {
  if (activeTab === 'groups') {
    if (groups.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-[#4caf50]/10 border border-[#4caf50]/20 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-[#4caf50]/40" />
          </div>
          <h3 className="text-sm font-bold text-[#00f3ff] mb-2">No Groups</h3>
          <p className="text-xs text-[#4caf50]/60 text-center mb-6">
            Create or join a group to start secure communications
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <button 
              onClick={onCreateGroup}
              className="w-full py-2.5 rounded-lg bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff] text-xs font-bold uppercase tracking-wide hover:bg-[#00f3ff]/20 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
            <button 
              onClick={onJoinGroup}
              className="w-full py-2.5 rounded-lg bg-[#4caf50]/10 border border-[#4caf50]/40 text-[#4caf50] text-xs font-bold uppercase tracking-wide hover:bg-[#4caf50]/20 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Join Group
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelectChat(group.id, 'group')}
            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[#4caf50]/5 transition-colors border-b border-[#4caf50]/10 ${
              selectedChatId === group.id ? 'bg-[#00f3ff]/10' : ''
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center">
                <span className="text-[#4caf50] font-bold text-sm">{group.name.substring(0, 2).toUpperCase()}</span>
              </div>
              {group.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-[#00f3ff] text-black text-[10px] font-bold rounded-full">
                  {group.unreadCount}
                </span>
              )}
            </div>
            
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-[#00f3ff] truncate">{group.name}</span>
                <span className="text-[10px] text-[#4caf50]/60">
                  {group.lastActivity ? formatTime(group.lastActivity) : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-[#4caf50]/40 flex-shrink-0" />
                <span className="text-xs text-[#4caf50]/60 truncate">{group.memberCount} members</span>
                {group.isPrivate && <Lock className="w-3 h-3 text-[#4caf50]/40" />}
                {group.zkpVerified && <ShieldCheck className="w-3 h-3 text-[#00f3ff]/40" />}
              </div>
            </div>
          </button>
        ))}
        
        <div className="p-4 flex gap-2">
          <button 
            onClick={onCreateGroup}
            className="flex-1 py-2 rounded-lg border border-[#00f3ff]/30 text-[#00f3ff] text-xs font-bold hover:bg-[#00f3ff]/10 transition-all flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Create
          </button>
          <button 
            onClick={onJoinGroup}
            className="flex-1 py-2 rounded-lg border border-[#4caf50]/30 text-[#4caf50] text-xs font-bold hover:bg-[#4caf50]/10 transition-all flex items-center justify-center gap-1"
          >
            <UserPlus className="w-3 h-3" /> Join
          </button>
        </div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-[#4caf50]/10 border border-[#4caf50]/20 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-[#4caf50]/40" />
        </div>
        <h3 className="text-sm font-bold text-[#00f3ff] mb-2">No Chats</h3>
        <p className="text-xs text-[#4caf50]/60 text-center mb-6">
          Add a contact to start a secure conversation
        </p>
        <button 
          onClick={() => (onAddContact as () => void)()}
          className="px-6 py-2.5 rounded-lg bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff] text-xs font-bold uppercase tracking-wide hover:bg-[#00f3ff]/20 transition-all flex items-center gap-2 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Add Contact
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {contacts.map((contact) => (
        <button
          key={contact.peerId}
          onClick={() => onSelectChat(contact.peerId, 'contact')}
          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[#4caf50]/5 transition-colors border-b border-[#4caf50]/10 ${
            selectedChatId === contact.peerId ? 'bg-[#00f3ff]/10' : ''
          }`}
        >
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center overflow-hidden">
              {contact.avatar ? (
                <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#00f3ff] font-bold text-sm">
                  {(contact.displayName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#010401] ${
              contact.isOnline ? 'bg-[#4caf50]' : 'bg-[#4caf50]/30'
            }`} />
            {contact.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-[#00f3ff] text-black text-[10px] font-bold rounded-full">
                {contact.unreadCount}
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-[#00f3ff] truncate">
                {contact.displayName || `Peer ${contact.peerId.substring(0, 8)}`}
              </span>
              {contact.lastMessage && (
                <span className="text-[10px] text-[#4caf50]/60">
                  {formatTime(contact.lastMessage.timestamp)}
                </span>
              )}
            </div>
            {contact.lastMessage && (
              <p className="text-xs text-[#4caf50]/60 truncate">
                {contact.lastMessage.isMe && 'You: '}
                {contact.lastMessage.content}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
