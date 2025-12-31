import React, { useState } from 'react';
import { 
  Users, Shield, Settings, UserPlus, UserMinus, Crown, Star, 
  ChevronRight, Lock, Unlock, Bell, BellOff, MoreVertical,
  Check, X, Clock, Ban, MessageSquare, Phone, Video, Search,
  Copy, Link, RefreshCw, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { 
  MeshGroup, MeshGroupMember, JoinRequest, MeshGroupRole, 
  JoinRequestStatus, MeshGroupPermissions, DEFAULT_PERMISSIONS 
} from '../types';

interface MeshGroupPanelProps {
  group: MeshGroup;
  currentUserId: string;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string, reason?: string) => void;
  onKickMember: (memberId: string) => void;
  onBanMember: (memberId: string) => void;
  onChangeRole: (memberId: string, newRole: MeshGroupRole) => void;
  onMuteMember: (memberId: string, duration?: number) => void;
  onUpdateSettings: (settings: Partial<MeshGroup['settings']>) => void;
  onLeaveGroup: () => void;
  onClose: () => void;
}

const RoleIcon: React.FC<{ role: MeshGroupRole }> = ({ role }) => {
  switch (role) {
    case MeshGroupRole.OWNER:
      return <Crown size={12} className="text-yellow-400" />;
    case MeshGroupRole.ADMIN:
      return <Shield size={12} className="text-[#00f3ff]" />;
    case MeshGroupRole.MODERATOR:
      return <Star size={12} className="text-[#4caf50]" />;
    default:
      return null;
  }
};

const RoleBadge: React.FC<{ role: MeshGroupRole }> = ({ role }) => {
  const colors: Record<MeshGroupRole, string> = {
    [MeshGroupRole.OWNER]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    [MeshGroupRole.ADMIN]: 'bg-[#00f3ff]/20 text-[#00f3ff] border-[#00f3ff]/40',
    [MeshGroupRole.MODERATOR]: 'bg-[#4caf50]/20 text-[#4caf50] border-[#4caf50]/40',
    [MeshGroupRole.MEMBER]: 'bg-white/10 text-white/60 border-white/20',
    [MeshGroupRole.PENDING]: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    [MeshGroupRole.BANNED]: 'bg-red-500/20 text-red-400 border-red-500/40'
  };
  
  return (
    <span className={`px-2 py-0.5 text-[7px] font-black uppercase tracking-widest border-[0.5px] ${colors[role]}`}>
      {role}
    </span>
  );
};

