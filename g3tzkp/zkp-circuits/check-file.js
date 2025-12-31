const fs = require('fs');

const file = './production/authentication.circom';
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

console.log('First 5 lines:');
for (let i = 0; i < 5; i++) {
  console.log(`Line ${i}: "${lines[i]}"`);
}

console.log('\nFirst 100 characters:');
console.log(JSON.stringify(content.substring(0, 100)));
