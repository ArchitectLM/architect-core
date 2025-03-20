// Script to update imports in the extensions package
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get all files with .ts imports
const output = execSync('grep -r "import.*from.*\\.ts" packages/extensions/src').toString();
const files = new Set();

// Extract unique files
output.split('\n').forEach(line => {
  if (line.trim() === '') return;
  const filePath = line.split(':')[0];
  if (filePath) {
    files.add(filePath);
  }
});

console.log(`Found ${files.size} files with .ts imports`);

// Update each file
files.forEach(filePath => {
  console.log(`Updating ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace .ts with .js in imports
  content = content.replace(/from\s+['"](.+)\.ts['"]/g, 'from \'$1.js\'');
  
  fs.writeFileSync(filePath, content);
});

console.log('Done updating imports'); 