#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const snarkjs = require('snarkjs');

const SCRIPT_DIR = __dirname;
const BUILD_DIR = path.join(SCRIPT_DIR, 'build');
const PRODUCTION_DIR = path.join(SCRIPT_DIR, 'production');
const PTAU_FILE = path.join(SCRIPT_DIR, 'pot12_final.ptau');

const circuits = [
  'authentication',
  'message_security',
  'forward_secrecy',
  'message_send',
  'message_delivery',
  'key_rotation',
  'group_message'
];

let successCount = 0;
let failCount = 0;

async function checkPrerequisites() {
  console.log('=== G3ZKP Production Circuit Compilation ===');
  console.log(`Production circuits directory: ${PRODUCTION_DIR}`);
  console.log(`Build directory: ${BUILD_DIR}`);
  console.log(`Powers of Tau file: ${PTAU_FILE}`);

  if (!fs.existsSync(PRODUCTION_DIR)) {
    console.error(`ERROR: Production directory not found at ${PRODUCTION_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(PTAU_FILE)) {
    console.error(`ERROR: Powers of Tau file not found at ${PTAU_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  console.log('✓ All prerequisites verified');
}

async function compileCircom(circuitPath, outputDir) {
  try {
    console.log(`  Compiling Circom: ${path.basename(circuitPath)}`);
    execSync(`npx circom "${circuitPath}" --r1cs --wasm --sym -o "${outputDir}"`, { stdio: 'inherit' });
    console.log('  ✓ Circom compilation successful');
    return true;
  } catch (error) {
    console.error('  ✗ Circom compilation failed');
    return false;
  }
}

async function compileCircuit(circuitName) {
  const circuitFile = path.join(PRODUCTION_DIR, `${circuitName}.circom`);

  if (!fs.existsSync(circuitFile)) {
    console.error(`ERROR: Circuit file not found: ${circuitFile}`);
    failCount++;
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Compiling: ${circuitName} (Production)`);
  console.log('='.repeat(60));

  try {
    console.log('Step 1: Compile Circom to R1CS and WASM...');
    const compiledOk = await compileCircom(circuitFile, BUILD_DIR);
    if (!compiledOk) {
      failCount++;
      return;
    }

    const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
    const zkey0Path = path.join(BUILD_DIR, `${circuitName}_0000.zkey`);
    const zkeyFinalPath = path.join(BUILD_DIR, `${circuitName}_final.zkey`);
    const vkeyPath = path.join(BUILD_DIR, `${circuitName}_verification_key.json`);
    const verifierPath = path.join(BUILD_DIR, `${circuitName}_verifier.sol`);

    if (!fs.existsSync(r1csPath)) {
      throw new Error(`R1CS file not found: ${r1csPath}`);
    }

    console.log('\nStep 2: Setup Groth16 proving system with Powers of Tau...');
    await snarkjs.groth16.setup(
      fs.readFileSync(r1csPath),
      fs.readFileSync(PTAU_FILE),
      null
    );
    fs.writeFileSync(zkey0Path, fs.readFileSync(path.join(BUILD_DIR, 'zkey_0000')));
    console.log('  ✓ Groth16 setup complete');

    console.log('\nStep 3: Contribute to ceremony (adding entropy)...');
    const contributionSeed = `g3zkp-production-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const zkey = await snarkjs.zKey.newZKey(r1csPath, PTAU_FILE, contributionSeed);
    const zkeyFinal = await snarkjs.zKey.contribute(zkey);
    
    fs.writeFileSync(zkeyFinalPath, zkeyFinal);
    console.log('  ✓ Ceremony contribution complete');

    console.log('\nStep 4: Export verification key...');
    const vkeyJson = await snarkjs.zKey.exportVerificationKey(zkeyFinalPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vkeyJson, null, 2));
    console.log('  ✓ Verification key exported');

    console.log('\nStep 5: Export Solidity verifier...');
    const solidityVerifier = await snarkjs.zKey.exportSolidityVerifier(zkeyFinalPath);
    fs.writeFileSync(verifierPath, solidityVerifier);
    console.log('  ✓ Solidity verifier exported');

    console.log(`\n✓ ${circuitName} compiled successfully`);
    successCount++;

  } catch (error) {
    console.error(`\n✗ Circuit compilation failed: ${error.message}`);
    failCount++;
  }
}

async function generateCircuitRegistry() {
  console.log('\n' + '='.repeat(60));
  console.log('Generating Circuit Registry');
  console.log('='.repeat(60));

  const registry = {
    version: '1.0.0',
    production: true,
    compiled_at: new Date().toISOString(),
    ptau: 'pot12_final.ptau',
    ptau_power: 12,
    circuits: []
  };

  for (const circuit of circuits) {
    const vkeyPath = path.join(BUILD_DIR, `${circuit}_verification_key.json`);
    const wasmPath = path.join(BUILD_DIR, `${circuit}.wasm`);
    const zkeyPath = path.join(BUILD_DIR, `${circuit}_final.zkey`);
    const verifierPath = path.join(BUILD_DIR, `${circuit}_verifier.sol`);

    if (fs.existsSync(vkeyPath) && fs.existsSync(wasmPath) && fs.existsSync(zkeyPath)) {
      registry.circuits.push({
        id: circuit,
        name: circuit,
        wasm: `${circuit}.wasm`,
        zkey: `${circuit}_final.zkey`,
        verification_key: `${circuit}_verification_key.json`,
        verifier_contract: `${circuit}_verifier.sol`,
        compiled: true
      });
    }
  }

  const registryPath = path.join(BUILD_DIR, 'circuit_registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.log(`✓ Circuit registry generated: ${registryPath}`);
  console.log(`✓ Total circuits compiled: ${registry.circuits.length}`);
}

async function main() {
  try {
    await checkPrerequisites();

    console.log('\n=== Compiling Production Circuits ===\n');

    for (const circuit of circuits) {
      await compileCircuit(circuit);
    }

    await generateCircuitRegistry();

    console.log('\n' + '='.repeat(60));
    console.log('=== COMPILATION SUMMARY ===');
    console.log('='.repeat(60));
    console.log(`✓ Successfully compiled: ${successCount} circuits`);
    if (failCount > 0) {
      console.log(`✗ Failed: ${failCount} circuits`);
    }
    console.log(`Build directory: ${BUILD_DIR}`);

    if (failCount === 0) {
      console.log('\n✓ All production circuits compiled successfully!');
      process.exit(0);
    } else {
      console.log('\n✗ Some circuits failed to compile');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
