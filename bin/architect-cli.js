#!/usr/bin/env node

/**
 * ArchitectLM CLI
 * 
 * Command-line interface for the ArchitectLM framework
 */

// Use tsx to run TypeScript files directly
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = resolve(__dirname, '../src/cli/index.ts');

// Spawn tsx with the CLI script
const child = spawn('npx', ['tsx', cliPath, ...process.argv.slice(2)], { 
  stdio: 'inherit',
  shell: true
});

// Handle process exit
child.on('exit', (code) => {
  process.exit(code);
}); 