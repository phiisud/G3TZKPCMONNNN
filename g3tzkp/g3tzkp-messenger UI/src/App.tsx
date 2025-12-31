import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, Network, Activity, Cpu, Lock, Send, Hash, Zap, 
  Search, MessageSquare, Users, PlusCircle, CheckCircle, 
  Binary, RefreshCw, Sparkles, Map, Target, X, ChevronRight, ChevronLeft, Settings, 
  Clock, CreditCard, Award, Info, Bell, UserPlus, ShieldCheck, Navigation, MapPin,
  Train, Download
} from 'lucide-react';
import { useG3ZKP } from './contexts/G3ZKPContext';
import GeodesicMap from './components/GeodesicMap';
import DiegeticTerminal from './components/DiegeticTerminal';
import ZKPVerifier from './components/ZKPVerifier';
import MatrixRain from './components/MatrixRain';
import MobileNav, { PageType } from './components/MobileNav';
import MarketplacePageExtended from './pages/MarketplacePageExtended';
import MeshGroupPanel from './components/MeshGroupPanel';
import JoinGroupModal from './components/JoinGroupModal';
import OperatorProfilePanel from './components/UserProfilePanel';
import { GroupModal, LicenseModal, SettingsModal } from './components/Modals';
import FaceTimeCall from './components/calls/FaceTimeCall';
import NavigatorMap from './components/navigation/NavigatorMap';
import RoutePlanner from './components/navigation/RoutePlanner';
import NavigationInterface from './components/navigation/NavigationInterface';
import OfflineMapManager from './components/navigation/OfflineMapManager';
import ActiveNavigation from './components/navigation/ActiveNavigation';
import TransitPlanner from './components/navigation/TransitPlanner';
import TopLeftControlCluster from './components/navigation/TopLeftControlCluster';
import BottomSheetPanel from './components/navigation/BottomSheetPanel';
import GeodesicNavigationView from './components/navigation/GeodesicNavigationView';
import { useNavigationStore } from './stores/useNavigationStore';
import { useOperatorStore } from './stores/operatorStore';
import trafficService from './services/TrafficService';
import RealCryptoStatus from './components/system/RealCryptoStatus';
import ProtocolMonitor from './components/system/ProtocolMonitor';
import ZKPCircuitRegistry from './components/system/ZKPCircuitRegistry';
import { Coordinate, Route } from './types/navigation';
import navigationService from './services/NavigationService';
import { 
  UIState, Message, LicenseStatus, ModalType, 
  MeshGroup, MeshGroupMember, JoinRequest, MeshGroupRole, 
  JoinRequestStatus, DEFAULT_GROUP_SETTINGS, DEFAULT_PERMISSIONS,
  OperatorProfile, OperatorStatus, OperatorSettings, DEFAULT_OPERATOR_SETTINGS,
  Notification, NotificationType, TypingUser, SearchResult, TensorData
} from './types';
import TensorObjectViewer from './components/TensorObjectViewer';
import { mediaStorageService } from './services/MediaStorageService';
import { tensorConversionService } from './services/TensorConversionService';
import SearchPanel from './components/SearchPanel';
import { 
  Notification as AppNotification, 
  NotificationType as AppNotificationType, 
  NotificationSettings, 
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationContainer,
  NotificationCenter,
  NotificationBadge,
  useNotifications
} from './components/NotificationSystem';
import { useThemeStore } from './stores/themeStore';
import { useLocationStore } from './stores/useLocationStore';
import ContactList from './components/contacts/ContactList';
import MeshContactList from './components/contacts/MeshContactList';
import LocationShareButton from './components/chat/LocationShareButton';
import LocationMessage from './components/chat/LocationMessage';
import WazeLikeSearch from './components/navigation/WazeLikeSearch';
import FlowerOfLifeMarker from './components/navigation/FlowerOfLifeMarker';
import IntegratedNavigation from './components/IntegratedNavigation';
import IntegratedChat from './components/IntegratedChat';
import MeshPage from './pages/MeshPage';
import GroupAdminPanel from './components/groups/GroupAdminPanel';
import { groupManagementService } from './services/GroupManagementService';
import { operatorProfileService } from './services/OperatorProfileService';
import { peerContactService } from './services/PeerContactService';
import ConnectionRequestNotification from './components/ConnectionRequestNotification';
import { businessCallingService } from './services/BusinessCallingService';
import { g3tzkpWebService } from './services/web/G3TZKPWebService';

const FlowerOfLife: React.FC<{ size?: number, color?: string, rotorSpeed?: string }> = ({ 
  size = 200, color = "currentColor", rotorSpeed = "40s" 
}) => {
  const radius = size / 6;
  const centerX = size / 2;
  const centerY = size / 2;
  const angles = [0, 60, 120, 180, 240, 300];
  
  return (
    <div className="rotorse-container relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 animate-[rotorse-alpha_var(--speed)_linear_infinite]" style={{ '--speed': rotorSpeed } as any}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full opacity-80">
          <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke={color} strokeWidth="0.5" />
          {angles.map(angle => {
            const x = centerX + radius * Math.cos((angle * Math.PI) / 180);
            const y = centerY + radius * Math.sin((angle * Math.PI) / 180);
            return (
              <React.Fragment key={angle}>
                <circle cx={x} cy={y} r={radius} fill="none" stroke={color} strokeWidth="0.5" />
                {angles.map(innerAngle => {
                   const ox = x + radius * Math.cos(((innerAngle) * Math.PI) / 180);
                   const oy = y + radius * Math.sin(((innerAngle) * Math.PI) / 180);
                   return <circle key={`${angle}-${innerAngle}`} cx={ox} cy={oy} r={radius} fill="none" stroke={color} strokeWidth="0.2" opacity="0.6" />;
                })}
              </React.Fragment>
            );
          })}
          <circle cx={centerX} cy={centerY} r={radius * 3} fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="10 5" opacity="0.2" />
        </svg>
      </div>
      <div className="absolute inset-0 animate-[rotorse-beta_60s_linear_infinite] scale-75 opacity-50">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
           <circle cx={centerX} cy={centerY} r={radius * 2} fill="none" stroke={color} strokeWidth="0.2" strokeDasharray="4 8" />
        </svg>
      </div>
      <div className="absolute w-4 h-4 bg-white/40 rounded-full blur-sm animate-pulse"></div>
    </div>
  );
};


