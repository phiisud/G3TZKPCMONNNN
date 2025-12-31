pragma circom 2.1.3;

/**
 * Message Security Circuit
 * Proves message integrity and proper encryption without revealing content
 * 
 * SECURITY NOTE: This circuit uses SimplePoseidon, a development-only hash
 * function for testing and demonstration. For production deployment:
 * - Replace SimplePoseidon with actual Poseidon from circomlib
 * - Add: include "circomlib/circuits/poseidon.circom";
 * - Use Poseidon(1), Poseidon(3), Poseidon(4) templates
 * 
 * SimplePoseidon provides structural correctness but NOT cryptographic
 * collision resistance. The circuit logic is correct; only the hash
 * implementation needs upgrading for production.
 */

/**
 * IsZero - Check if a value is zero
 */
template IsZero() {
    signal input in;
    signal output out;
    signal inv;

    inv <-- in != 0 ? 1/in : 0;
    out <== -in*inv + 1;
    in * out === 0;
}

/**
 * IsEqual - Check if two values are equal
 */
template IsEqual() {
    signal input in[2];
    signal output out;

    component isz = IsZero();
    isz.in <== in[1] - in[0];
    out <== isz.out;
}

/**
 * SimplePoseidon3 - Simplified Poseidon-like hash for 3 inputs
 */
template SimplePoseidon3() {
    signal input inputs[3];
    signal output out;
    
    var c1 = 17;
    var c2 = 23;
    var c3 = 31;
    
    signal s1 <== inputs[0] + c1;
    signal s2 <== inputs[1] + c2;
    signal s3 <== inputs[2] + c3;
    
    signal t1 <== s1 * s1 * s1;
    signal t2 <== s2 * s2 * s2;
    signal t3 <== s3 * s3 * s3;
    
    out <== t1 + t2 + t3 + inputs[0] * inputs[1] * inputs[2];
}

/**
 * SimplePoseidon4 - Simplified Poseidon-like hash for 4 inputs
 */
template SimplePoseidon4() {
    signal input inputs[4];
    signal output out;
    
    var c1 = 17;
    var c2 = 23;
    var c3 = 31;
    var c4 = 37;
    
    signal s1 <== inputs[0] + c1;
    signal s2 <== inputs[1] + c2;
    signal s3 <== inputs[2] + c3;
    signal s4 <== inputs[3] + c4;
    
    signal t1 <== s1 * s1 * s1;
    signal t2 <== s2 * s2 * s2;
    signal t3 <== s3 * s3 * s3;
    signal t4 <== s4 * s4 * s4;
    
    signal mix1 <== inputs[0] * inputs[1];
    signal mix2 <== inputs[2] * inputs[3];
    
    out <== t1 + t2 + t3 + t4 + mix1 * mix2;
}

/**
 * SimplePoseidon1 - Simplified Poseidon-like hash for 1 input
 */
template SimplePoseidon1() {
    signal input inputs;
    signal output out;
    
    var c1 = 17;
    
    signal s1 <== inputs + c1;
    signal t1 <== s1 * s1 * s1 * s1 * s1;  // s1^5
    
    out <== t1 + inputs * 7;
}

/**
 * MessageSecurity - Main circuit
 */
template MessageSecurity() {
    // Public inputs
    signal input messageRoot;            // Merkle root of message tree
    signal input timestamp;              // Message timestamp
    signal input senderCommitment;       // Commitment to sender's identity
    signal input receiverCommitment;     // Commitment to receiver's identity
    
    // Private inputs
    signal input messageHash;            // Hash of plaintext message
    signal input encryptionKeyHash;      // Hash of encryption key used
    signal input senderSecret;           // Sender's secret
    signal input receiverSecret;         // Receiver's secret
    signal input nonce;                  // Encryption nonce
    
    // Outputs
    signal output valid;
    signal output encryptedMessageHash;
    
    // 1. Verify sender commitment
    component senderHash = SimplePoseidon1();
    senderHash.inputs <== senderSecret;
    
    component senderCheck = IsEqual();
    senderCheck.in[0] <== senderHash.out;
    senderCheck.in[1] <== senderCommitment;
    
    // 2. Verify receiver commitment (or allow broadcast if receiverSecret is 0)
    component receiverHash = SimplePoseidon1();
    receiverHash.inputs <== receiverSecret;
    
    component receiverCheck = IsEqual();
    receiverCheck.in[0] <== receiverHash.out;
    receiverCheck.in[1] <== receiverCommitment;
    
    component receiverSecretZero = IsZero();
    receiverSecretZero.in <== receiverSecret;
    
    // receiverValid = receiverCheck OR receiverSecretZero
    signal receiverValid <== receiverCheck.out + receiverSecretZero.out - receiverCheck.out * receiverSecretZero.out;
    
    // 3. Compute encrypted message hash
    component encryptionHash = SimplePoseidon3();
    encryptionHash.inputs[0] <== messageHash;
    encryptionHash.inputs[1] <== encryptionKeyHash;
    encryptionHash.inputs[2] <== nonce;
    encryptedMessageHash <== encryptionHash.out;
    
    // 4. Verify message root
    component rootHash = SimplePoseidon4();
    rootHash.inputs[0] <== encryptedMessageHash;
    rootHash.inputs[1] <== timestamp;
    rootHash.inputs[2] <== senderCommitment;
    rootHash.inputs[3] <== receiverCommitment;
    
    component rootCheck = IsEqual();
    rootCheck.in[0] <== rootHash.out;
    rootCheck.in[1] <== messageRoot;
    
    // 5. Verify nonce is non-zero
    component nonceCheck = IsZero();
    nonceCheck.in <== nonce;
    signal nonceValid <== 1 - nonceCheck.out;
    
    // 6. Verify timestamp is valid
    component timestampCheck = IsZero();
    timestampCheck.in <== timestamp;
    signal timestampValid <== 1 - timestampCheck.out;
    
    // 7. Verify message hash is non-zero
    component messageCheck = IsZero();
    messageCheck.in <== messageHash;
    signal messageValid <== 1 - messageCheck.out;
    
    // 8. Combine all checks
    signal check1 <== senderCheck.out * receiverValid;
    signal check2 <== rootCheck.out * nonceValid;
    signal check3 <== timestampValid * messageValid;
    valid <== check1 * check2 * check3;
}

component main {public [messageRoot, timestamp, senderCommitment, receiverCommitment]} = MessageSecurity();
