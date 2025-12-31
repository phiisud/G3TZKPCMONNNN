import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Mic, Smile, X, Image, File, MapPin } from 'lucide-react';
import { Message, TypingUser } from '../../types';
import DiegeticTerminal from '../DiegeticTerminal';

interface ChatInterfaceProps {
  messages: Message[];
  onSend: (content: string, replyTo?: string | null) => void;
  onFileUpload: (file: File) => void;
  onVoiceMessage: (blob: Blob) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
  onStartTyping: () => void;
  onStopTyping: () => void;
  onViewThread: (messageId: string) => void;
  onViewTensorObject: (tensorData: any) => void;
  getMessageById: (id: string) => Message | undefined;
  typingUsers: TypingUser[];
  highlightedMessageId: string | null;
  fileProgress: number;
  isVerifying: boolean;
  onCall?: (type: 'voice' | 'video') => void;
  onOpenSettings?: () => void;
}

export default function ChatInterface({
  messages,
  onSend,
  onFileUpload,
  onVoiceMessage,
  onReact,
  onEdit,
  onDelete,
  onStartTyping,
  onStopTyping,
  onViewThread,
  onViewTensorObject,
  getMessageById,
  typingUsers,
  highlightedMessageId,
  fileProgress,
  isVerifying
  , onCall, onOpenSettings
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  useEffect(() => {
    if ('visualViewport' in window && window.visualViewport) {
      const handleResize = () => {
        const container = document.getElementById('chat-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      };
      
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    onStartTyping();
    
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 2000);
  }, [onStartTyping, onStopTyping]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    onSend(trimmed, replyToId);
    setInputValue('');
    setReplyToId(null);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onStopTyping();
  }, [inputValue, replyToId, onSend, onStopTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      setShowAttachments(false);
    }
  }, [onFileUpload]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [onVoiceMessage]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const replyToMessage = replyToId ? getMessageById(replyToId) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DiegeticTerminal
        messages={messages}
        onSend={onSend}
        onFileUpload={onFileUpload}
        onVoiceMessage={onVoiceMessage}
        onOpenSettings={onOpenSettings}
        fileProgress={fileProgress}
        isVerifying={isVerifying}
        nodeId="12D3KooWG3ZKPLocal"
        onCall={onCall}
        onReact={onReact}
        onEdit={onEdit}
        onDelete={onDelete}
        getMessageById={getMessageById}
        typingUsers={typingUsers}
        onStartTyping={onStartTyping}
        onStopTyping={onStopTyping}
        onViewThread={onViewThread}
        highlightedMessageId={highlightedMessageId}
        onViewTensorObject={onViewTensorObject}
      />
    </div>
  );
}
