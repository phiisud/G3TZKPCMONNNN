import { ZKPEngine } from './zkp-engine';
import * as path from 'path';

async function testEngineInitialization() {
  console.log('=== Testing ZKP Engine Full Load ===\n');

  const buildDir = path.join(__dirname, '../../zkp-circuits/build');
  const engine = new ZKPEngine(buildDir);

  try {
    await engine.initialize();
    
    const isInitialized = engine.isInitialized();
    console.log(`✓ Engine initialized: ${isInitialized}`);

    const circuitList = await engine.listCircuits();
    console.log(`✓ Circuits loaded: ${circuitList.length}`);

    for (const circuit of circuitList) {
      console.log(`  - ${circuit.id}: ${circuit.constraints} constraints`);
    }

    const stats = engine.getStats();
    console.log(`\n✓ Circuits in registry: ${stats.circuitsLoaded}`);
    console.log(`✓ Deployment ready: ${stats.deploymentGrade ? 'YES' : 'NO'}`);

    if (stats.deploymentGrade && stats.circuitsLoaded === 7) {
      console.log('\n✅ ALL 7 CIRCUITS FULLY LOADED AND READY FOR PRODUCTION');
      process.exit(0);
    } else {
      console.error(`\n⚠ Expected 7 circuits, got ${stats.circuitsLoaded}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Initialization failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testEngineInitialization().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
