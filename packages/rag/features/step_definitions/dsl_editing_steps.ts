import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { CliTool } from '../../src/cli/cli-tool.js';
import { LLMService } from '../../src/llm/llm-service.js';
import { CodeValidator } from '../../src/validation/code-validator.js';
import { CliCommandHandler, CommandResult } from '../../src/cli/cli-command-handler.js';
import { SessionManager } from '../../src/cli/session-manager.js';
import { VectorConfigStore } from '../../src/cli/vector-config-store.js';
import { ErrorFormatter } from '../../src/cli/error-formatter.js';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';
import { Component, ComponentType, VectorDBConfig } from '../../src/models.js';

// State to be shared across steps
let cliTool: CliTool;
let chromaConnector: ChromaDBConnector;
let workflowResult: any;
let existingComponent: Component;

// Mock implementations for testing
class MockLLMService extends LLMService {
  async generateComponent(request: string, componentType: ComponentType): Promise<Component> {
    if (request.includes('syntax errors')) {
      return {
        type: componentType,
        name: 'ErrorComponent',
        content: 'function errorFunction() {\n  const x = 1\n  return x\n}', // Missing semicolon
        metadata: {
          path: 'src/functions/error-function.ts',
          description: 'A function with syntax errors',
          createdAt: Date.now(),
          author: 'LLM',
          tags: ['error', 'test'],
        },
      };
    }
    
    if (request.includes('Modify') && request.includes('UserAuthentication')) {
      return {
        ...existingComponent,
        content: existingComponent.content.replace(
          'function authenticateUser',
          'function authenticateUser(username: string, password: string) {\n  // Authentication logic\n  return true;\n}\n\nfunction resetPassword'
        ),
        metadata: {
          ...existingComponent.metadata,
          description: 'User authentication with password reset',
          updatedAt: Date.now(),
        },
      };
    }
    
    return {
      type: componentType,
      name: 'UserAuthentication',
      content: 'function authenticateUser(username: string, password: string) {\n  // Authentication logic\n  return true;\n}',
      metadata: {
        path: 'src/functions/user-authentication.ts',
        description: 'User authentication function',
        createdAt: Date.now(),
        author: 'LLM',
        tags: ['auth', 'user'],
      },
    };
  }
}

class MockCodeValidator extends CodeValidator {
  validate(code: string): any {
    if (code.includes('const x = 1')) {
      return {
        isValid: false,
        errors: [
          {
            line: 2,
            column: 10,
            message: 'Missing semicolon',
            severity: 'error',
          },
        ],
      };
    }
    return { isValid: true, errors: [] };
  }
}

class MockCliCommandHandler extends CliCommandHandler {
  async executeCommand(): Promise<CommandResult> {
    return {
      success: true,
      message: 'Command executed successfully',
    };
  }
}

// Step definitions
Given('the RAG system is initialized with ChromaDB', async function() {
  // Initialize ChromaDB connector
  const config: VectorDBConfig = {
    collectionName: 'test-dsl-components',
    embeddingDimension: 128,
    distance: 'cosine',
  };
  
  chromaConnector = new ChromaDBConnector(config);
  await chromaConnector.initialize();
  
  // Initialize CLI tool with mocks
  const llmService = new MockLLMService({});
  const codeValidator = new MockCodeValidator();
  const commandHandler = new MockCliCommandHandler();
  const sessionManager = new SessionManager(llmService, codeValidator, commandHandler);
  const vectorConfigStore = new VectorConfigStore(chromaConnector);
  const errorFormatter = new ErrorFormatter();
  
  cliTool = new CliTool(
    llmService,
    codeValidator,
    commandHandler,
    sessionManager,
    vectorConfigStore,
    errorFormatter
  );
});

Given('the DSL package is available', function() {
  // This is a mock step - in a real implementation, we would check if the DSL package is available
  // For now, we'll just assume it is
});

Given('there is an existing DSL component in ChromaDB with name {string}', async function(name: string) {
  // Create and store a component
  existingComponent = {
    type: ComponentType.Function,
    name,
    content: 'function authenticateUser(username: string, password: string) {\n  // Authentication logic\n  return true;\n}',
    metadata: {
      path: `src/functions/${name.toLowerCase()}.ts`,
      description: 'User authentication function',
      createdAt: Date.now(),
      author: 'LLM',
      tags: ['auth', 'user'],
    },
  };
  
  const id = await chromaConnector.addDocument(existingComponent);
  existingComponent.id = id;
});

When('I run the CLI tool with the command {string}', async function(command: string) {
  workflowResult = await cliTool.executeWorkflow(command);
});

Then('a new component of type {string} should be generated', function(type: string) {
  expect(workflowResult.component).to.not.be.undefined;
  expect(workflowResult.component.type).to.equal(type.toLowerCase());
});

Then('the component should be validated successfully', function() {
  expect(workflowResult.success).to.be.true;
});

Then('the component should be stored in ChromaDB', async function() {
  if (!workflowResult.component.id) {
    throw new Error('Component ID is undefined');
  }
  const component = await chromaConnector.getDocument(workflowResult.component.id);
  expect(component).to.not.be.null;
});

Then('I should see a success message', function() {
  expect(workflowResult.message).to.include('success');
});

Then('the existing component should be retrieved from ChromaDB', function() {
  expect(workflowResult.component.id).to.equal(existingComponent.id);
});

Then('the component should be modified with new functionality', function() {
  expect(workflowResult.component.content).to.include('resetPassword');
});

Then('the modified component should be validated successfully', function() {
  expect(workflowResult.success).to.be.true;
});

Then('the updated component should be stored in ChromaDB', async function() {
  if (!existingComponent.id) {
    throw new Error('Component ID is undefined');
  }
  const component = await chromaConnector.getDocument(existingComponent.id);
  if (!component) {
    throw new Error('Component not found in ChromaDB');
  }
  expect(component.content).to.include('resetPassword');
});

Then('the initial generation should fail validation', function() {
  expect(workflowResult.success).to.be.false;
});

When('the system retries with error feedback', async function() {
  // This step is handled automatically by the CLI tool
  // We'll just verify that the result has changed after retries
  expect(workflowResult.component.content).to.include('const x = 1;'); // With semicolon
});

Then('the corrected component should pass validation', function() {
  expect(workflowResult.success).to.be.true;
}); 