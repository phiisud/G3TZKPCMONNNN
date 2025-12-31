import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Users, MessageSquare, Search, QrCode, AlertCircle, Loader2, Link2 } from 'lucide-react';
import { MeshGroup, Message, TypingUser } from '../types';
import ChatListPanel from '../components/chat/ChatListPanel';
import ChatInterface from '../components/chat/ChatInterface';
import G3TZKPConnectPopup from '../components/chat/G3TZKPConnectPopup';
import P2PConnectModal from '../components/P2PConnectModal';
import { useOperatorStore } from '../stores/operatorStore';
import { g3tzkpService, G3TZKPPeer } from '../services/G3TZKPService';
import { useG3TZKPPersistence } from '../hooks/useG3TZKPPersistence';

interface MeshContact {
  peerId: string;
  displayName?: string;
  avatar?: string;
  isOnline: boolean;
  lastMessage?: { content: string; timestamp: number; isMe: boolean; read: boolean };
  unreadCount: number;
}

interface MeshPageProps {
  meshGroups: MeshGroup[];
  meshContacts: MeshContact[];
  messages: Message[];
  selectedGroup: MeshGroup | null;
  typingUsers: TypingUser[];
  highlightedMessageId: string | null;
  onSelectGroup: (group: MeshGroup | null) => void;
  onSendMessage: (content: string, replyTo?: string | null) => void;
  onFileUpload: (file: File) => void;
  onVoiceMessage: (blob: Blob) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onAddContact: (contact: { peerId: string; displayName?: string }) => void;
  onCall: (type: 'voice' | 'video') => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onStartTyping: () => void;
  onStopTyping: () => void;
  onViewThread: (messageId: string) => void;
  onViewTensorObject: (tensorData: any) => void;
  getMessageById: (id: string) => Message | undefined;
  fileProgress: number;
  isVerifying: boolean;
}

type ViewState = 'list' | 'chat' | 'group';

