const fs = require('fs');
const path = require('path');

const productionDir = __dirname + '/production';
const files = fs.readdirSync(productionDir).filter(f => f.endsWith('.circom'));

for (const file of files) {
  const filePath = path.join(productionDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace include paths to go up to parent directory
  // From: include "circomlib/circuits/...";
  // To: include "../node_modules/circomlib/circuits/...";
  
  content = content.replace(/include "circomlib\//g, 'include "../node_modules/circomlib/');
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed includes in: ${file}`);
}

console.log('\nAll include paths fixed');
