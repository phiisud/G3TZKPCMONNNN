import React, { useState, useCallback, useMemo } from 'react';
import { 
  X, Users, Shield, Settings, Link2, UserPlus, UserMinus, 
  Crown, Clock, Copy, Check, ChevronDown, ChevronRight,
  Lock, Globe, Image, Mic, AlertTriangle
} from 'lucide-react';
import { MeshGroup, MeshGroupMember, MeshGroupRole, MeshGroupSettings } from '../../types';
import groupManagementService from '../../services/GroupManagementService';

interface GroupAdminPanelProps {
  group: MeshGroup;
  currentUserId: string;
  onClose: () => void;
  onUpdateGroup: (group: MeshGroup) => void;
  onKickMember: (memberId: string, reason: string) => void;
  onChangeMemberRole: (memberId: string, newRole: MeshGroupRole) => void;
  onUpdateSettings: (settings: Partial<MeshGroupSettings>) => void;
  onHandleJoinRequest: (requestId: string, approved: boolean) => void;
}

type TabType = 'members' | 'requests' | 'settings' | 'invites';

const roleIcons: Record<MeshGroupRole, React.ReactNode> = {
  [MeshGroupRole.OWNER]: <Crown className="w-4 h-4 text-yellow-500" />,
  [MeshGroupRole.ADMIN]: <Shield className="w-4 h-4 text-[#00f3ff]" />,
  [MeshGroupRole.MODERATOR]: <Shield className="w-4 h-4 text-[#4caf50]" />,
  [MeshGroupRole.MEMBER]: <Users className="w-4 h-4 text-gray-500" />,
  [MeshGroupRole.PENDING]: <Clock className="w-4 h-4 text-yellow-400" />,
  [MeshGroupRole.BANNED]: <X className="w-4 h-4 text-red-500" />
};

const roleLabels: Record<MeshGroupRole, string> = {
  [MeshGroupRole.OWNER]: 'Owner',
  [MeshGroupRole.ADMIN]: 'Admin',
  [MeshGroupRole.MODERATOR]: 'Mod',
  [MeshGroupRole.MEMBER]: 'Member',
  [MeshGroupRole.PENDING]: 'Pending',
  [MeshGroupRole.BANNED]: 'Banned'
};

