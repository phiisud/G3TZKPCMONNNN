pragma circom 2.1.6;

// G3ZKP Key Rotation Proof Circuit
// Proves that a key rotation was performed correctly without revealing keys

template KeyRotationProof() {
    // Public inputs
    signal input oldKeyHash;        // Hash of old key (public)
    signal input newKeyHash;        // Hash of new key (public)
    signal input rotationTimestamp; // When rotation occurred
    signal input sessionId;         // Session identifier

    // Private inputs (not revealed)
    signal input oldKey;            // Actual old key (private)
    signal input newKey;            // Actual new key (private)
    signal input rotationProof;     // Proof of legitimate rotation

    // Intermediate signals
    signal oldHashComputed;
    signal newHashComputed;
    signal rotationValid;

    // Verify old key hash
    oldHashComputed <== Poseidon(1)([oldKey]);
    oldHashComputed === oldKeyHash;

    // Verify new key hash
    newHashComputed <== Poseidon(1)([newKey]);
    newHashComputed === newKeyHash;

    // Verify rotation proof (simplified - in production would be more complex)
    rotationValid <== Poseidon(3)([oldKey, newKey, rotationTimestamp]);
    rotationValid === rotationProof;

    // Ensure keys are different
    signal keyDifference;
    keyDifference <== oldKey - newKey;
    keyDifference !== 0;
}

component main {public [oldKeyHash, newKeyHash, rotationTimestamp, sessionId]} = KeyRotationProof();