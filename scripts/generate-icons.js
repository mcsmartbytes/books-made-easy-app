const fs = require('fs');
const path = require('path');

// Simple SVG icon template - blue background with "B" letter
const createIconSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, sans-serif" font-weight="bold" font-size="${size * 0.5}" fill="white">B</text>
</svg>
`;

// Create splash screen SVG
const createSplashSVG = (width, height) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b"/>
      <stop offset="100%" style="stop-color:#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <g transform="translate(${width/2}, ${height/2})">
    <rect x="-60" y="-60" width="120" height="120" rx="24" fill="#3b82f6"/>
    <text x="0" y="15" dominant-baseline="middle" text-anchor="middle"
          font-family="Arial, sans-serif" font-weight="bold" font-size="60" fill="white">B</text>
  </g>
  <text x="${width/2}" y="${height/2 + 100}" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, sans-serif" font-weight="600" font-size="24" fill="white">Books Made Easy</text>
</svg>
`;

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes needed for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate icon SVGs
iconSizes.forEach(size => {
  const svgContent = createIconSVG(size);
  const filename = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(filename, svgContent.trim());
  console.log(`Created: icon-${size}x${size}.svg`);
});

// Splash screen sizes for iOS
const splashSizes = [
  { width: 640, height: 1136, name: 'splash-640x1136' },
  { width: 750, height: 1334, name: 'splash-750x1334' },
  { width: 1242, height: 2208, name: 'splash-1242x2208' },
  { width: 1125, height: 2436, name: 'splash-1125x2436' },
  { width: 1536, height: 2048, name: 'splash-1536x2048' },
  { width: 1668, height: 2224, name: 'splash-1668x2224' },
  { width: 2048, height: 2732, name: 'splash-2048x2732' },
];

// Generate splash SVGs
splashSizes.forEach(({ width, height, name }) => {
  const svgContent = createSplashSVG(width, height);
  const filename = path.join(iconsDir, `${name}.svg`);
  fs.writeFileSync(filename, svgContent.trim());
  console.log(`Created: ${name}.svg`);
});

// Screenshot placeholders
const createScreenshotSVG = (width, height, label) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f1f5f9"/>
  <rect x="0" y="0" width="${width}" height="60" fill="#1e293b"/>
  <text x="20" y="38" font-family="Arial" font-size="20" fill="white" font-weight="bold">Books Made Easy</text>
  <text x="${width/2}" y="${height/2}" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial" font-size="24" fill="#64748b">${label}</text>
</svg>
`;

fs.writeFileSync(path.join(iconsDir, 'screenshot-wide.svg'), createScreenshotSVG(1280, 720, 'Dashboard Preview'));
fs.writeFileSync(path.join(iconsDir, 'screenshot-narrow.svg'), createScreenshotSVG(720, 1280, 'Mobile View'));

console.log('\\nAll SVG icons and splash screens created!');
console.log('\\nNote: For production, convert SVGs to PNGs using a tool like:');
console.log('  - sharp (npm install sharp)');
console.log('  - Inkscape CLI');
console.log('  - Online converter');
