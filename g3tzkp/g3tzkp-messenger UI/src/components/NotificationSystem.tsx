import React, { useEffect, useRef } from 'react';
import { X, Bell, MessageSquare, Users, Shield, AlertTriangle, Check, Info } from 'lucide-react';

export enum NotificationType {
  MESSAGE = 'message',
  GROUP_INVITE = 'group_invite',
  GROUP_JOIN = 'group_join',
  SECURITY = 'security',
  WARNING = 'warning',
  SUCCESS = 'success',
  INFO = 'info'
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  groupId?: string;
  senderId?: string;
  senderName?: string;
  actionUrl?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  showPreview: boolean;
  mutedGroups: string[];
  mutedUntil: number | null;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  sound: true,
  desktop: true,
  showPreview: true,
  mutedGroups: [],
  mutedUntil: null
};

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case NotificationType.MESSAGE:
      return <MessageSquare size={16} strokeWidth={1.5} />;
    case NotificationType.GROUP_INVITE:
    case NotificationType.GROUP_JOIN:
      return <Users size={16} strokeWidth={1.5} />;
    case NotificationType.SECURITY:
      return <Shield size={16} strokeWidth={1.5} />;
    case NotificationType.WARNING:
      return <AlertTriangle size={16} strokeWidth={1.5} />;
    case NotificationType.SUCCESS:
      return <Check size={16} strokeWidth={1.5} />;
    case NotificationType.INFO:
    default:
      return <Info size={16} strokeWidth={1.5} />;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case NotificationType.MESSAGE:
      return 'text-[#00f3ff] border-[#00f3ff]/30 bg-[#00f3ff]/5';
    case NotificationType.GROUP_INVITE:
    case NotificationType.GROUP_JOIN:
      return 'text-[#4caf50] border-[#4caf50]/30 bg-[#4caf50]/5';
    case NotificationType.SECURITY:
      return 'text-purple-400 border-purple-400/30 bg-purple-400/5';
    case NotificationType.WARNING:
      return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5';
    case NotificationType.SUCCESS:
      return 'text-[#4caf50] border-[#4caf50]/30 bg-[#4caf50]/5';
    case NotificationType.INFO:
    default:
      return 'text-white/70 border-white/20 bg-white/5';
  }
};

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onClick
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [notification.id, onDismiss]);
  
  const colorClass = getNotificationColor(notification.type);
  
  return (
    <div
      className={`animate-in slide-in-from-right-full fade-in duration-300 border ${colorClass} p-4 shadow-lg cursor-pointer hover:scale-[1.02] transition-transform`}
      onClick={() => onClick?.(notification)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider truncate">{notification.title}</h4>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(notification.id);
              }}
              className="text-white/40 hover:text-white p-1 -mr-1 flex-shrink-0"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>
          <p className="text-[9px] text-white/60 mt-1 line-clamp-2">{notification.message}</p>
          <div className="text-[7px] text-white/30 mt-2 uppercase tracking-wider">
            {new Date(notification.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss,
  onClick
}) => {
  const visibleNotifications = notifications.filter(n => !n.read).slice(0, 5);
  
  if (visibleNotifications.length === 0) return null;
  
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-xs w-full pointer-events-auto">
      {visibleNotifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
          onClick={onClick}
        />
      ))}
    </div>
  );
};

