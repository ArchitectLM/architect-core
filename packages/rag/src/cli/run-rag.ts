#!/usr/bin/env node

import { CliTool } from './cli-tool.js';
import { SessionManager } from './session-manager.js';
import { VectorConfigStore } from './vector-config-store.js';
import { ErrorFormatter } from './error-formatter.js';
import { LLMService } from '../llm/llm-service.js';
import { CodeValidator } from '../validation/code-validator.js';
import { CliCommandHandler } from './cli-command-handler.js';
import { ChromaDBConnector } from '../vector-db/chroma-connector.js';

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
    
    // Initialize command handler
    const commandHandler = new CliCommandHandler(llmService, codeValidator);
    
    // Initialize session manager with command handler
    const sessionManager = new SessionManager(commandHandler);

    // Initialize vector database connector and config store
    const vectorDB = new ChromaDBConnector({
      collectionName: "rag-components",
      embeddingDimension: 1536, // OpenAI embedding dimension
      distance: "cosine",
      persistDirectory: "./data/chroma" // Optional: for persistence
    });
    const configStore = new VectorConfigStore(vectorDB);
    
    const cliTool = new CliTool(
      llmService,
      codeValidator,
      commandHandler,
      sessionManager,
      configStore,
      errorFormatter
    );

    // Start the workflow with a welcome message
    console.log('Welcome to the RAG CLI Tool!');
    console.log('Type your command or "help" for available commands.');

    // Example workflow execution
    const result = await cliTool.executeWorkflow('help');
    console.log(result.message);

  } catch (error) {
    console.error('Error running RAG workflow:', error);
    process.exit(1);
  }
}

main(); 