import { G3TZKPBusinessProfile, BusinessHoursWeek, BusinessHours } from '../types/business';
import { CallSession, BusinessCallAvailability } from '../types/peer';
import { businessProfileService } from './BusinessProfileService';

type CallEventHandler = (session: CallSession) => void;

class BusinessCallingService {
  private activeCalls: Map<string, CallSession> = new Map();
  private callHistory: CallSession[] = [];
  private incomingCallHandlers: Set<CallEventHandler> = new Set();
  private callEndedHandlers: Set<CallEventHandler> = new Set();
  private storageKey = 'g3tzkp-call-history';

  async initialize(): Promise<void> {
    await this.loadCallHistory();
  }

  checkBusinessAvailability(profile: G3TZKPBusinessProfile): BusinessCallAvailability {
    if (!profile.acceptsCallsDuringHours) {
      return { isOpen: false };
    }

    if (!profile.hours) {
      return { isOpen: true };
    }

    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' }) as keyof BusinessHoursWeek;
    const todayHours = profile.hours[dayOfWeek];

    if (!todayHours) {
      return { 
        isOpen: false,
        nextOpenTime: this.getNextOpenTime(profile.hours, now)
      };
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMin] = todayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = todayHours.close.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    if (currentTime >= openTime && currentTime < closeTime) {
      const closeMsToday = new Date(now);
      closeMsToday.setHours(closeHour, closeMin, 0, 0);
      
      return {
        isOpen: true,
        nextCloseTime: closeMsToday.getTime()
      };
    }

    if (currentTime < openTime) {
      const openMsToday = new Date(now);
      openMsToday.setHours(openHour, openMin, 0, 0);
      
      return {
        isOpen: false,
        nextOpenTime: openMsToday.getTime()
      };
    }

    return {
      isOpen: false,
      nextOpenTime: this.getNextOpenTime(profile.hours, now)
    };
  }

  private getNextOpenTime(hours: BusinessHoursWeek, fromDate: Date): number | undefined {
    const daysOrder: (keyof BusinessHoursWeek)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const currentDay = fromDate.toLocaleDateString('en-US', { weekday: 'lowercase' }) as keyof BusinessHoursWeek;
    const currentDayIndex = daysOrder.indexOf(currentDay);

    for (let i = 1; i <= 7; i++) {
      const nextDayIndex = (currentDayIndex + i) % 7;
      const nextDay = daysOrder[nextDayIndex];
      const nextDayHours = hours[nextDay];

      if (nextDayHours) {
        const [openHour, openMin] = nextDayHours.open.split(':').map(Number);
        const nextOpenDate = new Date(fromDate);
        nextOpenDate.setDate(nextOpenDate.getDate() + i);
        nextOpenDate.setHours(openHour, openMin, 0, 0);
        return nextOpenDate.getTime();
      }
    }

    return undefined;
  }

  async initiateCallToBusiness(
    businessId: string,
    callerId: string,
    callerName: string,
    isVideoCall: boolean = false
  ): Promise<CallSession | null> {
    const business = await businessProfileService.getBusinessProfileById(businessId);
    
    if (!business) {
      throw new Error('Business not found');
    }

    const availability = this.checkBusinessAvailability(business);
    
    if (!availability.isOpen) {
      const nextOpen = availability.nextOpenTime;
      const nextOpenStr = nextOpen ? new Date(nextOpen).toLocaleString() : 'unknown';
      throw new Error(`Business is currently closed. Next open time: ${nextOpenStr}`);
    }

    const sessionId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: CallSession = {
      sessionId,
      callerId,
      callerName,
      recipientId: business.peerId,
      recipientName: business.name,
      startTime: Date.now(),
      status: 'ringing',
      isVideocall: isVideoCall
    };

    this.activeCalls.set(sessionId, session);
    
    await this.sendCallSignal(session, 'CALL_OFFER');

    return session;
  }

  async acceptCall(sessionId: string): Promise<void> {
    const session = this.activeCalls.get(sessionId);
    if (!session) {
      throw new Error('Call session not found');
    }

    session.status = 'active';
    await this.sendCallSignal(session, 'CALL_ACCEPT');
  }

  async rejectCall(sessionId: string): Promise<void> {
    const session = this.activeCalls.get(sessionId);
    if (!session) {
      throw new Error('Call session not found');
    }

    session.status = 'rejected';
    session.endTime = Date.now();
    await this.sendCallSignal(session, 'CALL_REJECT');
    
    this.activeCalls.delete(sessionId);
    this.callHistory.push(session);
    await this.saveCallHistory();
    this.notifyCallEnded(session);
  }

  async endCall(sessionId: string): Promise<void> {
    const session = this.activeCalls.get(sessionId);
    if (!session) {
      throw new Error('Call session not found');
    }

    session.status = 'ended';
    session.endTime = Date.now();
    await this.sendCallSignal(session, 'CALL_END');
    
    this.activeCalls.delete(sessionId);
    this.callHistory.push(session);
    await this.saveCallHistory();
    this.notifyCallEnded(session);
  }

  handleIncomingCallSignal(from: string, signalData: any): void {
    const { type, session } = signalData;

    switch (type) {
      case 'CALL_OFFER':
        this.activeCalls.set(session.sessionId, session);
        this.notifyIncomingCall(session);
        break;
      
      case 'CALL_ACCEPT':
        const activeSession = this.activeCalls.get(session.sessionId);
        if (activeSession) {
          activeSession.status = 'active';
        }
        break;
      
      case 'CALL_REJECT':
      case 'CALL_END':
        const endedSession = this.activeCalls.get(session.sessionId);
        if (endedSession) {
          endedSession.status = session.status;
          endedSession.endTime = session.endTime;
          this.activeCalls.delete(session.sessionId);
          this.callHistory.push(endedSession);
          this.saveCallHistory();
          this.notifyCallEnded(endedSession);
        }
        break;
    }
  }

  getActiveCall(sessionId: string): CallSession | undefined {
    return this.activeCalls.get(sessionId);
  }

  getAllActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values());
  }

  getCallHistory(limit: number = 50): CallSession[] {
    return this.callHistory
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  onIncomingCall(handler: CallEventHandler): () => void {
    this.incomingCallHandlers.add(handler);
    return () => this.incomingCallHandlers.delete(handler);
  }

  onCallEnded(handler: CallEventHandler): () => void {
    this.callEndedHandlers.add(handler);
    return () => this.callEndedHandlers.delete(handler);
  }

  private async sendCallSignal(session: CallSession, type: string): Promise<void> {
    try {
      const { g3tzkpService } = await import('./G3TZKPService');
      
      const signalMessage = {
        type,
        session,
        timestamp: Date.now()
      };

      const recipientId = session.callerId === session.recipientId ? session.callerId : session.recipientId;
      await g3tzkpService.sendMessage(recipientId, JSON.stringify(signalMessage), 'TEXT');
    } catch (error) {
      console.error('Failed to send call signal:', error);
    }
  }

  private notifyIncomingCall(session: CallSession): void {
    this.incomingCallHandlers.forEach(handler => handler(session));
  }

  private notifyCallEnded(session: CallSession): void {
    this.callEndedHandlers.forEach(handler => handler(session));
  }

  private async loadCallHistory(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.callHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load call history:', error);
      this.callHistory = [];
    }
  }

  private async saveCallHistory(): Promise<void> {
    try {
      const recentHistory = this.callHistory.slice(0, 100);
      localStorage.setItem(this.storageKey, JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Failed to save call history:', error);
    }
  }
}

export const businessCallingService = new BusinessCallingService();
