import React, { useState, useRef } from 'react';
import { 
  X, User, Shield, Edit2, Check, Camera, Globe, Eye, EyeOff,
  Bell, BellOff, Volume2, VolumeX, MessageSquare, Clock, ShieldCheck
} from 'lucide-react';
import { OperatorProfile, OperatorStatus, OperatorSettings, DEFAULT_OPERATOR_SETTINGS } from '../types';

interface OperatorProfilePanelProps {
  profile: OperatorProfile;
  isOwnProfile: boolean;
  onUpdateProfile: (updates: Partial<OperatorProfile>) => void;
  onUpdateSettings: (updates: Partial<OperatorSettings>) => void;
  onClose: () => void;
}

const StatusIndicator: React.FC<{ status: OperatorStatus, size?: number }> = ({ status, size = 12 }) => {
  const colors: Record<OperatorStatus, string> = {
    [OperatorStatus.ONLINE]: 'bg-[#4caf50] shadow-[0_0_8px_#4caf50]',
    [OperatorStatus.AWAY]: 'bg-yellow-400 shadow-[0_0_8px_#facc15]',
    [OperatorStatus.BUSY]: 'bg-red-400 shadow-[0_0_8px_#f87171]',
    [OperatorStatus.OFFLINE]: 'bg-[#4caf50]/20',
    [OperatorStatus.INVISIBLE]: 'bg-[#4caf50]/20 border-[0.5px] border-[#4caf50]/40'
  };
  
  return (
    <div 
      className={`rounded-full ${colors[status]}`} 
      style={{ width: size, height: size }}
    />
  );
};

