import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentType, SearchOptions, SearchResult, Component, VectorDBConnector } from '../../src/models.js';
import { CliTool } from '../../src/cli/cli-tool.js';
import { LLMService } from '../../src/llm/llm-service.js';
import { CodeValidator } from '../../src/validation/code-validator.js';
import { CliCommandHandler, CommandResult, CommitResult } from '../../src/cli/cli-command-handler.js';
import { SessionManager, HistoryEntry, HistoryEntryType } from '../../src/cli/session-manager.js';
import { VectorConfigStore } from '../../src/cli/vector-config-store.js';
import { ErrorFormatter } from '../../src/cli/error-formatter.js';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';
import { ComponentSearch } from '../../src/search/component-search.js';

// Mock classes
class MockLLMService extends LLMService {
  generateComponent = vi.fn();
  searchSimilarComponents = vi.fn();
}

class MockCodeValidator extends CodeValidator {
  validateCode = vi.fn();
}

class MockCliCommandHandler extends SessionManager {
  constructor() {
    const mockLLMService = {
      generateComponent: vi.fn().mockResolvedValue({
        content: '',
        type: ComponentType.Function,
        name: 'test',
        metadata: {}
      })
    } as unknown as LLMService;

    const mockCodeValidator = {
      validateCode: vi.fn().mockResolvedValue({ isValid: true })
    } as unknown as CodeValidator;

    const mockCommandHandler = new CliCommandHandler(mockLLMService, mockCodeValidator);
    super(mockCommandHandler);
  }
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

class MockComponentSearch extends ComponentSearch {
  constructor() {
    const mockVectorDB = {
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
    super(mockVectorDB);
  }

  async searchComponents(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByType(query: string, type: ComponentType, options?: Omit<SearchOptions, "types">): Promise<SearchResult[]> {
    return [];
  }

  async getComponentById(id: string): Promise<Component | null> {
    return null;
  }

  async findSimilarComponents(component: Component, options?: Omit<SearchOptions, "types">): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByName(name: string, options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByPath(path: string, options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByTags(tags: string[], options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async getAllComponentsByType(type: ComponentType): Promise<Component[]> {
    return [];
  }
}

describe('RAG Agent CLI Editing', () => {
  let cliTool: CliTool;
  let llmService: MockLLMService;
  let codeValidator: MockCodeValidator;
  let commandHandler: MockCliCommandHandler;
  let vectorConfigStore: MockVectorConfigStore;
  let errorFormatter: ErrorFormatter;
  let chromaConnector: MockChromaDBConnector;
  let componentSearch: MockComponentSearch;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock implementations
    llmService = new MockLLMService({});
    codeValidator = new MockCodeValidator();
    commandHandler = new MockCliCommandHandler();
    chromaConnector = new MockChromaDBConnector({
      collectionName: 'test-components',
      embeddingDimension: 128,
      distance: 'cosine',
    });
    vectorConfigStore = new MockVectorConfigStore(chromaConnector);
    errorFormatter = new ErrorFormatter();
    componentSearch = new MockComponentSearch();

    cliTool = new CliTool(
      llmService,
      codeValidator,
      commandHandler,
      vectorConfigStore,
      errorFormatter,
      componentSearch
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GIVEN a user wants to create a new component', () => {
    describe('WHEN the component has syntax errors', () => {
      it('THEN the system should retry until validation passes', async () => {
        // Arrange
        const command = 'Create a user authentication component';
        const invalidComponent = {
          type: ComponentType.Function,
          name: 'UserAuth',
          content: 'function authenticateUser(username: string, password: string) {\n  const result = true\n  return result\n}',
          metadata: {
            path: 'src/auth/user-auth.ts',
            description: 'User authentication function',
            createdAt: Date.now(),
            author: 'RAG Agent',
            tags: ['auth', 'user'],
          },
        };

        const validComponent = {
          ...invalidComponent,
          content: 'function authenticateUser(username: string, password: string) {\n  const result = true;\n  return result;\n}',
        };

        llmService.generateComponent.mockResolvedValue(invalidComponent);
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

        commandHandler.processCommand = vi.fn().mockImplementation(async (cmd: string, type: ComponentType) => {
          const component = await llmService.generateComponent(cmd, type);
          const validationResult = await codeValidator.validateCode(component.content);
          return {
            component: validationResult.isValid ? validComponent : invalidComponent,
            validationResult,
          };
        });

        commandHandler.commitCurrentComponent = vi.fn().mockResolvedValue({
          success: true,
          message: 'Component committed successfully',
          component: validComponent,
        });

        // Act
        const result = await cliTool.executeWorkflow(command);

        // Assert
        expect(result.success).toBe(true);
        expect(result.component).toBeDefined();
        expect(result.component.name).toBe('UserAuth');
        expect(result.component.content).toContain(';');
        expect(commandHandler.processCommand).toHaveBeenCalledTimes(2);
        expect(codeValidator.validateCode).toHaveBeenCalledTimes(2);
        expect(commandHandler.commitCurrentComponent).toHaveBeenCalled();
      });
    });

    describe('WHEN similar components exist in the codebase', () => {
      it('THEN the system should use them as context for generation', async () => {
        const command = 'Create a user authentication function';
        const validComponent = {
          name: 'UserAuth',
          type: ComponentType.Function,
          content: 'function hashPassword(password: string) { /* ... */ }',
          metadata: { path: 'src/auth/user-auth.ts' }
        };

        // Mock component search to return similar components
        componentSearch.searchComponents = vi.fn().mockResolvedValue([{
          component: validComponent,
          score: 0.8,
          distance: 0.2
        }]);

        // Mock command handler to use similar components
        commandHandler.processCommand = vi.fn().mockImplementation(async (cmd: string, type: ComponentType, similarComponents: Component[]) => {
          expect(similarComponents).toHaveLength(1);
          expect(similarComponents[0].name).toBe('UserAuth');
          return {
            component: validComponent,
            validationResult: { isValid: true }
          };
        });

        commandHandler.commitCurrentComponent = vi.fn().mockResolvedValue({
          success: true,
          message: 'Component committed successfully',
          component: validComponent
        });

        // Act
        const result = await cliTool.executeWorkflow(command);

        // Assert
        expect(result.success).toBe(true);
        expect(result.component.name).toBe('UserAuth');
        expect(componentSearch.searchComponents).toHaveBeenCalledWith(command, expect.any(Object));
        expect(commandHandler.processCommand).toHaveBeenCalledWith(command, ComponentType.Function, expect.any(Array));
      });
    });

    describe('WHEN the command is invalid', () => {
      it('THEN the system should handle the error gracefully', async () => {
        const command = 'Invalid command';

        // Mock command handler to throw an error
        commandHandler.processCommand = vi.fn().mockRejectedValue(new Error('Invalid command'));

        // Act
        let result;
        try {
          result = await cliTool.executeWorkflow(command);
        } catch (err) {
          const error = err as Error;
          result = {
            success: false,
            message: 'Failed to generate valid code',
            error: error.message
          };
        }

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to generate valid code');
        expect(commandHandler.processCommand).toHaveBeenCalledWith(command, "command", []);
      });
    });
  });

  describe('GIVEN a user wants to modify an existing component', () => {
    describe('WHEN the modification request is ambiguous', () => {
      it('THEN the system should ask for clarification', async () => {
        // Arrange
        const command = 'Modify the user authentication';
        const existingComponents = [
          {
            type: ComponentType.Function,
            name: 'UserAuth',
            content: 'function authenticateUser(username: string, password: string) {\n  return validateCredentials(username, password);\n}',
            metadata: {
              path: 'src/auth/user-auth.ts',
              description: 'User authentication function',
              createdAt: Date.now(),
              author: 'RAG Agent',
              tags: ['auth', 'user'],
            },
          },
          {
            type: ComponentType.Function,
            name: 'UserAuthService',
            content: 'class UserAuthService {\n  async login(username: string, password: string) {\n    return this.validateUser(username, password);\n  }\n}',
            metadata: {
              path: 'src/auth/user-auth-service.ts',
              description: 'User authentication service',
              createdAt: Date.now(),
              author: 'RAG Agent',
              tags: ['auth', 'service'],
            },
          },
        ];

        llmService.searchSimilarComponents = vi.fn().mockResolvedValue(existingComponents);
        commandHandler.processCommand = vi.fn().mockRejectedValue(new Error('Ambiguous request: Multiple matching components found'));
        commandHandler.commitCurrentComponent = vi.fn();

        // Act & Assert
        await expect(cliTool.executeWorkflow(command)).rejects.toThrow('Ambiguous request');
        expect(commandHandler.commitCurrentComponent).not.toHaveBeenCalled();
      });
    });
  });

  describe('GIVEN a user wants to provide feedback', () => {
    describe('WHEN the feedback is valid', () => {
      it('THEN the system should apply the feedback and commit', async () => {
        const command = 'Create a user authentication function';
        const feedback = 'Add input validation';
        const component = {
          name: 'UserAuth',
          type: ComponentType.Function,
          content: 'function authenticateUser(username: string, password: string) { /* ... */ }',
          metadata: { path: 'src/auth/user-auth.ts' }
        };

        // Mock command handler
        commandHandler.processCommand = vi.fn().mockResolvedValue({
          component,
          validationResult: { isValid: true }
        });

        commandHandler.provideFeedback = vi.fn().mockResolvedValue({
          component: {
            ...component,
            content: 'function authenticateUser(username: string, password: string) {\n  if (!username || !password) throw new Error("Invalid input");\n  /* ... */\n}'
          },
          validationResult: { isValid: true }
        });

        commandHandler.commitCurrentComponent = vi.fn().mockResolvedValue({
          success: true,
          message: 'Component committed successfully',
          component
        });

        // Act
        const result = await cliTool.executeWorkflowWithFeedback(command, feedback);

        // Assert
        expect(result.success).toBe(true);
        expect(result.component.content).toContain('if (!username || !password)');
        expect(commandHandler.provideFeedback).toHaveBeenCalledWith(feedback);
        expect(commandHandler.commitCurrentComponent).toHaveBeenCalled();
      });
    });
  });
}); 