export default function GroupAdminPanel({
  group,
  currentUserId,
  onClose,
  onUpdateGroup,
  onKickMember,
  onChangeMemberRole,
  onUpdateSettings,
  onHandleJoinRequest
}: GroupAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [kickReason, setKickReason] = useState('');
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [inviteOptions, setInviteOptions] = useState({ expiresInHours: 24, maxUses: 0 });
  const [inviteLinks, setInviteLinks] = useState(groupManagementService.getGroupInviteLinks(group.id));
  const [expandedSettings, setExpandedSettings] = useState<string[]>(['general']);

  const currentUserRole = useMemo(() => {
    const member = group.members.find(m => m.peerId === currentUserId);
    return member?.role || MeshGroupRole.MEMBER;
  }, [group.members, currentUserId]);

  const isAdmin = currentUserRole === MeshGroupRole.OWNER || currentUserRole === MeshGroupRole.ADMIN;
  const isOwner = currentUserRole === MeshGroupRole.OWNER;

  const pendingRequests = group.pendingRequests?.filter(r => r.status === 'pending') || [];

  const handleCreateInviteLink = useCallback(() => {
    const link = groupManagementService.createInviteLink(group.id, {
      expiresInHours: inviteOptions.expiresInHours > 0 ? inviteOptions.expiresInHours : undefined,
      maxUses: inviteOptions.maxUses > 0 ? inviteOptions.maxUses : undefined
    });
    setInviteLinks(prev => [...prev, link]);
  }, [group.id, inviteOptions]);

  const handleCopyLink = useCallback((code: string) => {
    const url = groupManagementService.formatInviteUrl(code);
    navigator.clipboard.writeText(url);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2000);
  }, []);

  const handleRevokeLink = useCallback((code: string) => {
    groupManagementService.revokeInviteLink(code);
    setInviteLinks(prev => prev.filter(l => l.code !== code));
  }, []);

  const handleKickMember = useCallback(() => {
    if (selectedMember) {
      onKickMember(selectedMember, kickReason || 'Removed by admin');
      setShowKickConfirm(false);
      setSelectedMember(null);
      setKickReason('');
    }
  }, [selectedMember, kickReason, onKickMember]);

  const toggleSettingsSection = useCallback((section: string) => {
    setExpandedSettings(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  }, []);

  const canManageMember = useCallback((memberRole: MeshGroupRole) => {
    if (currentUserRole === MeshGroupRole.OWNER) return memberRole !== MeshGroupRole.OWNER;
    if (currentUserRole === MeshGroupRole.ADMIN) {
      return memberRole === MeshGroupRole.MEMBER || memberRole === MeshGroupRole.MODERATOR;
    }
    return false;
  }, [currentUserRole]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#010401] border border-[#4caf50]/40 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#4caf50]/20 bg-black/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center">
              <span className="text-[#4caf50] font-bold">{group.name.substring(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#00f3ff]">{group.name}</h2>
              <p className="text-xs text-[#4caf50]/60">{group.memberCount} members</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#4caf50] hover:text-[#00f3ff] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-[#4caf50]/20 bg-black/40">
          {(['members', 'requests', 'settings', 'invites'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${
                activeTab === tab 
                  ? 'text-[#00f3ff] bg-[#00f3ff]/10' 
                  : 'text-[#4caf50]/60 hover:text-[#4caf50]'
              }`}
            >
              {tab}
              {tab === 'requests' && pendingRequests.length > 0 && (
                <span className="absolute top-2 right-2 w-5 h-5 bg-[#00f3ff] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00f3ff]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'members' && (
            <div className="space-y-2">
              {group.members.map(member => (
                <div
                  key={member.peerId}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedMember === member.peerId
                      ? 'border-[#00f3ff]/40 bg-[#00f3ff]/10'
                      : 'border-[#4caf50]/20 bg-black/40 hover:border-[#4caf50]/40'
                  }`}
                  onClick={() => canManageMember(member.role) && setSelectedMember(
                    selectedMember === member.peerId ? null : member.peerId
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center">
                    {member.avatar ? (
                      <img src={member.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-[#00f3ff] font-bold text-sm">
                        {(member.displayName || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#00f3ff] truncate">
                        {member.displayName || `Peer ${member.peerId.substring(0, 8)}`}
                      </span>
                      {roleIcons[member.role]}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#4caf50]/60">
                      <span>{roleLabels[member.role]}</span>
                      <span className={`w-2 h-2 rounded-full ${member.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                    </div>
                  </div>

                  {canManageMember(member.role) && selectedMember === member.peerId && (
                    <div className="flex gap-2">
                      {isAdmin && (
                        <select
                          value={member.role}
                          onChange={(e) => onChangeMemberRole(member.peerId, e.target.value as MeshGroupRole)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-black border border-[#4caf50]/30 text-[#00f3ff] text-xs px-2 py-1 rounded"
                        >
                          <option value={MeshGroupRole.MEMBER}>Member</option>
                          <option value={MeshGroupRole.MODERATOR}>Moderator</option>
                          {isOwner && <option value={MeshGroupRole.ADMIN}>Admin</option>}
                        </select>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowKickConfirm(true);
                        }}
                        className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-[#4caf50]/60">
                  <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="text-sm">No pending join requests</p>
                </div>
              ) : (
                pendingRequests.map(request => (
                  <div key={request.id} className="p-4 border border-[#4caf50]/20 bg-black/40 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center">
                        <span className="text-[#00f3ff] font-bold text-sm">
                          {(request.requesterName || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#00f3ff]">
                          {request.requesterName || `Peer ${request.requesterId.substring(0, 8)}`}
                        </p>
                        <p className="text-xs text-[#4caf50]/60 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {request.requestMessage && (
                      <p className="text-xs text-[#4caf50]/80 mb-3 p-2 bg-black/40 rounded border border-[#4caf50]/10">
                        "{request.requestMessage}"
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onHandleJoinRequest(request.id, true)}
                        className="flex-1 py-2 bg-[#4caf50]/20 border border-[#4caf50]/40 text-[#4caf50] text-xs font-bold uppercase tracking-wide hover:bg-[#4caf50]/30 transition-colors rounded"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onHandleJoinRequest(request.id, false)}
                        className="flex-1 py-2 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wide hover:bg-red-500/30 transition-colors rounded"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="border border-[#4caf50]/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSettingsSection('general')}
                  className="w-full flex items-center justify-between p-4 bg-black/40 hover:bg-black/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-[#00f3ff]" />
                    <span className="text-sm font-bold text-[#00f3ff]">General</span>
                  </div>
                  {expandedSettings.includes('general') ? (
                    <ChevronDown className="w-4 h-4 text-[#4caf50]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#4caf50]" />
                  )}
                </button>
                {expandedSettings.includes('general') && (
                  <div className="p-4 space-y-4 border-t border-[#4caf50]/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#00f3ff]">Private Group</p>
                        <p className="text-xs text-[#4caf50]/60">Require approval to join</p>
                      </div>
                      <button
                        onClick={() => onUpdateSettings({ requireApproval: !group.settings?.requireApproval })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          group.settings?.requireApproval ? 'bg-[#00f3ff]' : 'bg-[#4caf50]/30'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                          group.settings?.requireApproval ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-[#4caf50]/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSettingsSection('permissions')}
                  className="w-full flex items-center justify-between p-4 bg-black/40 hover:bg-black/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-[#00f3ff]" />
                    <span className="text-sm font-bold text-[#00f3ff]">Permissions</span>
                  </div>
                  {expandedSettings.includes('permissions') ? (
                    <ChevronDown className="w-4 h-4 text-[#4caf50]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#4caf50]" />
                  )}
                </button>
                {expandedSettings.includes('permissions') && (
                  <div className="p-4 space-y-3 border-t border-[#4caf50]/10">
                    {[
                      { key: 'allowFileSharing', label: 'Share Media', desc: 'Members can share files/images', icon: Image },
                      { key: 'allowVoiceCalls', label: 'Voice Calls', desc: 'Members can start voice calls', icon: Mic },
                      { key: 'allowVideoCalls', label: 'Video Calls', desc: 'Members can start video calls', icon: Globe }
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-[#4caf50]/60" />
                          <div>
                            <p className="text-sm text-[#00f3ff]">{item.label}</p>
                            <p className="text-xs text-[#4caf50]/60">{item.desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => onUpdateSettings({ [item.key]: !(group.settings as any)?.[item.key] })}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            (group.settings as any)?.[item.key] !== false ? 'bg-[#4caf50]' : 'bg-[#4caf50]/30'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                            (group.settings as any)?.[item.key] !== false ? 'left-5' : 'left-0.5'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'invites' && (
            <div className="space-y-4">
              <div className="p-4 border border-[#4caf50]/20 bg-black/40 rounded-lg">
                <h3 className="text-sm font-bold text-[#00f3ff] mb-4">Create Invite Link</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-[#4caf50]/60 block mb-1">Expires After</label>
                    <select
                      value={inviteOptions.expiresInHours}
                      onChange={(e) => setInviteOptions(prev => ({ ...prev, expiresInHours: Number(e.target.value) }))}
                      className="w-full bg-black border border-[#4caf50]/30 text-[#00f3ff] text-sm px-3 py-2 rounded"
                    >
                      <option value="0">Never</option>
                      <option value="1">1 hour</option>
                      <option value="24">24 hours</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#4caf50]/60 block mb-1">Max Uses</label>
                    <select
                      value={inviteOptions.maxUses}
                      onChange={(e) => setInviteOptions(prev => ({ ...prev, maxUses: Number(e.target.value) }))}
                      className="w-full bg-black border border-[#4caf50]/30 text-[#00f3ff] text-sm px-3 py-2 rounded"
                    >
                      <option value="0">No limit</option>
                      <option value="1">1 use</option>
                      <option value="5">5 uses</option>
                      <option value="10">10 uses</option>
                      <option value="25">25 uses</option>
                      <option value="100">100 uses</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleCreateInviteLink}
                  className="w-full py-2.5 bg-[#00f3ff]/20 border border-[#00f3ff]/40 text-[#00f3ff] text-sm font-bold uppercase tracking-wide hover:bg-[#00f3ff]/30 transition-colors rounded flex items-center justify-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Generate Link
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#4caf50]/60 uppercase tracking-wide">Active Links</h3>
                {inviteLinks.length === 0 ? (
                  <p className="text-center py-8 text-[#4caf50]/60 text-sm">No active invite links</p>
                ) : (
                  inviteLinks.map(link => (
                    <div key={link.code} className="flex items-center gap-3 p-3 border border-[#4caf50]/20 bg-black/40 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-[#00f3ff] truncate">
                          {groupManagementService.formatInviteUrl(link.code)}
                        </p>
                        <p className="text-xs text-[#4caf50]/60">
                          {link.uses} uses
                          {link.maxUses && ` / ${link.maxUses} max`}
                          {link.expiresAt && ` • Expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopyLink(link.code)}
                        className="p-2 text-[#4caf50] hover:text-[#00f3ff] transition-colors"
                      >
                        {copiedLink === link.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRevokeLink(link.code)}
                        className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {showKickConfirm && selectedMember && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#010401] border border-red-500/40 p-6 rounded-lg max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-bold text-red-400">Remove Member</h3>
              </div>
              <p className="text-sm text-[#4caf50]/80 mb-4">
                Are you sure you want to remove this member from the group?
              </p>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
                className="w-full bg-black border border-[#4caf50]/30 text-[#00f3ff] text-sm px-3 py-2 rounded mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowKickConfirm(false);
                    setSelectedMember(null);
                    setKickReason('');
                  }}
                  className="flex-1 py-2 border border-[#4caf50]/30 text-[#4caf50] text-sm font-bold uppercase tracking-wide hover:bg-[#4caf50]/10 transition-colors rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleKickMember}
                  className="flex-1 py-2 bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold uppercase tracking-wide hover:bg-red-500/30 transition-colors rounded"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