const MeshGroupPanel: React.FC<MeshGroupPanelProps> = ({
  group,
  currentUserId,
  onApproveRequest,
  onRejectRequest,
  onKickMember,
  onBanMember,
  onChangeRole,
  onMuteMember,
  onUpdateSettings,
  onLeaveGroup,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'requests' | 'settings' | 'permissions'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null);

  const currentMember = group.members.find(m => m.id === currentUserId);
  const currentPermissions = currentMember?.permissions || DEFAULT_PERMISSIONS[MeshGroupRole.MEMBER];
  const isOwner = currentMember?.role === MeshGroupRole.OWNER;
  const isAdmin = currentMember?.role === MeshGroupRole.ADMIN || isOwner;
  const isMod = currentMember?.role === MeshGroupRole.MODERATOR || isAdmin;

  const filteredMembers = group.members.filter(m => 
    m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.peerId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingRequests = group.pendingRequests.filter(r => r.status === JoinRequestStatus.PENDING);

  const tabs = [
    { id: 'members' as const, label: 'MEMBERS', icon: Users, count: group.memberCount },
    { id: 'requests' as const, label: 'REQUESTS', icon: UserPlus, count: pendingRequests.length, requiresMod: true },
    { id: 'settings' as const, label: 'SETTINGS', icon: Settings, requiresAdmin: true },
    { id: 'permissions' as const, label: 'ROLES', icon: Shield, requiresOwner: true }
  ];

  const handleRoleChange = (memberId: string, newRole: MeshGroupRole) => {
    onChangeRole(memberId, newRole);
    setShowRoleMenu(null);
  };

  const copyInviteLink = () => {
    if (group.settings.inviteLink) {
      navigator.clipboard.writeText(group.settings.inviteLink);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 md:p-6 backdrop-blur-xl bg-black/85 animate-in fade-in duration-300">
      <div className="w-full max-w-4xl h-[90vh] border-[0.5px] border-[#4caf50]/20 bg-[#0a1a0a]/95 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.95)]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent"></div>
        
        <div className="flex items-center justify-between p-6 border-b-[0.5px] border-[#4caf50]/20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-[0.5px] border-[#4caf50]/40 flex items-center justify-center bg-black/40">
              <Users size={20} className="text-[#00f3ff]" />
            </div>
            <div>
              <h2 className="orbitron text-sm font-black text-[#00f3ff] tracking-widest uppercase">{group.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[7px] font-mono text-[#4caf50]/60 uppercase">{group.memberCount} Members</span>
                {group.isPrivate && <Lock size={10} className="text-[#4caf50]/40" />}
                {group.zkpVerified && <ShieldCheck size={10} className="text-[#00f3ff]/60" />}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2 border-[0.5px] border-[#4caf50]/20 hover:border-[#00f3ff]/40">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b-[0.5px] border-[#4caf50]/20 shrink-0 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            if (tab.requiresOwner && !isOwner) return null;
            if (tab.requiresAdmin && !isAdmin) return null;
            if (tab.requiresMod && !isMod) return null;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-[8px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#00f3ff] text-[#00f3ff] bg-[#00f3ff]/5'
                    : 'border-transparent text-[#4caf50]/60 hover:text-[#4caf50]'
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-[#00f3ff]/20 text-[#00f3ff] text-[6px] font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {activeTab === 'members' && (
            <div className="space-y-6">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4caf50]/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 pl-10 pr-4 py-3 text-[10px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-mono uppercase"
                />
              </div>

              <div className="space-y-2">
                {filteredMembers.map(member => (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-4 border-[0.5px] border-[#4caf50]/20 bg-black/20 hover:bg-black/40 transition-all group ${
                      member.id === currentUserId ? 'border-[#00f3ff]/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 border-[0.5px] border-[#4caf50]/40 flex items-center justify-center bg-black/40 text-[#00f3ff] font-black text-[10px]">
                          {member.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-[0.5px] border-black ${
                          member.isOnline ? 'bg-[#4caf50]' : 'bg-[#4caf50]/20'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-[#00f3ff] uppercase tracking-wider">{member.displayName}</span>
                          <RoleIcon role={member.role} />
                          {member.id === currentUserId && (
                            <span className="text-[6px] font-mono text-[#4caf50]/60">(YOU)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <RoleBadge role={member.role} />
                          {member.statusMessage && (
                            <span className="text-[7px] font-mono text-[#4caf50]/40 truncate max-w-[150px]">{member.statusMessage}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {member.id !== currentUserId && isMod && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {currentPermissions.canManageRoles && member.role !== MeshGroupRole.OWNER && (
                          <div className="relative">
                            <button
                              onClick={() => setShowRoleMenu(showRoleMenu === member.id ? null : member.id)}
                              className="p-2 border-[0.5px] border-[#4caf50]/20 hover:border-[#00f3ff]/40 text-[#4caf50] hover:text-[#00f3ff] transition-all"
                            >
                              <Shield size={12} />
                            </button>
                            {showRoleMenu === member.id && (
                              <div className="absolute right-0 top-full mt-1 z-50 bg-black border-[0.5px] border-[#4caf50]/40 shadow-xl">
                                {[MeshGroupRole.ADMIN, MeshGroupRole.MODERATOR, MeshGroupRole.MEMBER].map(role => (
                                  <button
                                    key={role}
                                    onClick={() => handleRoleChange(member.id, role)}
                                    className={`w-full px-4 py-2 text-[8px] font-black uppercase tracking-widest text-left hover:bg-[#00f3ff]/10 transition-all ${
                                      member.role === role ? 'text-[#00f3ff] bg-[#00f3ff]/5' : 'text-[#4caf50]'
                                    }`}
                                  >
                                    {role}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {currentPermissions.canMute && (
                          <button
                            onClick={() => onMuteMember(member.id)}
                            className="p-2 border-[0.5px] border-[#4caf50]/20 hover:border-orange-500/40 text-[#4caf50] hover:text-orange-400 transition-all"
                          >
                            {member.isMuted ? <Bell size={12} /> : <BellOff size={12} />}
                          </button>
                        )}
                        {currentPermissions.canKick && (
                          <button
                            onClick={() => onKickMember(member.id)}
                            className="p-2 border-[0.5px] border-[#4caf50]/20 hover:border-red-500/40 text-[#4caf50] hover:text-red-400 transition-all"
                          >
                            <UserMinus size={12} />
                          </button>
                        )}
                        {currentPermissions.canBan && (
                          <button
                            onClick={() => onBanMember(member.id)}
                            className="p-2 border-[0.5px] border-red-500/20 hover:border-red-500/60 text-red-400/60 hover:text-red-400 transition-all"
                          >
                            <Ban size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'requests' && currentPermissions.canApproveJoinRequests && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-[#00f3ff] uppercase tracking-widest">Pending Requests</h3>
                <span className="text-[8px] font-mono text-[#4caf50]/60">{pendingRequests.length} pending</span>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <UserPlus size={32} className="text-[#4caf50]/20 mx-auto mb-4" />
                  <p className="text-[10px] font-mono text-[#4caf50]/40 uppercase tracking-widest">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="p-4 border-[0.5px] border-[#4caf50]/20 bg-black/20">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 border-[0.5px] border-orange-500/40 flex items-center justify-center bg-orange-500/10 text-orange-400 font-black text-[10px]">
                            {request.requesterName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[#00f3ff] uppercase tracking-wider">{request.requesterName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock size={10} className="text-[#4caf50]/40" />
                              <span className="text-[7px] font-mono text-[#4caf50]/40">
                                {new Date(request.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onApproveRequest(request.id)}
                            className="p-2 border-[0.5px] border-[#4caf50]/40 hover:bg-[#4caf50]/20 text-[#4caf50] transition-all"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => onRejectRequest(request.id)}
                            className="p-2 border-[0.5px] border-red-500/40 hover:bg-red-500/20 text-red-400 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      {request.requestMessage && (
                        <div className="mt-3 p-3 bg-black/40 border-l-[0.5px] border-[#4caf50]/40">
                          <p className="text-[9px] font-mono text-[#4caf50]/80 italic">"{request.requestMessage}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && isAdmin && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-[#00f3ff] uppercase tracking-widest border-b-[0.5px] border-[#4caf50]/20 pb-2">Join Settings</h3>
                {[
                  { key: 'allowJoinRequests', label: 'Allow Join Requests', desc: 'Users can request to join this group' },
                  { key: 'requireApproval', label: 'Require Approval', desc: 'New members must be approved by admin/mod' }
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between p-4 border-[0.5px] border-[#4caf50]/20 bg-black/20">
                    <div>
                      <p className="text-[9px] font-black text-[#00f3ff] uppercase tracking-wider">{setting.label}</p>
                      <p className="text-[7px] font-mono text-[#4caf50]/40 mt-1">{setting.desc}</p>
                    </div>
                    <button
                      onClick={() => onUpdateSettings({ [setting.key]: !(group.settings as any)[setting.key] })}
                      className={`w-12 h-6 border-[0.5px] relative transition-all ${
                        (group.settings as any)[setting.key]
                          ? 'border-[#00f3ff]/60 bg-[#00f3ff]/10'
                          : 'border-[#4caf50]/20 bg-black/40'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 transition-all ${
                        (group.settings as any)[setting.key]
                          ? 'left-7 bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]'
                          : 'left-1 bg-[#4caf50]/40'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-[#00f3ff] uppercase tracking-widest border-b-[0.5px] border-[#4caf50]/20 pb-2">Security Settings</h3>
                {[
                  { key: 'zkpRequired', label: 'ZKP Verification Required', desc: 'All messages require zero-knowledge proofs' },
                  { key: 'antiSpamEnabled', label: 'Anti-Spam Protection', desc: 'Automatic detection and filtering of spam' }
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between p-4 border-[0.5px] border-[#4caf50]/20 bg-black/20">
                    <div>
                      <p className="text-[9px] font-black text-[#00f3ff] uppercase tracking-wider">{setting.label}</p>
                      <p className="text-[7px] font-mono text-[#4caf50]/40 mt-1">{setting.desc}</p>
                    </div>
                    <button
                      onClick={() => onUpdateSettings({ [setting.key]: !(group.settings as any)[setting.key] })}
                      className={`w-12 h-6 border-[0.5px] relative transition-all ${
                        (group.settings as any)[setting.key]
                          ? 'border-[#00f3ff]/60 bg-[#00f3ff]/10'
                          : 'border-[#4caf50]/20 bg-black/40'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 transition-all ${
                        (group.settings as any)[setting.key]
                          ? 'left-7 bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]'
                          : 'left-1 bg-[#4caf50]/40'
                      }`} />
                    </button>
                  </div>
                ))}

                <div className="p-4 border-[0.5px] border-[#4caf50]/20 bg-black/20">
                  <p className="text-[9px] font-black text-[#00f3ff] uppercase tracking-wider mb-2">Encryption Level</p>
                  <div className="flex gap-2">
                    {(['standard', 'enhanced', 'paranoid'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => onUpdateSettings({ encryptionLevel: level })}
                        className={`flex-1 py-3 text-[8px] font-black uppercase tracking-widest border-[0.5px] transition-all ${
                          group.settings.encryptionLevel === level
                            ? 'border-[#00f3ff]/60 bg-[#00f3ff]/20 text-[#00f3ff]'
                            : 'border-[#4caf50]/20 text-[#4caf50]/60 hover:text-[#4caf50]'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {group.settings.inviteLinkEnabled && group.settings.inviteLink && (
                <div className="p-4 border-[0.5px] border-[#00f3ff]/30 bg-[#00f3ff]/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black text-[#00f3ff] uppercase tracking-wider">Invite Link</p>
                    <button onClick={copyInviteLink} className="text-[#4caf50] hover:text-[#00f3ff] transition-all">
                      <Copy size={12} />
                    </button>
                  </div>
                  <p className="text-[8px] font-mono text-[#4caf50]/60 break-all">{group.settings.inviteLink}</p>
                </div>
              )}

              <button
                onClick={onLeaveGroup}
                className="w-full py-4 border-[0.5px] border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
              >
                Leave Group
              </button>
            </div>
          )}

          {activeTab === 'permissions' && isOwner && (
            <div className="space-y-6">
              <p className="text-[9px] font-mono text-[#4caf50]/60">Configure role permissions for this mesh group.</p>
              
              {[MeshGroupRole.ADMIN, MeshGroupRole.MODERATOR, MeshGroupRole.MEMBER].map(role => (
                <div key={role} className="border-[0.5px] border-[#4caf50]/20 bg-black/20">
                  <div className="flex items-center gap-3 p-4 border-b-[0.5px] border-[#4caf50]/10">
                    <RoleIcon role={role} />
                    <span className="text-[10px] font-black text-[#00f3ff] uppercase tracking-widest">{role}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-4">
                    {Object.entries(DEFAULT_PERMISSIONS[role]).map(([perm, value]) => (
                      <div key={perm} className="flex items-center justify-between p-2 bg-black/20">
                        <span className="text-[7px] font-mono text-[#4caf50]/60 uppercase">{perm.replace(/can/g, '').replace(/([A-Z])/g, ' $1')}</span>
                        <div className={`w-2 h-2 ${value ? 'bg-[#4caf50]' : 'bg-red-400/40'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeshGroupPanel;
