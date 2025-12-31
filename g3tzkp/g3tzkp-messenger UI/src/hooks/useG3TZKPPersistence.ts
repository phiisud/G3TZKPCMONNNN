import { useState, useEffect, useCallback, useRef } from 'react';
import { Message } from '../types';
import { g3tzkpPersistence } from '../services/G3TZKPPersistenceController';
import { g3tzkpService } from '../services/G3TZKPService';

interface PersistenceState {
  messages: Map<string, Message[]>;
  isLoading: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  lastError: Error | null;
}

interface PersistenceActions {
  sendMessage: (peerId: string, content: string, replyTo?: string) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => void;
  deleteMessage: (messageId: string) => void;
  reactToMessage: (messageId: string, emoji: string, myPeerId: string) => void;
  getMessagesForPeer: (peerId: string) => Message[];
  getMessageById: (messageId: string, peerId?: string) => Message | undefined;
  forceSync: () => Promise<void>;
}

export function useG3TZKPPersistence(): PersistenceState & PersistenceActions {
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const initializedRef = useRef(false);
  const messageHandlerSetupRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        const loadedMessages = await g3tzkpPersistence.initialize();
        setMessages(new Map(loadedMessages));
        console.log('[useG3TZKPPersistence] Initialized with', loadedMessages.size, 'conversations');
      } catch (err) {
        console.error('[useG3TZKPPersistence] Init failed:', err);
        setLastError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (messageHandlerSetupRef.current) return;
    messageHandlerSetupRef.current = true;

    g3tzkpService.onMessage(async (fromPeerId, content, type) => {
      console.log('[useG3TZKPPersistence] Received message from:', fromPeerId);
      
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

      g3tzkpPersistence.saveMessage(fromPeerId, newMessage);
      
      setMessages(prev => {
        const updated = new Map(prev);
        const existing = updated.get(fromPeerId) || [];
        updated.set(fromPeerId, [...existing, newMessage]);
        return updated;
      });
    });
  }, []);

  useEffect(() => {
    const unsubCompleted = g3tzkpPersistence.on('job:completed', () => {
      const status = g3tzkpPersistence.getQueueStatus();
      setPendingOperations(status.pending + status.processing);
    });

    const unsubFailed = g3tzkpPersistence.on('job:failed', ({ error }) => {
      setLastError(error);
      const status = g3tzkpPersistence.getQueueStatus();
      setPendingOperations(status.pending + status.processing);
    });

    const unsubRetry = g3tzkpPersistence.on('job:retry', () => {
      const status = g3tzkpPersistence.getQueueStatus();
      setPendingOperations(status.pending + status.processing);
    });

    const unsubSync = g3tzkpPersistence.on('sync:complete', () => {
      setMessages(new Map(g3tzkpPersistence.getAllMessages()));
      setIsSyncing(false);
    });

    return () => {
      unsubCompleted();
      unsubFailed();
      unsubRetry();
      unsubSync();
    };
  }, []);

  const sendMessage = useCallback(async (peerId: string, content: string, replyTo?: string): Promise<boolean> => {
    const myPeerId = g3tzkpService.getPeerId();
    
    if (!g3tzkpService.isConnected(peerId)) {
      console.error('[useG3TZKPPersistence] Not connected to peer:', peerId);
      return false;
    }

    const success = await g3tzkpService.sendMessage(peerId, content, 'TEXT');
    
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
        replyTo,
        reactions: []
      };

      g3tzkpPersistence.saveMessage(peerId, newMessage);
      
      setMessages(prev => {
        const updated = new Map(prev);
        const existing = updated.get(peerId) || [];
        updated.set(peerId, [...existing, newMessage]);
        return updated;
      });

      setPendingOperations(prev => prev + 1);
    }

    return success;
  }, []);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    const editedAt = Date.now();

    setMessages(prev => {
      const updated = new Map(prev);
      for (const [peerId, peerMessages] of updated.entries()) {
        const index = peerMessages.findIndex(m => m.id === messageId);
        if (index !== -1) {
          const editedMessages = [...peerMessages];
          editedMessages[index] = { ...editedMessages[index], content: newContent, editedAt };
          updated.set(peerId, editedMessages);
          break;
        }
      }
      return updated;
    });

    g3tzkpPersistence.updateMessage(messageId, { content: newContent, editedAt });
    setPendingOperations(prev => prev + 1);
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => {
      const updated = new Map(prev);
      for (const [peerId, peerMessages] of updated.entries()) {
        const index = peerMessages.findIndex(m => m.id === messageId);
        if (index !== -1) {
          const deletedMessages = [...peerMessages];
          deletedMessages[index] = { 
            ...deletedMessages[index], 
            deleted: true, 
            content: '[Message deleted]' 
          };
          updated.set(peerId, deletedMessages);
          break;
        }
      }
      return updated;
    });

    g3tzkpPersistence.deleteMessage(messageId);
    setPendingOperations(prev => prev + 1);
  }, []);

  const reactToMessage = useCallback((messageId: string, emoji: string, myPeerId: string) => {
    let newReactions: Message['reactions'] | null = null;

    setMessages(prev => {
      const updated = new Map(prev);
      for (const [peerId, peerMessages] of updated.entries()) {
        const index = peerMessages.findIndex(m => m.id === messageId);
        if (index !== -1) {
          const reactedMessages = [...peerMessages];
          const msg = reactedMessages[index];
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
          reactedMessages[index] = { ...msg, reactions: updatedReactions };
          updated.set(peerId, reactedMessages);
          break;
        }
      }
      return updated;
    });

    if (newReactions !== null) {
      g3tzkpPersistence.updateMessage(messageId, { reactions: newReactions });
      setPendingOperations(prev => prev + 1);
    }
  }, []);

  const getMessagesForPeer = useCallback((peerId: string): Message[] => {
    return messages.get(peerId) || [];
  }, [messages]);

  const getMessageById = useCallback((messageId: string, peerId?: string): Message | undefined => {
    if (peerId) {
      const peerMessages = messages.get(peerId) || [];
      return peerMessages.find(m => m.id === messageId);
    }

    for (const peerMessages of messages.values()) {
      const found = peerMessages.find(m => m.id === messageId);
      if (found) return found;
    }
    return undefined;
  }, [messages]);

  const forceSync = useCallback(async () => {
    setIsSyncing(true);
    await g3tzkpPersistence.forceSync();
  }, []);

  return {
    messages,
    isLoading,
    isSyncing,
    pendingOperations,
    lastError,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    getMessagesForPeer,
    getMessageById,
    forceSync
  };
}
