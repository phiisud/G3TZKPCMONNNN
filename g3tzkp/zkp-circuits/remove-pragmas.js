const fs = require('fs');
const path = require('path');

const productionDir = __dirname + '/production';
const files = fs.readdirSync(productionDir).filter(f => f.endsWith('.circom'));

for (const file of files) {
  const filePath = path.join(productionDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove pragma statement
  content = content.replace(/^pragma circom 2.1.3;\n\n/m, '');
  
  fs.writeFileSync(filePath, content);
  console.log(`Removed pragma from: ${file}`);
}

console.log('All pragmas removed');
