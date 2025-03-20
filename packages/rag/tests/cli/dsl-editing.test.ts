import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentType, SearchOptions, SearchResult, Component, VectorDBConnector } from '../../src/models.js';
import { ComponentSearch } from '../../src/search/component-search.js';

// Import the classes first
import { CliTool } from '../../src/cli/cli-tool.js';
import { LLMService } from '../../src/llm/llm-service.js';
import { CodeValidator } from '../../src/validation/code-validator.js';
import { CliCommandHandler, CommandResult } from '../../src/cli/cli-command-handler.js';
import { SessionManager } from '../../src/cli/session-manager.js';
import { VectorConfigStore } from '../../src/cli/vector-config-store.js';
import { ErrorFormatter } from '../../src/cli/error-formatter.js';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';
import { VectorDBConfig } from '../../src/models.js';

// Create mock classes
class MockLLMService extends LLMService {
  generateComponent = vi.fn();
}

class MockCodeValidator extends CodeValidator {
  validateCode = vi.fn();
}

class MockCliCommandHandler extends CliCommandHandler {
  executeCommand = vi.fn();
  commitComponent = vi.fn();
  processCommand = vi.fn();

  constructor() {
    super({} as LLMService, {} as CodeValidator);
  }
}

class MockSessionManager extends SessionManager {
  processCommand = vi.fn();
  provideFeedback = vi.fn();
  commitCurrentComponent = vi.fn();
}

class MockVectorConfigStore extends VectorConfigStore {
  saveConfig = vi.fn();
  getConfig = vi.fn();
  getAllVersions = vi.fn();
  compareVersions = vi.fn();
  updateConfig = vi.fn();
}

class MockChromaDBConnector extends ChromaDBConnector {
  initialize = vi.fn();
  addDocument = vi.fn();
  getDocument = vi.fn();
  search = vi.fn();
}

// Mock VectorDBConnector
const mockVectorDBConnector: VectorDBConnector = {
  initialize: vi.fn().mockResolvedValue(undefined),
  addDocument: vi.fn().mockResolvedValue("doc1"),
  addDocuments: vi.fn().mockResolvedValue(["doc1", "doc2"]),
  search: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
  addFeedback: vi.fn().mockResolvedValue("feedback1"),
  getFeedbackForComponent: vi.fn().mockResolvedValue([]),
  searchFeedback: vi.fn().mockResolvedValue([]),
  recordRetrieval: vi.fn().mockResolvedValue("retrieval1"),
  updateRetrievalOutcome: vi.fn().mockResolvedValue(undefined),
  getRetrievalsByQuery: vi.fn().mockResolvedValue([]),
  getSuccessfulRetrievals: vi.fn().mockResolvedValue([]),
  createComponentVersion: vi.fn().mockResolvedValue("version1"),
  getComponentVersions: vi.fn().mockResolvedValue([]),
  getComponentVersionDiff: vi.fn().mockResolvedValue({ changes: [] }),
  addLearningTask: vi.fn().mockResolvedValue("task1"),
  getLearningTasks: vi.fn().mockResolvedValue([]),
  addExemplarSolution: vi.fn().mockResolvedValue("solution1"),
  getExemplarSolutions: vi.fn().mockResolvedValue([]),
  getTasksByDifficulty: vi.fn().mockResolvedValue([]),
  getNextRecommendedTask: vi.fn().mockResolvedValue(null)
};

