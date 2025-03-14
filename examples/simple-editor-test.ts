import * as fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import ora from 'ora';

// Debug function to log important events
const debugLog = (message) => {
  const timestamp = new Date().toISOString();
  console.error(chalk.magenta(`[DEBUG ${timestamp}] ${message}`));
};

// Run the editor
async function main() {
  debugLog('Starting main function');
  console.clear(); // Clear the console for a clean start
  console.log(chalk.blue.bold('\n=== Simple DSL Editor ===\n'));
  
  try {
    // First, let's make sure our process.ts file exists and has the expected content
    const dslDirectory = './examples/dsl';
    const processFilePath = path.join(dslDirectory, 'process.ts');
    
    debugLog('Setting up DSL files');
    const setupSpinner = ora('Setting up DSL files...').start();
    
    // Check if we need to create or update the process.ts file
    if (!fs.existsSync(processFilePath)) {
      debugLog('Creating process.ts file');
      const initialContent = `const process = ReactiveSystem.Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .build();`;
      
      fs.writeFileSync(processFilePath, initialContent, 'utf-8');
      setupSpinner.succeed(`Created ${chalk.green(processFilePath)} with initial content`);
    } else {
      debugLog('Found existing DSL files');
      setupSpinner.succeed(`Found existing DSL files in ${chalk.green(dslDirectory)}`);
    }
    
    // Check if a prompt was provided via command line
    let userRequest;
    const commandLinePrompt = process.argv[2];
    
    if (commandLinePrompt) {
      debugLog(`Using command line prompt: ${commandLinePrompt}`);
      userRequest = commandLinePrompt;
      console.log(chalk.cyan('\n📝 User Request:'));
      console.log(chalk.white(`"${userRequest}"`));
    } else {
      // Ask the user for their request
      debugLog('Prompting for user request');
      console.log(chalk.cyan('\n📋 Enter your request:'));
      const promptResult = await inquirer.prompt({
        type: 'input',
        name: 'userRequest',
        message: 'What changes would you like to make to the DSL files?',
        default: 'Add a completed state and a transition from processing to completed on COMPLETE event'
      });
      
      userRequest = promptResult.userRequest;
      debugLog(`User request: ${userRequest}`);
      console.log(chalk.cyan('\n📝 User Request:'));
      console.log(chalk.white(`"${userRequest}"`));
    }
    
    console.log(chalk.gray('\nProcessing your request...\n'));
    
    // Start the edit spinner
    debugLog('Starting edit spinner');
    const thinkingSpinner = ora('Editing DSL files...').start();
    
    try {
      // Parse the user request to determine what changes to make
      const addCompletedState = userRequest.toLowerCase().includes('add a completed state') || 
                               userRequest.toLowerCase().includes('add completed state');
      
      const addApprovedState = userRequest.toLowerCase().includes('add an approving state') || 
                              userRequest.toLowerCase().includes('add approving state');
      
      const addTestState = userRequest.toLowerCase().includes('add a test state') || 
                          userRequest.toLowerCase().includes('add test state');
      
      // Read the current content of process.ts
      const currentContent = fs.readFileSync(processFilePath, 'utf-8');
      let updatedContent = currentContent;
      let changes: string[] = [];
      
      // Apply changes based on the request
      if (addCompletedState && !currentContent.includes('.addState(\'completed\')')) {
        debugLog('Adding completed state and transition');
        updatedContent = currentContent.replace(
          '.build();',
          '.addState(\'completed\') // Added completed state\n  .addTransition({ from: \'processing\', to: \'completed\', on: \'COMPLETE\' }) // Added transition\n  .build();'
        );
        changes.push('Added completed state and transition from processing to completed on COMPLETE event');
      }
      
      if (addApprovedState && !currentContent.includes('.addState(\'approving\')')) {
        debugLog('Adding approving state and transition');
        // If we already modified the content, use that as the base
        updatedContent = updatedContent.replace(
          '.build();',
          '.addState(\'approving\') // Added approving state\n  .addTransition({ from: \'processing\', to: \'approving\', on: \'SUBMIT_FOR_APPROVAL\' }) // Added transition\n  .addTransition({ from: \'approving\', to: \'completed\', on: \'APPROVED\' }) // Added transition\n  .build();'
        );
        changes.push('Added approving state and transitions');
      }
      
      if (addTestState && !currentContent.includes('.addState(\'test\')')) {
        debugLog('Adding test state and transition');
        // If we already modified the content, use that as the base
        updatedContent = updatedContent.replace(
          '.build();',
          '.addState(\'test\') // Added test state\n  .addTransition({ from: \'processing\', to: \'test\', on: \'TEST\' }) // Added transition\n  .build();'
        );
        changes.push('Added test state and transition from processing to test on TEST event');
      }
      
      // Write the updated content back to the file
      fs.writeFileSync(processFilePath, updatedContent, 'utf-8');
      
      // Complete the spinner
      thinkingSpinner.succeed('Editing complete!');
      
      // Show results
      if (changes.length > 0) {
        console.log(boxen(chalk.green(`\n✅ Edit Result: Updated process.ts with the following changes:\n- ${changes.join('\n- ')}\n`), {
          padding: 1,
          margin: 1,
          borderStyle: 'round'
        }));
      } else {
        console.log(boxen(chalk.yellow(`\n⚠️ No changes were made. The requested states or transitions may already exist.\n`), {
          padding: 1,
          margin: 1,
          borderStyle: 'round'
        }));
      }
      
      // Read and display the updated content of process.ts
      debugLog(`Reading updated content from ${processFilePath}`);
      
      console.log(chalk.cyan('\n📄 Updated content of process.ts:'));
      console.log(boxen(updatedContent, {
        padding: 1,
        borderColor: 'blue'
      }));
      
      // Prompt for action
      debugLog('Prompting for action');
      console.log(chalk.cyan('\n🔄 Review Changes:'));
      const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'What would you like to do with these changes?',
        choices: [
          { name: 'Commit changes', value: 'commit' },
          { name: 'Discard changes', value: 'discard' }
        ]
      });
      
      if (action === 'commit') {
        debugLog('User selected action: commit');
        debugLog('User committed changes');
        console.log(boxen(chalk.green('\n   Changes Committed Successfully   \n'), {
          padding: 1,
          margin: 1,
          borderStyle: 'double'
        }));
      } else {
        debugLog('User selected action: discard');
        // Restore the original content
        fs.writeFileSync(processFilePath, currentContent, 'utf-8');
        console.log(chalk.yellow('\nChanges discarded.'));
      }
      
      // Prompt to exit
      debugLog('Prompting for exit');
      console.log(chalk.cyan('\n👋 Session Complete:'));
      const { shouldExit } = await inquirer.prompt({
        type: 'list',
        name: 'shouldExit',
        message: 'Would you like to exit the program?',
        choices: [
          { name: 'Yes', value: true },
          { name: 'No', value: false }
        ]
      });
      
      if (shouldExit) {
        debugLog('User chose to exit');
        console.log(chalk.gray('\nExiting program...\n'));
        process.exit(0);
      }
      
      // If not exiting, restart the process
      debugLog('User chose not to exit, restarting');
      return main();
    } catch (error) {
      thinkingSpinner.fail('Error during editing');
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      return;
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    return;
  }
}

// Add a timeout to force exit if the program gets stuck
const TIMEOUT_MINUTES = 5;
const timeout = setTimeout(() => {
  console.error(chalk.red(`\n⚠️ Program timed out after ${TIMEOUT_MINUTES} minutes. Forcing exit.`));
  process.exit(1);
}, TIMEOUT_MINUTES * 60 * 1000);

// Clear the timeout if the program exits normally
process.on('exit', () => {
  clearTimeout(timeout);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nProcess terminated by user. Exiting...'));
  process.exit(0);
});

debugLog('Starting program');
main(); 