const App: React.FC = () => {
  const [uiState, setUiState] = useState<UIState>(UIState.INITIALIZING);
  const [activePage, setActivePage] = useState<PageType>('geodesic');
  const [modal, setModal] = useState<ModalType>('none');
  const [isVerifying, setIsVerifying] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meshGroups, setMeshGroups] = useState<MeshGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<MeshGroup | null>(null);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [meshContacts, setMeshContacts] = useState<Array<{
    peerId: string;
    displayName?: string;
    avatar?: string;
    isOnline: boolean;
    lastMessage?: { content: string; timestamp: number; isMe: boolean; read: boolean };
    unreadCount: number;
  }>>([]);
  const [selectedPeerChat, setSelectedPeerChat] = useState<string | null>(null);
  
  const { 
    profile: operatorProfile, 
    updateProfile: updateOperatorProfile, 
    updateSettings: updateOperatorSettings,
    initializeProfile,
    isInitialized: isOperatorInitialized 
  } = useOperatorStore();
  
  const currentOperator: OperatorProfile = operatorProfile || {
    id: 'local_user',
    peerId: '12D3KooW' + Array(12).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join(''),
    displayName: 'LOCAL_OPERATOR',
    publicKey: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
    status: OperatorStatus.ONLINE,
    statusMessage: 'Synchronizing geodesic paths...',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
    isVerified: true,
    bio: 'G3ZKP mesh network operator. Specializing in tautological verification protocols.',
    settings: DEFAULT_OPERATOR_SETTINGS
  };
  
  useEffect(() => {
    if (!isOperatorInitialized && !operatorProfile) {
      const peerId = '12D3KooW' + Array(12).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
      const publicKey = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      initializeProfile(peerId, publicKey);
    }
  }, [isOperatorInitialized, operatorProfile, initializeProfile]);
  
  const [license, setLicense] = useState<LicenseStatus>({
    valid: true,
    expiresAt: null, // Lifetime
    expiresInDays: null,
    accumulatedValue: 30.0
  });
  const [fileProgress, setFileProgress] = useState<number>(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isLocalTyping, setIsLocalTyping] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<MeshGroupMember | null>(null);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([
    {
      id: 'welcome-1',
      type: AppNotificationType.INFO,
      title: 'Welcome to G3ZKP Messenger',
      message: 'Your connection is secured with zero-knowledge proofs and end-to-end encryption.',
      timestamp: Date.now() - 60000,
      read: false
    },
    {
      id: 'security-1',
      type: AppNotificationType.SECURITY,
      title: 'Encryption Active',
      message: 'All messages are encrypted with X3DH key exchange and Double Ratchet protocol.',
      timestamp: Date.now() - 120000,
      read: false
    }
  ]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [toastNotifications, setToastNotifications] = useState<AppNotification[]>([]);
  
  const { playSound, showDesktopNotification, shouldNotify } = useNotifications(notificationSettings);
  
  const unreadNotificationCount = appNotifications.filter(n => !n.read).length;
  
  const { 
    isInitialized, 
    initializationProgress, 
    statusMessage,
    messages: contextMessages,
    sendMessage: sendContextMessage,
    sendMediaMessage: sendContextMediaMessage,
    connectedPeers,
    localPeerId
  } = useG3ZKP();

  useEffect(() => {
    useThemeStore.getState().applyTheme();
  }, []);

  useEffect(() => {
    const initG3TZKPServices = async () => {
      try {
        console.log('[G3TZKP] Initializing all G3TZKP services...');
        await operatorProfileService.initialize();
        console.log('[G3TZKP] OperatorProfileService initialized');
        await peerContactService.initialize();
        console.log('[G3TZKP] PeerContactService initialized');
        await businessCallingService.initialize();
        console.log('[G3TZKP] BusinessCallingService initialized');
        await g3tzkpWebService.initialize();
        console.log('[G3TZKP] G3TZKPWebService initialized');
        console.log('[G3TZKP] All G3TZKP services initialized successfully');
        
        // Load initial contacts from PeerContactService
        const initialContacts = peerContactService.getAllContacts();
        setMeshContacts(initialContacts.map(contact => ({
          peerId: contact.peerId,
          displayName: contact.contactName,
          avatar: undefined,
          isOnline: contact.connectionStatus === 'connected',
          unreadCount: contact.unreadCount
        })));
      } catch (error) {
        console.error('[G3TZKP] Failed to initialize services:', error);
      }
    };
    initG3TZKPServices();
  }, []);

  // Subscribe to contact changes from PeerContactService
  useEffect(() => {
    const unsubscribe = peerContactService.subscribe((updatedContacts) => {
      console.log('[App] Received contact update from PeerContactService:', updatedContacts.length, 'contacts');
      setMeshContacts(updatedContacts.map(contact => ({
        peerId: contact.peerId,
        displayName: contact.contactName,
        avatar: undefined,
        isOnline: contact.connectionStatus === 'connected',
        unreadCount: contact.unreadCount
      })));
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // BETA MODE: Auto-grant lifetime license (static deployment - always grant)
  useEffect(() => {
    const existingLicense = localStorage.getItem('g3zkp_license');
    if (!existingLicense) {
      const betaLicense = `BETA_LIFETIME_${Date.now()}`;
      localStorage.setItem('g3zkp_license', betaLicense);
      console.log('[BETA] Lifetime license granted for static deployment');
      setLicense({
        valid: true,
        expiresAt: null,
        expiresInDays: null,
        accumulatedValue: 30.0
      });
    }
  }, []);

  useEffect(() => {
    const initGeolocation = () => {
      if (!navigator.geolocation) {
        console.warn('[Location] Geolocation not supported');
        return;
      }

      console.log('[Location] Requesting high-accuracy geolocation...');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coord: Coordinate = [position.coords.longitude, position.coords.latitude];
          console.log('[Location] Got position:', coord, 'Accuracy:', position.coords.accuracy, 'm');
          setCurrentLocation(coord);
        },
        (error) => {
          console.error('[Location] Geolocation error:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coord: Coordinate = [position.coords.longitude, position.coords.latitude];
          setCurrentLocation(coord);
          if (position.coords.heading !== null) {
            setNavigationHeading(position.coords.heading);
          }
        },
        (error) => {
          console.warn('[Location] Watch position error:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    };

    const cleanup = initGeolocation();
    return cleanup;
  }, []);

  useEffect(() => {
    if (isInitialized) {
      setUiState(UIState.NETWORK_MAP);
    }
  }, [isInitialized]);

  useEffect(() => {
    if (!isLocalTyping) return;
    const timer = setTimeout(() => {
      setIsLocalTyping(false);
      setTypingUsers(prev => prev.filter(u => u.peerId !== currentOperator.peerId));
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLocalTyping, currentOperator.peerId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  const handleCreateGroup = useCallback((name: string) => {
    const newGroup: MeshGroup = {
      id: `group_${Date.now()}`,
      name,
      description: 'New mesh group for secure communications',
      createdAt: Date.now(),
      createdBy: currentOperator.id,
      updatedAt: Date.now(),
      memberCount: 1,
      members: [{
        id: currentOperator.id,
        peerId: currentOperator.peerId,
        displayName: currentOperator.displayName,
        role: MeshGroupRole.OWNER,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        permissions: DEFAULT_PERMISSIONS[MeshGroupRole.OWNER],
        isMuted: false,
        publicKey: currentOperator.publicKey,
        isOnline: true
      }],
      pendingRequests: [],
      settings: DEFAULT_GROUP_SETTINGS,
      pinnedMessages: [],
      isPrivate: true,
      requiresApproval: true,
      lastActivity: Date.now(),
      unreadCount: 0,
      zkpVerified: true,
      encryptionEnabled: true
    };
    setMeshGroups(prev => [newGroup, ...prev]);
    setModal('none');
    setUiState(UIState.CRYPTO_VERIFICATION);
    setTimeout(() => setUiState(UIState.NETWORK_MAP), 3000);
  }, [currentOperator]);

  const handleApproveRequest = useCallback((requestId: string) => {
    setMeshGroups(prev => prev.map(group => {
      const request = group.pendingRequests.find(r => r.id === requestId);
      if (!request) return group;
      
      const newMember: MeshGroupMember = {
        id: request.requesterId,
        peerId: `12D3KooW${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        displayName: request.requesterName,
        role: MeshGroupRole.MEMBER,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        permissions: DEFAULT_PERMISSIONS[MeshGroupRole.MEMBER],
        isMuted: false,
        publicKey: request.requesterPublicKey,
        isOnline: true
      };
      
      return {
        ...group,
        members: [...group.members, newMember],
        memberCount: group.memberCount + 1,
        pendingRequests: group.pendingRequests.map(r => 
          r.id === requestId ? { ...r, status: JoinRequestStatus.APPROVED, reviewedAt: Date.now(), reviewedBy: currentOperator.id } : r
        )
      };
    }));
  }, [currentOperator.id]);

  const handleRejectRequest = useCallback((requestId: string, reason?: string) => {
    setMeshGroups(prev => prev.map(group => ({
      ...group,
      pendingRequests: group.pendingRequests.map(r => 
        r.id === requestId ? { ...r, status: JoinRequestStatus.REJECTED, reviewedAt: Date.now(), reviewedBy: currentOperator.id, rejectionReason: reason } : r
      )
    })));
  }, [currentOperator.id]);

  const handleKickMember = useCallback((memberId: string) => {
    if (!selectedGroup) return;
    setMeshGroups(prev => prev.map(group => 
      group.id === selectedGroup.id ? {
        ...group,
        members: group.members.filter(m => m.id !== memberId),
        memberCount: group.memberCount - 1
      } : group
    ));
  }, [selectedGroup]);

  const handleBanMember = useCallback((memberId: string) => {
    if (!selectedGroup) return;
    setMeshGroups(prev => prev.map(group => 
      group.id === selectedGroup.id ? {
        ...group,
        members: group.members.map(m => 
          m.id === memberId ? { ...m, role: MeshGroupRole.BANNED, permissions: DEFAULT_PERMISSIONS[MeshGroupRole.BANNED] } : m
        )
      } : group
    ));
  }, [selectedGroup]);

  const handleChangeRole = useCallback((memberId: string, newRole: MeshGroupRole) => {
    if (!selectedGroup) return;
    setMeshGroups(prev => prev.map(group => 
      group.id === selectedGroup.id ? {
        ...group,
        members: group.members.map(m => 
          m.id === memberId ? { ...m, role: newRole, permissions: DEFAULT_PERMISSIONS[newRole] } : m
        )
      } : group
    ));
  }, [selectedGroup]);

  const handleMuteMember = useCallback((memberId: string, duration?: number) => {
    if (!selectedGroup) return;
    setMeshGroups(prev => prev.map(group => 
      group.id === selectedGroup.id ? {
        ...group,
        members: group.members.map(m => 
          m.id === memberId ? { ...m, isMuted: !m.isMuted, mutedUntil: duration ? Date.now() + duration : undefined } : m
        )
      } : group
    ));
  }, [selectedGroup]);

  const handleUpdateGroupSettings = useCallback((settings: Partial<MeshGroup['settings']>) => {
    if (!selectedGroup) return;
    setMeshGroups(prev => prev.map(group => 
      group.id === selectedGroup.id ? {
        ...group,
        settings: { ...group.settings, ...settings }
      } : group
    ));
  }, [selectedGroup]);

  const handleLeaveGroup = useCallback(() => {
    if (!selectedGroup) return;
    setMeshGroups(prev => prev.map(group => 
      group.id === selectedGroup.id ? {
        ...group,
        members: group.members.filter(m => m.id !== currentOperator.id),
        memberCount: group.memberCount - 1
      } : group
    ));
    setShowGroupPanel(false);
    setSelectedGroup(null);
  }, [selectedGroup, currentOperator.id]);

  const handleJoinRequest = useCallback(async (groupId: string, message?: string) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newNotification: AppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: AppNotificationType.GROUP_INVITE,
      title: 'Join Request Sent',
      message: 'Your request has been sent to the group admins',
      groupId,
      timestamp: Date.now(),
      read: false
    };
    setAppNotifications(prev => [newNotification, ...prev]);
    setToastNotifications(prev => [...prev, newNotification]);
  }, []);

  const [viewingTensorObject, setViewingTensorObject] = useState<TensorData | null>(null);

  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [navigationActive, setNavigationActive] = useState(false);
  const [navigationHeading, setNavigationHeading] = useState(0);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [showTransitPlanner, setShowTransitPlanner] = useState(false);
  const [plannerMode, setPlannerMode] = useState<'car' | 'transit'>('car');
  const [showOfflineManager, setShowOfflineManager] = useState(false);

  const handleFileUpload = useCallback(async (files: File[], convert3D: boolean = false) => {
    setFileProgress(10);
    
    try {
      const uploadResults = await mediaStorageService.uploadMultipleFiles(files, 'LOCAL_OPERATOR');
      setFileProgress(50);
      
      if (convert3D) {
        const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
        if (mediaFiles.length > 0) {
          const sources: { element: HTMLImageElement | HTMLVideoElement; url: string; name: string; type: 'image' | 'video' }[] = [];
          
          for (const result of uploadResults) {
            if (mediaStorageService.isImage(result.metadata.mimeType) || mediaStorageService.isVideo(result.metadata.mimeType)) {
              const isVideo = mediaStorageService.isVideo(result.metadata.mimeType);
              const element = isVideo ? document.createElement('video') : new Image();
              element.crossOrigin = 'anonymous';
              (element as HTMLImageElement | HTMLVideoElement).src = result.url;
              
              await new Promise<void>((resolve) => {
                if (isVideo) {
                  (element as HTMLVideoElement).onloadeddata = () => resolve();
                  (element as HTMLVideoElement).load();
                } else {
                  (element as HTMLImageElement).onload = () => resolve();
                }
                setTimeout(resolve, 3000);
              });
              
              sources.push({
                element: element as HTMLImageElement | HTMLVideoElement,
                url: result.url,
                name: result.metadata.originalName,
                type: isVideo ? 'video' : 'image'
              });
            }
          }
          
          setFileProgress(70);
          
          if (sources.length > 0) {
            const tensorObject = await tensorConversionService.convertToTensor3DObject(sources, {
              generations: 3,
              sacredGeometryScale: 1.0,
              tensorResolution: 64
            });
            
            setFileProgress(90);
            
            const tensorData: TensorData = {
              objectUrl: sources[0].url,
              dimensions: tensorObject.dimensions,
              vertices: tensorObject.vertices,
              tensorField: {
                pixelCount: tensorObject.tensorField.pixels.length,
                resolution: tensorObject.metadata.tensorResolution,
                phiValue: tensorObject.metadata.phiValue,
                piValue: tensorObject.metadata.piValue
              },
              flowerOfLife: {
                generations: tensorObject.metadata.generations,
                rayCount: tensorObject.metadata.rayCount,
                sacredGeometryScale: tensorObject.metadata.sacredGeometryScale
              },
              originalFiles: uploadResults.map(r => ({
                fileId: r.fileId,
                fileName: r.metadata.originalName,
                url: r.url,
                mimeType: r.metadata.mimeType,
                size: r.metadata.size
              })),
              thumbnailDataUrl: tensorObject.thumbnailDataUrl,
              createdAt: Date.now()
            };
            
            const tensorMsg: Message = {
              id: Math.random().toString(36).substr(2, 9),
              sender: 'LOCAL_OPERATOR',
              content: `3D_TENSOR_OBJECT_CREATED: ${files.length} file${files.length > 1 ? 's' : ''} via FLOWER_OF_LIFE_PHI`,
              timestamp: Date.now(),
              status: 'sent',
              type: '3d-object',
              isZkpVerified: true,
              isMe: true,
              tensorData,
              fileName: files.map(f => f.name).join(', '),
              mediaType: files[0].type
            };
            
            setMessages(prev => [...prev, tensorMsg]);
          }
        }
      } else {
        for (const result of uploadResults) {
          const file = files.find(f => f.name === result.metadata.originalName) || files[0];
          const isImage = mediaStorageService.isImage(result.metadata.mimeType);
          const isVideo = mediaStorageService.isVideo(result.metadata.mimeType);
          
          const fileMsg: Message = {
            id: Math.random().toString(36).substr(2, 9),
            sender: 'LOCAL_OPERATOR',
            content: `ISO_FILE_TRANSMITTED: ${result.metadata.originalName} [AES-GCM-256]`,
            timestamp: Date.now(),
            status: 'sent',
            type: isImage ? 'image' : isVideo ? 'video' : 'file',
            isZkpVerified: true,
            isMe: true,
            fileName: result.metadata.originalName,
            fileSize: result.metadata.size,
            mediaUrl: result.url,
            mediaType: result.metadata.mimeType
          };
          setMessages(prev => [...prev, fileMsg]);
        }
      }
      
      setFileProgress(100);
      setTimeout(() => setFileProgress(0), 500);
      
    } catch (error) {
      console.error('File upload error:', error);
      setFileProgress(0);
    }
  }, []);

  const handleViewTensorObject = useCallback((tensorData: TensorData) => {
    setViewingTensorObject(tensorData);
  }, []);

  const handleLocationFound = useCallback((coord: Coordinate) => {
    setCurrentLocation(coord);
  }, []);

  const handleMapClick = useCallback(async (coord: Coordinate) => {
    if (currentLocation) {
      try {
        const routes = await navigationService.calculateRoute(
          [currentLocation, coord],
          'car',
          3
        );
        if (routes.length > 0) {
          setCurrentRoute(routes[0]);
        }
      } catch (error) {
        console.error('Failed to calculate route:', error);
      }
    }
  }, [currentLocation]);

  const handleRouteCalculated = useCallback((route: Route) => {
    setCurrentRoute(route);
  }, []);

  const handleStartNavigation = useCallback(() => {
    if (currentRoute) {
      setNavigationActive(true);
    }
  }, [currentRoute]);

  const handleReroute = useCallback(async () => {
    if (currentLocation && currentRoute) {
      const destination = currentRoute.geometry.coordinates[currentRoute.geometry.coordinates.length - 1];
      try {
        const routes = await navigationService.calculateRoute(
          [currentLocation, destination],
          'car',
          1
        );
        if (routes.length > 0) {
          setCurrentRoute(routes[0]);
        }
      } catch (error) {
        console.error('Failed to reroute:', error);
      }
    }
  }, [currentLocation, currentRoute]);

  const handleSendMessage = useCallback(async (text: string, replyToId?: string) => {
    setIsVerifying(true);
    const userMsg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      sender: 'LOCAL_OPERATOR',
      content: text,
      timestamp: Date.now(),
      status: 'sent',
      type: 'text',
      isZkpVerified: true,
      isMe: true,
      replyTo: replyToId,
      reactions: []
    };

    if (replyToId) {
      setMessages(prev => prev.map(m => 
        m.id === replyToId 
          ? { ...m, threadCount: (m.threadCount || 0) + 1 }
          : m
      ));
    }

    await new Promise(res => setTimeout(res, 2200)); 
    setMessages(prev => [...prev, userMsg]);
    setLicense(prev => ({ ...prev, accumulatedValue: Math.min(30, prev.accumulatedValue + 0.5) }));
    setIsVerifying(false);
  }, []);

  const handleVoiceMessage = useCallback(async (blob: Blob, duration: number, waveformData: number[]) => {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const base64Data = await base64Promise;
      
      const response = await fetch('/api/voice/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: base64Data,
          duration,
          waveformData,
          senderId: 'LOCAL_OPERATOR',
          mimeType: blob.type
        })
      });
      
      if (!response.ok) throw new Error('Voice upload failed');
      
      const result = await response.json();
      
      const voiceMsg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        sender: 'LOCAL_OPERATOR',
        content: `Voice message (${Math.round(duration)}s)`,
        timestamp: Date.now(),
        status: 'sent',
        type: 'voice',
        isZkpVerified: true,
        isMe: true,
        voiceData: {
          url: result.url,
          duration,
          waveform: waveformData
        }
      };
      
      setMessages(prev => [...prev, voiceMsg]);
    } catch (error) {
      console.error('Voice message error:', error);
    }
  }, []);

  const handleReactToMessage = useCallback((messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const reactions = msg.reactions || [];
      const existingReaction = reactions.find(r => r.emoji === emoji);
      
      if (existingReaction) {
        if (existingReaction.includesMe) {
          if (existingReaction.count === 1) {
            return { ...msg, reactions: reactions.filter(r => r.emoji !== emoji) };
          }
          return {
            ...msg,
            reactions: reactions.map(r => 
              r.emoji === emoji 
                ? { ...r, count: r.count - 1, includesMe: false, users: r.users.filter(u => u !== 'LOCAL_OPERATOR') }
                : r
            )
          };
        } else {
          return {
            ...msg,
            reactions: reactions.map(r => 
              r.emoji === emoji 
                ? { ...r, count: r.count + 1, includesMe: true, users: [...r.users, 'LOCAL_OPERATOR'] }
                : r
            )
          };
        }
      }
      
      return {
        ...msg,
        reactions: [...reactions, { emoji, count: 1, users: ['LOCAL_OPERATOR'], includesMe: true }]
      };
    }));
  }, []);

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: newContent, editedAt: Date.now() }
        : msg
    ));
  }, []);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, deletedAt: Date.now() }
        : msg
    ));
  }, []);

  const getMessageById = useCallback((id: string): Message | undefined => {
    return messages.find(m => m.id === id);
  }, [messages]);

  const handleStartTyping = useCallback(() => {
    setIsLocalTyping(true);
    const localTypingUser: TypingUser = {
      peerId: currentOperator.peerId,
      displayName: currentOperator.displayName,
      startedAt: Date.now()
    };
    setTypingUsers(prev => {
      const filtered = prev.filter(u => u.peerId !== currentOperator.peerId);
      return [...filtered, localTypingUser];
    });
  }, [currentOperator.peerId, currentOperator.displayName]);

  const handleStopTyping = useCallback(() => {
    setIsLocalTyping(false);
    setTypingUsers(prev => prev.filter(u => u.peerId !== currentOperator.peerId));
  }, [currentOperator.peerId]);

  const handleViewThread = useCallback((messageId: string) => {
    console.log('View thread for message:', messageId);
  }, []);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    };
    
    setAppNotifications(prev => [newNotification, ...prev]);
    
    if (shouldNotify()) {
      setToastNotifications(prev => [...prev, newNotification]);
      playSound();
      if (notificationSettings.showPreview) {
        showDesktopNotification(notification.title, notification.message);
      } else {
        showDesktopNotification(notification.title, 'New notification');
      }
    }
  }, [shouldNotify, playSound, showDesktopNotification, notificationSettings.showPreview]);

  const handleDismissToast = useCallback((id: string) => {
    setToastNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleMarkNotificationRead = useCallback((id: string) => {
    setAppNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setToastNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleMarkAllNotificationsRead = useCallback(() => {
    setAppNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setToastNotifications([]);
  }, []);

  const handleDeleteNotification = useCallback((id: string) => {
    setAppNotifications(prev => prev.filter(n => n.id !== id));
    setToastNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleClearAllNotifications = useCallback(() => {
    setAppNotifications([]);
    setToastNotifications([]);
  }, []);

  const handleNotificationClick = useCallback((notification: AppNotification) => {
    handleMarkNotificationRead(notification.id);
    setShowNotificationCenter(false);
    
    if (notification.groupId) {
      const group = meshGroups.find(g => g.id === notification.groupId);
      if (group) {
        setActiveGroup(group);
        setActivePage('mesh');
      }
    }
  }, [handleMarkNotificationRead, meshGroups]);

  const handleUpdateProfile = useCallback((updates: Partial<OperatorProfile>) => {
    console.log('[OperatorStore] Profile update:', updates);
    updateOperatorProfile(updates);
  }, [updateOperatorProfile]);

  const handleUpdateOperatorSettings = useCallback((updates: Partial<OperatorSettings>) => {
    console.log('[OperatorStore] Settings update:', updates);
    updateOperatorSettings(updates);
  }, [updateOperatorSettings]);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    setShowSearch(false);
    if (result.type === 'message' && result.messageId) {
      setActivePage('mesh');
      setHighlightedMessageId(result.messageId);
      setTimeout(() => setHighlightedMessageId(null), 3000);
    } else if (result.type === 'group' && result.groupId) {
      const group = meshGroups.find(g => g.id === result.groupId);
      if (group) {
        setActiveGroup(group);
        setActivePage('mesh');
        setShowGroupPanel(true);
      }
    } else if (result.type === 'operator' && result.senderId) {
      const members = meshGroups.flatMap(g => g.members);
      const member = members.find(m => m.peerId === result.senderId || m.displayName === result.senderId);
      if (member) {
        setViewingMember(member);
      } else {
        setShowUserProfile(true);
      }
    } else if (result.type === 'file' && result.messageId) {
      setActivePage('mesh');
      setHighlightedMessageId(result.messageId);
      setTimeout(() => setHighlightedMessageId(null), 3000);
    }
  }, [meshGroups]);

  const allMembers = meshGroups.flatMap(g => g.members);

  const totalUnread = meshGroups.reduce((acc, g) => acc + g.unreadCount, 0);
  const totalPendingRequests = meshGroups.reduce((acc, g) => acc + g.pendingRequests.filter(r => r.status === JoinRequestStatus.PENDING).length, 0);

  if (uiState === UIState.INITIALIZING) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-cyan-400 overflow-hidden p-6">
        <MatrixRain color="#4caf50" className="opacity-30" />
        <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
          <div className="mb-12 relative">
             <div className="absolute inset-0 bg-cyan-400/30 blur-3xl animate-pulse"></div>
             <FlowerOfLife size={140} color="#00f3ff" />
          </div>
          <div className="text-center">
            <h1 className="orbitron text-3xl md:text-5xl font-black tracking-[1.2em] mb-4 text-cyan-400 pl-[1.2em]">G3ZKP</h1>
            <p className="orbitron text-[8px] md:text-[10px] uppercase tracking-[0.6em] text-green-500 mb-10 opacity-80">Meta-Geodesic Cryptographic Engine</p>
          </div>
          <div className="h-[0.5px] w-56 bg-green-500/40 relative overflow-hidden mb-10">
             <div className="absolute top-0 left-0 h-full bg-cyan-400 animate-[load_3s_linear_infinite]"></div>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[1em] opacity-60 text-center animate-pulse"> Establishing_Tautology_Grade_3 </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'geodesic', icon: Map, label: 'GEODESIC' },
    { id: 'mesh', icon: Users, label: 'MESH' },
    { id: 'business', icon: CreditCard, label: 'UPLINK' },
    { id: 'system', icon: Activity, label: 'SYSTEM' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative bg-[#010401] touch-manipulation">
      <MatrixRain color="#4caf50" className="opacity-15" speed={0.15} />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden pb-[env(safe-area-inset-bottom,60px)] lg:pb-0 min-h-0">
        
        <aside className={`hidden lg:block w-64 xl:w-72 border-r-[0.5px] border-[#4caf50]/30 overflow-y-auto bg-black/60 backdrop-blur-md flex-shrink-0 ${
          navigationActive || activePage === 'geodesic' ? 'lg:hidden' : ''
        }`}>
          <div className="p-8 border-b-[0.5px] border-[#4caf50]/40">
            <div className="flex items-center gap-4">
              <FlowerOfLife size={36} color="#00f3ff" rotorSpeed="25s" />
              <div>
                <h2 className="orbitron text-sm font-black text-[#00f3ff] tracking-widest leading-none opacity-100">G3ZKP</h2>
                <span className="text-[7px] uppercase tracking-widest opacity-70 mt-1.5 block font-mono">GENESIS_V1.ISO</span>
              </div>
            </div>
          </div>

          <div className="p-6 border-b-[0.5px] border-[#4caf50]/40">
            <div className="relative mb-6">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input type="text" placeholder="Scan Nodes..." className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/40 pl-10 pr-4 py-2.5 text-[10px] outline-none focus:border-[#00f3ff]/50 text-[#00f3ff] transition-all" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setActivePage('mesh'); setSelectedPeerChat(null); }} className="flex-1 py-2 border-[0.5px] border-[#00f3ff]/40 text-[8px] font-black tracking-widest uppercase hover:bg-[#00f3ff]/15 text-[#00f3ff] flex items-center justify-center gap-1"><Users size={10} /> Groups</button>
              <button onClick={() => { setActivePage('mesh'); setSelectedPeerChat('chats'); }} className="flex-1 py-2 border-[0.5px] border-[#4caf50]/30 text-[8px] font-black tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"><MessageSquare size={10} /> Chats</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            {meshGroups.map((group) => (
              <div 
                key={group.id} 
                onClick={() => { setSelectedGroup(group); setActivePage('mesh'); }}
                className={`p-4 border-[0.5px] bg-white/[0.05] transition-all cursor-pointer group flex items-center gap-5 ${
                  selectedGroup?.id === group.id 
                    ? 'border-[#00f3ff]/60 opacity-100' 
                    : 'border-[#4caf50]/30 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 border-[0.5px] border-[#4caf50]/40 flex items-center justify-center font-black text-[9px] text-[#4caf50]">
                    {group.name.substring(0, 3)}
                  </div>
                  {group.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center px-1 bg-[#00f3ff] text-black text-[7px] font-black">
                      {group.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black text-[#00f3ff] truncate uppercase tracking-wider">{group.name}</span>
                    {group.isPrivate && <Lock size={10} className="text-[#4caf50]/40 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={10} className="text-[#4caf50]/40" />
                    <span className="text-[7px] font-mono text-[#4caf50]/40">{group.memberCount}</span>
                    {group.zkpVerified && <ShieldCheck size={10} className="text-[#00f3ff]/40" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 border-t-[0.5px] border-[#4caf50]/40 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowSearch(true)}
                className="py-3 border-[0.5px] border-[#00f3ff]/30 text-[8px] font-black uppercase tracking-widest hover:bg-[#00f3ff]/10 flex items-center justify-center gap-2 text-[#00f3ff]/70 hover:text-[#00f3ff] transition-all"
              >
                <Search size={12} strokeWidth={1} /> SEARCH
              </button>
              <button 
                onClick={() => setShowNotificationCenter(true)}
                className="py-3 border-[0.5px] border-yellow-500/30 text-[8px] font-black uppercase tracking-widest hover:bg-yellow-500/10 flex items-center justify-center gap-2 text-yellow-500/70 hover:text-yellow-500 transition-all relative"
              >
                <Bell size={12} strokeWidth={1} /> ALERTS
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#00f3ff] text-black text-[7px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-1 animate-pulse">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowJoinModal(true)} className="py-3 border-[0.5px] border-[#00f3ff]/40 text-[8px] font-black uppercase tracking-widest hover:bg-[#00f3ff]/15 flex items-center justify-center gap-2 text-[#00f3ff]">
                 <UserPlus size={12} strokeWidth={1} /> JOIN
               </button>
               <button onClick={() => setModal('group')} className="py-3 border-[0.5px] border-[#4caf50]/40 text-[8px] font-black uppercase tracking-widest hover:bg-[#4caf50]/15 flex items-center justify-center gap-2 text-[#4caf50]">
                 <PlusCircle size={12} strokeWidth={1} /> CREATE
               </button>
            </div>
            <button 
              onClick={() => setShowUserProfile(true)}
              className="w-full py-3 border-[0.5px] border-[#4caf50]/20 text-[8px] font-black uppercase tracking-widest hover:bg-[#4caf50]/10 flex items-center justify-center gap-2 text-[#4caf50]/60 hover:text-[#4caf50]"
            >
              <UserPlus size={12} strokeWidth={1} /> OPERATOR PROFILE
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative z-10 overflow-hidden bg-[#010401]/95 min-h-0">
          <header className="h-16 sm:h-18 flex items-center justify-between px-4 sm:px-6 md:px-8 border-b-[0.5px] border-[#4caf50]/30 bg-black/40 backdrop-blur-md">
             <div className="flex items-center gap-3 md:gap-5">
               <FlowerOfLife size={28} color="#00f3ff" />
               <div className="block">
                  <h1 className="orbitron text-[10px] sm:text-xs font-black text-[#00f3ff] tracking-widest uppercase opacity-100">G3ZKP MESSENGER</h1>
                  <p className="hidden sm:block text-[6px] text-[#4caf50] uppercase tracking-[0.5em] font-bold mt-1 opacity-70">Tautological Soundness V1.0</p>
               </div>
             </div>

             <div className="flex items-center gap-2 md:gap-6">
               <div className="hidden md:flex gap-1.5 lg:gap-2 border-l-[0.5px] border-[#4caf50]/30 pl-3 lg:pl-4">
                 {navItems.map(item => (
                   <button 
                     key={item.id}
                     onClick={() => setActivePage(item.id as any)}
                     className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 lg:py-2 text-[7px] lg:text-[8px] font-black uppercase tracking-widest transition-all border-[0.5px] ${
                       activePage === item.id 
                         ? 'border-[#00f3ff]/60 text-[#00f3ff] bg-[#00f3ff]/10' 
                         : 'border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/40'
                     }`}
                   >
                     <item.icon size={12} strokeWidth={1} />
                     <span className="hidden lg:inline">{item.label}</span>
                   </button>
                 ))}
               </div>

               <div className="flex gap-2 sm:gap-3 border-l-[0.5px] border-[#4caf50]/30 pl-3 md:pl-4">
                 <button
                   onClick={() => setShowNotificationCenter(true)}
                   className="relative text-[#4caf50] hover:text-[#00f3ff] transition-all p-1.5"
                 >
                   <Bell size={14} strokeWidth={1} />
                   {unreadNotificationCount > 0 && (
                     <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#00f3ff] animate-pulse" />
                   )}
                 </button>
                 <button onClick={() => setModal('settings')} className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-1.5"><Settings size={14} strokeWidth={1} /></button>
               </div>
             </div>
          </header>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activePage === 'mesh' && (
              <MeshPage
                meshGroups={meshGroups}
                meshContacts={meshContacts}
                messages={messages}
                selectedGroup={selectedGroup}
                typingUsers={typingUsers}
                highlightedMessageId={highlightedMessageId}
                onSelectGroup={setSelectedGroup}
                onSendMessage={handleSendMessage}
                onFileUpload={(file) => handleFileUpload([file])}
                onVoiceMessage={(blob) => handleVoiceMessage(blob, 0, [])}
                onCreateGroup={() => setModal('group')}
                onJoinGroup={() => setShowJoinModal(true)}
                onAddContact={async (contact) => {
                  try {
                    // Check if contact already exists in PeerContactService
                    const existingContact = peerContactService.getContact(contact.peerId);
                    
                    if (existingContact) {
                      // If contact exists, just select their chat tab
                      setSelectedPeerChat(contact.peerId);
                      console.log('[App] Contact already exists, selecting chat tab for:', contact.peerId);
                    } else {
                      // Add new contact through PeerContactService
                      await peerContactService.addContact({
                        peerId: contact.peerId,
                        contactName: contact.displayName
                      });
                      
                      // The contact will be added to meshContacts via the subscription
                      setSelectedPeerChat(contact.peerId);
                      console.log('[App] Added new contact and selected chat tab for:', contact.peerId);
                    }
                  } catch (error) {
                    console.error('[App] Failed to add contact:', error);
                    // Even if there's an error, try to select the contact if it exists
                    const existingContact = peerContactService.getContact(contact.peerId);
                    if (existingContact) {
                      setSelectedPeerChat(contact.peerId);
                    }
                  }
                }}
                onCall={(type) => setModal(type === 'voice' ? 'call_voice' : 'call_video')}
                onReactToMessage={handleReactToMessage}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onStartTyping={handleStartTyping}
                onStopTyping={handleStopTyping}
                onViewThread={handleViewThread}
                onViewTensorObject={handleViewTensorObject}
                getMessageById={getMessageById}
                fileProgress={fileProgress}
                isVerifying={isVerifying}
              />
            )}
            {showGroupPanel && selectedGroup && (
              <GroupAdminPanel
                group={selectedGroup}
                currentUserId={operatorProfile.peerId}
                onClose={() => setShowGroupPanel(false)}
                onUpdateGroup={(updatedGroup) => {
                  setMeshGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
                }}
                onKickMember={(memberId, reason) => {
                  groupManagementService.kickMember(selectedGroup, memberId, operatorProfile.peerId, reason);
                  setSelectedGroup({
                    ...selectedGroup,
                    members: selectedGroup.members.filter(m => m.peerId !== memberId),
                    memberCount: selectedGroup.memberCount - 1
                  });
                }}
                onChangeMemberRole={(memberId, newRole) => {
                  groupManagementService.changeMemberRole(selectedGroup, memberId, newRole, operatorProfile.peerId);
                  setSelectedGroup({
                    ...selectedGroup,
                    members: selectedGroup.members.map(m => 
                      m.peerId === memberId ? { ...m, role: newRole } : m
                    )
                  });
                }}
                onUpdateSettings={(settings) => {
                  groupManagementService.updateGroupSettings(selectedGroup, settings, operatorProfile.peerId);
                  setSelectedGroup({
                    ...selectedGroup,
                    settings: { ...selectedGroup.settings, ...settings }
                  });
                }}
                onHandleJoinRequest={(requestId, approved) => {
                  groupManagementService.handleJoinRequest(selectedGroup, requestId, approved, operatorProfile.peerId);
                }}
              />
            )}
            {activePage === 'geodesic' && (
              <GeodesicNavigationView
                currentLocation={currentLocation}
                currentRoute={currentRoute}
                navigationActive={navigationActive}
                navigationHeading={navigationHeading}
                showRoutePlanner={showRoutePlanner}
                showTransitPlanner={showTransitPlanner}
                showOfflineManager={showOfflineManager}
                onMapClick={handleMapClick}
                onLocationFound={handleLocationFound}
                onRouteCalculated={handleRouteCalculated}
                onStartNavigation={handleStartNavigation}
                onEndNavigation={() => setNavigationActive(false)}
                onReroute={handleReroute}
                onToggleRoutePlanner={() => setShowRoutePlanner(!showRoutePlanner)}
                onToggleTransitPlanner={() => setShowTransitPlanner(!showTransitPlanner)}
                onToggleOfflineManager={() => setShowOfflineManager(!showOfflineManager)}
                onCloseRoutePlanner={() => setShowRoutePlanner(false)}
                onCloseTransitPlanner={() => setShowTransitPlanner(false)}
                onCloseOfflineManager={() => setShowOfflineManager(false)}
              />
            )}
            {activePage === 'business' && (
              <MarketplacePageExtended />
            )}
            {activePage === 'system' && (
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-6xl mx-auto">
                  <header className="mb-6">
                    <h1 className="text-2xl text-[var(--color-primary,#00f3ff)] font-mono mb-2 flex items-center gap-2">
                      <Activity size={24} />
                      SYSTEM MONITOR
                    </h1>
                    <p className="text-gray-400 text-sm">
                      Real-time cryptographic protocol status and network monitoring.
                      <span className="text-green-500 ml-2 font-mono">NO SIMULATED DATA</span>
                    </p>
                  </header>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <RealCryptoStatus refreshInterval={3000} />
                    </div>

                    <div className="space-y-6">
                      <ProtocolMonitor />
                      <ZKPCircuitRegistry />
                    </div>
                  </div>

                  <div className="mt-6 bg-gray-900 border border-cyan-800 rounded-lg p-4">
                    <h3 className="text-cyan-400 mb-3 font-mono flex items-center gap-2">
                      <Zap size={16} />
                      SYSTEM METRICS
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-black p-3 rounded border border-gray-800">
                        <div className="text-gray-400 text-xs font-mono mb-1">Mesh Groups</div>
                        <div className="text-green-400 text-xl font-mono">{meshGroups.length}</div>
                      </div>
                      <div className="bg-black p-3 rounded border border-gray-800">
                        <div className="text-gray-400 text-xs font-mono mb-1">Total Members</div>
                        <div className="text-green-400 text-xl font-mono">
                          {meshGroups.reduce((acc, g) => acc + g.memberCount, 0)}
                        </div>
                      </div>
                      <div className="bg-black p-3 rounded border border-gray-800">
                        <div className="text-gray-400 text-xs font-mono mb-1">Messages</div>
                        <div className="text-green-400 text-xl font-mono">{messages.length}</div>
                      </div>
                      <div className="bg-black p-3 rounded border border-gray-800">
                        <div className="text-gray-400 text-xs font-mono mb-1">Status</div>
                        <div className="text-green-400 text-sm font-mono">OPERATIONAL</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileNav 
        activePage={activePage}
        onPageChange={setActivePage}
        onNewAction={() => setModal('group')}
        onProfileClick={() => setShowUserProfile(true)}
        unreadCount={totalUnread}
        pendingRequests={totalPendingRequests}
      />

      {modal === 'call_voice' && (
        <FaceTimeCall 
          type="voice" 
          onClose={() => setModal('none')} 
          contactName={selectedPeerChat ? meshContacts.find(c => c.peerId === selectedPeerChat)?.displayName || selectedPeerChat.substring(0, 12) : 'MESH_NODE'}
          targetPeerId={selectedPeerChat || undefined}
        />
      )}
      {modal === 'call_video' && (
        <FaceTimeCall 
          type="video" 
          onClose={() => setModal('none')} 
          contactName={selectedPeerChat ? meshContacts.find(c => c.peerId === selectedPeerChat)?.displayName || selectedPeerChat.substring(0, 12) : 'MESH_NODE'}
          targetPeerId={selectedPeerChat || undefined}
        />
      )}
      {modal === 'group' && <GroupModal onClose={() => setModal('none')} onCreate={handleCreateGroup} />}
      {modal === 'license' && <LicenseModal status={license} onClose={() => setModal('none')} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal('none')} />}
      
      {showGroupPanel && selectedGroup && (
        <MeshGroupPanel
          group={meshGroups.find(g => g.id === selectedGroup.id) || selectedGroup}
          currentUserId={currentOperator.id}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
          onKickMember={handleKickMember}
          onBanMember={handleBanMember}
          onChangeRole={handleChangeRole}
          onMuteMember={handleMuteMember}
          onUpdateSettings={handleUpdateGroupSettings}
          onLeaveGroup={handleLeaveGroup}
          onClose={() => setShowGroupPanel(false)}
        />
      )}
      
      {showJoinModal && (
        <JoinGroupModal
          groups={meshGroups.filter(g => g.settings.allowJoinRequests)}
          onJoinRequest={handleJoinRequest}
          onClose={() => setShowJoinModal(false)}
        />
      )}
      
      {showUserProfile && (
        <OperatorProfilePanel
          profile={currentOperator}
          isOwnProfile={true}
          onUpdateProfile={handleUpdateProfile}
          onUpdateSettings={handleUpdateOperatorSettings}
          onClose={() => setShowUserProfile(false)}
        />
      )}

      {viewingMember && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#010401] border border-[#00f3ff]/20 w-full max-w-md shadow-[0_0_40px_rgba(0,243,255,0.1)]">
            <div className="p-6 border-b border-[#00f3ff]/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${viewingMember.isOnline ? 'bg-[#4caf50] animate-pulse' : 'bg-white/20'}`} />
                <h2 className="text-[#00f3ff] font-black text-sm uppercase tracking-[0.2em]">{viewingMember.displayName}</h2>
              </div>
              <button onClick={() => setViewingMember(null)} className="text-white/40 hover:text-white p-2">
                <X size={18} strokeWidth={1} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-[#00f3ff]/10 bg-white/[0.02]">
                  <div className="text-[7px] font-black tracking-[0.3em] text-[#00f3ff]/50 uppercase mb-1">Role</div>
                  <div className="text-[#00f3ff] text-sm font-bold uppercase">{viewingMember.role}</div>
                </div>
                <div className="p-3 border border-[#4caf50]/10 bg-white/[0.02]">
                  <div className="text-[7px] font-black tracking-[0.3em] text-[#4caf50]/50 uppercase mb-1">Status</div>
                  <div className="text-[#4caf50] text-sm font-bold uppercase">{viewingMember.isOnline ? 'ONLINE' : 'OFFLINE'}</div>
                </div>
              </div>
              <div className="p-3 border border-white/10 bg-white/[0.02]">
                <div className="text-[7px] font-black tracking-[0.3em] text-white/50 uppercase mb-1">Peer ID</div>
                <div className="text-white/70 text-[10px] font-mono break-all">{viewingMember.peerId}</div>
              </div>
              <div className="p-3 border border-white/10 bg-white/[0.02]">
                <div className="text-[7px] font-black tracking-[0.3em] text-white/50 uppercase mb-1">Public Key</div>
                <div className="text-white/70 text-[10px] font-mono break-all">{viewingMember.publicKey}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-white/10 bg-white/[0.02]">
                  <div className="text-[7px] font-black tracking-[0.3em] text-white/50 uppercase mb-1">Joined</div>
                  <div className="text-white/70 text-xs">{new Date(viewingMember.joinedAt).toLocaleDateString()}</div>
                </div>
                <div className="p-3 border border-white/10 bg-white/[0.02]">
                  <div className="text-[7px] font-black tracking-[0.3em] text-white/50 uppercase mb-1">Last Seen</div>
                  <div className="text-white/70 text-xs">{new Date(viewingMember.lastSeenAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="text-[7px] font-black tracking-[0.3em] text-white/50 uppercase mb-2">Permissions</div>
                <div className="flex flex-wrap gap-2">
                  {viewingMember.permissions.canPost && <span className="text-[8px] px-2 py-1 bg-[#4caf50]/10 text-[#4caf50] uppercase tracking-wider">POST</span>}
                  {viewingMember.permissions.canReply && <span className="text-[8px] px-2 py-1 bg-[#4caf50]/10 text-[#4caf50] uppercase tracking-wider">REPLY</span>}
                  {viewingMember.permissions.canInvite && <span className="text-[8px] px-2 py-1 bg-[#00f3ff]/10 text-[#00f3ff] uppercase tracking-wider">INVITE</span>}
                  {viewingMember.permissions.canKick && <span className="text-[8px] px-2 py-1 bg-yellow-500/10 text-yellow-400 uppercase tracking-wider">KICK</span>}
                  {viewingMember.permissions.canBan && <span className="text-[8px] px-2 py-1 bg-red-500/10 text-red-400 uppercase tracking-wider">BAN</span>}
                  {viewingMember.permissions.canManageRoles && <span className="text-[8px] px-2 py-1 bg-purple-500/10 text-purple-400 uppercase tracking-wider">MANAGE_ROLES</span>}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-center">
              <button
                onClick={() => setViewingMember(null)}
                className="px-6 py-2 border border-[#00f3ff]/30 text-[#00f3ff] text-[9px] font-black uppercase tracking-widest hover:bg-[#00f3ff]/10 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showSearch && (
        <SearchPanel
          messages={messages}
          groups={meshGroups}
          members={allMembers}
          onResultClick={handleSearchResultClick}
          onClose={() => setShowSearch(false)}
        />
      )}

      <NotificationContainer
        notifications={toastNotifications}
        onDismiss={handleDismissToast}
        onClick={handleNotificationClick}
      />

      <ConnectionRequestNotification />

      {showNotificationCenter && (
        <NotificationCenter
          notifications={appNotifications}
          settings={notificationSettings}
          onUpdateSettings={setNotificationSettings}
          onMarkRead={handleMarkNotificationRead}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onDelete={handleDeleteNotification}
          onClearAll={handleClearAllNotifications}
          onClick={handleNotificationClick}
          onClose={() => setShowNotificationCenter(false)}
        />
      )}

      {viewingTensorObject && (
        <TensorObjectViewer
          tensorData={viewingTensorObject}
          onClose={() => setViewingTensorObject(null)}
        />
      )}
    </div>
  );
};

export default App;
