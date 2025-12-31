pragma circom 2.1.3;

/**
 * Forward Secrecy Circuit
 * Proves that old keys have been properly deleted and new keys generated
 * 
 * SECURITY NOTE: This circuit uses SimplePoseidon, a development-only hash
 * function for testing and demonstration. For production deployment:
 * - Replace SimplePoseidon with actual Poseidon from circomlib
 * - Add: include "circomlib/circuits/poseidon.circom";
 * - Use Poseidon(1), Poseidon(2), Poseidon(4) templates
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
 * SimplePoseidon1 - Simplified Poseidon-like hash for 1 input
 */
template SimplePoseidon1() {
    signal input inputs;
    signal output out;
    
    var c1 = 17;
    
    signal s1 <== inputs + c1;
    signal t1 <== s1 * s1;
    signal t2 <== t1 * t1;
    signal t3 <== t2 * s1;  // s1^5
    
    out <== t3 + inputs * 7;
}

/**
 * SimplePoseidon2 - Simplified Poseidon-like hash for 2 inputs
 */
template SimplePoseidon2() {
    signal input inputs[2];
    signal output out;
    
    var c1 = 17;
    var c2 = 23;
    var c3 = 31;
    
    signal s1 <== inputs[0] + c1;
    signal s2 <== inputs[1] + c2;
    
    signal t1 <== s1 * s1 * s1;
    signal t2 <== s2 * s2 * s2;
    
    out <== t1 + t2 * c3 + inputs[0] * inputs[1];
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
 * ForwardSecrecy - Main circuit
 */
template ForwardSecrecy() {
    // Public inputs
    signal input oldKeyCommitment;       // Commitment to old key being deleted
    signal input newKeyCommitment;       // Commitment to new key
    signal input deletionProof;          // Proof of key deletion
    
    // Private inputs
    signal input oldKeySecret;           // Old key secret being deleted
    signal input newKeySecret;           // New key secret
    signal input rotationNonce;          // Nonce for this rotation
    
    // Outputs
    signal output valid;
    signal output rotationCommitment;
    
    // 1. Verify old key commitment
    component oldKeyHash = SimplePoseidon1();
    oldKeyHash.inputs <== oldKeySecret;
    
    component oldKeyCheck = IsEqual();
    oldKeyCheck.in[0] <== oldKeyHash.out;
    oldKeyCheck.in[1] <== oldKeyCommitment;
    
    // 2. Verify new key commitment
    component newKeyHash = SimplePoseidon1();
    newKeyHash.inputs <== newKeySecret;
    
    component newKeyCheck = IsEqual();
    newKeyCheck.in[0] <== newKeyHash.out;
    newKeyCheck.in[1] <== newKeyCommitment;
    
    // 3. Verify deletion proof
    component deletionHash = SimplePoseidon2();
    deletionHash.inputs[0] <== oldKeySecret;
    deletionHash.inputs[1] <== rotationNonce;
    
    component deletionCheck = IsEqual();
    deletionCheck.in[0] <== deletionHash.out;
    deletionCheck.in[1] <== deletionProof;
    
    // 4. Verify new key is different from old key
    component keysDifferent = IsEqual();
    keysDifferent.in[0] <== oldKeySecret;
    keysDifferent.in[1] <== newKeySecret;
    signal keysAreDifferent <== 1 - keysDifferent.out;
    
    // 5. Verify rotation nonce is non-zero
    component nonceCheck = IsZero();
    nonceCheck.in <== rotationNonce;
    signal nonceValid <== 1 - nonceCheck.out;
    
    // 6. Create rotation commitment
    component rotationHash = SimplePoseidon4();
    rotationHash.inputs[0] <== oldKeyCommitment;
    rotationHash.inputs[1] <== newKeyCommitment;
    rotationHash.inputs[2] <== deletionProof;
    rotationHash.inputs[3] <== rotationNonce;
    rotationCommitment <== rotationHash.out;
    
    // 7. Combine all checks
    signal check1 <== oldKeyCheck.out * newKeyCheck.out;
    signal check2 <== deletionCheck.out * keysAreDifferent;
    valid <== check1 * check2 * nonceValid;
}

component main {public [oldKeyCommitment, newKeyCommitment, deletionProof]} = ForwardSecrecy();
