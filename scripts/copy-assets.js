const fs = require('fs');
const path = require('path');

const sourceDir = path.join(process.cwd(), 'src', 'assets');
const targetDir = path.join(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(sourceDir)) {
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

for (const entry of fs.readdirSync(sourceDir)) {
  const sourcePath = path.join(sourceDir, entry);
  const targetPath = path.join(targetDir, entry);
  if (fs.statSync(sourcePath).isFile()) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}
