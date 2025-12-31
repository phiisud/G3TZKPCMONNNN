import { v4 as uuidv4 } from 'uuid';

export interface BookingSession {
  id: string;
  startTime: number;
  bookingUrl: string;
  userType: 'operator' | 'standard';
  tunnelId?: string;
  status: 'active' | 'completed' | 'expired' | 'failed';
}

export interface BookingGatewayResponse {
  success: boolean;
  proxiedUrl?: string;
  tunnelId?: string;
  error?: string;
}

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'source', 'origin', 'affiliate', 'partner', 'click_id',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'twclid',
  'mc_cid', 'mc_eid', 'ml_subscriber', 'ml_subscriber_hash',
  '_ga', '_gl', 'srsltid', 'si'
];

const ALLOWED_BOOKING_DOMAINS = [
  'google.com',
  'flights.google.com',
  'www.google.com',
  'skyscanner.com',
  'www.skyscanner.com',
  'kayak.com',
  'www.kayak.com',
  'expedia.com',
  'www.expedia.com',
  'booking.com',
  'www.booking.com',
  'lufthansa.com',
  'www.lufthansa.com',
  'airfrance.com',
  'www.airfrance.com',
  'britishairways.com',
  'www.britishairways.com',
  'klm.com',
  'www.klm.com',
  'ryanair.com',
  'www.ryanair.com',
  'easyjet.com',
  'www.easyjet.com',
  'vueling.com',
  'www.vueling.com',
  'wizzair.com',
  'www.wizzair.com',
  'iberia.com',
  'www.iberia.com',
  'swiss.com',
  'www.swiss.com',
  'austrian.com',
  'www.austrian.com',
  'flysas.com',
  'www.flysas.com',
  'finnair.com',
  'www.finnair.com',
  'tap.pt',
  'www.tap.pt',
  'united.com',
  'www.united.com',
  'delta.com',
  'www.delta.com',
  'aa.com',
  'www.aa.com',
  'emirates.com',
  'www.emirates.com'
];

const BLOCKED_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/
];

const CONFIRMATION_PATTERNS = [
  '/booking/confirmation',
  '/confirmation',
  '/receipt',
  '/itinerary',
  '/thankyou',
  '/thank-you',
  '/success',
  'status=confirmed',
  'bookingReference=',
  'confirmationNumber=',
  'pnr='
];

export class BookingGatewayService {
  private iframe: HTMLIFrameElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private sessionId: string = '';
  private isOperator: boolean = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private sessionTimeout: ReturnType<typeof setTimeout> | null = null;
  private onCompleteCallback: ((success: boolean, details?: any) => void) | null = null;

  constructor(isOperator: boolean = false) {
    this.isOperator = isOperator;
  }

  setOperatorMode(isOperator: boolean): void {
    this.isOperator = isOperator;
  }

