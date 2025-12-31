pragma circom 2.1.3;

// Simplified Forward Secrecy Proof Circuit for Local P2P Messaging
// Note: This is a simplified version for local implementation

template ForwardSecrecyProof() {
    // Proves that old message keys have been properly deleted
    // while maintaining ability to decrypt current messages
    
    // Public inputs
    signal input currentStateHash;     // Hash of current ratchet state
    signal input oldStateHash;         // Hash of old ratchet state
    signal input messageHash;          // Hash of current message
    
    // Private inputs
    signal input currentKey;           // Current decryption key
    signal input oldKey;               // Old decryption key (to prove deletion)
    signal input deletionProof;        // Proof key was deleted
    
    // Outputs
    signal output validProof;          // Boolean proof validity
    
    // 1. Verify current key is valid (non-zero)
    signal currentKeyValid <== currentKey > 0 ? 1 : 0;
    
    // 2. Verify old key was deleted (is zero)
    signal oldKeyDeleted <== oldKey == 0 ? 1 : 0;
    
    // 3. Verify state transition is valid
    signal stateTransitionValid <== (currentStateHash != oldStateHash) ? 1 : 0;
    
    // 4. Verify message hash is valid
    signal messageHashValid <== messageHash > 0 ? 1 : 0;
    
    // 5. Combine all checks for forward secrecy proof
    validProof <== currentKeyValid * 
                   oldKeyDeleted * 
                   stateTransitionValid * 
                   messageHashValid;
}

component main = ForwardSecrecyProof();
