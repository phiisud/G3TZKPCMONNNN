#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

const SCRIPT_DIR = __dirname;
const BUILD_DIR = path.join(SCRIPT_DIR, 'build');

const circuits = [
  'authentication',
  'message_security',
  'forward_secrecy',
  'message_send',
  'message_delivery',
  'key_rotation',
  'group_message'
];

async function testCircuit(circuitName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${circuitName}`);
  console.log('='.repeat(60));

  const wasmPath = path.join(BUILD_DIR, `${circuitName}.wasm`);
  const zkeyPath = path.join(BUILD_DIR, `${circuitName}_final.zkey`);
  const vkeyPath = path.join(BUILD_DIR, `${circuitName}_verification_key.json`);

  if (!fs.existsSync(wasmPath)) {
    console.error(`❌ WASM file not found: ${wasmPath}`);
    return false;
  }

  if (!fs.existsSync(zkeyPath)) {
    console.error(`❌ ZKey file not found: ${zkeyPath}`);
    return false;
  }

  if (!fs.existsSync(vkeyPath)) {
    console.error(`❌ Verification key not found: ${vkeyPath}`);
    return false;
  }

  console.log(`✓ WASM file found (${(fs.statSync(wasmPath).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✓ ZKey file found (${(fs.statSync(zkeyPath).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✓ Verification key found`);

  try {
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    console.log(`✓ Verification key valid (nPublic: ${vkey.nPublic})`);
  } catch (error) {
    console.error(`❌ Verification key parsing failed: ${error.message}`);
    return false;
  }

  try {
    const inputs = generateTestInputs(circuitName);
    console.log(`✓ Generated test inputs for ${circuitName}`);

    const startProve = Date.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      wasmPath,
      zkeyPath
    );
    const proveTime = Date.now() - startProve;

    console.log(`✓ Proof generated (${proveTime}ms)`);
    console.log(`  - Public signals: ${publicSignals.length}`);
    console.log(`  - Proof size: ${JSON.stringify(proof).length} bytes`);

    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    const startVerify = Date.now();
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    const verifyTime = Date.now() - startVerify;

    if (!isValid) {
      console.error(`❌ Proof verification failed`);
      return false;
    }

    console.log(`✓ Proof verified (${verifyTime}ms)`);
    console.log(`✅ ${circuitName} - PRODUCTION READY`);
    return true;

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

function generateTestInputs(circuitName) {
  const base = BigInt('12345678901234567890');

  switch (circuitName) {
    case 'authentication':
      const secret = base;
      const nullifier = base + BigInt(1);
      const commitment = base + BigInt(100);
      const extNullifier = base + BigInt(2);
      const nullHash = base + BigInt(101);

      return {
        identityCommitment: commitment.toString(),
        nullifierHash: nullHash.toString(),
        externalNullifier: extNullifier.toString(),
        identitySecret: secret.toString(),
        identityNullifier: nullifier.toString()
      };

    case 'message_security':
      return {
        messageRoot: (base + BigInt(200)).toString(),
        timestamp: '1234567890',
        senderCommitment: (base + BigInt(101)).toString(),
        receiverCommitment: (base + BigInt(102)).toString(),
        messageHash: (base + BigInt(1)).toString(),
        encryptionKeyHash: (base + BigInt(2)).toString(),
        senderSecret: (base).toString(),
        receiverSecret: (base + BigInt(3)).toString(),
        nonce: '999'
      };

    case 'forward_secrecy':
      return {
        oldKeyCommitment: (base + BigInt(101)).toString(),
        newKeyCommitment: (base + BigInt(102)).toString(),
        deletionProof: (base + BigInt(200)).toString(),
        oldKeySecret: (base).toString(),
        newKeySecret: (base + BigInt(3)).toString(),
        rotationNonce: '888'
      };

    case 'message_send':
      return {
        messageHash: (base + BigInt(100)).toString(),
        senderPublicKey: (base + BigInt(101)).toString(),
        recipientPublicKey: (base + BigInt(102)).toString(),
        timestamp: '1234567890',
        plaintextHash: (base).toString(),
        encryptionKey: (base + BigInt(1)).toString(),
        nonce: '777'
      };

    case 'message_delivery':
      return {
        messageHash: (base + BigInt(100)).toString(),
        recipientPublicKey: (base + BigInt(102)).toString(),
        deliveryTimestamp: '1234567890',
        decryptionProof: (base + BigInt(50)).toString(),
        ackNonce: '666'
      };

    case 'key_rotation':
      return {
        currentKeyCommitment: (base + BigInt(101)).toString(),
        nextKeyCommitment: (base + BigInt(102)).toString(),
        rotationIndex: '100',
        currentKey: (base).toString(),
        nextKey: (base + BigInt(3)).toString(),
        rotationSecret: (base + BigInt(1)).toString(),
        rotationCounter: '50'
      };

    case 'group_message':
      return {
        groupId: (base + BigInt(1000)).toString(),
        groupMembershipRoot: (base + BigInt(200)).toString(),
        messageHash: (base + BigInt(100)).toString(),
        timestamp: '1234567890',
        memberSecret: (base).toString(),
        groupSecret: (base + BigInt(1)).toString(),
        encryptionKey: (base + BigInt(2)).toString(),
        nonce: '555'
      };

    default:
      throw new Error(`Unknown circuit: ${circuitName}`);
  }
}

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        G3ZKP Production Circuit Verification Suite       ║');
  console.log('║                  Testing All Circuits                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`❌ Build directory not found: ${BUILD_DIR}`);
    console.error('Please run: npm run build:circuits');
    process.exit(1);
  }

  const results = [];

  for (const circuit of circuits) {
    const passed = await testCircuit(circuit);
    results.push({ circuit, passed });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  let passCount = 0;
  let failCount = 0;

  for (const { circuit, passed } of results) {
    if (passed) {
      console.log(`✓ ${circuit.padEnd(25)} PASS`);
      passCount++;
    } else {
      console.log(`✗ ${circuit.padEnd(25)} FAIL`);
      failCount++;
    }
  }

  console.log('='.repeat(60));
  console.log(`Passed: ${passCount}/${circuits.length}`);
  console.log(`Failed: ${failCount}/${circuits.length}`);

  if (failCount === 0) {
    console.log('\n✅ ALL PRODUCTION CIRCUITS VERIFIED');
    console.log('Ready for deployment!');
    process.exit(0);
  } else {
    console.log('\n❌ Some circuits failed verification');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
