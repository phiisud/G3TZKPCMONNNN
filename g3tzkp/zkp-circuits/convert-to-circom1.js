const fs = require('fs');
const path = require('path');

const productionDir = __dirname + '/production';
const files = fs.readdirSync(productionDir).filter(f => f.endsWith('.circom'));

for (const file of files) {
  const filePath = path.join(productionDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Convert component main syntax from Circom 2.x to Circom 1.x
  // From: component main {public [inputs]} = Template();
  // To: component main = new Template();
  // Then mark inputs as input signals manually
  
  // Match the pattern and extract template name and inputs
  const mainRegex = /^component main \{public \[(.*?)\]\} = (\w+)\(\);$/m;
  const match = content.match(mainRegex);
  
  if (match) {
    const publicInputs = match[1];
    const templateName = match[2];
    
    // Replace the main component line
    content = content.replace(mainRegex, `component main = new ${templateName}();`);
    
    console.log(`Converted main component in: ${file}`);
    console.log(`  Template: ${templateName}`);
    console.log(`  Public inputs: ${publicInputs}`);
  }
  
  // Also handle signal output patterns
  // In Circom 2.x: signal output varName;
  // In Circom 1.x: signal output varName;
  // This should already be compatible, but output declarations inside templates need to be signal output
  
  fs.writeFileSync(filePath, content);
}

console.log('\nAll files converted to Circom 1.x syntax');
