import React, { useState } from 'react';
import { Search, UserPlus, X, MessageSquare, Users } from 'lucide-react';
import MeshConversationItem from './MeshConversationItem';
import MeshAddContactDialog from './MeshAddContactDialog';

interface Contact {
  peerId: string;
  displayName?: string;
  avatar?: string;
  isOnline: boolean;
  lastMessage?: {
    content: string;
    timestamp: number;
    isMe: boolean;
    read: boolean;
  };
  unreadCount: number;
}

interface MeshContactListProps {
  contacts: Contact[];
  onSelectContact: (peerId: string) => void;
  onAddContact: (contact: { peerId: string; method: 'manual' | 'nearby' | 'qr' }) => void;
}

export function MeshContactList({ contacts, onSelectContact, onAddContact }: MeshContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    return (
      contact.displayName?.toLowerCase().includes(query) ||
      contact.peerId.toLowerCase().includes(query)
    );
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    
    const timeA = a.lastMessage?.timestamp || 0;
    const timeB = b.lastMessage?.timestamp || 0;
    return timeB - timeA;
  });

  const onlineCount = contacts.filter(c => c.isOnline).length;

  return (
    <div className="h-full flex flex-col bg-[#0a1a0a]/95">
      <div className="p-4 border-b-[0.5px] border-[#4caf50]/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageSquare size={16} className="text-[#00f3ff]" />
            <h1 className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest">MESH_CONTACTS</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[8px] font-mono text-[#4caf50]/60">
              {onlineCount}/{contacts.length} ONLINE
            </span>
            <button
              onClick={() => setShowAddDialog(true)}
              className="p-2 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 transition-all"
              title="Add Contact"
            >
              <UserPlus size={14} className="text-[#00f3ff]" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4caf50]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH_NODES..."
            className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 pl-10 pr-10 py-3 text-[10px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-mono uppercase placeholder:text-[#4caf50]/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4caf50]/40 hover:text-[#00f3ff]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedContacts.length > 0 ? (
          <div className="space-y-1 p-2">
            {sortedContacts.map(contact => (
              <MeshConversationItem
                key={contact.peerId}
                contact={contact}
                lastMessage={contact.lastMessage}
                unreadCount={contact.unreadCount}
                isOnline={contact.isOnline}
                onClick={() => onSelectContact(contact.peerId)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 border-[0.5px] border-[#4caf50]/20 bg-black/40 flex items-center justify-center mb-4">
              <Users size={32} className="text-[#4caf50]/30" />
            </div>
            <h3 className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">
              {searchQuery ? 'NO_RESULTS' : 'NO_NODES_CONNECTED'}
            </h3>
            <p className="text-[9px] font-mono text-[#4caf50]/40 uppercase mb-4">
              {searchQuery
                ? 'MODIFY_SEARCH_PARAMETERS'
                : 'INITIATE_NODE_DISCOVERY_TO_CONNECT'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddDialog(true)}
                className="px-6 py-3 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 transition-all text-[10px] font-black text-[#00f3ff] uppercase tracking-widest flex items-center gap-2"
              >
                <UserPlus size={14} />
                ADD_NODE
              </button>
            )}
          </div>
        )}
      </div>

      {showAddDialog && (
        <MeshAddContactDialog
          onAdd={onAddContact}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}

export default MeshContactList;
