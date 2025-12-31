import { box, sign } from 'tweetnacl';
export class KeyStore {
    identityKeys = null;
    preKeys = new Map();
    signedPreKey = null;
    oneTimePreKeys = [];
    async initialize() {
        if (!this.identityKeys) {
            await this.generateIdentityKeys();
        }
        if (!this.signedPreKey) {
            await this.generateSignedPreKey();
        }
        if (this.oneTimePreKeys.length < 100) {
            await this.generateOneTimePreKeys(100 - this.oneTimePreKeys.length);
        }
    }
    async generateIdentityKeys() {
        const identityKeyPair = box.keyPair();
        const signingKeyPair = sign.keyPair();
        const keyId = this.generateKeyId(identityKeyPair.publicKey);
        this.identityKeys = {
            identityKeyPair: {
                publicKey: identityKeyPair.publicKey,
                secretKey: identityKeyPair.secretKey
            },
            signingKeyPair: {
                publicKey: signingKeyPair.publicKey,
                secretKey: signingKeyPair.secretKey
            },
            keyId,
            createdAt: new Date()
        };
        return this.identityKeys;
    }
    async generateSignedPreKey() {
        const keyPair = box.keyPair();
        this.signedPreKey = {
            publicKey: keyPair.publicKey,
            secretKey: keyPair.secretKey
        };
        return this.signedPreKey;
    }
    async generateOneTimePreKeys(count) {
        const newKeys = [];
        for (let i = 0; i < count; i++) {
            const keyPair = box.keyPair();
            newKeys.push({
                publicKey: keyPair.publicKey,
                secretKey: keyPair.secretKey
            });
        }
        this.oneTimePreKeys.push(...newKeys);
        return newKeys;
    }
    getIdentityKey() {
        if (!this.identityKeys)
            throw new Error('Keys not initialized');
        return this.identityKeys.identityKeyPair.publicKey;
    }
    getIdentityKeyPair() {
        if (!this.identityKeys)
            throw new Error('Keys not initialized');
        return this.identityKeys.identityKeyPair;
    }
    getSigningKeyPair() {
        if (!this.identityKeys)
            throw new Error('Keys not initialized');
        return this.identityKeys.signingKeyPair;
    }
    getSignedPreKey() {
        if (!this.signedPreKey)
            throw new Error('Signed pre-key not generated');
        return this.signedPreKey;
    }
    consumeOneTimePreKey() {
        return this.oneTimePreKeys.shift();
    }
    generateKeyId(publicKey) {
        // Simple key ID generation without requiring core dependencies
        let hash = 0;
        for (let i = 0; i < publicKey.length; i++) {
            const char = publicKey[i];
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
    hasIdentityKey() {
        return this.identityKeys !== null;
    }
}