export default function MeshPage({
  meshGroups,
  meshContacts,
  messages,
  selectedGroup,
  typingUsers,
  highlightedMessageId,
  onSelectGroup,
  onSendMessage,
  onFileUpload,
  onVoiceMessage,
  onCreateGroup,
  onJoinGroup,
  onAddContact,
  onCall,
  onReactToMessage,
  onEditMessage,
  onDeleteMessage,
  onStartTyping,
  onStopTyping,
  onViewThread,
  onViewTensorObject,
  getMessageById,
  fileProgress,
  isVerifying
}: MeshPageProps) {
  const [activeTab, setActiveTab] = useState<'groups' | 'chats'>('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewState, setViewState] = useState<ViewState>('list');
  const [showPeerDiscovery, setShowPeerDiscovery] = useState(false);
  const [showP2PConnect, setShowP2PConnect] = useState(false);
  const [myPeerId, setMyPeerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [g3tzkpMessages, setG3tzkpMessages] = useState<Map<string, Message[]>>(new Map());
  const messageHandlerSetup = useRef(false);
  
  const { getDisplayName, getAvatarUrl } = useOperatorStore();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile && viewState === 'list') {
        setViewState('list');
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewState]);

  useEffect(() => {
    const loadPeerId = async () => {
      try {
        const peerId = await g3tzkpService.initialize();
        if (peerId) {
          setMyPeerId(peerId);
        }
      } catch (err) {
        console.error('[MeshPage] Failed to get peer ID:', err);
      }
    };
    loadPeerId();
  }, []);

  useEffect(() => {
    const loadPersistedMessages = async () => {
      try {
        const storedMessages = await g3tzkpStorage.getAllMessages();
        if (storedMessages.size > 0) {
          setG3tzkpMessages(storedMessages);
          console.log('[MeshPage] Loaded', storedMessages.size, 'peer conversations from storage');
        }
      } catch (err) {
        console.error('[MeshPage] Failed to load persisted messages:', err);
      }
    };
    loadPersistedMessages();
  }, []);

  useEffect(() => {
    if (messageHandlerSetup.current) return;
    messageHandlerSetup.current = true;

    g3tzkpService.onMessage(async (fromPeerId, content, type) => {
      console.log('[MeshPage] Received G3TZKP message from:', fromPeerId);
      const newMessage: Message = {
        id: crypto.randomUUID(),
        sender: fromPeerId,
        content,
        timestamp: Date.now(),
        status: 'delivered',
        type: type === 'TEXT' ? 'text' : 'text',
        isZkpVerified: true,
        isMe: false,
        reactions: []
      };
      
      setG3tzkpMessages(prev => {
        const updated = new Map(prev);
        const existing = updated.get(fromPeerId) || [];
        updated.set(fromPeerId, [...existing, newMessage]);
        return updated;
      });

      try {
        await g3tzkpStorage.saveMessage(fromPeerId, newMessage);
        console.log('[MeshPage] Saved incoming message to storage');
      } catch (err) {
        console.error('[MeshPage] Failed to persist incoming message:', err);
      }
    });

    g3tzkpService.onPeerConnect((peer) => {
      console.log('[MeshPage] G3TZKP peer connected:', peer.peerId);
    });

    g3tzkpService.onPeerDisconnect((peer) => {
      console.log('[MeshPage] G3TZKP peer disconnected:', peer.peerId);
    });
  }, []);

  const handleSelectChat = useCallback((chatId: string, type: 'contact' | 'group') => {
    setSelectedChatId(chatId);
    if (type === 'group') {
      const group = meshGroups.find(g => g.id === chatId);
      onSelectGroup(group || null);
    } else {
      onSelectGroup(null);
    }
    if (isMobile) {
      setViewState('chat');
    }
  }, [isMobile, meshGroups, onSelectGroup]);

  const handleBack = useCallback(() => {
    setViewState('list');
    setSelectedChatId(null);
    onSelectGroup(null);
  }, [onSelectGroup]);

  const handleOpenPeerDiscovery = useCallback(() => {
    setShowPeerDiscovery(true);
  }, []);

  const handlePeerConnected = useCallback((peerId: string) => {
    const peer = g3tzkpService.getPeer(peerId);
    onAddContact({ peerId, displayName: peerId.slice(0, 12) + '...' });
    console.log('[MeshPage] Peer connected via G3TZKP:', peerId);
  }, [onAddContact]);

  const handleG3TZKPSendMessage = useCallback(async (content: string, replyTo?: string | null) => {
    if (!selectedChatId) return;
    
    const isG3TZKPPeer = selectedChatId.startsWith('G3-');
    
    if (isG3TZKPPeer && g3tzkpService.isConnected(selectedChatId)) {
      const success = await g3tzkpService.sendMessage(selectedChatId, content, 'TEXT');
      
      if (success) {
        const newMessage: Message = {
          id: crypto.randomUUID(),
          sender: myPeerId,
          content,
          timestamp: Date.now(),
          status: 'sent',
          type: 'text',
          isZkpVerified: true,
          isMe: true,
          replyTo: replyTo || undefined,
          reactions: []
        };
        
        setG3tzkpMessages(prev => {
          const updated = new Map(prev);
          const existing = updated.get(selectedChatId) || [];
          updated.set(selectedChatId, [...existing, newMessage]);
          return updated;
        });

        try {
          await g3tzkpStorage.saveMessage(selectedChatId, newMessage);
          console.log('[MeshPage] Saved sent message to storage');
        } catch (err) {
          console.error('[MeshPage] Failed to persist sent message:', err);
        }
      } else {
        console.error('[MeshPage] Failed to send G3TZKP message');
      }
    } else {
      onSendMessage(content, replyTo || undefined);
    }
  }, [selectedChatId, myPeerId, onSendMessage]);

  const getCurrentMessages = useCallback((): Message[] => {
    if (!selectedChatId) return messages;
    
    const isG3TZKPPeer = selectedChatId.startsWith('G3-');
    if (isG3TZKPPeer) {
      return g3tzkpMessages.get(selectedChatId) || [];
    }
    return messages;
  }, [selectedChatId, g3tzkpMessages, messages]);

  const handleGetMessageById = useCallback((id: string): Message | undefined => {
    if (selectedChatId?.startsWith('G3-')) {
      const peerMessages = g3tzkpMessages.get(selectedChatId) || [];
      return peerMessages.find(m => m.id === id);
    }
    return getMessageById(id);
  }, [selectedChatId, g3tzkpMessages, getMessageById]);

  const handleEditG3TZKPMessage = useCallback(async (messageId: string, newContent: string) => {
    if (selectedChatId?.startsWith('G3-')) {
      const editedAt = Date.now();
      setG3tzkpMessages(prev => {
        const updated = new Map(prev);
        const peerMessages = updated.get(selectedChatId) || [];
        const editedMessages = peerMessages.map(msg =>
          msg.id === messageId ? { ...msg, content: newContent, editedAt } : msg
        );
        updated.set(selectedChatId, editedMessages);
        return updated;
      });

      try {
        await g3tzkpStorage.updateMessage(messageId, { content: newContent, editedAt });
      } catch (err) {
        console.error('[MeshPage] Failed to persist message edit:', err);
      }
    } else {
      onEditMessage(messageId, newContent);
    }
  }, [selectedChatId, onEditMessage]);

  const handleDeleteG3TZKPMessage = useCallback(async (messageId: string) => {
    if (selectedChatId?.startsWith('G3-')) {
      setG3tzkpMessages(prev => {
        const updated = new Map(prev);
        const peerMessages = updated.get(selectedChatId) || [];
        const filteredMessages = peerMessages.map(msg =>
          msg.id === messageId ? { ...msg, deleted: true, content: '[Message deleted]' } : msg
        );
        updated.set(selectedChatId, filteredMessages);
        return updated;
      });

      try {
        await g3tzkpStorage.updateMessage(messageId, { deleted: true, content: '[Message deleted]' });
      } catch (err) {
        console.error('[MeshPage] Failed to persist message deletion:', err);
      }
    } else {
      onDeleteMessage(messageId);
    }
  }, [selectedChatId, onDeleteMessage]);

  const handleReactG3TZKPMessage = useCallback(async (messageId: string, emoji: string) => {
    if (selectedChatId?.startsWith('G3-')) {
      let newReactions: Message['reactions'] | null = null;
      
      setG3tzkpMessages(prev => {
        const updated = new Map(prev);
        const peerMessages = updated.get(selectedChatId) || [];
        const reactedMessages = peerMessages.map(msg => {
          if (msg.id !== messageId) return msg;
          const reactions = msg.reactions || [];
          const existingReaction = reactions.find(r => r.emoji === emoji);
          let updatedReactions: Message['reactions'];
          
          if (existingReaction) {
            if (existingReaction.includesMe) {
              if (existingReaction.count === 1) {
                updatedReactions = reactions.filter(r => r.emoji !== emoji);
              } else {
                updatedReactions = reactions.map(r =>
                  r.emoji === emoji
                    ? { ...r, count: r.count - 1, includesMe: false, users: r.users.filter(u => u !== myPeerId) }
                    : r
                );
              }
            } else {
              updatedReactions = reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, includesMe: true, users: [...r.users, myPeerId] }
                  : r
              );
            }
          } else {
            updatedReactions = [...reactions, { emoji, count: 1, users: [myPeerId], includesMe: true }];
          }
          
          newReactions = updatedReactions;
          return { ...msg, reactions: updatedReactions };
        });
        updated.set(selectedChatId, reactedMessages);
        return updated;
      });

      if (newReactions !== null) {
        try {
          await g3tzkpStorage.updateMessage(messageId, { reactions: newReactions });
        } catch (err) {
          console.error('[MeshPage] Failed to persist reaction:', err);
        }
      }
    } else {
      onReactToMessage(messageId, emoji);
    }
  }, [selectedChatId, myPeerId, onReactToMessage]);

  const filteredContacts = meshContacts.filter(c => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(query) ||
      c.peerId.toLowerCase().includes(query)
    );
  });

  const filteredGroups = meshGroups.filter(g => {
    if (!searchQuery.trim()) return true;
    return g.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedContact = meshContacts.find(c => c.peerId === selectedChatId);
  const chatName = selectedGroup?.name || selectedContact?.displayName || 'Chat';
  const isOnline = selectedContact?.isOnline || false;
  const memberCount = selectedGroup?.memberCount;

  if (isMobile && viewState === 'chat' && selectedChatId) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#010401]">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3 border-b border-[#4caf50]/20 bg-black/60 backdrop-blur-md safe-top">
          <button 
            onClick={handleBack}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-[#4caf50]/10 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-[#00f3ff]" />
          </button>
          
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center flex-shrink-0">
            {selectedGroup ? (
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#4caf50]" />
            ) : (
              <span className="text-[#00f3ff] font-bold text-xs sm:text-sm">
                {chatName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-[#00f3ff] truncate">{chatName}</h3>
            <p className="text-[10px] sm:text-xs text-[#4caf50]/60">
              {selectedGroup 
                ? `${memberCount} members` 
                : isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <ChatInterface
          messages={getCurrentMessages()}
          onSend={handleG3TZKPSendMessage}
          onFileUpload={onFileUpload}
          onVoiceMessage={onVoiceMessage}
          onReact={handleReactG3TZKPMessage}
          onEdit={handleEditG3TZKPMessage}
          onDelete={handleDeleteG3TZKPMessage}
          onStartTyping={onStartTyping}
          onStopTyping={onStopTyping}
          onViewThread={onViewThread}
          onViewTensorObject={onViewTensorObject}
          getMessageById={handleGetMessageById}
          typingUsers={typingUsers}
          highlightedMessageId={highlightedMessageId}
          fileProgress={fileProgress}
          isVerifying={isVerifying}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#010401]">
      <div className={`${isMobile ? 'flex-1' : 'w-[280px] sm:w-[320px] md:w-[360px]'} flex flex-col border-r border-[#4caf50]/20 bg-black/40`}>
        <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-[#4caf50]/20 bg-black/60 safe-top">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h2 className="text-xs sm:text-sm font-bold text-[#00f3ff] uppercase tracking-wider">MESH</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowP2PConnect(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#4caf50]/10 border border-[#4caf50]/30 flex items-center justify-center text-[#4caf50] hover:bg-[#4caf50]/20 transition-all active:scale-95"
                title="P2P Direct Connect"
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleOpenPeerDiscovery}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#00f3ff]/10 border border-[#00f3ff]/30 flex items-center justify-center text-[#00f3ff] hover:bg-[#00f3ff]/20 transition-all active:scale-95"
                title="Add Peer"
              >
                <QrCode className="w-4 h-4" />
              </button>
              <span className="text-[10px] sm:text-xs text-[#4caf50]/60 font-mono">
                {meshContacts.filter(c => c.isOnline).length} online
              </span>
            </div>
          </div>
          
          <div className="flex gap-1.5 sm:gap-2">
            <button 
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'chats'
                  ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/40'
                  : 'bg-black/20 text-[#4caf50]/60 border border-[#4caf50]/20 hover:border-[#4caf50]/40'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              CHATS
            </button>
            <button 
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'groups'
                  ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/40'
                  : 'bg-black/20 text-[#4caf50]/60 border border-[#4caf50]/20 hover:border-[#4caf50]/40'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              GROUPS
            </button>
          </div>
        </div>

        <div className="px-3 py-1.5 sm:px-4 sm:py-2 border-b border-[#4caf50]/10">
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4caf50]/40" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-[#4caf50]/20 rounded-lg pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#00f3ff] placeholder-[#4caf50]/40 focus:outline-none focus:border-[#00f3ff]/40"
            />
          </div>
        </div>

        <ChatListPanel
          activeTab={activeTab}
          groups={filteredGroups}
          contacts={filteredContacts}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onCreateGroup={onCreateGroup}
          onJoinGroup={onJoinGroup}
          onAddContact={handleOpenPeerDiscovery}
        />
      </div>

      {!isMobile && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedChatId ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#4caf50]/20 bg-black/60">
                <div className="w-10 h-10 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center">
                  {selectedGroup ? (
                    <Users className="w-5 h-5 text-[#4caf50]" />
                  ) : (
                    <span className="text-[#00f3ff] font-bold text-sm">
                      {chatName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#00f3ff] truncate">{chatName}</h3>
                  <p className="text-xs text-[#4caf50]/60">
                    {selectedGroup 
                      ? `${memberCount} members` 
                      : isOnline ? 'Online' : 'Last seen recently'}
                  </p>
                </div>
              </div>

              <ChatInterface
                messages={getCurrentMessages()}
                onSend={handleG3TZKPSendMessage}
                onFileUpload={onFileUpload}
                onVoiceMessage={onVoiceMessage}
                onReact={handleReactG3TZKPMessage}
                onEdit={handleEditG3TZKPMessage}
                onDelete={handleDeleteG3TZKPMessage}
                onStartTyping={onStartTyping}
                onStopTyping={onStopTyping}
                onViewThread={onViewThread}
                onViewTensorObject={onViewTensorObject}
                getMessageById={handleGetMessageById}
                typingUsers={typingUsers}
                highlightedMessageId={highlightedMessageId}
                fileProgress={fileProgress}
                isVerifying={isVerifying}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#010401]/50 p-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#4caf50]/10 border border-[#4caf50]/20 flex items-center justify-center mb-4 sm:mb-6">
                <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-[#4caf50]/40" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#00f3ff] mb-2">G3ZKP Messenger</h3>
              <p className="text-xs sm:text-sm text-[#4caf50]/60 text-center max-w-md mb-4">
                Select a chat to start messaging with end-to-end encryption
              </p>
              <button
                onClick={handleOpenPeerDiscovery}
                className="px-4 py-2.5 rounded-lg bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff] text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-[#00f3ff]/20 transition-all"
              >
                <QrCode className="w-4 h-4" />
                Add New Peer
              </button>
            </div>
          )}
        </div>
      )}

      <G3TZKPConnectPopup
        isOpen={showPeerDiscovery}
        onClose={() => setShowPeerDiscovery(false)}
        onConnected={handlePeerConnected}
      />

      <P2PConnectModal
        isOpen={showP2PConnect}
        onClose={() => setShowP2PConnect(false)}
        localPeerId={myPeerId}
        localPeerName={getDisplayName() || 'LOCAL_OPERATOR'}
      />
    </div>
  );
}