describe('DSL Editing with CLI Tool', () => {
  let cliTool: CliTool;
  let llmService: MockLLMService;
  let codeValidator: MockCodeValidator;
  let commandHandler: MockCliCommandHandler;
  let sessionManager: MockSessionManager;
  let vectorConfigStore: MockVectorConfigStore;
  let errorFormatter: ErrorFormatter;
  let chromaConnector: MockChromaDBConnector;
  let componentSearch: ComponentSearch;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock implementations
    llmService = new MockLLMService({});
    llmService.generateComponent.mockImplementation((request, componentType) => {
      if (request.includes('syntax errors')) {
        return Promise.resolve({
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
        });
      }
      
      if (request.includes('Modify') && request.includes('UserAuthentication')) {
        return Promise.resolve({
          type: componentType,
          name: 'UserAuthentication',
          content: 'function authenticateUser(username: string, password: string) {\n  // Authentication logic\n  return true;\n}\n\nfunction resetPassword(username: string, email: string) {\n  // Password reset logic\n  return true;\n}',
          metadata: {
            path: 'src/functions/user-authentication.ts',
            description: 'User authentication with password reset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            author: 'LLM',
            tags: ['auth', 'user'],
          },
        });
      }
      
      return Promise.resolve({
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
      });
    });

    codeValidator = new MockCodeValidator();
    codeValidator.validateCode.mockImplementation((code) => {
      if (code.includes('const x = 1')) {
        return {
          isValid: false,
          errors: [
            {
              message: 'Missing semicolon',
              location: {
                line: 2,
                column: 10,
              },
            },
          ],
        };
      }
      return { isValid: true, errors: [] };
    });

    commandHandler = new MockCliCommandHandler();
    commandHandler.executeCommand.mockResolvedValue({
      success: true,
      message: 'Command executed successfully',
    });
    commandHandler.commitComponent.mockResolvedValue({
      success: true,
      message: 'Component committed successfully',
    });

    const mockComponent = {
      type: ComponentType.Function,
      name: 'UserAuthentication',
      content: 'function authenticateUser(username: string, password: string) {\n  // Authentication logic\n  return true;\n}',
      metadata: {
        path: 'src/functions/user-authentication.ts',
        description: 'User authentication function',
        createdAt: Date.now(),
        author: 'LLM',
        tags: ['auth', 'user'],
      },
      id: 'mock-id-1',
    };

    sessionManager = new MockSessionManager(commandHandler);
    sessionManager.processCommand.mockResolvedValue({
      component: mockComponent,
      validationResult: { isValid: true, errors: [] },
    });

    sessionManager.provideFeedback.mockResolvedValue({
      component: {
        ...mockComponent,
        content: mockComponent.content + '\n\nfunction resetPassword(username: string, email: string) {\n  // Password reset logic\n  return true;\n}',
        metadata: {
          ...mockComponent.metadata,
          description: 'User authentication with password reset',
        },
      },
      validationResult: { isValid: true, errors: [] },
    });

    sessionManager.commitCurrentComponent.mockResolvedValue({
      success: true,
      message: 'Component committed successfully',
    });

    chromaConnector = new MockChromaDBConnector({
      collectionName: 'test-dsl-components',
      embeddingDimension: 128,
      distance: 'cosine',
    });
    chromaConnector.initialize.mockResolvedValue(undefined);
    chromaConnector.addDocument.mockImplementation((document) => {
      return Promise.resolve('mock-id-1');
    });
    chromaConnector.getDocument.mockImplementation((id) => {
      return Promise.resolve(mockComponent);
    });
    chromaConnector.search.mockResolvedValue([]);
    
    vectorConfigStore = new MockVectorConfigStore(chromaConnector);
    errorFormatter = new ErrorFormatter();

    componentSearch = new ComponentSearch(chromaConnector);

    // Initialize CLI tool
    cliTool = new CliTool(
      llmService,
      codeValidator,
      sessionManager,
      vectorConfigStore,
      errorFormatter,
      componentSearch
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('executeWorkflow', () => {
    it('should generate a new DSL component and store it in ChromaDB', async () => {
      // Arrange
      const command = 'Create a new DSL component for handling user authentication';

      // Act
      const result = await cliTool.executeWorkflow(command);

      // Assert
      expect(result.success).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.component.name).toBe('UserAuthentication');
      expect(result.component.type).toBe(ComponentType.Function);
      expect(sessionManager.processCommand).toHaveBeenCalledWith(command, "function", []);
      expect(sessionManager.commitCurrentComponent).toHaveBeenCalled();
    });

    it('should handle validation errors and retry', async () => {
      // Arrange
      const command = 'Create a component with syntax errors';
      
      // Mock code validator to return invalid result first, then valid
      codeValidator.validateCode
        .mockResolvedValueOnce({
          isValid: false,
          errors: [
            {
              line: 2,
              column: 10,
              message: 'Missing semicolon',
            },
          ],
        })
        .mockResolvedValueOnce({
          isValid: true,
          errors: [],
        });

      // Mock command handler to use code validator
      commandHandler.processCommand.mockImplementation(async (cmd, type) => {
        const component = await llmService.generateComponent(cmd, type);
        const validationResult = await codeValidator.validateCode(component.content);
        return {
          component,
          validationResult,
        };
      });

      // Mock session manager to pass through to command handler
      sessionManager.processCommand.mockImplementation((cmd, type) => {
        return commandHandler.processCommand(cmd, type);
      });

      // Act
      const result = await cliTool.executeWorkflow(command);

      // Assert
      expect(result.success).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.component.name).toBe('ErrorComponent');
      expect(sessionManager.processCommand).toHaveBeenCalledTimes(2);
      expect(codeValidator.validateCode).toHaveBeenCalled();
      expect(commandHandler.processCommand).toHaveBeenCalledTimes(2);
    });

    it('should modify an existing DSL component', async () => {
      // Arrange
      const command = 'Modify the UserAuthentication component to add password reset functionality';
      
      // Mock session manager to return the modified component
      sessionManager.processCommand.mockResolvedValue({
        component: {
          type: ComponentType.Function,
          name: 'UserAuthentication',
          content: 'function authenticateUser(username: string, password: string) {\n  // Authentication logic\n  return true;\n}\n\nfunction resetPassword(username: string, email: string) {\n  // Password reset logic\n  return true;\n}',
          metadata: {
            path: 'src/functions/user-authentication.ts',
            description: 'User authentication with password reset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            author: 'LLM',
            tags: ['auth', 'user'],
          },
          id: 'mock-id-1',
        },
        validationResult: { isValid: true, errors: [] },
      });

      // Act
      const result = await cliTool.executeWorkflow(command);

      // Assert
      expect(result.success).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.component.name).toBe('UserAuthentication');
      expect(result.component.content).toContain('resetPassword');
      expect(sessionManager.processCommand).toHaveBeenCalledWith(command, "function", []);
      expect(sessionManager.commitCurrentComponent).toHaveBeenCalled();
    });
  });

  describe('executeWorkflowWithFeedback', () => {
    it('should apply user feedback to a generated component', async () => {
      // Arrange
      const command = 'Create a user authentication component';
      const feedback = 'Add password reset functionality';

      // Act
      const result = await cliTool.executeWorkflowWithFeedback(command, feedback);

      // Assert
      expect(result.success).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.component.content).toContain('resetPassword');
      expect(sessionManager.provideFeedback).toHaveBeenCalledWith(feedback);
      expect(sessionManager.commitCurrentComponent).toHaveBeenCalled();
    });
  });
}); 