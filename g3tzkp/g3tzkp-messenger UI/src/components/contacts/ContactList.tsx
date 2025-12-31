import React, { useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import ConversationItem from './ConversationItem';
import AddContactDialog from './AddContactDialog';

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

interface ContactListProps {
  contacts: Contact[];
  onSelectContact: (peerId: string) => void;
  onAddContact: (contact: { peerId: string; method: 'manual' | 'nearby' | 'qr' }) => void;
}

export function ContactList({ contacts, onSelectContact, onAddContact }: ContactListProps) {
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

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="p-4 border-b border-cyan-500/30">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-cyan-400">Chats</h1>
          <button
            onClick={() => setShowAddDialog(true)}
            className="p-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors"
            title="Add Contact"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedContacts.length > 0 ? (
          sortedContacts.map(contact => (
            <ConversationItem
              key={contact.peerId}
              contact={contact}
              lastMessage={contact.lastMessage}
              unreadCount={contact.unreadCount}
              isOnline={contact.isOnline}
              onClick={() => onSelectContact(contact.peerId)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-4">
              <Search className="w-12 h-12 text-gray-700" />
            </div>
            <h3 className="text-xl font-bold text-gray-400 mb-2">
              {searchQuery ? 'No results found' : 'No conversations yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? 'Try a different search term'
                : 'Start a conversation by adding a contact'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddDialog(true)}
                className="px-6 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Add Contact
              </button>
            )}
          </div>
        )}
      </div>

      {showAddDialog && (
        <AddContactDialog
          onAdd={onAddContact}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}

export default ContactList;
