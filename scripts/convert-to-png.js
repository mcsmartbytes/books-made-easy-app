const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

async function convertSvgToPng() {
  const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));

  for (const file of files) {
    const svgPath = path.join(iconsDir, file);
    const pngPath = path.join(iconsDir, file.replace('.svg', '.png'));

    try {
      const svgBuffer = fs.readFileSync(svgPath);

      // Extract dimensions from filename
      const match = file.match(/(\d+)x(\d+)/);
      if (match) {
        const width = parseInt(match[1]);
        const height = parseInt(match[2]);

        await sharp(svgBuffer)
          .resize(width, height)
          .png()
          .toFile(pngPath);

        console.log(`Converted: ${file} -> ${file.replace('.svg', '.png')}`);
      }
    } catch (error) {
      console.error(`Error converting ${file}:`, error.message);
    }
  }

  console.log('\nPNG conversion complete!');
}

convertSvgToPng();
