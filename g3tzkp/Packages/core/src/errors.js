export class G3ZKPError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'G3ZKPError';
    }
}
export class SecurityError extends G3ZKPError {
    constructor(message, details) {
        super(message, 'SECURITY_ERROR', details);
        this.name = 'SecurityError';
    }
}
export class NetworkError extends G3ZKPError {
    constructor(message, details) {
        super(message, 'NETWORK_ERROR', details);
        this.name = 'NetworkError';
    }
}
export class CryptoError extends G3ZKPError {
    constructor(message, details) {
        super(message, 'CRYPTO_ERROR', details);
        this.name = 'CryptoError';
    }
}
export class ZKPError extends G3ZKPError {
    constructor(message, details) {
        super(message, 'ZKP_ERROR', details);
        this.name = 'ZKPError';
    }
}
export class ValidationError extends G3ZKPError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
