/**
 * Tests for LLM Test Generator
 */

import { LLMTestGenerator, TestGenerationConfig, TestSuite, TestCase } from '../core/llm-test-generation';
import { MockLLMService } from '../services/mock-llm-service';
import type { ReactiveSystem, Process, Task, BoundedContext } from '../schema/types';

describe('LLMTestGenerator', () => {
  // Mock LLM service for testing
  let mockLLMService: MockLLMService;
  
  // Test generator instance
  let testGenerator: LLMTestGenerator;
  
  // Sample test data
  let sampleSystem: ReactiveSystem;
  let sampleProcess: Process;
  let sampleTask: Task;
  let sampleContext: BoundedContext;
  
  // Sample test suite for reuse in tests
  let sampleTestSuite: any;
  let sampleTestCode: string;
  
  beforeEach(() => {
    // Create a mock LLM service with deterministic responses
    mockLLMService = new MockLLMService({
      logPrompts: false,
      simulateDelay: false
    });
    
    // Configure the test generator
    const config: TestGenerationConfig = {
      model: 'test-model',
      temperature: 0.0,
      includeEdgeCases: true,
      includePerformanceTests: false,
      includeSecurityTests: true,
      maxTestsPerEntity: 2
    };
    
    testGenerator = new LLMTestGenerator(config, mockLLMService);
    
    // Set up sample test data
    sampleSystem = {
      id: 'sys-test',
      name: 'Test System',
      description: 'A system for testing',
      version: '1.0.0',
      processes: {
        'proc-test': {
          id: 'proc-test',
          name: 'Test Process',
          description: 'A process for testing',
          contextId: 'ctx-test',
          type: 'stateful',
          triggers: [
            {
              type: 'user_event',
              name: 'start_test',
              description: 'Starts the test'
            }
          ],
          tasks: ['task-test']
        }
      },
      tasks: {
        'task-test': {
          id: 'task-test',
          type: 'operation',
          description: 'A task for testing',
          input: ['input-data'],
          output: ['output-data']
        }
      },
      boundedContexts: {
        'ctx-test': {
          id: 'ctx-test',
          name: 'Test Context',
          description: 'A context for testing',
          processes: ['proc-test']
        }
      }
    };
    
    sampleProcess = sampleSystem.processes!['proc-test'];
    sampleTask = sampleSystem.tasks!['task-test'];
    sampleContext = sampleSystem.boundedContexts!['ctx-test'];
    
    // Create sample test data
    sampleTestSuite = {
      name: 'Test Suite',
      description: 'A test suite for testing',
      entityType: 'system',
      entityId: 'sys-test',
      tests: [
        {
          name: 'Test Case 1',
          description: 'A test case for testing',
          type: 'unit',
          scenario: 'happy-path',
          input: { key: 'value' },
          expectedOutput: { result: 'success' }
        }
      ],
      estimatedCoverage: 0.8
    };
    
    sampleTestCode = 'test("Test Case", () => { expect(true).toBe(true); });';
    
    // Set up custom response handlers for the mock LLM service
    mockLLMService.addResponseTemplate('testSuite', sampleTestSuite);
    mockLLMService.addResponseTemplate('testCode', sampleTestCode);
  });
  
  describe('generateTestSuiteForSystem', () => {
    it('should generate a test suite for a system', async () => {
      // Arrange
      mockLLMService.addResponseHandler(
        /system/i,
        () => sampleTestSuite
      );
      
      // Act
      const result = await testGenerator.generateTestSuiteForSystem(sampleSystem);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.entityType).toBe('system');
      expect(result.entityId).toBe('sys-test');
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });
  
  describe('generateTestSuiteForProcess', () => {
    it('should generate a test suite for a process', async () => {
      // Arrange
      mockLLMService.addResponseHandler(
        /process/i,
        () => ({
          ...sampleTestSuite,
          entityType: 'process',
          entityId: 'proc-test'
        })
      );
      
      // Act
      const result = await testGenerator.generateTestSuiteForProcess(sampleProcess);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.entityType).toBe('process');
      expect(result.entityId).toBe('proc-test');
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });
  
  describe('generateTestSuiteForTask', () => {
    it('should generate a test suite for a task', async () => {
      // Arrange
      mockLLMService.addResponseHandler(
        /task/i,
        () => ({
          ...sampleTestSuite,
          entityType: 'task',
          entityId: 'task-test'
        })
      );
      
      // Act
      const result = await testGenerator.generateTestSuiteForTask(sampleTask);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.entityType).toBe('task');
      expect(result.entityId).toBe('task-test');
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });
  
  describe('generateTestSuiteForBoundedContext', () => {
    it('should generate a test suite for a bounded context', async () => {
      // Arrange
      mockLLMService.addResponseHandler(
        /bounded context/i,
        () => ({
          ...sampleTestSuite,
          entityType: 'boundedContext',
          entityId: 'ctx-test'
        })
      );
      
      // Act
      const result = await testGenerator.generateTestSuiteForBoundedContext(sampleContext);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.entityType).toBe('boundedContext');
      expect(result.entityId).toBe('ctx-test');
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });
  
  describe('generateTestCode', () => {
    it('should generate test code for a test case', async () => {
      // Arrange
      const testCase: TestCase = {
        name: 'Test Case',
        description: 'A test case for testing',
        type: 'unit',
        scenario: 'happy-path',
        input: { key: 'value' },
        expectedOutput: { result: 'success' }
      };
      
      mockLLMService.addResponseHandler(
        /test code/i,
        () => sampleTestCode
      );
      
      // Act
      const result = await testGenerator.generateTestCode(testCase);
      
      // Assert
      expect(result).toBeDefined();
      expect(result).toContain('test(');
      expect(result).toContain('expect(');
    });
  });
}); 