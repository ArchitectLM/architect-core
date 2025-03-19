#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CliTool } from './cli-tool.js';
import { SessionManager } from './session-manager.js';
import { VectorConfigStore } from './vector-config-store.js';
import { ErrorFormatter } from './error-formatter.js';
import { LLMService } from '../llm/llm-service.js';
import { CodeValidator } from '../validation/code-validator.js';
import { CliCommandHandler } from './cli-command-handler.js';
import { ChromaDBConnector } from '../vector-db/chroma-connector.js';
import { ComponentSearch } from '../search/component-search.js';
import { VectorDBConfig, Component } from '../models.js';
import readline from 'readline';
import { exampleComponents } from '../../tests/cli/fixtures/example-components.js';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../..');
config({ path: join(rootDir, '.env') });

/**
 * Interactive CLI tool for RAG Agent interaction
 */
async function main() {
  try {
    // Initialize services with configurations
    const llmService = new LLMService({
      model: "gpt-4",
      maxTokens: 2048,
      temperature: 0.7
    });

    const codeValidator = new CodeValidator();
    const errorFormatter = new ErrorFormatter();
    
    // Track current components in the session
    let currentComponents: Component[] = [];
    let editedComponents: Component[] = [];
    
    // Initialize command handler with system prompt
    const systemPrompt = `You are a TypeScript code generator. Your task is to generate clean, well-documented TypeScript code following best practices.

Guidelines:
1. Use proper TypeScript syntax and features
2. Include all necessary imports
3. Add JSDoc comments for classes, interfaces, and methods
4. Handle errors appropriately
5. Make code modular and reusable
6. Follow naming conventions (camelCase for variables/methods, PascalCase for classes/interfaces)
7. Use strict typing (avoid 'any' type)
8. Include proper error handling
9. Add input validation where necessary
10. Follow SOLID principles

Example components for reference:
${exampleComponents.map((c: Component) => `\n// ${c.name} (${c.type})
${c.content}`).join('\n')}

Please generate code that follows these guidelines and matches the example structure.`;
    
    const commandHandler = new CliCommandHandler(llmService, codeValidator, systemPrompt);
    
    // Initialize session manager with command handler
    const sessionManager = new SessionManager(commandHandler);

    // Initialize vector database connector and config store
    const vectorDBConfig: VectorDBConfig = {
      collectionName: "rag-components",
      embeddingDimension: 1536, // OpenAI embedding dimension
      distance: "cosine",
      persistDirectory: "./data/chroma" // Optional: for persistence
    };
    const vectorDB = new ChromaDBConnector(vectorDBConfig);
    
    // Initialize ChromaDB
    await vectorDB.initialize();
    
    const configStore = new VectorConfigStore(vectorDB);
    
    // Initialize component search
    const componentSearch = new ComponentSearch(vectorDB);
    
    // Initialize CLI tool
    const cliTool = new CliTool(
      llmService,
      codeValidator,
      sessionManager,
      configStore,
      errorFormatter,
      componentSearch
    );

    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Welcome message
    console.log('\n=== Welcome to the RAG CLI Tool ===');
    console.log('Available commands:');
    console.log('- help: Show this help message');
    console.log('- generate <description>: Generate new components');
    console.log('- feedback <message>: Provide feedback on the current components');
    console.log('- commit: Commit the current components');
    console.log('- list: Show current and edited components');
    console.log('- exit: Exit the CLI\n');

    // Main interaction loop
    while (true) {
      const input = await new Promise<string>(resolve => {
        rl.question('> ', resolve);
      });

      const [command, ...args] = input.trim().split(' ');
      const description = args.join(' ');

      switch (command.toLowerCase()) {
        case 'help':
          console.log('\nAvailable commands:');
          console.log('- help: Show this help message');
          console.log('- generate <description>: Generate new components');
          console.log('- feedback <message>: Provide feedback on the current components');
          console.log('- commit: Commit the current components');
          console.log('- list: Show current and edited components');
          console.log('- exit: Exit the CLI\n');
          break;

        case 'generate':
          if (!description) {
            console.log('Error: Please provide a description for the components');
            continue;
          }
          try {
            console.log('\nGenerating components...');
            // Get raw response from LLM
            const prompt = `Generate complete components based on this request: "${description}"

Important:
1. Generate all necessary components without any cuts or truncation
2. Include all necessary imports, types, and interfaces
3. Show the full implementation of all methods and classes
4. Do not use placeholders or "..." to indicate omitted code
5. Ensure all code blocks are properly closed
6. If multiple components are needed, clearly separate them with comments
7. Each component should be self-contained and properly typed

Please provide the entire implementation of all required components.`;
            const rawResponse = await llmService.getRawResponse(prompt, systemPrompt);
            console.log('\n=== Raw LLM Response ===');
            console.log(rawResponse);
            
            // Process the response into components
            const result = await cliTool.executeWorkflow(description);
            if (result.success) {
              // Add new components to current components
              if (Array.isArray(result.component)) {
                currentComponents = [...currentComponents, ...result.component];
              } else {
                currentComponents.push(result.component);
              }
              
              console.log('\n=== Generated Components ===');
              currentComponents.forEach((component, index) => {
                console.log(`\nComponent ${index + 1}:`);
                console.log(component.content);
                console.log('\nMetadata:');
                console.log(JSON.stringify(component.metadata, null, 2));
              });
            } else {
              console.log('Error:', result.message);
            }
          } catch (error) {
            console.error('Error generating components:', error);
          }
          break;

        case 'feedback':
          if (!description) {
            console.log('Error: Please provide feedback message');
            continue;
          }
          try {
            console.log('\nApplying feedback...');
            // Get raw response from LLM
            const prompt = `Improve the components based on this feedback: "${description}"`;
            const rawResponse = await llmService.getRawResponse(prompt, systemPrompt);
            console.log('\n=== Raw LLM Response ===');
            console.log(rawResponse);
            
            // Process the response into components
            const result = await cliTool.executeWorkflowWithFeedback('', description);
            if (result.success) {
              // Update edited components
              if (Array.isArray(result.component)) {
                editedComponents = [...editedComponents, ...result.component];
              } else {
                editedComponents.push(result.component);
              }
              
              console.log('\n=== Updated Components ===');
              editedComponents.forEach((component, index) => {
                console.log(`\nComponent ${index + 1}:`);
                console.log(component.content);
                console.log('\nMetadata:');
                console.log(JSON.stringify(component.metadata, null, 2));
              });
            } else {
              console.log('Error:', result.message);
            }
          } catch (error) {
            console.error('Error applying feedback:', error);
          }
          break;

        case 'list':
          console.log('\n=== Current Components ===');
          currentComponents.forEach((component, index) => {
            console.log(`\nComponent ${index + 1}:`);
            console.log(`Name: ${component.name}`);
            console.log(`Type: ${component.type}`);
            console.log(`Path: ${component.metadata.path}`);
          });
          
          if (editedComponents.length > 0) {
            console.log('\n=== Edited Components ===');
            editedComponents.forEach((component, index) => {
              console.log(`\nComponent ${index + 1}:`);
              console.log(`Name: ${component.name}`);
              console.log(`Type: ${component.type}`);
              console.log(`Path: ${component.metadata.path}`);
            });
          }
          break;

        case 'commit':
          try {
            // Commit both current and edited components
            const allComponents = [...currentComponents, ...editedComponents];
            const result = await cliTool.executeWorkflow('commit');
            console.log(result.message);
            
            // Clear the lists after successful commit
            currentComponents = [];
            editedComponents = [];
          } catch (error) {
            console.error('Error committing components:', error);
          }
          break;

        case 'exit':
          rl.close();
          console.log('\nGoodbye!');
          process.exit(0);
          break;

        default:
          console.log('Unknown command. Type "help" for available commands.');
      }
    }

  } catch (error) {
    console.error('Error running RAG CLI:', error);
    process.exit(1);
  }
}

// Run the CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 