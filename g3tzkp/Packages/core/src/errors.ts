export class G3ZKPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'G3ZKPError';
  }
}

export class SecurityError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SECURITY_ERROR', details);
    this.name = 'SecurityError';
  }
}

export class NetworkError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class CryptoError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CRYPTO_ERROR', details);
    this.name = 'CryptoError';
  }
}

export class ZKPError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ZKP_ERROR', details);
    this.name = 'ZKPError';
  }
}

export class ValidationError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}