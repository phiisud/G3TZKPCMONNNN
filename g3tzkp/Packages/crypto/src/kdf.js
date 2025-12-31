// Simplified KDF functions for local P2P messaging
// Note: This is a simplified version for local implementation
export async function hkdf(ikm, length, info, hash = 'SHA-256') {
    const hashLen = hash === 'SHA-256' ? 32 : 64;
    // Simplified HKDF for local implementation
    // In production, this would use proper HKDF with HMAC-SHA256
    // Extract phase - simplified
    const salt = new Uint8Array(hashLen);
    const prk = extract(ikm, salt);
    // Expand phase
    const n = Math.ceil(length / hashLen);
    const okm = new Uint8Array(n * hashLen);
    let prev = new Uint8Array(0);
    for (let i = 0; i < n; i++) {
        const input = new Uint8Array(prev.length + info.length + 1);
        input.set(prev);
        input.set(info, prev.length);
        input[input.length - 1] = i + 1;
        const expanded = expand(input, prk);
        prev = new Uint8Array(expanded);
        okm.set(prev, i * hashLen);
    }
    return okm.slice(0, length);
}
function extract(ikm, salt) {
    // Simplified extract phase
    const result = new Uint8Array(Math.max(ikm.length, salt.length));
    for (let i = 0; i < result.length; i++) {
        const ikmByte = i < ikm.length ? ikm[i] : 0;
        const saltByte = i < salt.length ? salt[i] : 0;
        result[i] = ikmByte ^ saltByte;
    }
    return result;
}
function expand(input, key) {
    // Simplified expand phase using XOR and rotation
    const output = new Uint8Array(32);
    for (let i = 0; i < output.length; i++) {
        let value = 0;
        for (let j = 0; j < input.length; j++) {
            value ^= input[j];
        }
        for (let j = 0; j < key.length; j++) {
            value ^= key[j];
        }
        output[i] = (value + i) & 0xFF;
    }
    return output;
}
