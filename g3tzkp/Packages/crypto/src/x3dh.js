import { box } from 'tweetnacl';
export class X3DHProtocol {
    keyStore;
    constructor(keyStore) {
        this.keyStore = keyStore;
    }
    async initiateHandshake(recipientBundle) {
        const identityKeyPair = this.keyStore.getIdentityKeyPair();
        const ephemeralKeyPair = box.keyPair();
        // DH1 = DH(IK_A, SPK_B)
        const dh1 = box.before(recipientBundle.signedPreKey, identityKeyPair.secretKey);
        // DH2 = DH(EK_A, IK_B)
        const dh2 = box.before(recipientBundle.identityKey, ephemeralKeyPair.secretKey);
        // DH3 = DH(EK_A, SPK_B)
        const dh3 = box.before(recipientBundle.signedPreKey, ephemeralKeyPair.secretKey);
        // DH4 = DH(EK_A, OPK_B) if available
        let dh4 = new Uint8Array(0);
        let usedOneTimePreKey = false;
        if (recipientBundle.oneTimePreKey) {
            dh4 = box.before(recipientBundle.oneTimePreKey, ephemeralKeyPair.secretKey);
            usedOneTimePreKey = true;
        }
        // Combine DH outputs
        const dhOutput = this.concatUint8Arrays(dh1, dh2, dh3, dh4);
        // Derive shared secret using HKDF (simplified for now)
        const sharedSecret = await this.deriveSharedSecret(dhOutput);
        return {
            sharedSecret,
            ephemeralKey: ephemeralKeyPair.publicKey,
            usedOneTimePreKey
        };
    }
    async respondToHandshake(senderIdentityKey, senderEphemeralKey, usedOneTimePreKey, oneTimePreKeySecret) {
        const identityKeyPair = this.keyStore.getIdentityKeyPair();
        const signedPreKey = this.keyStore.getSignedPreKey();
        // DH1 = DH(SPK_B, IK_A)
        const dh1 = box.before(senderIdentityKey, signedPreKey.secretKey);
        // DH2 = DH(IK_B, EK_A)
        const dh2 = box.before(senderEphemeralKey, identityKeyPair.secretKey);
        // DH3 = DH(SPK_B, EK_A)
        const dh3 = box.before(senderEphemeralKey, signedPreKey.secretKey);
        // DH4 = DH(OPK_B, EK_A) if used
        let dh4 = new Uint8Array(0);
        if (usedOneTimePreKey && oneTimePreKeySecret) {
            dh4 = box.before(senderEphemeralKey, oneTimePreKeySecret);
        }
        const dhOutput = this.concatUint8Arrays(dh1, dh2, dh3, dh4);
        return await this.deriveSharedSecret(dhOutput);
    }
    async deriveSharedSecret(dhOutput) {
        // Simplified HKDF - in production, use proper HKDF implementation
        // For now, just use SHA256 of the concatenated output
        if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
            const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', dhOutput);
            return new Uint8Array(hashBuffer);
        }
        else {
            // Node.js fallback
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256');
            hash.update(dhOutput);
            return new Uint8Array(hash.digest());
        }
    }
    concatUint8Arrays(...arrays) {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }
}
