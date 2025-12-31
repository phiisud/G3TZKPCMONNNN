import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Filter, MessageSquare, Users, Folder, FileText, Calendar, CheckCircle, ChevronDown, Loader2 } from 'lucide-react';
import { SearchCategory, SearchFilters, SearchResult, Message, MeshGroup, MeshGroupMember } from '../types';

interface SearchPanelProps {
  messages: Message[];
  groups: MeshGroup[];
  members: MeshGroupMember[];
  onResultClick: (result: SearchResult) => void;
  onClose: () => void;
}

const DEFAULT_FILTERS: SearchFilters = {
  category: SearchCategory.ALL,
  dateFrom: undefined,
  dateTo: undefined,
  groupId: undefined,
  senderId: undefined,
  hasFiles: undefined,
  isVerified: undefined
};

const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() 
      ? <span key={i} className="bg-[#00f3ff]/30 text-[#00f3ff] font-bold">{part}</span>
      : part
  );
};

const SearchPanel: React.FC<SearchPanelProps> = ({
  messages,
  groups,
  members,
  onResultClick,
  onClose
}) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  const performSearch = useCallback((searchQuery: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim() && searchFilters.category === SearchCategory.ALL) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    const queryLower = searchQuery.toLowerCase().trim();
    const searchResults: SearchResult[] = [];

    if (searchFilters.category === SearchCategory.ALL || searchFilters.category === SearchCategory.MESSAGES) {
      messages
        .filter(msg => {
          if (msg.deletedAt) return false;
          if (!queryLower) return false;
          const matchesContent = msg.content.toLowerCase().includes(queryLower);
          const matchesSender = msg.sender.toLowerCase().includes(queryLower);
          if (!matchesContent && !matchesSender) return false;
          if (searchFilters.dateFrom && msg.timestamp < searchFilters.dateFrom) return false;
          if (searchFilters.dateTo && msg.timestamp > searchFilters.dateTo) return false;
          if (searchFilters.hasFiles !== undefined) {
            const hasFile = msg.type === 'file' || msg.type === 'image' || msg.type === 'voice';
            if (searchFilters.hasFiles !== hasFile) return false;
          }
          if (searchFilters.isVerified !== undefined && (msg.isZkpVerified ?? false) !== searchFilters.isVerified) return false;
          return true;
        })
        .forEach(msg => {
          const matchedTerms: string[] = [];
          if (msg.content.toLowerCase().includes(queryLower)) matchedTerms.push('content');
          if (msg.sender.toLowerCase().includes(queryLower)) matchedTerms.push('sender');
          
          searchResults.push({
            id: `msg_${msg.id}`,
            type: 'message',
            title: msg.sender,
            snippet: msg.content.length > 120 ? msg.content.substring(0, 120) + '...' : msg.content,
            timestamp: msg.timestamp,
            senderId: msg.sender,
            senderName: msg.sender,
            messageId: msg.id,
            matchedTerms,
            relevanceScore: matchedTerms.length * 10 + ((msg.isZkpVerified ?? false) ? 5 : 0)
          });
        });
    }

    if (searchFilters.category === SearchCategory.ALL || searchFilters.category === SearchCategory.GROUPS) {
      groups
        .filter(group => {
          if (!queryLower) return false;
          return group.name.toLowerCase().includes(queryLower) || 
                 (group.description?.toLowerCase().includes(queryLower));
        })
        .forEach(group => {
          const matchedTerms: string[] = [];
          if (group.name.toLowerCase().includes(queryLower)) matchedTerms.push('name');
          if (group.description?.toLowerCase().includes(queryLower)) matchedTerms.push('description');
          
          searchResults.push({
            id: `group_${group.id}`,
            type: 'group',
            title: group.name,
            snippet: group.description || `${group.memberCount} members`,
            timestamp: group.createdAt,
            groupId: group.id,
            groupName: group.name,
            matchedTerms,
            relevanceScore: matchedTerms.length * 15 + group.memberCount
          });
        });
    }

    if (searchFilters.category === SearchCategory.ALL || searchFilters.category === SearchCategory.USERS) {
      members
        .filter(member => {
          if (!queryLower) return false;
          return member.displayName.toLowerCase().includes(queryLower) ||
                 member.peerId.toLowerCase().includes(queryLower);
        })
        .forEach(member => {
          const matchedTerms: string[] = [];
          if (member.displayName.toLowerCase().includes(queryLower)) matchedTerms.push('name');
          if (member.peerId.toLowerCase().includes(queryLower)) matchedTerms.push('peerId');
          
          searchResults.push({
            id: `operator_${member.peerId}`,
            type: 'operator',
            title: member.displayName,
            snippet: `Peer: ${member.peerId.substring(0, 16)}...`,
            timestamp: member.joinedAt,
            senderId: member.peerId,
            senderName: member.displayName,
            matchedTerms,
            relevanceScore: matchedTerms.length * 10 + (member.isOnline ? 10 : 0)
          });
        });
    }

    if (searchFilters.category === SearchCategory.ALL || searchFilters.category === SearchCategory.FILES) {
      messages
        .filter(msg => {
          if (msg.deletedAt) return false;
          if (msg.type !== 'file' && msg.type !== 'image') return false;
          if (!queryLower) return true;
          const matchesName = msg.fileName?.toLowerCase().includes(queryLower);
          const matchesContent = msg.content.toLowerCase().includes(queryLower);
          return matchesName || matchesContent;
        })
        .forEach(msg => {
          const matchedTerms: string[] = [];
          if (msg.fileName?.toLowerCase().includes(queryLower)) matchedTerms.push('filename');
          if (msg.content.toLowerCase().includes(queryLower)) matchedTerms.push('content');
          
          searchResults.push({
            id: `file_${msg.id}`,
            type: 'file',
            title: msg.fileName || 'Unnamed File',
            snippet: `From ${msg.sender} - ${msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}`,
            timestamp: msg.timestamp,
            senderId: msg.sender,
            senderName: msg.sender,
            messageId: msg.id,
            matchedTerms,
            relevanceScore: matchedTerms.length * 10
          });
        });
    }

    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }
    resultTimeoutRef.current = setTimeout(() => {
      setResults(searchResults);
      setIsSearching(false);
    }, 150);
  }, [messages, groups, members]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(newQuery, filters);
    }, 200);
  }, [filters, performSearch]);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: unknown) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    performSearch(query, newFilters);
  }, [filters, query, performSearch]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  const getCategoryIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'message': return <MessageSquare size={14} strokeWidth={1} />;
      case 'group': return <Users size={14} strokeWidth={1} />;
      case 'operator': return <Users size={14} strokeWidth={1} />;
      case 'file': return <FileText size={14} strokeWidth={1} />;
      default: return <Search size={14} strokeWidth={1} />;
    }
  };

  const getCategoryLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'message': return 'MESSAGE';
      case 'group': return 'GROUP';
      case 'operator': return 'OPERATOR';
      case 'file': return 'FILE';
      default: return 'RESULT';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-300">
      <div className="border-b border-[#00f3ff]/20 bg-black/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} strokeWidth={1} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00f3ff]/50" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="SEARCH_MESH_NETWORK..."
                className="w-full bg-white/[0.02] border border-[#00f3ff]/20 rounded-none px-12 py-4 text-[#00f3ff] placeholder:text-[#00f3ff]/30 focus:outline-none focus:border-[#00f3ff]/50 font-mono text-sm tracking-wide"
              />
              {query && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00f3ff]/50 hover:text-[#00f3ff] transition-colors"
                >
                  <X size={18} strokeWidth={1} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-4 border transition-all ${showFilters ? 'bg-[#00f3ff]/10 border-[#00f3ff]/50 text-[#00f3ff]' : 'border-[#00f3ff]/20 text-[#00f3ff]/50 hover:text-[#00f3ff]'}`}
            >
              <Filter size={18} strokeWidth={1} />
            </button>
            <button
              onClick={onClose}
              className="p-4 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all"
            >
              <X size={18} strokeWidth={1} />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[#00f3ff]/10 animate-in slide-in-from-top-2 duration-200">
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black tracking-[0.3em] text-[#00f3ff]/50 uppercase">Category:</span>
                  <div className="flex gap-1">
                    {Object.values(SearchCategory).map(cat => (
                      <button
                        key={cat}
                        onClick={() => handleFilterChange('category', cat)}
                        className={`px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all border ${
                          filters.category === cat 
                            ? 'bg-[#00f3ff]/20 border-[#00f3ff] text-[#00f3ff]' 
                            : 'border-[#00f3ff]/20 text-[#00f3ff]/50 hover:text-[#00f3ff] hover:border-[#00f3ff]/50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black tracking-[0.3em] text-[#00f3ff]/50 uppercase">Verified:</span>
                  <button
                    onClick={() => handleFilterChange('isVerified', filters.isVerified === true ? undefined : true)}
                    className={`px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all border flex items-center gap-1 ${
                      filters.isVerified === true 
                        ? 'bg-[#4caf50]/20 border-[#4caf50] text-[#4caf50]' 
                        : 'border-[#4caf50]/20 text-[#4caf50]/50 hover:text-[#4caf50]'
                    }`}
                  >
                    <CheckCircle size={10} strokeWidth={1} />
                    ZKP_ONLY
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black tracking-[0.3em] text-[#00f3ff]/50 uppercase">Files:</span>
                  <button
                    onClick={() => handleFilterChange('hasFiles', filters.hasFiles === true ? undefined : true)}
                    className={`px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all border flex items-center gap-1 ${
                      filters.hasFiles === true 
                        ? 'bg-[#00f3ff]/20 border-[#00f3ff] text-[#00f3ff]' 
                        : 'border-[#00f3ff]/20 text-[#00f3ff]/50 hover:text-[#00f3ff]'
                    }`}
                  >
                    <Folder size={10} strokeWidth={1} />
                    WITH_FILES
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4">
          {isSearching && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-[#00f3ff]/50">
                <Loader2 size={20} strokeWidth={1} className="animate-spin" />
                <span className="text-[10px] font-black tracking-[0.3em] uppercase animate-pulse">SCANNING_MESH...</span>
              </div>
            </div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search size={40} strokeWidth={0.5} className="text-[#00f3ff]/20 mb-4" />
              <p className="text-[#00f3ff]/40 text-[10px] font-black tracking-[0.3em] uppercase mb-2">NO_RESULTS_FOUND</p>
              <p className="text-white/30 text-xs">Try adjusting your search terms or filters</p>
            </div>
          )}

          {!isSearching && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search size={40} strokeWidth={0.5} className="text-[#00f3ff]/20 mb-4" />
              <p className="text-[#00f3ff]/40 text-[10px] font-black tracking-[0.3em] uppercase mb-2">MESH_SEARCH_READY</p>
              <p className="text-white/30 text-xs">Search messages, groups, peers, and files</p>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[8px] font-black tracking-[0.3em] text-[#00f3ff]/50 uppercase">
                  {results.length} RESULT{results.length !== 1 ? 'S' : ''} FOUND
                </span>
                <span className="text-[8px] font-black tracking-[0.3em] text-[#4caf50]/50 uppercase flex items-center gap-1">
                  <CheckCircle size={10} strokeWidth={1} />
                  SORTED_BY_RELEVANCE
                </span>
              </div>

              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => onResultClick(result)}
                  className="w-full text-left p-4 bg-white/[0.02] border border-[#00f3ff]/10 hover:border-[#00f3ff]/30 hover:bg-[#00f3ff]/[0.03] transition-all group animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 border ${
                      result.type === 'message' ? 'border-[#00f3ff]/30 text-[#00f3ff]' :
                      result.type === 'group' ? 'border-[#4caf50]/30 text-[#4caf50]' :
                      result.type === 'operator' ? 'border-purple-500/30 text-purple-400' :
                      'border-yellow-500/30 text-yellow-400'
                    }`}>
                      {getCategoryIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[7px] font-black tracking-[0.3em] uppercase px-2 py-0.5 ${
                          result.type === 'message' ? 'bg-[#00f3ff]/10 text-[#00f3ff]' :
                          result.type === 'group' ? 'bg-[#4caf50]/10 text-[#4caf50]' :
                          result.type === 'operator' ? 'bg-purple-500/10 text-purple-400' :
                          'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {getCategoryLabel(result.type)}
                        </span>
                        <span className="text-[10px] font-bold text-white/80 truncate">
                          {highlightMatch(result.title, query)}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 truncate group-hover:text-white/60 transition-colors">
                        {highlightMatch(result.snippet, query)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[8px] text-white/30">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} strokeWidth={1} />
                          {new Date(result.timestamp).toLocaleDateString()}
                        </span>
                        {result.groupName && (
                          <span className="flex items-center gap-1">
                            <Users size={10} strokeWidth={1} />
                            {result.groupName}
                          </span>
                        )}
                        {result.matchedTerms.length > 0 && (
                          <span className="text-[#00f3ff]/50">
                            Matched: {result.matchedTerms.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[#00f3ff]/30 group-hover:text-[#00f3ff] transition-colors">
                      <ChevronDown size={16} strokeWidth={1} className="-rotate-90" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[#00f3ff]/10 bg-black/80 backdrop-blur-xl p-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-[8px] text-white/30 font-mono tracking-wider">
          <span>ESC to close</span>
          <span className="flex items-center gap-2">
            <span className="text-[#4caf50]">ZKP</span>
            <span>ENCRYPTED_SEARCH_INDEX</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;
