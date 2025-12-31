import { MeshGroup, MeshGroupMember, MeshGroupRole, JoinRequest, JoinRequestStatus, MeshGroupSettings, MeshGroupPermissions, DEFAULT_GROUP_SETTINGS, DEFAULT_PERMISSIONS } from '../types';

interface InviteLink {
  code: string;
  groupId: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null;
  maxUses: number | null;
  uses: number;
  isActive: boolean;
}

interface GroupManagementEvents {
  onMemberJoined: (groupId: string, member: MeshGroupMember) => void;
  onMemberLeft: (groupId: string, memberId: string) => void;
  onMemberKicked: (groupId: string, memberId: string, reason: string) => void;
  onMemberRoleChanged: (groupId: string, memberId: string, newRole: MeshGroupRole) => void;
  onSettingsChanged: (groupId: string, settings: MeshGroupSettings) => void;
  onInviteLinkCreated: (groupId: string, link: InviteLink) => void;
}

class GroupManagementService {
  private inviteLinks: Map<string, InviteLink> = new Map();
  private eventHandlers: Partial<GroupManagementEvents> = {};
  private localPeerId: string | null = null;

  constructor() {
    this.loadInviteLinks();
  }

  setLocalPeerId(peerId: string) {
    this.localPeerId = peerId;
  }

  on<K extends keyof GroupManagementEvents>(event: K, handler: GroupManagementEvents[K]) {
    this.eventHandlers[event] = handler;
  }

  private loadInviteLinks() {
    try {
      const stored = localStorage.getItem('g3zkp_invite_links');
      if (stored) {
        const links = JSON.parse(stored) as InviteLink[];
        links.forEach(link => {
          if (this.isLinkValid(link)) {
            this.inviteLinks.set(link.code, link);
          }
        });
      }
    } catch (error) {
      console.error('[GroupManagement] Failed to load invite links:', error);
    }
  }

  private saveInviteLinks() {
    try {
      const links = Array.from(this.inviteLinks.values());
      localStorage.setItem('g3zkp_invite_links', JSON.stringify(links));
    } catch (error) {
      console.error('[GroupManagement] Failed to save invite links:', error);
    }
  }