interface NotificationCenterProps {
  notifications: Notification[];
  settings: NotificationSettings;
  onUpdateSettings: (settings: NotificationSettings) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onClick?: (notification: Notification) => void;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  settings,
  onUpdateSettings,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onClearAll,
  onClick,
  onClose
}) => {
  const [activeTab, setActiveTab] = React.useState<'all' | 'settings'>('all');
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const handleMuteToggle = (duration: number | null) => {
    onUpdateSettings({
      ...settings,
      mutedUntil: duration ? Date.now() + duration : null
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#010401] border border-[#00f3ff]/20 w-full max-w-lg max-h-[80vh] flex flex-col shadow-[0_0_40px_rgba(0,243,255,0.1)]">
        <div className="p-4 border-b border-[#00f3ff]/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-[#00f3ff]" strokeWidth={1} />
            <h2 className="text-[#00f3ff] font-black text-sm uppercase tracking-[0.2em]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-[#00f3ff] text-black text-[8px] font-black px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-2">
            <X size={18} strokeWidth={1} />
          </button>
        </div>
        
        <div className="flex border-b border-[#00f3ff]/10 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'all'
                ? 'text-[#00f3ff] border-b-2 border-[#00f3ff]'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'settings'
                ? 'text-[#00f3ff] border-b-2 border-[#00f3ff]'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Settings
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'all' ? (
            <div className="divide-y divide-white/5">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={32} className="text-white/10 mx-auto mb-4" strokeWidth={1} />
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">No notifications</p>
                </div>
              ) : (
                <>
                  {notifications.map(notification => {
                    const colorClass = getNotificationColor(notification.type);
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-white/[0.02] cursor-pointer transition-colors ${!notification.read ? 'bg-white/[0.01]' : ''}`}
                        onClick={() => {
                          if (!notification.read) onMarkRead(notification.id);
                          onClick?.(notification);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex-shrink-0 ${colorClass.split(' ')[0]}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[10px] font-bold text-white/90 truncate">{notification.title}</h4>
                              {!notification.read && (
                                <span className="w-1.5 h-1.5 bg-[#00f3ff] rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-[9px] text-white/50 mt-1 line-clamp-2">{notification.message}</p>
                            <div className="text-[7px] text-white/30 mt-2 uppercase tracking-wider">
                              {new Date(notification.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(notification.id);
                            }}
                            className="text-white/20 hover:text-red-400 p-1 flex-shrink-0"
                          >
                            <X size={12} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="p-3 border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-white/90">Notifications Enabled</div>
                    <div className="text-[8px] text-white/50 mt-1">Receive in-app notifications</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, enabled: !settings.enabled })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      settings.enabled ? 'bg-[#4caf50]' : 'bg-white/20'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.enabled ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
              
              <div className="p-3 border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-white/90">Sound</div>
                    <div className="text-[8px] text-white/50 mt-1">Play sound for notifications</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, sound: !settings.sound })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      settings.sound ? 'bg-[#4caf50]' : 'bg-white/20'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.sound ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
              
              <div className="p-3 border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-white/90">Desktop Notifications</div>
                    <div className="text-[8px] text-white/50 mt-1">Show system notifications</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, desktop: !settings.desktop })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      settings.desktop ? 'bg-[#4caf50]' : 'bg-white/20'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.desktop ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
              
              <div className="p-3 border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-white/90">Show Message Preview</div>
                    <div className="text-[8px] text-white/50 mt-1">Display message content in notifications</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, showPreview: !settings.showPreview })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      settings.showPreview ? 'bg-[#4caf50]' : 'bg-white/20'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.showPreview ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
              
              <div className="p-3 border border-white/10 bg-white/[0.02]">
                <div className="text-[10px] font-bold text-white/90 mb-3">Mute Notifications</div>
                <div className="flex flex-wrap gap-2">
                  {settings.mutedUntil && settings.mutedUntil > Date.now() ? (
                    <button
                      type="button"
                      onClick={() => handleMuteToggle(null)}
                      className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-[8px] font-bold uppercase tracking-wider hover:bg-yellow-500/30 transition-colors"
                    >
                      Unmute ({Math.ceil((settings.mutedUntil - Date.now()) / 60000)}m left)
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMuteToggle(30 * 60 * 1000)}
                        className="px-3 py-1.5 border border-white/20 text-white/60 text-[8px] font-bold uppercase tracking-wider hover:bg-white/5 transition-colors"
                      >
                        30 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMuteToggle(60 * 60 * 1000)}
                        className="px-3 py-1.5 border border-white/20 text-white/60 text-[8px] font-bold uppercase tracking-wider hover:bg-white/5 transition-colors"
                      >
                        1 hour
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMuteToggle(8 * 60 * 60 * 1000)}
                        className="px-3 py-1.5 border border-white/20 text-white/60 text-[8px] font-bold uppercase tracking-wider hover:bg-white/5 transition-colors"
                      >
                        8 hours
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMuteToggle(24 * 60 * 60 * 1000)}
                        className="px-3 py-1.5 border border-white/20 text-white/60 text-[8px] font-bold uppercase tracking-wider hover:bg-white/5 transition-colors"
                      >
                        24 hours
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {activeTab === 'all' && notifications.length > 0 && (
          <div className="p-4 border-t border-white/10 flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="flex-1 px-4 py-2 border border-[#00f3ff]/30 text-[#00f3ff] text-[9px] font-black uppercase tracking-widest hover:bg-[#00f3ff]/10 transition-all"
            >
              Mark All Read
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="flex-1 px-4 py-2 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface NotificationBadgeProps {
  count: number;
  onClick: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ count, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative p-2 text-white/60 hover:text-[#00f3ff] transition-colors"
    >
      <Bell size={18} strokeWidth={1} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-[#00f3ff] text-black text-[7px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-1 animate-pulse">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};

export const useNotifications = (settings: NotificationSettings) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleT4iXZDN1adREghA');
  }, []);
  
  const requestDesktopPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  };
  
  const playSound = () => {
    if (settings.sound && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };
  
  const showDesktopNotification = async (title: string, body: string, icon?: string) => {
    if (!settings.desktop) return;
    const hasPermission = await requestDesktopPermission();
    if (hasPermission) {
      new Notification(title, { body, icon: icon ?? '/favicon.ico', silent: true });
    }
  };
  
  const shouldNotify = (): boolean => {
    if (!settings.enabled) return false;
    if (settings.mutedUntil && settings.mutedUntil > Date.now()) return false;
    return true;
  };
  
  return {
    playSound,
    showDesktopNotification,
    shouldNotify,
    requestDesktopPermission
  };
};
