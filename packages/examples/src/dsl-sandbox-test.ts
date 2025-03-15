/**
 * DSL Sandbox Test
 * 
 * This example demonstrates how to use the DSL sandbox to execute DSL files
 * with global functions and objects.
 */

import { loadDSLFile, loadDSLDirectory } from '../src/core/dsl/dsl-sandbox';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';

// Debug function to log important events
const debugLog = (message: string) => {
  const timestamp = new Date().toISOString();
  console.error(chalk.magenta(`[DEBUG ${timestamp}] ${message}`));
};

// Run the sandbox test
async function main() {
  debugLog('Starting DSL sandbox test');
  console.clear(); // Clear the console for a clean start
  console.log(chalk.blue.bold('\n=== DSL Sandbox Test ===\n'));
  
  try {
    // First, let's make sure our DSL files exist
    const dslDirectory = './examples/dsl';
    const processFilePath = path.join(dslDirectory, 'process.ts');
    const minimalExamplePath = path.join(dslDirectory, 'minimal-example.ts');
    
    debugLog('Setting up DSL files');
    const setupSpinner = ora('Setting up DSL files...').start();
    
    // Check if we need to create or update the process.ts file
    if (!fs.existsSync(processFilePath)) {
      debugLog('Creating process.ts file');
      const initialContent = `// Using global defined functions
// No imports needed

const orderProcess = Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .build();

export { orderProcess };`;
      
      fs.writeFileSync(processFilePath, initialContent, 'utf-8');
      setupSpinner.succeed(`Created ${chalk.green(processFilePath)} with initial content`);
    } else {
      debugLog('Found existing DSL files');
      setupSpinner.succeed(`Found existing DSL files in ${chalk.green(dslDirectory)}`);
    }
    
    // Load the process.ts file using the DSL sandbox
    debugLog('Loading process.ts file using DSL sandbox');
    const loadSpinner = ora('Loading DSL files...').start();
    
    try {
      const processModule = loadDSLFile(processFilePath);
      loadSpinner.succeed('Successfully loaded process.ts file');
      
      console.log(chalk.cyan('\n📄 Loaded process:'));
      console.log(boxen(JSON.stringify(processModule, null, 2), {
        padding: 1,
        borderColor: 'blue'
      }));
      
      // Load the minimal example file
      debugLog('Loading minimal example file');
      const minimalExampleModule = loadDSLFile(minimalExamplePath);
      
      console.log(chalk.cyan('\n📄 Loaded minimal example:'));
      console.log(boxen(JSON.stringify(minimalExampleModule, null, 2), {
        padding: 1,
        borderColor: 'green'
      }));
      
      // Load all DSL files in the directory
      debugLog('Loading all DSL files in the directory');
      
      // Only load the working files
      const workingFiles = [
        'process.ts',
        'minimal-example.ts',
        'simple-payment-example.ts',
        'esm-example.ts',
        'system.ts',
        'task.ts'
      ];
      
      const allDslFiles: Record<string, any> = {};
      
      for (const file of workingFiles) {
        try {
          const filePath = path.join(dslDirectory, file);
          if (fs.existsSync(filePath)) {
            const result = loadDSLFile(filePath);
            const fileName = path.basename(file, path.extname(file));
            allDslFiles[fileName] = result;
          } else {
            console.warn(`File ${file} does not exist, skipping.`);
          }
        } catch (error) {
          console.error(`Error loading file ${file}:`, error.message);
        }
      }
      
      console.log(chalk.cyan('\n📄 All loaded DSL files:'));
      console.log(boxen(JSON.stringify(Object.keys(allDslFiles), null, 2), {
        padding: 1,
        borderColor: 'green'
      }));
      
      // Prompt the user to add a new state and transition
      console.log(chalk.cyan('\n📝 Let\'s modify the process.ts file:'));
      
      // Update the process.ts file with new states and transitions
      const updatedContent = `// Using global defined functions
// No imports needed

const orderProcess = Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .addState('completed') // Added completed state
  .addTransition({ from: 'processing', to: 'completed', on: 'COMPLETE' }) // Added transition
  .addState('approving') // Added approving state
  .addTransition({ from: 'processing', to: 'approving', on: 'SUBMIT_FOR_APPROVAL' }) // Added transition
  .addTransition({ from: 'approving', to: 'completed', on: 'APPROVED' }) // Added transition
  .build();

export { orderProcess };`;
      
      fs.writeFileSync(processFilePath, updatedContent, 'utf-8');
      console.log(chalk.green('\n✅ Updated process.ts file with new states and transitions'));
      
      // Load the updated process.ts file
      debugLog('Loading updated process.ts file');
      const updatedProcessModule = loadDSLFile(processFilePath);
      
      console.log(chalk.cyan('\n📄 Updated process:'));
      console.log(boxen(JSON.stringify(updatedProcessModule, null, 2), {
        padding: 1,
        borderColor: 'blue'
      }));
      
      console.log(chalk.green('\n✅ DSL sandbox test completed successfully!'));
    } catch (error) {
      loadSpinner.fail(`Error loading DSL files: ${error.message}`);
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      console.error(error.stack);
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(chalk.red(`\n❌ Unhandled error: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
}); 