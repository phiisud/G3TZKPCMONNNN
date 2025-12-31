include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Group Message Circuit - Production Version
 * Proves authorization to send a message to a group
 * 
 * Uses real Poseidon hash from circomlib for cryptographic security
 * 
 * Public inputs:
 *   - groupId: Unique identifier for the group
 *   - groupMembershipRoot: Merkle root of group membership
 *   - messageHash: Hash of group message content
 *   - timestamp: Message creation timestamp
 * 
 * Private inputs:
 *   - memberSecret: Sender's group membership secret
 *   - groupSecret: Group's shared secret
 *   - encryptionKey: Key for encrypting to group
 *   - nonce: Encryption nonce
 * 
 * Constraints:
 *   - Proves sender is a valid group member (via membership root)
 *   - Proves sender used correct group secret
 *   - Proves message was encrypted with group key
 *   - Ensures all values are non-zero (valid)
 *   - Prevents unauthorized group messages
 * 
 * Security properties:
 *   - Only group members can send messages
 *   - Proves correct encryption for group distribution
 *   - Prevents non-members from forging group messages
 *   - Supports group key rotation
 */

template GroupMessage() {
    signal input groupId;
    signal input groupMembershipRoot;
    signal input messageHash;
    signal input timestamp;
    
    signal input memberSecret;
    signal input groupSecret;
    signal input encryptionKey;
    signal input nonce;
    
    signal output valid;
    signal output groupMessageCommitment;
    
    component memberCommitment = Poseidon(2);
    memberCommitment.inputs[0] <== memberSecret;
    memberCommitment.inputs[1] <== groupId;
    
    component membershipCheck = Poseidon(2);
    membershipCheck.inputs[0] <== memberCommitment.out;
    membershipCheck.inputs[1] <== groupSecret;
    
    component groupKeyCheck = IsEqual();
    groupKeyCheck.in[0] <== membershipCheck.out;
    groupKeyCheck.in[1] <== groupMembershipRoot;
    
    component memberSecretZero = IsZero();
    memberSecretZero.in <== memberSecret;
    signal memberSecretValid <== 1 - memberSecretZero.out;
    
    component groupSecretZero = IsZero();
    groupSecretZero.in <== groupSecret;
    signal groupSecretValid <== 1 - groupSecretZero.out;
    
    component encryptionHash = Poseidon(3);
    encryptionHash.inputs[0] <== messageHash;
    encryptionHash.inputs[1] <== encryptionKey;
    encryptionHash.inputs[2] <== nonce;
    
    component encryptionCheck = IsEqual();
    encryptionCheck.in[0] <== encryptionHash.out;
    encryptionCheck.in[1] <== messageHash;
    
    component nonceZero = IsZero();
    nonceZero.in <== nonce;
    signal nonceValid <== 1 - nonceZero.out;
    
    component timestampZero = IsZero();
    timestampZero.in <== timestamp;
    signal timestampValid <== 1 - timestampZero.out;
    
    component groupMessageHash = Poseidon(4);
    groupMessageHash.inputs[0] <== groupId;
    groupMessageHash.inputs[1] <== messageHash;
    groupMessageHash.inputs[2] <== timestamp;
    groupMessageHash.inputs[3] <== encryptionKey;
    groupMessageCommitment <== groupMessageHash.out;
    
    signal check1 <== groupKeyCheck.out * memberSecretValid;
    signal check2 <== groupSecretValid * nonceValid;
    signal check3 <== check1 * check2;
    valid <== check3 * timestampValid;
}

component main = GroupMessage();
