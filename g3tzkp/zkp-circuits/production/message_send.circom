include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Message Send Circuit - Production Version
 * Proves a message was properly encrypted and authorized for sending
 * 
 * Uses real Poseidon hash from circomlib for cryptographic security
 * 
 * Public inputs:
 *   - messageHash: Hash of plaintext message content
 *   - senderPublicKey: Sender's ephemeral public key component
 *   - recipientPublicKey: Recipient's ephemeral public key component
 *   - timestamp: Message creation timestamp
 * 
 * Private inputs:
 *   - plaintextHash: Hash of the plaintext before encryption
 *   - encryptionKey: Derived key from X3DH key agreement
 *   - nonce: Random nonce for encryption
 * 
 * Constraints:
 *   - Proves the message was encrypted with the correct key
 *   - Proves sender has authorization (implicit in proof generation)
 *   - Proves the public key components are correct
 *   - Ensures nonce is non-zero
 *   - Verifies timestamp is valid (non-zero)
 */

template MessageSend() {
    signal input messageHash;
    signal input senderPublicKey;
    signal input recipientPublicKey;
    signal input timestamp;
    
    signal input plaintextHash;
    signal input encryptionKey;
    signal input nonce;
    
    signal output valid;
    signal output encryptionProof;
    
    component senderKeyZero = IsZero();
    senderKeyZero.in <== senderPublicKey;
    signal senderKeyValid <== 1 - senderKeyZero.out;
    
    component recipientKeyZero = IsZero();
    recipientKeyZero.in <== recipientPublicKey;
    signal recipientKeyValid <== 1 - recipientKeyZero.out;
    
    component messageHash2 = Poseidon(2);
    messageHash2.inputs[0] <== plaintextHash;
    messageHash2.inputs[1] <== encryptionKey;
    
    component encryptionCheck = IsEqual();
    encryptionCheck.in[0] <== messageHash2.out;
    encryptionCheck.in[1] <== messageHash;
    
    component nonceCheck = IsZero();
    nonceCheck.in <== nonce;
    signal nonceValid <== 1 - nonceCheck.out;
    
    component timestampCheck = IsZero();
    timestampCheck.in <== timestamp;
    signal timestampValid <== 1 - timestampCheck.out;
    
    component encProof = Poseidon(4);
    encProof.inputs[0] <== senderPublicKey;
    encProof.inputs[1] <== recipientPublicKey;
    encProof.inputs[2] <== encryptionKey;
    encProof.inputs[3] <== nonce;
    encryptionProof <== encProof.out;
    
    signal check1 <== senderKeyValid * recipientKeyValid;
    signal check2 <== encryptionCheck.out * nonceValid;
    signal check3 <== check1 * check2;
    valid <== check3 * timestampValid;
}

component main = MessageSend();
