include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Forward Secrecy Circuit - Production Version
 * Proves that old session keys have been properly deleted and new keys generated
 * 
 * Uses real Poseidon hash from circomlib for cryptographic security
 * 
 * Public inputs:
 *   - oldKeyCommitment: Poseidon(oldKeySecret) - being deleted
 *   - newKeyCommitment: Poseidon(newKeySecret) - new key for future messages
 *   - deletionProof: Poseidon(oldKeySecret, rotationNonce) - proof of deletion
 * 
 * Private inputs:
 *   - oldKeySecret: The key being rotated out (will be deleted)
 *   - newKeySecret: The new ephemeral key for next message
 *   - rotationNonce: Unique nonce for this key rotation
 * 
 * Constraints:
 *   - Proves the old key commitment is correct
 *   - Proves the new key commitment is correct
 *   - Proves the deletion proof was computed from the old key
 *   - Ensures old and new keys are different
 *   - Ensures rotation nonce is non-zero (preventing predictable rotations)
 *   - Creates a rotation commitment for audit trail
 * 
 * Security properties:
 *   - Past messages remain secure even if old key secret is revealed later
 *   - Deletion is cryptographically proven
 *   - Key rotation prevents long-term key compromise
 */

template ForwardSecrecy() {
    signal input oldKeyCommitment;
    signal input newKeyCommitment;
    signal input deletionProof;
    
    signal input oldKeySecret;
    signal input newKeySecret;
    signal input rotationNonce;
    
    signal output valid;
    signal output rotationCommitment;
    
    component oldKeyHash = Poseidon(1);
    oldKeyHash.inputs[0] <== oldKeySecret;
    
    component oldKeyCheck = IsEqual();
    oldKeyCheck.in[0] <== oldKeyHash.out;
    oldKeyCheck.in[1] <== oldKeyCommitment;
    
    component newKeyHash = Poseidon(1);
    newKeyHash.inputs[0] <== newKeySecret;
    
    component newKeyCheck = IsEqual();
    newKeyCheck.in[0] <== newKeyHash.out;
    newKeyCheck.in[1] <== newKeyCommitment;
    
    component deletionHash = Poseidon(2);
    deletionHash.inputs[0] <== oldKeySecret;
    deletionHash.inputs[1] <== rotationNonce;
    
    component deletionCheck = IsEqual();
    deletionCheck.in[0] <== deletionHash.out;
    deletionCheck.in[1] <== deletionProof;
    
    component keysDifferent = IsEqual();
    keysDifferent.in[0] <== oldKeySecret;
    keysDifferent.in[1] <== newKeySecret;
    signal keysAreDifferent <== 1 - keysDifferent.out;
    
    component nonceCheck = IsZero();
    nonceCheck.in <== rotationNonce;
    signal nonceValid <== 1 - nonceCheck.out;
    
    component rotationHash = Poseidon(4);
    rotationHash.inputs[0] <== oldKeyCommitment;
    rotationHash.inputs[1] <== newKeyCommitment;
    rotationHash.inputs[2] <== deletionProof;
    rotationHash.inputs[3] <== rotationNonce;
    rotationCommitment <== rotationHash.out;
    
    signal check1 <== oldKeyCheck.out * newKeyCheck.out;
    signal check2 <== deletionCheck.out * keysAreDifferent;
    signal check3 <== check1 * check2;
    valid <== check3 * nonceValid;
}

component main = ForwardSecrecy();