const OperatorProfilePanel: React.FC<OperatorProfilePanelProps> = ({
  profile,
  isOwnProfile,
  onUpdateProfile,
  onUpdateSettings,
  onClose
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editName, setEditName] = useState(profile.displayName);
  const [editBio, setEditBio] = useState(profile.bio || '');
  const [editStatusMessage, setEditStatusMessage] = useState(profile.statusMessage || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = () => {
    onUpdateProfile({ displayName: editName });
    setIsEditingName(false);
  };

  const handleSaveBio = () => {
    onUpdateProfile({ bio: editBio });
    setIsEditingBio(false);
  };

  const handleSaveStatus = () => {
    onUpdateProfile({ statusMessage: editStatusMessage });
    setIsEditingStatus(false);
  };

  const handleStatusChange = (status: OperatorStatus) => {
    onUpdateProfile({ status });
  };

  const handleAvatarClick = () => {
    if (isOwnProfile && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const avatarUrl = e.target?.result as string;
      onUpdateProfile({ avatarUrl });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 md:p-6 backdrop-blur-xl bg-black/85 animate-in fade-in duration-300">
      <div className="w-full max-w-lg border-[0.5px] border-[#4caf50]/20 bg-[#0a1a0a]/95 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.95)] max-h-[90vh]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent"></div>
        
        <div className="flex items-center justify-between p-6 border-b-[0.5px] border-[#4caf50]/20 shrink-0">
          <h2 className="orbitron text-sm font-black text-[#00f3ff] tracking-widest uppercase">
            {isOwnProfile ? 'Operator Profile' : 'Operator Profile'}
          </h2>
          <button onClick={onClose} className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2 border-[0.5px] border-[#4caf50]/20 hover:border-[#00f3ff]/40">
            <X size={18} />
          </button>
        </div>

        {isOwnProfile && (
          <div className="flex border-b-[0.5px] border-[#4caf50]/20 shrink-0">
            {[
              { id: 'profile' as const, label: 'PROFILE' },
              { id: 'settings' as const, label: 'SETTINGS' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-[#00f3ff] text-[#00f3ff] bg-[#00f3ff]/5'
                    : 'border-transparent text-[#4caf50]/60 hover:text-[#4caf50]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {activeTab === 'profile' && (
            <div className="space-y-8">
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 border-[0.5px] border-[#4caf50]/40 flex items-center justify-center bg-black/40 text-[#00f3ff] font-black text-2xl overflow-hidden">
                    {(profile.avatarUrl || profile.avatar) ? (
                      <img src={profile.avatarUrl || profile.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      profile.displayName.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1">
                    <StatusIndicator status={profile.status} size={16} />
                  </div>
                  {isOwnProfile && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button 
                        onClick={handleAvatarClick}
                        className="absolute -bottom-2 -right-2 p-2 bg-black border-[0.5px] border-[#4caf50]/40 text-[#4caf50] hover:text-[#00f3ff] hover:border-[#00f3ff]/40 transition-all active:scale-95"
                      >
                        <Camera size={12} />
                      </button>
                    </>
                  )}
                </div>

                <div className="text-center w-full">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 justify-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-black/40 border-[0.5px] border-[#00f3ff]/40 px-4 py-2 text-center text-[12px] font-black text-[#00f3ff] uppercase tracking-wider outline-none"
                        autoFocus
                      />
                      <button onClick={handleSaveName} className="p-2 text-[#4caf50] hover:text-[#00f3ff]">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center">
                      <h3 className="text-[14px] font-black text-[#00f3ff] uppercase tracking-widest">{profile.displayName}</h3>
                      {profile.isVerified && <ShieldCheck size={14} className="text-[#00f3ff]" />}
                      {isOwnProfile && (
                        <button onClick={() => setIsEditingName(true)} className="text-[#4caf50]/40 hover:text-[#00f3ff]">
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[8px] font-mono text-[#4caf50]/40 mt-1 truncate">{profile.peerId}</p>
                </div>
              </div>

              {isOwnProfile && (
                <div className="space-y-3">
                  <label className="text-[8px] font-black text-[#4caf50] uppercase tracking-widest">Status</label>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.values(OperatorStatus).map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={`p-3 border-[0.5px] flex flex-col items-center gap-2 transition-all ${
                          profile.status === status
                            ? 'border-[#00f3ff]/60 bg-[#00f3ff]/10'
                            : 'border-[#4caf50]/20 hover:border-[#4caf50]/40'
                        }`}
                      >
                        <StatusIndicator status={status} />
                        <span className="text-[6px] font-mono text-[#4caf50]/60 uppercase">{status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-black text-[#4caf50] uppercase tracking-widest">Status Message</label>
                  {isOwnProfile && !isEditingStatus && (
                    <button onClick={() => setIsEditingStatus(true)} className="text-[#4caf50]/40 hover:text-[#00f3ff]">
                      <Edit2 size={10} />
                    </button>
                  )}
                </div>
                {isEditingStatus ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editStatusMessage}
                      onChange={(e) => setEditStatusMessage(e.target.value)}
                      placeholder="What's on your mind?"
                      className="flex-1 bg-black/40 border-[0.5px] border-[#4caf50]/20 px-4 py-3 text-[10px] font-mono text-[#00f3ff] outline-none focus:border-[#00f3ff]/40"
                    />
                    <button onClick={handleSaveStatus} className="px-4 border-[0.5px] border-[#4caf50]/40 text-[#4caf50] hover:text-[#00f3ff] hover:border-[#00f3ff]/40">
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] font-mono text-[#4caf50]/60 p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
                    {profile.statusMessage || (isOwnProfile ? 'No status message set' : 'No status')}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-black text-[#4caf50] uppercase tracking-widest">Bio</label>
                  {isOwnProfile && !isEditingBio && (
                    <button onClick={() => setIsEditingBio(true)} className="text-[#4caf50]/40 hover:text-[#00f3ff]">
                      <Edit2 size={10} />
                    </button>
                  )}
                </div>
                {isEditingBio ? (
                  <div className="space-y-2">
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      rows={3}
                      className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 p-4 text-[10px] font-mono text-[#00f3ff] outline-none focus:border-[#00f3ff]/40 resize-none"
                    />
                    <button onClick={handleSaveBio} className="w-full py-2 border-[0.5px] border-[#4caf50]/40 text-[#4caf50] text-[8px] font-black uppercase tracking-widest hover:bg-[#4caf50]/10">
                      Save
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] font-mono text-[#4caf50]/60 p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10 min-h-[60px]">
                    {profile.bio || (isOwnProfile ? 'Tell others about yourself...' : 'No bio')}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[8px] font-black text-[#4caf50] uppercase tracking-widest">Info</label>
                <div className="space-y-2 text-[9px] font-mono">
                  <div className="flex justify-between p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
                    <span className="text-[#4caf50]/40">Member Since</span>
                    <span className="text-[#00f3ff]">{new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
                    <span className="text-[#4caf50]/40">Last Seen</span>
                    <span className="text-[#00f3ff]">{new Date(profile.lastSeenAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
                    <span className="text-[#4caf50]/40">Verification</span>
                    <span className={profile.isVerified ? 'text-[#4caf50]' : 'text-[#4caf50]/40'}>
                      {profile.isVerified ? 'ZKP Verified' : 'Not Verified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && isOwnProfile && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-[#00f3ff] uppercase tracking-widest border-b-[0.5px] border-[#4caf50]/20 pb-2">Notifications</h3>
                {[
                  { key: 'notificationsEnabled' as const, label: 'Push Notifications', icon: Bell },
                  { key: 'soundEnabled' as const, label: 'Sound Effects', icon: Volume2 }
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between p-4 border-[0.5px] border-[#4caf50]/20 bg-black/20">
                    <div className="flex items-center gap-3">
                      <setting.icon size={14} className="text-[#4caf50]/60" />
                      <span className="text-[9px] font-black text-[#00f3ff] uppercase tracking-wider">{setting.label}</span>
                    </div>
                    <button
                      onClick={() => onUpdateSettings({ [setting.key]: !profile.settings[setting.key] })}
                      className={`w-12 h-6 border-[0.5px] relative transition-all ${
                        profile.settings[setting.key]
                          ? 'border-[#00f3ff]/60 bg-[#00f3ff]/10'
                          : 'border-[#4caf50]/20 bg-black/40'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 transition-all ${
                        profile.settings[setting.key]
                          ? 'left-7 bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]'
                          : 'left-1 bg-[#4caf50]/40'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-[#00f3ff] uppercase tracking-widest border-b-[0.5px] border-[#4caf50]/20 pb-2">Privacy</h3>
                {[
                  { key: 'readReceiptsEnabled' as const, label: 'Read Receipts', icon: MessageSquare },
                  { key: 'typingIndicatorsEnabled' as const, label: 'Typing Indicators', icon: Edit2 },
                  { key: 'onlineStatusVisible' as const, label: 'Show Online Status', icon: Globe },
                  { key: 'lastSeenVisible' as const, label: 'Show Last Seen', icon: Clock }
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between p-4 border-[0.5px] border-[#4caf50]/20 bg-black/20">
                    <div className="flex items-center gap-3">
                      <setting.icon size={14} className="text-[#4caf50]/60" />
                      <span className="text-[9px] font-black text-[#00f3ff] uppercase tracking-wider">{setting.label}</span>
                    </div>
                    <button
                      onClick={() => onUpdateSettings({ [setting.key]: !profile.settings[setting.key] })}
                      className={`w-12 h-6 border-[0.5px] relative transition-all ${
                        profile.settings[setting.key]
                          ? 'border-[#00f3ff]/60 bg-[#00f3ff]/10'
                          : 'border-[#4caf50]/20 bg-black/40'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 transition-all ${
                        profile.settings[setting.key]
                          ? 'left-7 bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]'
                          : 'left-1 bg-[#4caf50]/40'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperatorProfilePanel;
