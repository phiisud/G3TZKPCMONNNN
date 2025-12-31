import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { 
  Send, ShieldCheck, Zap, Activity, 
  Shield, Binary, Loader2, Sparkles, CheckCircle,
  Phone, Video, MoreVertical, Paperclip, Lock, Grid, X,
  Reply, Smile, Pencil, Trash2, Copy, Pin, Forward, CornerUpLeft,
  MessageSquare, Image, Film, Box, Upload, Download, Maximize2, Mic
} from 'lucide-react';
import { Message, TypingUser, AVAILABLE_REACTIONS, MessageReaction, TensorData, VoiceMessageData } from '../types';

const Media3DRenderer = lazy(() => import('./Media3DRenderer'));
import FileUploadDialog from './FileUploadDialog';
import VoiceMessageRecorder from './VoiceMessageRecorder';
import VoiceMessagePlayer from './VoiceMessagePlayer';

const MediaContent: React.FC<{
  message: Message;
  isMe: boolean;
  onViewTensor?: (tensorData: TensorData) => void;
}> = ({ message, isMe, onViewTensor }) => {
  if (message.type === '3d-object' && message.tensorData) {
    const tensorData = message.tensorData;
    return (
      <div className="mt-3 mb-2">
        <div 
          className="relative cursor-pointer group"
          onClick={() => onViewTensor?.(tensorData)}
        >
          <Suspense fallback={
            <div className="w-48 h-36 bg-black/50 border border-[#00f3ff]/20 rounded flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#00f3ff] animate-spin" />
            </div>
          }>
            <Media3DRenderer 
              tensorData={tensorData}
              isVideo={message.mediaType?.startsWith('video/')}
              size="medium"
              showFrame={true}
              interactive={false}
            />
          </Suspense>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded">
            <div className="flex items-center gap-2 text-[#00f3ff]">
              <Maximize2 size={20} />
              <span className="text-[9px] uppercase tracking-wider font-bold">View 3D</span>
            </div>
          </div>
        </div>
        
        {tensorData.flowerOfLife && (
          <div className="text-[7px] font-mono mt-2 opacity-50 flex items-center gap-2">
            <Sparkles size={8} className="text-[#00f3ff]" />
            FLOWER_OF_LIFE: {tensorData.flowerOfLife.rayCount} rays | Gen {tensorData.flowerOfLife.generations}
          </div>
        )}
        
        {tensorData.originalFiles && tensorData.originalFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tensorData.originalFiles.map((file, idx) => (
              <a
                key={idx}
                href={file.url}
                download={file.fileName}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-1 bg-[#4caf50]/10 border border-[#4caf50]/30 rounded text-[7px] text-[#4caf50] hover:bg-[#4caf50]/20 transition-all"
              >
                <Download size={8} />
                {file.fileName.length > 12 ? file.fileName.slice(0, 12) + '...' : file.fileName}
              </a>
            ))}
          </div>
        )}
        
        {message.fileName && (
          <div className="text-[8px] font-mono mt-2 opacity-60 flex items-center gap-2">
            <Box size={10} />
            {message.fileName}
          </div>
        )}
      </div>
    );
  }
  
  if (message.type === 'voice' && message.voiceData) {
    return (
      <div className="mt-3 mb-2 min-w-[200px]">
        <VoiceMessagePlayer
          audioUrl={message.voiceData.audioUrl}
          duration={message.voiceData.duration}
          waveformData={message.voiceData.waveformData}
          isMe={isMe}
        />
      </div>
    );
  }

  if (message.type === 'image' && message.mediaUrl) {
    return (
      <div className="mt-3 mb-2">
        <img 
          src={message.mediaUrl} 
          alt={message.altText || message.fileName || 'Image attachment'} 
          className="max-w-[240px] max-h-[180px] rounded border border-[#00f3ff]/20 object-contain"
          role="img"
          aria-describedby={`img-desc-${message.id}`}
        />
        {message.altText && (
          <p id={`img-desc-${message.id}`} className="sr-only">{message.altText}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {message.fileName && (
            <div className="text-[8px] font-mono opacity-60 flex items-center gap-2">
              <Image size={10} aria-hidden="true" />
              <span>{message.fileName}</span>
            </div>
          )}
          <a
            href={message.mediaUrl}
            download={message.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4caf50]/10 border border-[#4caf50]/20 rounded text-[7px] text-[#4caf50] hover:bg-[#4caf50]/20 transition-all"
            aria-label={`Download ${message.fileName || 'image'}`}
          >
            <Download size={8} aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }
  
  if (message.type === 'video' && message.mediaUrl) {
    return (
      <div className="mt-3 mb-2">
        <video 
          src={message.mediaUrl}
          controls
          className="max-w-[280px] max-h-[200px] rounded border border-[#00f3ff]/20"
          preload="metadata"
        />
        <div className="flex items-center gap-2 mt-2">
          {message.fileName && (
            <div className="text-[8px] font-mono opacity-60 flex items-center gap-2">
              <Film size={10} />
              {message.fileName}
            </div>
          )}
          <a
            href={message.mediaUrl}
            download={message.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4caf50]/10 border border-[#4caf50]/20 rounded text-[7px] text-[#4caf50] hover:bg-[#4caf50]/20 transition-all"
          >
            <Download size={8} />
          </a>
        </div>
      </div>
    );
  }
  
  if (message.type === 'file' && message.fileName) {
    return (
      <div className="mt-3 mb-2 p-3 bg-black/30 border border-[#4caf50]/20 rounded flex items-center gap-3">
        <Paperclip size={16} className="opacity-60" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold truncate">{message.fileName}</div>
          {message.fileSize && (
            <div className="text-[8px] opacity-40">
              {(message.fileSize / 1024).toFixed(1)} KB
            </div>
          )}
        </div>
        {message.mediaUrl && (
          <a
            href={message.mediaUrl}
            download={message.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-[#4caf50]/10 border border-[#4caf50]/20 rounded text-[#4caf50] hover:bg-[#4caf50]/20 transition-all"
          >
            <Download size={12} />
          </a>
        )}
      </div>
    );
  }
  
  return null;
};

interface DiegeticTerminalProps {
  messages: Message[];
  onSend: (text: string, replyToId?: string) => void;
  onFileUpload?: (files: File[], convert3D?: boolean) => void;
  onOpenSettings?: () => void;
  onVoiceMessage?: (audioBlob: Blob, duration: number, waveformData: number[]) => void;
  fileProgress?: number;
  isVerifying: boolean;
  nodeId: string;
  onCall?: (type: 'voice' | 'video') => void;
  typingUsers?: TypingUser[];
  onReact?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
  getMessageById?: (id: string) => Message | undefined;
  onViewThread?: (messageId: string) => void;
  highlightedMessageId?: string | null;
  onViewTensorObject?: (tensorData: TensorData) => void;
}

const MULTIVECTOR_OPCODES = 'φπψη∞∆∇∂∫∬∭∮∯∰∱∲∳∑∏√∛∜∝∠∡∢±∓÷×∗∘∙⋅⊕⊖⊗⊘⊙⊚⊛⊜⊝⊞⊟⊠⊡∧∨¬⊻⊼⊽⊾⊿≡≢≣≠≈≋≅≇∼∽∾≀≃≄αβγδεζηθικλμνξοπρςστυφχψω𝛷𝛹𝛼𝛽𝛾𝛿𝜀𝜁𝜂𝜃𝜄𝜅𝜆𝜇𝜈𝜉𝜊𝜋𝜌𝜍𝜎𝜏𝜐𝜑𝜒𝜓𝜔ℂℍℕℙℚℝℤ𝔾ℏℓ℘ℛℑℌℒℰℱℋℐℳ𝒪𝒫𝒬𝒭𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ᵢⱼₖₗₘₙ∈∉∋∌⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋∩∪∅⌀⟨⟩⟪⟫⟬⟭⟮⟯⟦⟧⌈⌉⌊⌋│┃┆┇┊┋←↑→↓↔↕↖↗↘↙⇐⇑⇒⇓⇔⇕⇖⇗⇘⇙⟵⟶⟷⟸⟹⟺↦↤⊢⊣⊤⊥⫤⫣∀∃∄∴∵∎∷⁞⋮⋯⋰⋱▲△▷▽◁○◊□■●◆★✦✧✪✫✬✭✮✯✰❂❃❄❅❆';

const MATRIX_RAIN_CHARS = 'φπψη∞∆∇∂∫∑∏√±÷×∗∘⋅⊕⊗∧∨≡≈∼αβγδεζηθικλμνξπρστυφχψωℂℍℕℙℚℝℤ𝔾ℏ⁰¹²³⁴⁵⁶⁷⁸⁹∈∉⊂⊃⊆⊇∩∪∅⟨⟩←↑→↓↔⇐⇒⇔∀∃∴∵▲△▷▽◁○◊□●◆★✦';

const FlowerOfLifeSmall: React.FC<{ size?: number, color?: string, rotor?: boolean, pulse?: boolean }> = ({ 
  size = 24, color = "currentColor", rotor = false, pulse = false 
}) => (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`opacity-100 transition-all duration-700 ${rotor ? 'animate-[rotorse-alpha_10s_linear_infinite]' : ''} ${pulse ? 'animate-pulse scale-110' : ''}`}>
        <circle cx="50" cy="50" r="16" fill="none" stroke={color} strokeWidth="1" />
        {[0, 60, 120, 180, 240, 300].map(angle => (
            <circle 
                key={angle} 
                cx={50 + 16 * Math.cos(angle * Math.PI / 180)} 
                cy={50 + 16 * Math.sin(angle * Math.PI / 180)} 
                r="16" 
                fill="none" 
                stroke={color} 
                strokeWidth="1" 
            />
        ))}
    </svg>
);

const TypingIndicator: React.FC<{ users: TypingUser[] }> = ({ users }) => {
  if (users.length === 0) return null;
  
  const text = users.length === 1 
    ? `${users[0].displayName} is typing`
    : users.length === 2 
      ? `${users[0].displayName} and ${users[1].displayName} are typing`
      : `${users[0].displayName} and ${users.length - 1} others are typing`;
  
  return (
    <div className="flex items-center gap-3 text-[9px] md:text-[11px] text-[#4caf50]/60 italic font-bold animate-in fade-in duration-300">
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 bg-[#4caf50] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-[#4caf50] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-[#4caf50] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="tracking-wider uppercase">{text}</span>
    </div>
  );
};

const ReactionPicker: React.FC<{ 
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  return (
    <div className="absolute -top-12 left-0 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-black border-[0.5px] border-[#00f3ff]/30 p-2 flex gap-1 shadow-[0_0_20px_rgba(0,243,255,0.2)]">
        {AVAILABLE_REACTIONS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#00f3ff]/10 transition-all rounded active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

const ReactionsDisplay: React.FC<{
  reactions: MessageReaction[];
  onReact: (emoji: string) => void;
}> = ({ reactions, onReact }) => {
  if (!reactions || reactions.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {reactions.map(reaction => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onReact(reaction.emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] border-[0.5px] transition-all rounded-full ${
            reaction.includesMe 
              ? 'bg-[#00f3ff]/20 border-[#00f3ff]/40 text-[#00f3ff]' 
              : 'bg-black/50 border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/40'
          }`}
        >
          <span>{reaction.emoji}</span>
          <span className="font-bold">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
};

const MessageActions: React.FC<{
  message: Message;
  onReply: () => void;
  onReact: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy: () => void;
}> = ({ message, onReply, onReact, onEdit, onDelete, onCopy }) => {
  return (
    <div className="absolute -top-8 right-0 z-40 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 animate-in fade-in">
      <div className="flex bg-black border-[0.5px] border-[#00f3ff]/20 shadow-lg">
        <button
          type="button"
          onClick={onReply}
          className="p-2 text-[#00f3ff]/60 hover:text-[#00f3ff] hover:bg-[#00f3ff]/10 transition-all"
          title="Reply"
        >
          <Reply size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onReact}
          className="p-2 text-[#00f3ff]/60 hover:text-[#00f3ff] hover:bg-[#00f3ff]/10 transition-all"
          title="React"
        >
          <Smile size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="p-2 text-[#00f3ff]/60 hover:text-[#00f3ff] hover:bg-[#00f3ff]/10 transition-all"
          title="Copy"
        >
          <Copy size={12} strokeWidth={1.5} />
        </button>
        {message.isMe && onEdit && !message.deletedAt && (
          <button
            type="button"
            onClick={onEdit}
            className="p-2 text-[#00f3ff]/60 hover:text-[#00f3ff] hover:bg-[#00f3ff]/10 transition-all"
            title="Edit"
          >
            <Pencil size={12} strokeWidth={1.5} />
          </button>
        )}
        {message.isMe && onDelete && !message.deletedAt && (
          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
            title="Delete"
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
};

const ReplyPreview: React.FC<{
  replyMessage: Message | undefined;
  isMe: boolean;
}> = ({ replyMessage, isMe }) => {
  if (!replyMessage) return null;
  
  return (
    <div className={`flex items-start gap-2 mb-2 pb-2 border-b-[0.5px] ${isMe ? 'border-[#00f3ff]/20' : 'border-[#4caf50]/20'}`}>
      <CornerUpLeft size={12} className="opacity-40 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
      <div className="min-w-0">
        <div className={`text-[8px] font-bold uppercase tracking-wider opacity-50 ${isMe ? 'text-[#00f3ff]' : 'text-[#4caf50]'}`}>
          {replyMessage.sender}
        </div>
        <div className={`text-[10px] opacity-40 truncate max-w-[200px] ${isMe ? 'text-[#00f3ff]' : 'text-[#4caf50]'}`}>
          {replyMessage.deletedAt ? '[Message deleted]' : replyMessage.content.substring(0, 50)}
          {replyMessage.content.length > 50 ? '...' : ''}
        </div>
      </div>
    </div>
  );
};

const DiegeticTerminal: React.FC<DiegeticTerminalProps> = ({ 
  messages, onSend, onFileUpload, onOpenSettings, onVoiceMessage, fileProgress = 0, isVerifying, nodeId, onCall,
  typingUsers = [], onReact, onEdit, onDelete, onStartTyping, onStopTyping, getMessageById, onViewThread,
  highlightedMessageId, onViewTensorObject
}) => {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editInput, setEditInput] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVoiceSend = useCallback((audioBlob: Blob, duration: number, waveformData: number[]) => {
    if (onVoiceMessage) {
      onVoiceMessage(audioBlob, duration, waveformData);
      setShowVoiceRecorder(false);
      setFeedback('VOICE_MESSAGE_SENT');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [onVoiceMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isVerifying, typingUsers]);

  useEffect(() => {
    if (!highlightedMessageId || !scrollRef.current) return;
    
    const messageElement = document.getElementById(`msg-${highlightedMessageId}`);
    if (!messageElement) return;
    
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageElement.classList.add('ring-2', 'ring-[#00f3ff]', 'ring-offset-2', 'ring-offset-black');
    
    const timeoutId = setTimeout(() => {
      messageElement.classList.remove('ring-2', 'ring-[#00f3ff]', 'ring-offset-2', 'ring-offset-black');
    }, 3000);
    
    return () => {
      clearTimeout(timeoutId);
      messageElement.classList.remove('ring-2', 'ring-[#00f3ff]', 'ring-offset-2', 'ring-offset-black');
    };
  }, [highlightedMessageId]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
    
    if (onStartTyping && e.target.value.length > 0) {
      onStartTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onStopTyping?.();
      }, 3000);
    } else if (onStopTyping && e.target.value.length === 0) {
      onStopTyping();
    }
  }, [onStartTyping, onStopTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isVerifying) {
        onSend(input, replyingTo?.id);
        setInput('');
        setReplyingTo(null);
        setShowPalette(false);
        onStopTyping?.();
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      }
    }
  }, [input, isVerifying, onSend, replyingTo, onStopTyping]);

  useEffect(() => {
    if ('visualViewport' in window && window.visualViewport) {
      const handleViewportResize = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      };
      window.visualViewport.addEventListener('resize', handleViewportResize);
      return () => window.visualViewport?.removeEventListener('resize', handleViewportResize);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isVerifying) {
      onSend(input, replyingTo?.id);
      setInput('');
      setReplyingTo(null);
      setShowPalette(false);
      onStopTyping?.();
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleEditSubmit = (messageId: string) => {
    if (editInput.trim() && onEdit) {
      onEdit(messageId, editInput);
      setEditingMessage(null);
      setEditInput('');
      setFeedback('MESSAGE_UPDATED');
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleDelete = (messageId: string) => {
    if (onDelete) {
      onDelete(messageId);
      setDeleteConfirm(null);
      setFeedback('MESSAGE_DELETED');
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (onReact) {
      onReact(messageId, emoji);
    }
    setShowReactionPicker(null);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setFeedback('COPIED_TO_CLIPBOARD');
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback('COPY_FAILED');
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onFileUpload) {
      onFileUpload(files, false);
      setFeedback(`ISO_FILE_QUEUED: ${files.length} FILE${files.length > 1 ? 'S' : ''}`);
      setTimeout(() => setFeedback(null), 3000);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUploadFromDialog = useCallback((files: File[], convert3D: boolean) => {
    if (onFileUpload) {
      onFileUpload(files, convert3D);
      const count = files.length;
      setFeedback(convert3D 
        ? `3D_TENSOR_OBJECT_CREATED: ${count} FILE${count > 1 ? 'S' : ''} VIA FLOWER_OF_LIFE_PHI`
        : `ISO_FILE_TRANSMITTED: ${count} FILE${count > 1 ? 'S' : ''}`
      );
      setTimeout(() => setFeedback(null), 3000);
    }
  }, [onFileUpload]);

  const insertSymbol = (sym: string) => {
    setInput(prev => prev + sym);
  };

  const startReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const startEdit = (message: Message) => {
    setEditingMessage(message);
    setEditInput(message.content);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditInput('');
  };

  const isAiThinking = isVerifying || (messages.length > 0 && !messages[messages.length - 1].isMe && messages[messages.length - 1].content === '');

  return (
    <div className="flex flex-col h-full bg-[#010401] font-mono text-[#00f3ff] relative overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,.md,.js,.ts,.jsx,.tsx,.cpp,.c,.h,.circom,.json,.html,.css,.yaml,.yml,.txt,.py,.rs,.go" multiple />
      
      <FileUploadDialog
        isOpen={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUpload={handleFileUploadFromDialog}
      />
      
      <div className="px-4 md:px-12 py-4 md:py-6 border-b-[0.5px] border-[#4caf50]/30 bg-black/90 flex justify-between items-center text-[7px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.4em] relative z-20 font-black shadow-lg">
        <div className="flex gap-4 md:gap-10 items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <FlowerOfLifeSmall color="#00f3ff" size={18} rotor />
            <span className="text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff66] truncate max-w-[90px] sm:max-w-none opacity-80">CHANNEL_ISO_CORE_0x9</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 opacity-30">
            <Binary size={14} strokeWidth={1} />
            <span className="hidden md:block">TUNNEL: {nodeId}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-10 text-[#00f3ff]">
          <div className="flex gap-4">
            <button 
              onClick={() => {
                setFeedback("INITIATING_SECURE_VOICE...");
                setTimeout(() => { setFeedback(null); onCall?.('voice'); }, 1000);
              }}
              className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity active:scale-90 p-1"
            >
              <Phone size={18} strokeWidth={1} />
            </button>
            <button 
              onClick={() => {
                setFeedback("INITIATING_SECURE_VIDEO...");
                setTimeout(() => { setFeedback(null); onCall?.('video'); }, 1000);
              }}
              className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity active:scale-90 p-1"
            >
              <Video size={18} strokeWidth={1} />
            </button>
          </div>
          <div className="w-[0.5px] h-4 bg-[#4caf50]/30"></div>
          <div className="flex items-center gap-1.5 text-[#4caf50]">
            <div className="w-1.5 h-1.5 bg-[#4caf50] rounded-full animate-pulse opacity-60"></div>
            <span className="tracking-widest uppercase italic font-black text-[7px] hidden xs:block opacity-60">SYNC</span>
          </div>
          <button onClick={() => onOpenSettings?.()} className="p-1 hover:bg-[#4caf50]/10 rounded transition-all">
            <MoreVertical size={18} className="cursor-pointer opacity-40 hover:opacity-100" strokeWidth={1} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-12 lg:p-16 space-y-10 md:space-y-14 scrollbar-hide scroll-smooth relative z-10 pb-24 md:pb-16 bg-[#010401]">
        <div className="text-[7px] md:text-[9px] text-[#4caf50]/30 uppercase mb-8 md:mb-12 pb-6 md:pb-10 border-b-[0.5px] border-[#4caf50]/20 font-black tracking-[0.2em] md:tracking-[0.4em] leading-loose italic">
          <p className="flex items-center gap-3 md:gap-4 mb-2"><Activity size={10} strokeWidth={1} /> ISO_ESTABLISHED: {new Date().toLocaleTimeString()}</p>
          <p className="flex items-center gap-3 md:gap-4 mb-2"><Shield size={10} strokeWidth={1} /> ENCRYPTION: G3T_DOUBLE_RATCHET</p>
          <p className="flex items-center gap-3 md:gap-4 text-[#00f3ff]/40 animate-pulse"><Sparkles size={10} strokeWidth={1} /> GEODESIC_SYNC: 0.9999812_STABLE</p>
        </div>

        {messages.map((msg) => {
          const replyMessage = msg.replyTo && getMessageById ? getMessageById(msg.replyTo) : undefined;
          const isDeleted = !!msg.deletedAt;
          const isEditing = editingMessage?.id === msg.id;
          
          return (
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-500 relative group transition-all`}>
              <div className={`flex items-center gap-3 md:gap-4 mb-2 md:mb-3 text-[7px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black ${msg.isMe ? 'text-[#00f3ff]/50' : 'text-[#4caf50]/50'}`}>
                {!msg.isMe && <Lock size={10} className="text-[#00f3ff] opacity-60" strokeWidth={1} />}
                {msg.isZkpVerified && <ShieldCheck size={12} className="opacity-60" strokeWidth={1} />}
                <span className="opacity-60">{msg.sender}</span>
                <span className="opacity-30 font-black font-mono">[{new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                {msg.editedAt && !isDeleted && (
                  <span className="text-[6px] opacity-30 italic">(edited)</span>
                )}
              </div>
              
              <div className={`relative max-w-[95%] md:max-w-[85%] p-4 md:p-8 text-[11px] md:text-[15px] border-l-[0.5px] transition-all duration-500 shadow-lg ${
                isDeleted
                  ? 'bg-white/[0.02] border-white/10 text-white/30 italic'
                  : msg.isMe 
                    ? 'bg-[#00f3ff]/[0.03] border-[#00f3ff]/30 text-[#00f3ff] hover:bg-[#00f3ff]/[0.05]' 
                    : 'bg-[#4caf50]/[0.03] border-[#4caf50]/30 text-[#4caf50] hover:bg-[#4caf50]/[0.05]'
              }`}>
                {replyMessage && (
                  <ReplyPreview replyMessage={replyMessage} isMe={msg.isMe} />
                )}
                
                {isDeleted ? (
                  <p className="leading-relaxed font-bold tracking-tight opacity-50 flex items-center gap-2">
                    <Trash2 size={14} strokeWidth={1} />
                    This message was deleted
                  </p>
                ) : isEditing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSubmit(msg.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="w-full bg-black/50 border-[0.5px] border-[#00f3ff]/30 px-3 py-2 text-[11px] md:text-[13px] outline-none text-[#00f3ff] font-bold"
                      autoFocus
                    />
                    <div className="flex gap-2 text-[8px]">
                      <button
                        type="button"
                        onClick={() => handleEditSubmit(msg.id)}
                        className="px-3 py-1 bg-[#00f3ff]/20 text-[#00f3ff] font-bold uppercase tracking-wider hover:bg-[#00f3ff]/30"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-1 bg-white/10 text-white/60 font-bold uppercase tracking-wider hover:bg-white/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.content && msg.type === 'text' && (
                      <p className="leading-relaxed whitespace-pre-wrap font-bold tracking-tight opacity-90 group-hover:opacity-100 transition-opacity">
                        {msg.content}
                      </p>
                    )}
                    {!msg.content && msg.type === 'text' && (
                      <span className="flex items-center gap-6 italic opacity-30">
                        <Loader2 size={16} className="animate-spin" strokeWidth={1} />
                        Calculating...
                      </span>
                    )}
                    <MediaContent message={msg} isMe={msg.isMe} onViewTensor={onViewTensorObject} />
                  </>
                )}

                {!isDeleted && msg.reactions && msg.reactions.length > 0 && (
                  <ReactionsDisplay 
                    reactions={msg.reactions} 
                    onReact={(emoji) => handleReaction(msg.id, emoji)} 
                  />
                )}

                {msg.threadCount && msg.threadCount > 0 && onViewThread && (
                  <button
                    type="button"
                    onClick={() => onViewThread(msg.id)}
                    className="flex items-center gap-2 mt-3 pt-2 border-t-[0.5px] border-current/10 text-[9px] font-bold uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <MessageSquare size={12} strokeWidth={1.5} />
                    {msg.threadCount} {msg.threadCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}
                
                {!isDeleted && !isEditing && (
                  <>
                    <MessageActions
                      message={msg}
                      onReply={() => startReply(msg)}
                      onReact={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                      onEdit={msg.isMe && onEdit ? () => startEdit(msg) : undefined}
                      onDelete={msg.isMe && onDelete ? () => setDeleteConfirm(msg.id) : undefined}
                      onCopy={() => handleCopy(msg.content)}
                    />
                    
                    {showReactionPicker === msg.id && (
                      <ReactionPicker
                        onSelect={(emoji) => handleReaction(msg.id, emoji)}
                        onClose={() => setShowReactionPicker(null)}
                      />
                    )}
                  </>
                )}

                {deleteConfirm === msg.id && (
                  <div className="absolute inset-0 bg-black/90 flex items-center justify-center gap-3 z-50 animate-in fade-in duration-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Delete?</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="px-3 py-1.5 bg-red-500/30 text-red-400 text-[9px] font-bold uppercase tracking-wider hover:bg-red-500/50"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 bg-white/10 text-white/60 text-[9px] font-bold uppercase tracking-wider hover:bg-white/20"
                    >
                      No
                    </button>
                  </div>
                )}

                {!isDeleted && (
                  <div className="absolute -top-3 right-4 md:right-8 flex items-center gap-2 px-3 py-0.5 bg-black border-[0.5px] border-[#00f3ff]/20 text-[6px] md:text-[8px] font-black tracking-[0.2em] md:tracking-[0.3em] text-[#00f3ff] uppercase group-hover:opacity-100 opacity-30 transition-opacity cursor-default z-20 shadow-xl">
                     <CheckCircle size={8} className="animate-pulse" strokeWidth={1} />
                     <span>SOUND_VERIFIED</span>
                  </div>
                )}

                {msg.isMe && !isDeleted && (
                  <div className="absolute -bottom-4 md:-bottom-5 right-0 flex items-center gap-2 md:gap-3 text-[6px] md:text-[9px] font-black italic tracking-widest opacity-20 group-hover:opacity-60 transition-opacity">
                    <span className="uppercase font-mono">PKT_{msg.id.substr(0, 4).toUpperCase()}</span>
                    <div className="flex items-center gap-1.5">
                       {msg.isZkpVerified && <Shield size={8} className="text-[#00f3ff] opacity-40" strokeWidth={1.5} />}
                       <div className="flex gap-0.5">
                          <CheckCircle size={8} className={msg.status === 'read' ? 'text-[#00f3ff]' : 'text-white/10'} strokeWidth={1} />
                          <CheckCircle size={8} className={msg.status === 'delivered' || msg.status === 'read' ? 'text-[#00f3ff]' : 'text-white/10'} strokeWidth={1} />
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="py-4">
            <TypingIndicator users={typingUsers} />
          </div>
        )}

        {isAiThinking && (
          <div className="flex flex-col items-start animate-in fade-in duration-700">
            <div className="p-4 md:p-10 border-l-[0.5px] border-[#4caf50]/20 bg-[#4caf50]/[0.02] text-[10px] md:text-[14px] italic opacity-30 flex items-center gap-6 md:gap-12">
               <FlowerOfLifeSmall size={28} color="#00f3ff" pulse rotor />
               <span className="font-black tracking-[0.1em] md:tracking-[0.2em] opacity-80 animate-pulse">Synchronizing_Geodesic...</span>
            </div>
          </div>
        )}
      </div>

      {showPalette && (
        <div className="absolute bottom-24 md:bottom-28 left-4 md:left-12 right-4 md:right-12 z-[150] animate-in slide-in-from-bottom-6 duration-300">
          <div className="bg-black border-[0.5px] border-[#4caf50]/30 p-4 md:p-6 shadow-[0_-15px_60px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <div className="flex justify-between items-center mb-4 border-b-[0.5px] border-[#4caf50]/10 pb-3">
               <span className="text-[7px] md:text-[9px] font-black tracking-[0.3em] uppercase text-[#4caf50]/60 flex items-center gap-2">
                 <Binary size={10} /> MULTIVECTOR_ONTOLOGY_OPCODES
               </span>
               <button onClick={() => setShowPalette(false)} className="text-[#4caf50] opacity-40 hover:opacity-100 p-1"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-16 lg:grid-cols-20 gap-1.5 h-36 md:h-48 overflow-y-auto scrollbar-hide">
               {MULTIVECTOR_OPCODES.split('').map((sym, idx) => (
                 <button 
                  key={idx} 
                  type="button"
                  onClick={() => insertSymbol(sym)}
                  className="w-full aspect-square border-[0.5px] border-[#4caf50]/10 flex items-center justify-center text-[12px] md:text-[15px] text-[#00f3ff]/40 hover:text-[#00f3ff] hover:bg-[#00f3ff]/10 hover:border-[#00f3ff]/30 transition-all active:scale-90 font-bold"
                 >
                   {sym}
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="px-4 md:px-12 py-3 border-t-[0.5px] border-[#00f3ff]/20 bg-[#00f3ff]/[0.02] flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200 z-20">
          <Reply size={14} className="text-[#00f3ff]/60" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[8px] font-bold uppercase tracking-wider text-[#00f3ff]/60">
              Replying to {replyingTo.sender}
            </div>
            <div className="text-[10px] text-[#00f3ff]/40 truncate">
              {replyingTo.content.substring(0, 60)}{replyingTo.content.length > 60 ? '...' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={cancelReply}
            className="text-[#00f3ff]/40 hover:text-[#00f3ff] p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <VoiceMessageRecorder
        isOpen={showVoiceRecorder}
        onSend={handleVoiceSend}
        onCancel={() => setShowVoiceRecorder(false)}
      />

      <form onSubmit={handleSubmit} className="relative z-20 px-4 md:px-12 py-4 md:py-6 border-t-[0.5px] border-[#4caf50]/30 bg-black/90 backdrop-blur-md" role="form" aria-label="Message input">
        {feedback && (
          <div className="absolute bottom-full left-4 md:left-12 mb-2 text-[7px] md:text-[8px] text-[#4caf50] italic opacity-70 font-bold" role="status" aria-live="polite">
            {feedback}
          </div>
        )}
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
            rows={1}
            className="flex-1 bg-black/40 border-[0.5px] border-[#4caf50]/40 px-4 py-3 text-[11px] md:text-[13px] outline-none focus:border-[#00f3ff]/50 text-[#00f3ff] font-semibold tracking-wide transition-all placeholder-[#4caf50]/30 resize-none overflow-hidden min-h-[44px] max-h-[120px]"
            aria-label="Message input field"
            style={{ height: 'auto' }}
          />
          <button 
            type="button"
            onClick={() => setShowUploadDialog(true)}
            className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2.5"
            title="Upload Media / 3D Object"
            aria-label="Upload media or 3D object"
          >
            <Paperclip size={14} strokeWidth={1} aria-hidden="true" />
          </button>
          {onVoiceMessage && (
            <button 
              type="button"
              onClick={() => setShowVoiceRecorder(true)}
              className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2.5"
              title="Record Voice Message"
              aria-label="Record voice message"
            >
              <Mic size={14} strokeWidth={1} aria-hidden="true" />
            </button>
          )}
          <button 
            type="button"
            onClick={() => setShowPalette(!showPalette)}
            className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2.5"
            aria-label="Open symbol palette"
          >
            <Grid size={14} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            type="submit"
            disabled={isVerifying || !input.trim()}
            className="px-6 py-3 bg-[#4caf50]/20 border-[0.5px] border-[#4caf50]/40 text-[#4caf50] font-black uppercase text-[9px] tracking-widest hover:bg-[#4caf50]/30 hover:border-[#4caf50]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            aria-label={replyingTo ? 'Send reply' : 'Send message'}
          >
            <Send size={12} strokeWidth={1.5} aria-hidden="true" />
            {replyingTo ? 'REPLY' : 'SEND'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DiegeticTerminal;
