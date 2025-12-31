import { loadStripe, Stripe } from '@stripe/stripe-js';

export interface PaymentConfig {
  publicKey: string;
  priceId: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export class StripePaymentService {
  private stripe: Stripe | null = null;
  private config: PaymentConfig;

  constructor(config: PaymentConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.stripe) {
      this.stripe = await loadStripe(this.config.publicKey);
    }
  }

  async createCheckoutSession(): Promise<CheckoutSession> {
    const response = await fetch('/api/payments/create-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId: this.config.priceId,
        successUrl: this.config.successUrl,
        cancelUrl: this.config.cancelUrl,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    return await response.json();
  }

  async redirectToCheckout(sessionId: string): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    const { error } = await this.stripe.redirectToCheckout({
      sessionId,
    });

    if (error) {
      throw error;
    }
  }

  async handlePaymentSuccess(sessionId: string): Promise<any> {
    const response = await fetch(`/api/payments/session/${sessionId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to retrieve payment session');
    }

    return await response.json();
  }

  getConfig(): PaymentConfig {
    return { ...this.config };
  }
}

// Production configuration
export const PRODUCTION_STRIPE_CONFIG: PaymentConfig = {
  publicKey: 'pk_live_your_production_key', // Replace with actual key
  priceId: 'price_your_lifetime_price', // Replace with actual price ID
  amount: 2999, // £29.99
  currency: 'gbp',
  successUrl: `${window.location.origin}/#/download?payment=success&session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl: `${window.location.origin}/#/pricing?payment=cancelled`,
};

// Development configuration
export const DEVELOPMENT_STRIPE_CONFIG: PaymentConfig = {
  publicKey: 'pk_test_your_test_key', // Replace with actual test key
  priceId: 'price_test_lifetime_price', // Replace with actual test price ID
  amount: 2999,
  currency: 'gbp',
  successUrl: `${window.location.origin}/#/download?payment=success&session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl: `${window.location.origin}/#/pricing?payment=cancelled`,
};