const fs = require('fs');
const path = require('path');

const productionDir = __dirname + '/production';
const files = fs.readdirSync(productionDir).filter(f => f.endsWith('.circom'));

for (const file of files) {
  const filePath = path.join(productionDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove duplicate pragma statements
  content = content.replace(/pragma circom 2.1.3;\n+pragma circom 2.1.3;/g, 'pragma circom 2.1.3;');
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${file}`);
}

console.log('All pragmas fixed');
