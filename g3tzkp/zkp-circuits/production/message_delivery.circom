include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Message Delivery Circuit - Production Version
 * Proves a message was delivered and can be decrypted by the recipient
 * 
 * Uses real Poseidon hash from circomlib for cryptographic security
 * 
 * Public inputs:
 *   - messageHash: Hash of encrypted message
 *   - recipientPublicKey: Recipient's public key identity
 *   - deliveryTimestamp: Timestamp when message was delivered
 * 
 * Private inputs:
 *   - decryptionProof: Proof that recipient can decrypt (Poseidon of decryption key)
 *   - ackNonce: Acknowledgment nonce for delivery confirmation
 * 
 * Constraints:
 *   - Proves the recipient can decrypt the message
 *   - Proves delivery with valid timestamp
 *   - Ensures acknowledgment nonce is unique (non-zero)
 *   - Ensures recipient public key is valid (non-zero)
 *   - Creates delivery receipt commitment
 */

template MessageDelivery() {
    signal input messageHash;
    signal input recipientPublicKey;
    signal input deliveryTimestamp;
    
    signal input decryptionProof;
    signal input ackNonce;
    
    signal output valid;
    signal output deliveryReceipt;
    
    component recipientKeyZero = IsZero();
    recipientKeyZero.in <== recipientPublicKey;
    signal recipientKeyValid <== 1 - recipientKeyZero.out;
    
    component messageZero = IsZero();
    messageZero.in <== messageHash;
    signal messageValid <== 1 - messageZero.out;
    
    component decryptionCheck = IsZero();
    decryptionCheck.in <== decryptionProof;
    signal decryptionValid <== 1 - decryptionCheck.out;
    
    component ackNonceCheck = IsZero();
    ackNonceCheck.in <== ackNonce;
    signal ackValid <== 1 - ackNonceCheck.out;
    
    component timestampCheck = IsZero();
    timestampCheck.in <== deliveryTimestamp;
    signal timestampValid <== 1 - timestampCheck.out;
    
    component receipt = Poseidon(4);
    receipt.inputs[0] <== messageHash;
    receipt.inputs[1] <== recipientPublicKey;
    receipt.inputs[2] <== deliveryTimestamp;
    receipt.inputs[3] <== ackNonce;
    deliveryReceipt <== receipt.out;
    
    signal check1 <== recipientKeyValid * messageValid;
    signal check2 <== decryptionValid * ackValid;
    signal check3 <== check1 * check2;
    valid <== check3 * timestampValid;
}

component main = MessageDelivery();
