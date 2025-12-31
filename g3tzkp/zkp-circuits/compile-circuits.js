#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const BUILD_DIR = path.join(SCRIPT_DIR, 'build');
const PTAU_FILE = path.join(SCRIPT_DIR, 'pot12_final.ptau');

console.log('=== G3ZKP Circuit Compilation ===');
console.log(`Build directory: ${BUILD_DIR}`);

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Check Powers of Tau file
if (!fs.existsSync(PTAU_FILE)) {
  console.error(`ERROR: Powers of Tau file not found at ${PTAU_FILE}`);
  process.exit(1);
}
console.log(`Using Powers of Tau file: ${PTAU_FILE}`);

// Get all .circom files
const circuitFiles = fs.readdirSync(SCRIPT_DIR)
  .filter(f => f.endsWith('.circom') && fs.statSync(path.join(SCRIPT_DIR, f)).isFile())
  .map(f => f.replace(/\.circom$/, ''));

console.log(`\nFound ${circuitFiles.length} circuits to compile:`);
circuitFiles.forEach(c => console.log(`  - ${c}`));

let successCount = 0;
let failureCount = 0;

// Compile each circuit
for (const circuitName of circuitFiles) {
  try {
    const circuitFile = path.join(SCRIPT_DIR, `${circuitName}.circom`);
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Compiling ${circuitName}`);
    console.log(`${'='.repeat(50)}`);
    
    // Step 1: Compile Circom
    console.log(`Step 1: Compiling Circom to R1CS and WASM...`);
    const circomCmd = `npx circom "${circuitFile}" --r1cs --wasm --sym -o "${BUILD_DIR}"`;
    console.log(`  Running: ${circomCmd}`);
    execSync(circomCmd, { stdio: 'inherit', cwd: SCRIPT_DIR });
    
    // Step 2: Groth16 setup
    console.log(`Step 2: Setting up Groth16 proving system...`);
    const setupCmd = `npx snarkjs groth16 setup "${path.join(BUILD_DIR, circuitName + '.r1cs')}" "${PTAU_FILE}" "${path.join(BUILD_DIR, circuitName + '_0000.zkey')}"`;
    console.log(`  Running: ${setupCmd}`);
    execSync(setupCmd, { stdio: 'inherit', cwd: SCRIPT_DIR });
    
    // Step 3: Contribute to ceremony
    console.log(`Step 3: Contributing to ceremony (adding entropy)...`);
    const timestamp = Math.floor(Date.now() / 1000);
    const contributeCmd = `npx snarkjs zkey contribute "${path.join(BUILD_DIR, circuitName + '_0000.zkey')}" "${path.join(BUILD_DIR, circuitName + '_final.zkey')}" --name="G3ZKP Contributor"`;
    console.log(`  Running: ${contributeCmd}`);
    execSync(`echo g3zkp-secure-random-contribution-${timestamp} | ${contributeCmd}`, { stdio: 'inherit', cwd: SCRIPT_DIR, shell: true });
    
    // Step 4: Export verification key
    console.log(`Step 4: Exporting verification key...`);
    const vkeyCmd = `npx snarkjs zkey export verificationkey "${path.join(BUILD_DIR, circuitName + '_final.zkey')}" "${path.join(BUILD_DIR, circuitName + '_verification_key.json')}"`;
    console.log(`  Running: ${vkeyCmd}`);
    execSync(vkeyCmd, { stdio: 'inherit', cwd: SCRIPT_DIR });
    
    // Step 5: Export Solidity verifier (optional)
    console.log(`Step 5: Exporting Solidity verifier (optional)...`);
    const solidityCmd = `npx snarkjs zkey export solidityverifier "${path.join(BUILD_DIR, circuitName + '_final.zkey')}" "${path.join(BUILD_DIR, circuitName + '_verifier.sol')}"`;
    try {
      execSync(solidityCmd, { stdio: 'inherit', cwd: SCRIPT_DIR });
    } catch (e) {
      console.log('  Solidity export skipped (optional)');
    }
    
    console.log(`✅ Circuit ${circuitName} compiled successfully!`);
    successCount++;
    
  } catch (err) {
    console.error(`❌ Failed to compile ${circuitName}`);
    console.error(err.message);
    failureCount++;
  }
}

// Generate circuit registry
console.log(`\n${'='.repeat(50)}`);
console.log('Generating circuit registry...');
const registryPath = path.join(BUILD_DIR, 'circuit_registry.json');

const circuits = fs.readdirSync(BUILD_DIR)
  .filter(f => f.endsWith('_verification_key.json'))
  .map(f => {
    const name = f.replace('_verification_key.json', '');
    return {
      name,
      verification_key: `${name}_verification_key.json`,
      zkey: `${name}_final.zkey`,
      wasm: `${name}.wasm`
    };
  });

const registry = {
  version: '1.0.0',
  compiled_at: new Date().toISOString(),
  ptau: 'pot12_final.ptau (Powers of Tau Ceremony)',
  circuits
};

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log(`✅ Circuit registry written to ${registryPath}`);

// Final summary
console.log(`\n${'='.repeat(50)}`);
console.log('=== Compilation Summary ===');
console.log(`Build artifacts in: ${BUILD_DIR}`);
console.log(`Successfully compiled: ${successCount} circuits`);
console.log(`Failed: ${failureCount} circuits`);

// List build artifacts
console.log(`\nBuild artifacts:`);
const artifacts = fs.readdirSync(BUILD_DIR).sort();
artifacts.forEach(f => {
  const stat = fs.statSync(path.join(BUILD_DIR, f));
  const size = (stat.size / 1024).toFixed(2);
  console.log(`  ${f} (${size} KB)`);
});

if (failureCount > 0) {
  console.error(`\n⚠️  ${failureCount} circuits failed to compile`);
  process.exit(1);
}

console.log(`\n✅ All circuits compiled successfully!`);