  private isLinkValid(link: InviteLink): boolean {
    if (!link.isActive) return false;
    if (link.expiresAt && Date.now() > link.expiresAt) return false;
    if (link.maxUses && link.uses >= link.maxUses) return false;
    return true;
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createInviteLink(groupId: string, options?: {
    expiresInHours?: number;
    maxUses?: number;
  }): InviteLink {
    const code = this.generateInviteCode();
    const link: InviteLink = {
      code,
      groupId,
      createdBy: this.localPeerId || 'unknown',
      createdAt: Date.now(),
      expiresAt: options?.expiresInHours ? Date.now() + (options.expiresInHours * 60 * 60 * 1000) : null,
      maxUses: options?.maxUses || null,
      uses: 0,
      isActive: true
    };

    this.inviteLinks.set(code, link);
    this.saveInviteLinks();

    console.log('[GroupManagement] Created invite link:', code, 'for group:', groupId);
    this.eventHandlers.onInviteLinkCreated?.(groupId, link);

    return link;
  }

  getInviteLink(code: string): InviteLink | null {
    const link = this.inviteLinks.get(code);
    if (!link || !this.isLinkValid(link)) return null;
    return link;
  }

  getGroupInviteLinks(groupId: string): InviteLink[] {
    return Array.from(this.inviteLinks.values())
      .filter(link => link.groupId === groupId && this.isLinkValid(link));
  }

  revokeInviteLink(code: string): boolean {
    const link = this.inviteLinks.get(code);
    if (!link) return false;
    
    link.isActive = false;
    this.saveInviteLinks();
    console.log('[GroupManagement] Revoked invite link:', code);
    return true;
  }

  useInviteLink(code: string): { success: boolean; groupId?: string; error?: string } {
    const link = this.inviteLinks.get(code);
    
    if (!link) {
      return { success: false, error: 'Invalid invite code' };
    }
    
    if (!this.isLinkValid(link)) {
      return { success: false, error: 'Invite link has expired or reached max uses' };
    }

    link.uses++;
    this.saveInviteLinks();
    
    console.log('[GroupManagement] Used invite link:', code, 'Uses:', link.uses);
    return { success: true, groupId: link.groupId };
  }

  async addMember(group: MeshGroup, member: MeshGroupMember): Promise<{ success: boolean; error?: string }> {
    if (group.members.some(m => m.peerId === member.peerId)) {
      return { success: false, error: 'Member already in group' };
    }

    group.members.push(member);
    group.memberCount = group.members.length;
    
    console.log('[GroupManagement] Added member:', member.peerId, 'to group:', group.id);
    this.eventHandlers.onMemberJoined?.(group.id, member);
    
    return { success: true };
  }

  async removeMember(group: MeshGroup, memberId: string, reason: string = 'Left group'): Promise<{ success: boolean; error?: string }> {
    const memberIndex = group.members.findIndex(m => m.peerId === memberId);
    if (memberIndex === -1) {
      return { success: false, error: 'Member not found in group' };
    }

    const member = group.members[memberIndex];
    if (member.role === MeshGroupRole.OWNER) {
      return { success: false, error: 'Cannot remove group owner' };
    }

    group.members.splice(memberIndex, 1);
    group.memberCount = group.members.length;
    
    console.log('[GroupManagement] Removed member:', memberId, 'from group:', group.id);
    this.eventHandlers.onMemberLeft?.(group.id, memberId);
    
    return { success: true };
  }

  async kickMember(group: MeshGroup, memberId: string, kickedBy: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const kicker = group.members.find(m => m.peerId === kickedBy);
    if (!kicker) {
      return { success: false, error: 'Kicker not found in group' };
    }

    const targetMember = group.members.find(m => m.peerId === memberId);
    if (!targetMember) {
      return { success: false, error: 'Target member not found' };
    }

    if (!this.canKick(kicker.role, targetMember.role)) {
      return { success: false, error: 'Insufficient permissions to kick this member' };
    }

    const result = await this.removeMember(group, memberId, reason);
    if (result.success) {
      this.eventHandlers.onMemberKicked?.(group.id, memberId, reason);
    }
    
    return result;
  }

  async changeMemberRole(group: MeshGroup, memberId: string, newRole: MeshGroupRole, changedBy: string): Promise<{ success: boolean; error?: string }> {
    const changer = group.members.find(m => m.peerId === changedBy);
    if (!changer) {
      return { success: false, error: 'Changer not found in group' };
    }

    const targetMember = group.members.find(m => m.peerId === memberId);
    if (!targetMember) {
      return { success: false, error: 'Target member not found' };
    }

    if (!this.canChangeRole(changer.role, targetMember.role, newRole)) {
      return { success: false, error: 'Insufficient permissions to change role' };
    }

    targetMember.role = newRole;
    targetMember.permissions = DEFAULT_PERMISSIONS[newRole];
    
    console.log('[GroupManagement] Changed role of:', memberId, 'to:', newRole, 'in group:', group.id);
    this.eventHandlers.onMemberRoleChanged?.(group.id, memberId, newRole);
    
    return { success: true };
  }

  async updateGroupSettings(group: MeshGroup, settings: Partial<MeshGroupSettings>, changedBy: string): Promise<{ success: boolean; error?: string }> {
    const changer = group.members.find(m => m.peerId === changedBy);
    if (!changer) {
      return { success: false, error: 'User not found in group' };
    }

    if (changer.role !== MeshGroupRole.OWNER && changer.role !== MeshGroupRole.ADMIN) {
      return { success: false, error: 'Only admins and owners can change settings' };
    }

    group.settings = { ...group.settings, ...settings };
    
    console.log('[GroupManagement] Updated settings for group:', group.id);
    this.eventHandlers.onSettingsChanged?.(group.id, group.settings);
    
    return { success: true };
  }

  async handleJoinRequest(group: MeshGroup, requestId: string, approved: boolean, handledBy: string): Promise<{ success: boolean; error?: string }> {
    const handler = group.members.find(m => m.peerId === handledBy);
    if (!handler) {
      return { success: false, error: 'Handler not found in group' };
    }

    if (handler.role !== MeshGroupRole.OWNER && handler.role !== MeshGroupRole.ADMIN && handler.role !== MeshGroupRole.MODERATOR) {
      return { success: false, error: 'Only admins, moderators, and owners can handle join requests' };
    }

    const requestIndex = group.pendingRequests?.findIndex(r => r.id === requestId);
    if (requestIndex === undefined || requestIndex === -1) {
      return { success: false, error: 'Join request not found' };
    }

    const request = group.pendingRequests[requestIndex];
    request.status = approved ? JoinRequestStatus.APPROVED : JoinRequestStatus.REJECTED;
    request.reviewedBy = handledBy;
    request.reviewedAt = Date.now();

    if (approved) {
      const newMember: MeshGroupMember = {
        id: crypto.randomUUID(),
        peerId: request.requesterId,
        displayName: request.requesterName || `NODE_${request.requesterId.substring(0, 8)}`,
        role: MeshGroupRole.MEMBER,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        permissions: DEFAULT_PERMISSIONS[MeshGroupRole.MEMBER],
        isMuted: false,
        publicKey: request.requesterPublicKey,
        isOnline: true
      };
      await this.addMember(group, newMember);
    }

    console.log('[GroupManagement] Handled join request:', requestId, 'Approved:', approved);
    return { success: true };
  }

  private canKick(kickerRole: MeshGroupRole, targetRole: MeshGroupRole): boolean {
    const roleHierarchy: Record<MeshGroupRole, number> = {
      [MeshGroupRole.OWNER]: 5,
      [MeshGroupRole.ADMIN]: 4,
      [MeshGroupRole.MODERATOR]: 3,
      [MeshGroupRole.MEMBER]: 2,
      [MeshGroupRole.PENDING]: 1,
      [MeshGroupRole.BANNED]: 0
    };
    return roleHierarchy[kickerRole] > roleHierarchy[targetRole];
  }

  private canChangeRole(changerRole: MeshGroupRole, targetCurrentRole: MeshGroupRole, targetNewRole: MeshGroupRole): boolean {
    const roleHierarchy: Record<MeshGroupRole, number> = {
      [MeshGroupRole.OWNER]: 5,
      [MeshGroupRole.ADMIN]: 4,
      [MeshGroupRole.MODERATOR]: 3,
      [MeshGroupRole.MEMBER]: 2,
      [MeshGroupRole.PENDING]: 1,
      [MeshGroupRole.BANNED]: 0
    };
    
    if (changerRole === MeshGroupRole.OWNER) return true;
    if (changerRole === MeshGroupRole.ADMIN) {
      return roleHierarchy[targetCurrentRole] < 4 && roleHierarchy[targetNewRole] < 4;
    }
    return false;
  }

  getDefaultSettings(): MeshGroupSettings {
    return { ...DEFAULT_GROUP_SETTINGS };
  }

  getDefaultPermissions(role: MeshGroupRole): MeshGroupPermissions {
    return { ...DEFAULT_PERMISSIONS[role] };
  }

  formatInviteUrl(code: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://g3zkp.app';
    return `${baseUrl}/join/${code}`;
  }
}

export const groupManagementService = new GroupManagementService();
export default groupManagementService;
