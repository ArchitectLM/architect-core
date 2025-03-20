#!/usr/bin/env tsx

/**
 * CLI script for editing DSL files using the RAG agent editor
 * 
 * Usage: tsx src/cli/edit-dsl.ts <dsl-directory> <edit-prompt>
 * 
 * Example: tsx src/cli/edit-dsl.ts ./examples/dsl "Add a refunded state to the OrderProcess"
 */

import { createRAGAgentEditor } from '../core/extensions/rag-agent-editor';
import { createRuntime } from '../core/implementations/runtime';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

/**
 * Create a readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask a question and get the user's response
 * @param rl The readline interface
 * @param question The question to ask
 * @returns The user's response
 */
async function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Main function to run the CLI
 */
async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: tsx src/cli/edit-dsl.ts <dsl-directory> <edit-prompt>');
    process.exit(1);
  }
  
  const dslDirectory = args[0];
  const userPrompt = args.slice(1).join(' ');
  
  console.log('=== ArchitectLM DSL Editor ===');
  console.log(`Directory: ${dslDirectory}`);
  console.log(`Edit request: ${userPrompt}`);
  console.log('');
  
  // Create the RAG agent editor
  const editor = createRAGAgentEditor({
    provider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'local' | 'custom' | 'openrouter') || 'openai',
    model: process.env.LLM_MODEL || 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.LLM_PROVIDER === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined,
    temperature: 0.7,
    maxTokens: 4000,
    debug: process.env.DEBUG === 'true',
    systemPrompt: `You are an expert in modifying ArchitectLM DSL files.
Your task is to understand existing DSL code and make requested changes.
Analyze the files carefully before suggesting modifications.

When editing DSL files:
1. Preserve the existing structure and style
2. Only make the changes requested by the user
3. Return the complete file content with your changes
4. Explain your changes clearly

The DSL uses a fluent API with methods like:
- Process.create() or ReactiveSystem.Process.create()
- Task.create() or ReactiveSystem.Task.create()
- System.create() or ReactiveSystem.System.create()
- withDescription(), withInitialState(), addState(), addTransition(), etc.

Be precise and careful with your edits.`
  });
  
  // Create a runtime
  const runtime = createRuntime({}, {}, {});
  
  // Initialize the editor
  await editor.initialize(runtime);
  
  // Create a readline interface for interactive mode
  const rl = createReadlineInterface();
  
  try {
    // Ask if the user wants to run in interactive mode
    const interactiveMode = await askQuestion(rl, 'Run in interactive mode? (y/n): ');
    
    // Edit the DSL files
    const summary = await editor.editDSL({
      dslDirectory,
      userRequest: userPrompt,
      interactive: interactiveMode.toLowerCase() === 'y',
      debug: process.env.DEBUG === 'true'
    });
    
    console.log('\n=== Edit Summary ===');
    console.log(summary);
  } catch (error) {
    console.error('Error editing DSL files:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 