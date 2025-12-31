# G3ZKP ZKP Circuits

This directory contains the Zero-Knowledge Proof circuits for G3ZKP Messenger.

## Directory Structure

```
zkp-circuits/
├── authentication.circom     # Development version (self-contained)
├── message_security.circom   # Development version (self-contained)
├── forward_secrecy.circom    # Development version (self-contained)
├── MessageSendProof.circom   # Legacy circuit
├── MessageDeliveryProof.circom
├── ForwardSecrecyProof.circom
├── production/               # Production versions (require circomlib)
│   ├── authentication.circom
│   ├── message_security.circom
│   └── forward_secrecy.circom
└── build/                    # Compiled circuit artifacts
```

## Development vs Production Circuits

### Development Circuits (Root Directory)

The circuits in the root directory use `SimplePoseidon`, a structurally-correct but
cryptographically-weak hash function. These are suitable for:
- Local development and testing
- CI/CD pipeline testing
- Learning and experimentation
- Rapid prototyping

**WARNING**: SimplePoseidon does NOT provide collision resistance. These circuits
should NOT be used in production.

### Production Circuits (`production/` Directory)

The circuits in `production/` use the real Poseidon hash from circomlib. These provide:
- Full cryptographic security
- Collision resistance
- Production-ready ZKP proofs

## Building Production Circuits

1. Install circomlib:
   ```bash
   npm install circomlib
   ```

2. Compile circuits:
   ```bash
   cd production
   circom authentication.circom --r1cs --wasm --sym -o ../build/authentication
   circom message_security.circom --r1cs --wasm --sym -o ../build/message_security
   circom forward_secrecy.circom --r1cs --wasm --sym -o ../build/forward_secrecy
   ```

3. Generate proving keys (requires Powers of Tau ceremony):
   ```bash
   snarkjs groth16 setup build/authentication/authentication.r1cs pot12_final.ptau build/authentication/authentication.zkey
   snarkjs zkey export verificationkey build/authentication/authentication.zkey build/authentication/verification_key.json
   ```

## Circuit Descriptions

### Authentication Circuit
Proves identity ownership without revealing the identity secret.
- Public: identityCommitment, nullifierHash, externalNullifier
- Private: identitySecret, identityNullifier
- Proves: Knowledge of secret that hashes to commitment

### Message Security Circuit
Proves message integrity and proper encryption.
- Public: messageRoot, timestamp, senderCommitment, receiverCommitment
- Private: messageHash, encryptionKeyHash, senderSecret, receiverSecret, nonce
- Proves: Sender authorization and message encryption validity

### Forward Secrecy Circuit
Proves proper key rotation and deletion.
- Public: oldKeyCommitment, newKeyCommitment, deletionProof
- Private: oldKeySecret, newKeySecret, rotationNonce
- Proves: Old key deleted and new key is different
