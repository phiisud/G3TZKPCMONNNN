pragma circom 2.1.3;

/**
 * Authentication Circuit
 * Proves identity ownership without revealing the identity secret
 * 
 * SECURITY NOTE: This circuit uses SimplePoseidon, a development-only hash
 * function for testing and demonstration. For production deployment:
 * - Replace SimplePoseidon with actual Poseidon from circomlib
 * - Add: include "circomlib/circuits/poseidon.circom";
 * - Use Poseidon(2), Poseidon(3), etc. templates
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
 * SimplePoseidon - Simplified Poseidon-like hash for 2 inputs
 * Uses a simple algebraic construction
 */
template SimplePoseidon2() {
    signal input inputs[2];
    signal output out;
    
    // Constants (simplified MDS matrix and round constants)
    var c1 = 17;
    var c2 = 23;
    var c3 = 31;
    
    // Mix and cube (simplified S-box)
    signal s1 <== inputs[0] + c1;
    signal s2 <== inputs[1] + c2;
    
    // Non-linear layer
    signal t1 <== s1 * s1;
    signal t2 <== s2 * s2;
    signal t3 <== t1 * s1;  // s1^3
    signal t4 <== t2 * s2;  // s2^3
    
    // Linear combination
    out <== t3 + t4 * c3 + inputs[0] * inputs[1];
}

/**
 * Authentication - Main circuit
 */
template Authentication() {
    // Public inputs
    signal input identityCommitment;     // Commitment to identity
    signal input nullifierHash;          // Hash of nullifier for this context
    signal input externalNullifier;      // Context-specific nullifier
    
    // Private inputs
    signal input identitySecret;         // User's secret identity value
    signal input identityNullifier;      // User's nullifier seed
    
    // Output
    signal output valid;
    
    // 1. Verify identity commitment
    component commitmentHash = SimplePoseidon2();
    commitmentHash.inputs[0] <== identitySecret;
    commitmentHash.inputs[1] <== identityNullifier;
    
    component commitmentCheck = IsEqual();
    commitmentCheck.in[0] <== commitmentHash.out;
    commitmentCheck.in[1] <== identityCommitment;
    
    // 2. Compute and verify nullifier hash
    component nullifierHasher = SimplePoseidon2();
    nullifierHasher.inputs[0] <== identityNullifier;
    nullifierHasher.inputs[1] <== externalNullifier;
    
    component nullifierCheck = IsEqual();
    nullifierCheck.in[0] <== nullifierHasher.out;
    nullifierCheck.in[1] <== nullifierHash;
    
    // 3. Verify identity secret is non-zero
    component secretNonZero = IsZero();
    secretNonZero.in <== identitySecret;
    signal secretValid <== 1 - secretNonZero.out;
    
    // 4. Verify nullifier is non-zero
    component nullifierNonZero = IsZero();
    nullifierNonZero.in <== identityNullifier;
    signal nullifierValid <== 1 - nullifierNonZero.out;
    
    // 5. Combine all validity checks
    signal check1 <== commitmentCheck.out * nullifierCheck.out;
    signal check2 <== secretValid * nullifierValid;
    valid <== check1 * check2;
}

component main {public [identityCommitment, nullifierHash, externalNullifier]} = Authentication();
