/**
 * @file CLI script to run the DSL editor with ChromaDB
 * @module @architectlm/rag
 */

import { CliTool } from './cli-tool.js';
import { LLMService } from '../llm/llm-service.js';
import { CodeValidator } from '../validation/code-validator.js';
import { CliCommandHandler } from './cli-command-handler.js';
import { SessionManager } from './session-manager.js';
import { VectorConfigStore } from './vector-config-store.js';
import { ErrorFormatter } from './error-formatter.js';
import { ChromaDBConnector } from '../vector-db/chroma-connector.js';
import { VectorDBConfig } from '../models.js';
import { ComponentSearch } from '../search/component-search.js';

/**
 * Run the DSL editor
 */
async function runDslEditor() {
  try {
    console.log('Initializing RAG DSL Editor...');
    
    // Initialize ChromaDB connector
    const config: VectorDBConfig = {
      collectionName: 'dsl-components',
      embeddingDimension: 384,
      distance: 'cosine',
    };
    
    console.log('Connecting to ChromaDB...');
    const chromaConnector = new ChromaDBConnector(config);
    await chromaConnector.initialize();
    console.log('ChromaDB connected successfully.');
    
    // Initialize services
    const llmService = new LLMService({
      model: 'gpt-4',
      temperature: 0.7,
    });
    
    const codeValidator = new CodeValidator();
    const commandHandler = new CliCommandHandler(llmService, codeValidator);
    const sessionManager = new SessionManager(commandHandler);
    const vectorConfigStore = new VectorConfigStore(chromaConnector);
    const errorFormatter = new ErrorFormatter();
    const componentSearch = new ComponentSearch(chromaConnector);
    
    // Initialize CLI tool
    const cliTool = new CliTool(
      llmService,
      codeValidator,
      sessionManager,
      vectorConfigStore,
      errorFormatter,
      componentSearch
    );
    
    // Get command from command line arguments
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('Usage: npm run dsl-editor "Your DSL component request"');
      console.log('Example: npm run dsl-editor "Create a new DSL component for handling user authentication"');
      return;
    }
    
    const command = args.join(' ');
    console.log(`Processing command: "${command}"`);
    
    // Execute the workflow
    const result = await cliTool.executeWorkflow(command);
    
    if (result.success) {
      console.log('✅ Success!');
      console.log(`Component ${result.component.name} (${result.component.type}) created and stored in ChromaDB.`);
      console.log('\nComponent content:');
      console.log('------------------');
      console.log(result.component.content);
      console.log('------------------');
    } else {
      console.log('❌ Error:');
      console.log(result.message);
    }
  } catch (error) {
    console.error('Error running DSL editor:', error);
  }
}

// Run the DSL editor
runDslEditor().catch(console.error); 