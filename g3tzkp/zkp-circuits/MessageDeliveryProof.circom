pragma circom 2.1.3;

// Simplified Message Delivery Proof Circuit for Local P2P Messaging
// Note: This is a simplified version for local implementation

template MessageDeliveryProof() {
    // Public inputs
    signal input messageHash;          // Hash of delivered message
    signal input recipientPublicKey;   // Recipient's public key
    signal input deliveryTimestamp;    // When delivered
    signal input routeHash;            // Hash of delivery route
    
    // Private inputs
    signal input deliverySignature;    // Recipient's delivery confirmation
    signal input routeProof;           // Proof of correct routing
    signal input storageDuration;      // How long message was stored
    
    // Outputs
    signal output validProof;          // Boolean proof validity
    signal output proofValue;          // Value for proof trading
    
    // Constants
    signal input sendTimestamp;        // When message was sent
    signal input maxDeliveryTime;      // Maximum delivery time allowed
    
    // 1. Verify delivery happened after sending
    component timeOrderCheck = GreaterThan(64);
    timeOrderCheck.in[0] <== deliveryTimestamp;
    timeOrderCheck.in[1] <== sendTimestamp;
    
    // 2. Verify delivery was within time limit
    signal deliveryTimeValid <== (deliveryTimestamp - sendTimestamp) <= maxDeliveryTime ? 1 : 0;
    
    // 3. Verify recipient public key is valid
    signal recipientKeyValid <== recipientPublicKey > 0 ? 1 : 0;
    
    // 4. Verify message hash is valid
    signal messageHashValid <== messageHash > 0 ? 1 : 0;
    
    // 5. Verify route hash is valid
    signal routeHashValid <== routeHash > 0 ? 1 : 0;
    
    // 6. Calculate proof value based on delivery speed and reliability
    signal deliverySpeed <== maxDeliveryTime - (deliveryTimestamp - sendTimestamp);
    signal reliabilityBonus <== 100; // Base reliability score
    
    component speedMultiplier = Divide();
    speedMultiplier.in[0] <== deliverySpeed;
    speedMultiplier.in[1] <== maxDeliveryTime;
    
    component valueCalc = Multiply();
    valueCalc.in[0] <== speedMultiplier.out;
    valueCalc.in[1] <== reliabilityBonus;
    
    proofValue <== valueCalc.out;
    
    // 7. Combine all checks
    validProof <== timeOrderCheck.out * 
                   deliveryTimeValid * 
                   recipientKeyValid * 
                   messageHashValid * 
                   routeHashValid;
}

// Helper component for greater than comparison
template GreaterThan(bits) {
    signal input in[2];
    signal output out;
    
    // Simplified greater than for local implementation
    out <== (in[0] > in[1]) ? 1 : 0;
}

// Helper component for division
template Divide() {
    signal input in[2];
    signal output out;
    
    // Simplified division for local implementation
    out <== in[1] != 0 ? in[0] / in[1] : 0;
}

// Helper component for multiplication
template Multiply() {
    signal input in[2];
    signal output out;
    
    out <== in[0] * in[1];
}

component main = MessageDeliveryProof();
