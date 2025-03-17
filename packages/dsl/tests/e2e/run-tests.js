// Simple script to run the e2e tests
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testFile = resolve(__dirname, 'simple.test.ts');

console.log(`Running tests from: ${testFile}`);

// Use vitest directly to run the test file
const result = spawnSync('npx', ['vitest', 'run', testFile], {
  stdio: 'inherit',
  cwd: resolve(__dirname, '../../..')
});

process.exit(result.status); 