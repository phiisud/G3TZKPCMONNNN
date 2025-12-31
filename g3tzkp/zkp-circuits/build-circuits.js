#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function exec(cmd) {
  try {
    console.log(`  Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: SCRIPT_DIR });
    return true;
  } catch (error) {
    console.error(`  ✗ Command failed: ${cmd}`);
    return false;
  }
}

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
    console.log(`✓ Created build directory: ${BUILD_DIR}`);
  }

  console.log('✓ All prerequisites verified');
}

function compileCircuit(circuitName) {
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
    console.log('\nStep 1: Compile Circom to R1CS and WASM...');
    const circuitPath = path.join(PRODUCTION_DIR, `${circuitName}.circom`);
    if (!exec(`npx circom "${circuitPath}" --r1cs --wasm --sym -o "${BUILD_DIR}"`)) {
      failCount++;
      return;
    }
    console.log('✓ Step 1: R1CS and WASM generated');

    console.log('\nStep 2: Setup Groth16 proving system...');
    const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
    const zkey0Path = path.join(BUILD_DIR, `${circuitName}_0000.zkey`);
    if (!exec(`npx snarkjs groth16 setup "${r1csPath}" "${PTAU_FILE}" "${zkey0Path}"`)) {
      failCount++;
      return;
    }
    console.log('✓ Step 2: Groth16 setup complete');

    console.log('\nStep 3: Contribute to ceremony (adding entropy)...');
    const zkeyFinalPath = path.join(BUILD_DIR, `${circuitName}_final.zkey`);
    const randomSeed = Math.random().toString(36).substring(2, 11);
    const seed = `g3zkp-production-${Date.now()}-${randomSeed}`;
    
    const seedFile = path.join(BUILD_DIR, `${circuitName}_seed.txt`);
    fs.writeFileSync(seedFile, seed);
    
    const contributeCmd = `echo "${seed}" | npx snarkjs zkey contribute "${zkey0Path}" "${zkeyFinalPath}" --name="G3ZKP Production Contributor"`;
    if (!exec(contributeCmd)) {
      failCount++;
      return;
    }
    console.log('✓ Step 3: Ceremony contribution complete');

    console.log('\nStep 4: Export verification key...');
    const vkeyPath = path.join(BUILD_DIR, `${circuitName}_verification_key.json`);
    if (!exec(`npx snarkjs zkey export verificationkey "${zkeyFinalPath}" "${vkeyPath}"`)) {
      failCount++;
      return;
    }
    console.log('✓ Step 4: Verification key exported');

    console.log('\nStep 5: Export Solidity verifier...');
    const verifierPath = path.join(BUILD_DIR, `${circuitName}_verifier.sol`);
    if (!exec(`npx snarkjs zkey export solidityverifier "${zkeyFinalPath}" "${verifierPath}"`)) {
      console.log('⚠ Step 5: Solidity verifier export skipped (non-critical)');
    } else {
      console.log('✓ Step 5: Solidity verifier exported');
    }

    console.log(`\n✓ ${circuitName} compiled successfully`);
    successCount++;

  } catch (error) {
    console.error(`\n✗ Circuit compilation failed: ${error.message}`);
    failCount++;
  }
}

function generateCircuitRegistry() {
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
      const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
      registry.circuits.push({
        id: circuit,
        name: circuit,
        wasm: `${circuit}.wasm`,
        zkey: `${circuit}_final.zkey`,
        verification_key: `${circuit}_verification_key.json`,
        verifier_contract: `${circuit}_verifier.sol`,
        compiled: true,
        constraints: vkey.nPublic || 0
      });
    }
  }

  const registryPath = path.join(BUILD_DIR, 'circuit_registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.log(`✓ Circuit registry generated: ${registryPath}`);
  console.log(`✓ Total circuits compiled: ${registry.circuits.length} / ${circuits.length}`);
  return registry.circuits.length === circuits.length;
}

async function main() {
  try {
    await checkPrerequisites();

    console.log('\n=== Compiling Production Circuits ===\n');

    for (const circuit of circuits) {
      compileCircuit(circuit);
    }

    const allCompiled = generateCircuitRegistry();

    console.log('\n' + '='.repeat(60));
    console.log('=== COMPILATION SUMMARY ===');
    console.log('='.repeat(60));
    console.log(`✓ Successfully compiled: ${successCount} circuits`);
    if (failCount > 0) {
      console.log(`✗ Failed: ${failCount} circuits`);
    }
    console.log(`Build directory: ${BUILD_DIR}`);

    if (successCount > 0 && failCount === 0) {
      console.log('\n✓ All production circuits compiled successfully!');
      process.exit(0);
    } else if (successCount > 0) {
      console.log(`\n⚠ Partial compilation: ${successCount} / ${circuits.length} circuits compiled`);
      process.exit(1);
    } else {
      console.log('\n✗ No circuits were compiled');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
