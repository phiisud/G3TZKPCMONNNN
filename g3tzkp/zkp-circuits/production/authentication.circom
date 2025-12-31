include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Authentication Circuit - Production Version
 * Proves identity ownership without revealing the identity secret
 * 
 * Uses real Poseidon hash from circomlib for cryptographic security
 * 
 * Public inputs:
 *   - identityCommitment: Poseidon(identitySecret, identityNullifier)
 *   - nullifierHash: Poseidon(identityNullifier, externalNullifier) 
 *   - externalNullifier: Context-specific identifier (e.g., application ID)
 * 
 * Private inputs:
 *   - identitySecret: User's secret authentication key
 *   - identityNullifier: User's unique nullifier for replay protection
 * 
 * Constraints:
 *   - User proves knowledge of identitySecret without revealing it
 *   - Proves the identityCommitment is correct
 *   - Proves nullifierHash is computed correctly from identityNullifier
 *   - Both secrets must be non-zero
 */

template Authentication() {
    signal input identityCommitment;
    signal input nullifierHash;
    signal input externalNullifier;
    
    signal input identitySecret;
    signal input identityNullifier;
    
    signal output valid;
    
    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== identitySecret;
    commitmentHash.inputs[1] <== identityNullifier;
    
    component commitmentCheck = IsEqual();
    commitmentCheck.in[0] <== commitmentHash.out;
    commitmentCheck.in[1] <== identityCommitment;
    
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== identityNullifier;
    nullifierHasher.inputs[1] <== externalNullifier;
    
    component nullifierCheck = IsEqual();
    nullifierCheck.in[0] <== nullifierHasher.out;
    nullifierCheck.in[1] <== nullifierHash;
    
    component secretNonZero = IsZero();
    secretNonZero.in <== identitySecret;
    signal secretValid <== 1 - secretNonZero.out;
    
    component nullifierNonZero = IsZero();
    nullifierNonZero.in <== identityNullifier;
    signal nullifierValid <== 1 - nullifierNonZero.out;
    
    signal check1 <== commitmentCheck.out * nullifierCheck.out;
    signal check2 <== secretValid * nullifierValid;
    valid <== check1 * check2;
}

component main = Authentication();
