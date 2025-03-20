/**
 * Test Generator
 * 
 * Generates tests for a schema using LLM.
 */

import { SchemaFiles } from './schema-loader';
import { LLMTestGenerator } from '../intelligence/llm-test-generator';

/**
 * Result of generating tests
 */
export interface TestGenerationResult {
  /**
   * Generated tests, mapping filenames to content
   */
  tests: Record<string, string>;
  
  /**
   * Whether the generation was successful
   */
  success: boolean;
  
  /**
   * Error message, if any
   */
  error?: string;
}

/**
 * Generates tests for a schema
 * @param schemaFiles Schema files to generate tests for
 * @returns Result of generating tests
 */
export async function generateTests(schemaFiles: SchemaFiles): Promise<TestGenerationResult> {
  try {
    // Create a test generator
    const testGenerator = new LLMTestGenerator({
      model: 'gpt-4',
      temperature: 0.7,
      includeEdgeCases: true,
      includePerformanceTests: true,
      includeSecurityTests: true,
      maxTestsPerEntity: 10
    });
    
    // Find the main system schema
    const systemSchema = findSystemSchema(schemaFiles);
    if (!systemSchema) {
      throw new Error('No system schema found in the provided files');
    }
    
    // Generate tests for the system
    console.log('Generating tests for system...');
    const systemTestSuite = await testGenerator.generateTestSuiteForSystem(systemSchema.schema);
    
    // Generate test code
    console.log('Generating test code...');
    const testCode = await testGenerator.generateTestCode(systemTestSuite, 'typescript');
    
    // Organize tests by entity
    const tests: Record<string, string> = {};
    
    // System tests
    tests['system.test.ts'] = testCode.system || '';
    
    // Process tests
    if (testCode.processes) {
      for (const [processId, code] of Object.entries(testCode.processes)) {
        tests[`processes/${processId}.test.ts`] = code;
      }
    }
    
    // Task tests
    if (testCode.tasks) {
      for (const [taskId, code] of Object.entries(testCode.tasks)) {
        tests[`tasks/${taskId}.test.ts`] = code;
      }
    }
    
    // Integration tests
    if (testCode.integration) {
      tests['integration.test.ts'] = testCode.integration;
    }
    
    return {
      tests,
      success: true
    };
  } catch (error) {
    return {
      tests: {},
      success: false,
      error: `Error generating tests: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Finds the main system schema in the schema files
 * @param schemaFiles Schema files to search
 * @returns The system schema and its filename, or null if not found
 */
function findSystemSchema(schemaFiles: SchemaFiles): { schema: any; filename: string } | null {
  for (const [filename, schema] of Object.entries(schemaFiles)) {
    if (isSystemSchema(schema)) {
      return { schema, filename };
    }
  }
  
  return null;
}

/**
 * Determines if a schema is a system schema
 * @param schema Schema to check
 * @returns True if the schema is a system schema
 */
function isSystemSchema(schema: any): boolean {
  return schema && 
         typeof schema === 'object' && 
         schema.id && 
         schema.name && 
         schema.version && 
         (schema.boundedContexts || schema.processes || schema.tasks);
}

/**
 * Mock implementation of the LLMTestGenerator for testing
 */
export class MockLLMTestGenerator {
  /**
   * Configuration for the test generator
   */
  private config: {
    model: string;
    temperature: number;
    includeEdgeCases: boolean;
    includePerformanceTests: boolean;
    includeSecurityTests: boolean;
    maxTestsPerEntity: number;
  };
  
  /**
   * Creates a new MockLLMTestGenerator
   * @param config Configuration for the test generator
   */
  constructor(config: {
    model: string;
    temperature: number;
    includeEdgeCases: boolean;
    includePerformanceTests: boolean;
    includeSecurityTests: boolean;
    maxTestsPerEntity: number;
  }) {
    this.config = config;
  }
  
  /**
   * Generates a test suite for a system
   * @param system System to generate tests for
   * @returns Generated test suite
   */
  async generateTestSuiteForSystem(system: any): Promise<any> {
    // This is a mock implementation that returns a simple test suite
    return {
      name: `${system.name} Test Suite`,
      description: `Test suite for ${system.name}`,
      entityType: 'system',
      entityId: system.id,
      testCases: [
        {
          name: 'System Validation',
          description: 'Validates that the system schema is valid',
          type: 'unit',
          scenario: 'Validate system schema',
          input: { system },
          expectedOutput: { valid: true },
          code: `
            it('should have a valid system schema', () => {
              const validationResult = validateSystem(system);
              expect(validationResult.success).toBe(true);
            });
          `
        }
      ],
      processes: Object.keys(system.processes || {}).map(processId => ({
        name: `${system.processes[processId].name} Test Suite`,
        description: `Test suite for ${system.processes[processId].name}`,
        entityType: 'process',
        entityId: processId,
        testCases: [
          {
            name: 'Process Validation',
            description: 'Validates that the process schema is valid',
            type: 'unit',
            scenario: 'Validate process schema',
            input: { process: system.processes[processId] },
            expectedOutput: { valid: true },
            code: `
              it('should have a valid process schema', () => {
                const validationResult = validateProcess(process);
                expect(validationResult.success).toBe(true);
              });
            `
          }
        ]
      })),
      tasks: Object.keys(system.tasks || {}).map(taskId => ({
        name: `${system.tasks[taskId].name} Test Suite`,
        description: `Test suite for ${system.tasks[taskId].name}`,
        entityType: 'task',
        entityId: taskId,
        testCases: [
          {
            name: 'Task Validation',
            description: 'Validates that the task schema is valid',
            type: 'unit',
            scenario: 'Validate task schema',
            input: { task: system.tasks[taskId] },
            expectedOutput: { valid: true },
            code: `
              it('should have a valid task schema', () => {
                const validationResult = validateTask(task);
                expect(validationResult.success).toBe(true);
              });
            `
          }
        ]
      }))
    };
  }
  
  /**
   * Generates test code for a test suite
   * @param testSuite Test suite to generate code for
   * @param language Programming language to generate code in
   * @returns Generated test code
   */
  async generateTestCode(testSuite: any, language: string): Promise<{
    system: string;
    processes: Record<string, string>;
    tasks: Record<string, string>;
    integration?: string;
  }> {
    // This is a mock implementation that returns simple test code
    const systemTests = `
      import { validateSystem } from '../src/schema/validation';
      import system from '../src/system';
      
      describe('${testSuite.name}', () => {
        ${testSuite.testCases.map((testCase: any) => testCase.code).join('\n')}
      });
    `;
    
    const processTests: Record<string, string> = {};
    for (const processSuite of (testSuite.processes || [])) {
      processTests[processSuite.entityId] = `
        import { validateProcess } from '../src/schema/validation';
        import { processes } from '../src/system';
        
        const process = processes['${processSuite.entityId}'];
        
        describe('${processSuite.name}', () => {
          ${processSuite.testCases.map((testCase: any) => testCase.code).join('\n')}
        });
      `;
    }
    
    const taskTests: Record<string, string> = {};
    for (const taskSuite of (testSuite.tasks || [])) {
      taskTests[taskSuite.entityId] = `
        import { validateTask } from '../src/schema/validation';
        import { tasks } from '../src/system';
        
        const task = tasks['${taskSuite.entityId}'];
        
        describe('${taskSuite.name}', () => {
          ${taskSuite.testCases.map((testCase: any) => testCase.code).join('\n')}
        });
      `;
    }
    
    const integrationTests = `
      import { executeProcess } from '../src/core/process-engine';
      import system from '../src/system';
      
      describe('Integration Tests', () => {
        it('should execute processes end-to-end', async () => {
          // This is a placeholder for integration tests
          // In a real implementation, we would generate more specific tests
          const result = await executeProcess(system, 'some-process-id', {});
          expect(result.success).toBe(true);
        });
      });
    `;
    
    return {
      system: systemTests,
      processes: processTests,
      tasks: taskTests,
      integration: integrationTests
    };
  }
} 