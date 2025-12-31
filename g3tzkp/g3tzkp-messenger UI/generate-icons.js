#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const generateSVGIcon = (size) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00f3ff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4caf50;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#010401" rx="${size * 0.15}"/>
  
  <!-- Flower of Life pattern -->
  <g opacity="0.8" fill="none" stroke="url(#grad)" stroke-width="${size * 0.01}">
    <circle cx="${size/2}" cy="${size/2}" r="${size * 0.12}"/>
    <circle cx="${size/2 + size * 0.12}" cy="${size/2}" r="${size * 0.12}"/>
    <circle cx="${size/2 - size * 0.12}" cy="${size/2}" r="${size * 0.12}"/>
    <circle cx="${size/2 + size * 0.06}" cy="${size/2 + size * 0.104}" r="${size * 0.12}"/>
    <circle cx="${size/2 - size * 0.06}" cy="${size/2 + size * 0.104}" r="${size * 0.12}"/>
    <circle cx="${size/2 + size * 0.06}" cy="${size/2 - size * 0.104}" r="${size * 0.12}"/>
    <circle cx="${size/2 - size * 0.06}" cy="${size/2 - size * 0.104}" r="${size * 0.12}"/>
  </g>
  
  <!-- Center glow -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.08}" fill="#00f3ff" opacity="0.3"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.04}" fill="#00f3ff" opacity="0.6"/>
  
  <!-- Text -->
  <text x="${size/2}" y="${size * 0.75}" 
        font-family="Orbitron, Arial, sans-serif" 
        font-size="${size * 0.15}" 
        font-weight="700"
        fill="#00f3ff" 
        text-anchor="middle">G3ZKP</text>
</svg>`;
  
  return svg;
};

console.log('🎨 Generating PWA icons...\n');

sizes.forEach(size => {
  const svg = generateSVGIcon(size);
  const filename = `icon-${size}x${size}.png`;
  const svgFilename = `icon-${size}x${size}.svg`;
  const svgPath = path.join(iconsDir, svgFilename);
  
  fs.writeFileSync(svgPath, svg);
  console.log(`✓ Generated ${svgFilename}`);
});

console.log('\n✓ Icon generation complete!');
console.log('\n📝 Note: SVG icons have been generated.');
console.log('   For production, convert these to PNG using an online tool or:');
console.log('   - Use https://www.aconvert.com/image/svg-to-png/');
console.log('   - Or install sharp: npm install sharp');
console.log('   - Then run: node convert-icons-to-png.js\n');

const convertScript = `// Optional: Convert SVG to PNG using sharp
// Run: npm install sharp
// Then: node convert-icons-to-png.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'public', 'icons');

async function convertIcons() {
  console.log('Converting SVG icons to PNG...');
  
  for (const size of sizes) {
    const svgPath = path.join(iconsDir, \`icon-\${size}x\${size}.svg\`);
    const pngPath = path.join(iconsDir, \`icon-\${size}x\${size}.png\`);
    
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(\`✓ Converted icon-\${size}x\${size}.png\`);
  }
  
  console.log('\\n✓ Conversion complete!');
}

convertIcons().catch(console.error);
`;

fs.writeFileSync(
  path.join(__dirname, 'convert-icons-to-png.js'),
  convertScript
);

console.log('✓ Created convert-icons-to-png.js for optional PNG conversion\n');
