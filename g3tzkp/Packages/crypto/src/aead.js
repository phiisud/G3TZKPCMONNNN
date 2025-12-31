// Simplified AEAD encryption for local P2P messaging
// Note: This is a simplified version for local implementation
export function encrypt(plaintext, key) {
    // Simplified encryption for local implementation
    // In production, this would use proper AEAD (AES-GCM, ChaCha20-Poly1305)
    const nonce = new Uint8Array(12);
    for (let i = 0; i < 12; i++) {
        nonce[i] = Math.floor(Math.random() * 256);
    }
    const ciphertext = new Uint8Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
        ciphertext[i] = plaintext[i] ^ key[i % key.length] ^ nonce[i % nonce.length];
    }
    return { ciphertext, nonce };
}
export function decrypt(ciphertext, nonce, key) {
    // Simplified decryption for local implementation
    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
        plaintext[i] = ciphertext[i] ^ key[i % key.length] ^ nonce[i % nonce.length];
    }
    return plaintext;
}
export function encryptWithAD(plaintext, key, associatedData) {
    const combined = new Uint8Array(associatedData.length + plaintext.length);
    combined.set(associatedData);
    combined.set(plaintext, associatedData.length);
    return encrypt(combined, key);
}