  async initiateAnonymousBooking(
    bookingUrl: string,
    flightDetails: any,
    onComplete?: (success: boolean, details?: any) => void
  ): Promise<void> {
    this.sessionId = uuidv4();
    this.onCompleteCallback = onComplete || null;

    console.log('[BookingGateway] Initiating anonymous booking session:', this.sessionId);

    try {
      const sanitizedUrl = this.sanitizeUrl(bookingUrl);

      const gatewayResponse = await fetch('/api/flights/booking-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          bookingUrl: sanitizedUrl,
          userType: this.isOperator ? 'operator' : 'standard',
          flightDetails: {
            id: flightDetails.id,
            carrier: flightDetails.itineraries?.[0]?.segments?.[0]?.carrierCode,
            flightNumber: flightDetails.itineraries?.[0]?.segments?.[0]?.number
          }
        })
      });

      if (!gatewayResponse.ok) {
        throw new Error(`Gateway request failed: ${gatewayResponse.status}`);
      }

      const { proxiedUrl, tunnelId, error } = await gatewayResponse.json() as BookingGatewayResponse;

      if (error) {
        throw new Error(error);
      }

      if (!proxiedUrl) {
        throw new Error('No proxied URL returned from gateway');
      }

      this.createSecureIframe(proxiedUrl, tunnelId);
      this.setupCompletionDetection();
      this.setupSessionTimeout();

      console.log('[BookingGateway] Booking session started:', {
        sessionId: this.sessionId,
        tunnelId,
        isOperator: this.isOperator
      });

    } catch (error) {
      console.error('[BookingGateway] Failed to initiate booking:', error);
      this.cleanupBookingSession(false);
      throw error;
    }
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        console.error('[BookingGateway] Blocked non-HTTP(S) URL:', url);
        throw new Error('Only HTTPS URLs are allowed for booking');
      }

      const hostname = urlObj.hostname.toLowerCase();
      
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(hostname)) {
          console.error('[BookingGateway] Blocked internal/private URL:', hostname);
          throw new Error('Internal URLs are not allowed');
        }
      }

      const isAllowedDomain = ALLOWED_BOOKING_DOMAINS.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isAllowedDomain) {
        console.warn('[BookingGateway] Domain not in allowlist, proceeding with caution:', hostname);
      }

      if (urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:';
      }

      TRACKING_PARAMS.forEach(param => urlObj.searchParams.delete(param));

      const keysToDelete: string[] = [];
      for (const [key] of urlObj.searchParams.entries()) {
        if (key.startsWith('_') || key.startsWith('utm') || key.includes('track')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => urlObj.searchParams.delete(key));

      return urlObj.toString();
    } catch (error) {
      console.error('[BookingGateway] URL sanitization failed:', error);
      throw error;
    }
  }

  validateBookingUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        return { valid: false, reason: 'Only HTTPS URLs are allowed' };
      }

      const hostname = urlObj.hostname.toLowerCase();
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(hostname)) {
          return { valid: false, reason: 'Internal URLs are not allowed' };
        }
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  private createSecureIframe(proxiedUrl: string, _tunnelId?: string): void {
    if (this.iframe && document.body.contains(this.iframe)) {
      document.body.removeChild(this.iframe);
    }
    if (this.overlay && document.body.contains(this.overlay)) {
      document.body.removeChild(this.overlay);
    }

    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: '99998',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: '20px'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      width: '95%',
      maxWidth: '1400px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 20px',
      backgroundColor: '#010401',
      border: '1px solid rgba(0, 243, 255, 0.3)',
      marginBottom: '10px'
    });

    const title = document.createElement('span');
    title.textContent = 'SECURE ANONYMOUS BOOKING';
    Object.assign(title.style, {
      color: '#00f3ff',
      fontSize: '12px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      fontFamily: 'monospace'
    });

    const privacyBadge = document.createElement('span');
    privacyBadge.textContent = this.isOperator ? 'VPN TUNNEL ACTIVE' : 'PROXY ENABLED';
    Object.assign(privacyBadge.style, {
      color: '#4caf50',
      fontSize: '10px',
      fontWeight: 'bold',
      letterSpacing: '1px',
      fontFamily: 'monospace',
      padding: '4px 8px',
      border: '1px solid #4caf50',
      borderRadius: '2px'
    });

    this.closeButton = document.createElement('button');
    this.closeButton.textContent = 'CLOSE';
    Object.assign(this.closeButton.style, {
      backgroundColor: 'transparent',
      border: '1px solid rgba(255, 0, 85, 0.5)',
      color: '#ff0055',
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: '10px',
      fontWeight: 'bold',
      letterSpacing: '1px',
      fontFamily: 'monospace'
    });
    this.closeButton.onclick = () => this.cleanupBookingSession(false);

    header.appendChild(title);
    header.appendChild(privacyBadge);
    header.appendChild(this.closeButton);
    this.overlay.appendChild(header);

    this.iframe = document.createElement('iframe');

    this.iframe.sandbox.add('allow-forms');
    this.iframe.sandbox.add('allow-scripts');
    this.iframe.sandbox.add('allow-same-origin');
    this.iframe.sandbox.add('allow-popups');
    this.iframe.sandbox.add('allow-modals');
    this.iframe.sandbox.add('allow-popups-to-escape-sandbox');

    this.iframe.referrerPolicy = 'no-referrer';

    this.iframe.src = proxiedUrl;

    Object.assign(this.iframe.style, {
      width: '95%',
      maxWidth: '1400px',
      height: 'calc(100vh - 100px)',
      border: '1px solid rgba(0, 243, 255, 0.3)',
      backgroundColor: '#ffffff',
      borderRadius: '0'
    });

    this.overlay.appendChild(this.iframe);
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden';
  }

  private setupCompletionDetection(): void {
    if (!this.iframe) return;

    this.checkInterval = setInterval(() => {
      try {
        const iframeUrl = this.iframe?.contentWindow?.location.href;
        if (iframeUrl && this.isBookingConfirmationUrl(iframeUrl)) {
          console.log('[BookingGateway] Booking confirmation detected');
          this.cleanupBookingSession(true, { confirmationUrl: iframeUrl });
        }
      } catch {
      }
    }, 2000);
  }

  private setupSessionTimeout(): void {
    this.sessionTimeout = setTimeout(() => {
      console.log('[BookingGateway] Session timeout reached');
      this.cleanupBookingSession(false);
    }, 30 * 60 * 1000);
  }

  private isBookingConfirmationUrl(url: string): boolean {
    return CONFIRMATION_PATTERNS.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
  }

  private cleanupBookingSession(success: boolean, details?: any): void {
    console.log('[BookingGateway] Cleaning up session:', { sessionId: this.sessionId, success });

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }

    fetch('/api/flights/booking-gateway/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        success,
        timestamp: Date.now()
      })
    }).catch(err => console.error('[BookingGateway] Cleanup report failed:', err));

    if (this.iframe && this.overlay && document.body.contains(this.overlay)) {
      document.body.removeChild(this.overlay);
    }

    this.iframe = null;
    this.overlay = null;
    this.closeButton = null;
    document.body.style.overflow = '';

    if (this.onCompleteCallback) {
      this.onCompleteCallback(success, details);
      this.onCompleteCallback = null;
    }
  }

  isSessionActive(): boolean {
    return this.iframe !== null;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  closeSession(): void {
    this.cleanupBookingSession(false);
  }
}

export default BookingGatewayService;
