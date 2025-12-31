import React, { useState } from 'react';
import { X, Users, Lock, Shield, Send, Loader2, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { MeshGroup } from '../types';

interface JoinGroupModalProps {
  groups: MeshGroup[];
  onJoinRequest: (groupId: string, message?: string) => Promise<void>;
  onClose: () => void;
}

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ groups, onJoinRequest, onClose }) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedGroup) return;
    
    setIsSubmitting(true);
    try {
      await onJoinRequest(selectedGroup, requestMessage || undefined);
      setSubmitStatus('success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedGroupData = groups.find(g => g.id === selectedGroup);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 md:p-6 backdrop-blur-xl bg-black/85 animate-in fade-in duration-300">
      <div className="w-full max-w-lg border-[0.5px] border-[#4caf50]/20 bg-[#0a1a0a]/95 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.95)] max-h-[90vh]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent"></div>
        
        <div className="flex items-center justify-between p-6 border-b-[0.5px] border-[#4caf50]/20 shrink-0">
          <div>
            <h2 className="orbitron text-sm font-black text-[#00f3ff] tracking-widest uppercase">Join Mesh Group</h2>
            <p className="text-[7px] font-mono text-[#4caf50]/60 mt-1 uppercase tracking-wider">Request access to a community</p>
          </div>
          <button onClick={onClose} className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2 border-[0.5px] border-[#4caf50]/20 hover:border-[#00f3ff]/40">
            <X size={18} />
          </button>
        </div>

        {submitStatus === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
            <div className="w-20 h-20 border-[0.5px] border-[#4caf50] rounded-full flex items-center justify-center bg-[#4caf50]/10 animate-in zoom-in duration-500">
              <CheckCircle size={40} className="text-[#4caf50]" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">Request Sent</p>
              <p className="text-[9px] font-mono text-[#4caf50]/60">Awaiting approval from group admins</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 border-b-[0.5px] border-[#4caf50]/20 shrink-0">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4caf50]/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search groups..."
                  className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 pl-10 pr-4 py-3 text-[10px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-mono uppercase"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={32} className="text-[#4caf50]/20 mx-auto mb-4" />
                  <p className="text-[10px] font-mono text-[#4caf50]/40 uppercase tracking-widest">No groups found</p>
                </div>
              ) : (
                filteredGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                    className={`w-full p-4 border-[0.5px] text-left transition-all ${
                      selectedGroup === group.id
                        ? 'border-[#00f3ff]/60 bg-[#00f3ff]/10'
                        : 'border-[#4caf50]/20 bg-black/20 hover:border-[#4caf50]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border-[0.5px] border-[#4caf50]/40 flex items-center justify-center bg-black/40 text-[#00f3ff] font-black text-[10px]">
                          {group.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black text-[#00f3ff] uppercase tracking-wider">{group.name}</p>
                            {group.isPrivate && <Lock size={10} className="text-[#4caf50]/60" />}
                            {group.zkpVerified && <Shield size={10} className="text-[#00f3ff]/60" />}
                          </div>
                          <p className="text-[7px] font-mono text-[#4caf50]/40 mt-1">{group.memberCount} members</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 border-[0.5px] flex items-center justify-center ${
                        selectedGroup === group.id
                          ? 'border-[#00f3ff] bg-[#00f3ff]'
                          : 'border-[#4caf50]/40'
                      }`}>
                        {selectedGroup === group.id && <CheckCircle size={10} className="text-black" />}
                      </div>
                    </div>
                    {group.description && (
                      <p className="text-[8px] font-mono text-[#4caf50]/60 mt-3 line-clamp-2">{group.description}</p>
                    )}
                    {group.requiresApproval && (
                      <div className="flex items-center gap-2 mt-3">
                        <AlertCircle size={10} className="text-orange-400/60" />
                        <span className="text-[7px] font-mono text-orange-400/60 uppercase">Requires approval</span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            {selectedGroup && selectedGroupData?.requiresApproval && (
              <div className="p-6 border-t-[0.5px] border-[#4caf50]/20 shrink-0">
                <label className="text-[8px] font-black text-[#4caf50] uppercase tracking-widest block mb-2">
                  Request Message (optional)
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Introduce yourself to the admins..."
                  rows={3}
                  className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 p-4 text-[10px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-mono resize-none"
                />
              </div>
            )}

            <div className="p-6 border-t-[0.5px] border-[#4caf50]/20 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={!selectedGroup || isSubmitting}
                className="w-full py-4 border-[0.5px] border-[#00f3ff]/50 text-[#00f3ff] font-black text-[10px] tracking-[0.5em] uppercase hover:bg-[#00f3ff]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    SENDING REQUEST...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    SEND JOIN REQUEST
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinGroupModal;
