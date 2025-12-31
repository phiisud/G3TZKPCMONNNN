const fs = require('fs');
const path = require('path');

const buildDir = 'zkp-circuits\\build';
const outputFile = 'build-check-output.txt';

let output = '';

function log(msg) {
  console.log(msg);
  output += msg + '\n';
}

try {
  const files = fs.readdirSync(buildDir);
  log('Build directory contents:');
  log(JSON.stringify(files, null, 2));
  
  if (files.length === 0) {
    log('⚠️  Build directory is empty - compilation may not have run');
  } else {
    log(`✅ Found ${files.length} files in build directory`);
    files.forEach(f => {
      try {
        const stat = fs.statSync(path.join(buildDir, f));
        log(`  - ${f} (${stat.size} bytes)`);
      } catch (e) {
        log(`  - ${f} (error reading)`);
      }
    });
  }
} catch (err) {
  log('Error reading build directory: ' + err.message);
}

fs.writeFileSync(outputFile, output);
log(`\nOutput written to ${outputFile}`);
