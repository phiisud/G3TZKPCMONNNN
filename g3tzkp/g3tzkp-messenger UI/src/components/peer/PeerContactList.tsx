import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Star, MessageCircle, Phone, Trash2 } from 'lucide-react';
import { PeerContact } from '@/types/peer';
import { peerContactService } from '@/services/PeerContactService';
import { AddPeerContactDialog } from './AddPeerContactDialog';

interface PeerContactListProps {
  onSelectContact?: (contact: PeerContact) => void;
  onCallContact?: (contact: PeerContact) => void;
}

export const PeerContactList: React.FC<PeerContactListProps> = ({ onSelectContact, onCallContact }) => {
  const [contacts, setContacts] = useState<PeerContact[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<PeerContact | null>(null);

  useEffect(() => {
    const unsubscribe = peerContactService.subscribe((updatedContacts) => {
      setContacts(updatedContacts);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleFavorite = async (peerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await peerContactService.toggleFavorite(peerId);
  };

  const handleDeleteContact = async (peerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Remove this contact?')) {
      await peerContactService.removeContact(peerId);
    }
  };

  const handleContactClick = (contact: PeerContact) => {
    setSelectedContact(contact);
    onSelectContact?.(contact);
  };

  const handleCallClick = (contact: PeerContact, e: React.MouseEvent) => {
    e.stopPropagation();
    onCallContact?.(contact);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const favoriteContacts = contacts.filter(c => c.isFavorite);
  const otherContacts = contacts.filter(c => !c.isFavorite);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={24} className="text-blue-600" />
          <h2 className="text-xl font-bold">Contacts</h2>
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
            {contacts.length}
          </span>
        </div>
        <button
          onClick={() => setIsAddDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={18} />
          Add Contact
        </button>
      </div>

      <div className="space-y-4">
        {favoriteContacts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Star size={14} fill="currentColor" />
              Favorites
            </h3>
            <div className="space-y-2">
              {favoriteContacts.map((contact) => (
                <div
                  key={contact.peerId}
                  onClick={() => handleContactClick(contact)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    selectedContact?.peerId === contact.peerId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                        {contact.contactName[0].toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(contact.connectionStatus)}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{contact.contactName}</p>
                        {contact.isFavorite && (
                          <Star size={14} fill="#EAB308" className="text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate font-mono">{contact.peerId}</p>
                      {contact.operatorProfile && (
                        <p className="text-xs text-blue-600 truncate">@{contact.operatorProfile.displayName}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {contact.connectionStatus === 'connected' && (
                        <>
                          <button
                            onClick={(e) => handleCallClick(contact, e)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Call"
                          >
                            <Phone size={18} />
                          </button>
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Message"
                          >
                            <MessageCircle size={18} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => handleToggleFavorite(contact.peerId, e)}
                        className="p-2 text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Toggle favorite"
                      >
                        <Star size={18} fill={contact.isFavorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteContact(contact.peerId, e)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {contact.unreadCount > 0 && (
                    <div className="mt-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded inline-block">
                      {contact.unreadCount} unread message{contact.unreadCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {otherContacts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">All Contacts</h3>
            <div className="space-y-2">
              {otherContacts.map((contact) => (
                <div
                  key={contact.peerId}
                  onClick={() => handleContactClick(contact)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    selectedContact?.peerId === contact.peerId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold">
                        {contact.contactName[0].toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(contact.connectionStatus)}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{contact.contactName}</p>
                      <p className="text-xs text-gray-500 truncate font-mono">{contact.peerId}</p>
                      {contact.operatorProfile && (
                        <p className="text-xs text-blue-600 truncate">@{contact.operatorProfile.displayName}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {contact.connectionStatus === 'connected' && (
                        <>
                          <button
                            onClick={(e) => handleCallClick(contact, e)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Call"
                          >
                            <Phone size={18} />
                          </button>
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Message"
                          >
                            <MessageCircle size={18} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => handleToggleFavorite(contact.peerId, e)}
                        className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Add to favorites"
                      >
                        <Star size={18} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteContact(contact.peerId, e)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {contact.unreadCount > 0 && (
                    <div className="mt-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded inline-block">
                      {contact.unreadCount} unread message{contact.unreadCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {contacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium mb-1">No contacts yet</p>
            <p className="text-sm">Add a contact by their Peer ID to get started</p>
          </div>
        )}
      </div>

      <AddPeerContactDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={() => {
          setIsAddDialogOpen(false);
        }}
      />
    </div>
  );
};
