const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, 'build');

console.log('=== Testing Circuit Loading from Registry ===\n');

const registryPath = path.join(buildDir, 'circuit_registry.json');

if (!fs.existsSync(registryPath)) {
  console.error('✗ circuit_registry.json not found');
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
console.log(`✓ Loaded registry with ${registry.circuits.length} circuits\n`);

let loadedCount = 0;
for (const circuit of registry.circuits) {
  if (!circuit.compiled) {
    console.log(`⚠ ${circuit.id} not compiled`);
    continue;
  }

  const wasmPath = path.join(buildDir, circuit.wasm);
  const zkeyPath = path.join(buildDir, circuit.zkey);
  const vkeyPath = path.join(buildDir, circuit.verification_key);

  let allPresent = true;
  if (!fs.existsSync(wasmPath)) {
    console.error(`✗ ${circuit.id}.wasm not found`);
    allPresent = false;
  }
  if (!fs.existsSync(zkeyPath)) {
    console.error(`✗ ${circuit.id}_final.zkey not found`);
    allPresent = false;
  }
  if (!fs.existsSync(vkeyPath)) {
    console.error(`✗ ${circuit.id}_verification_key.json not found`);
    allPresent = false;
  }

  if (allPresent) {
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    console.log(`✓ ${circuit.id} (${circuit.constraints} constraints, protocol: ${vkey.protocol})`);
    loadedCount++;
  }
}

console.log(`\n✓ Successfully loaded ${loadedCount}/${registry.circuits.length} circuits`);

if (loadedCount === registry.circuits.length) {
  console.log('\n✅ ALL CIRCUITS FULLY LOADED AND READY');
  process.exit(0);
} else {
  console.log('\n⚠ Some circuits failed to load');
  process.exit(1);
}
