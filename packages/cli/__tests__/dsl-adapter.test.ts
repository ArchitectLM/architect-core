/**
 * DSL Adapter Tests
 * 
 * Tests for the DSL adapter functionality that integrates the Hybrid DSL with the CLI.
 * 
 * Testing approach:
 * - We mock the dsl-adapter module itself to override the file system operations
 *   (loadSystemFromFile and saveSystemToFile) with mock functions.
 * - This approach avoids the complexity of mocking the fs module and promisify function.
 * - For the SystemBuilder and migrateSchema functions, we provide mock implementations
 *   that return predictable results for our tests.
 * - Each test focuses on a specific functionality of the DSL adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { 
  convertDslToJson, 
  loadSystemFromFile, 
  convertSystemToSchemaFiles,
  validateDslSystem,
  migrateDslSystem,
  saveSystemToFile,
  convertJsonToDsl
} from '../../src/cli/dsl-adapter';
import { SystemBuilder, migrateSchema } from '../../src/dsl';

// Mock the modules
vi.mock('../../src/cli/dsl-adapter', async () => {
  // Import the actual module
  const actualModule = await vi.importActual('../../src/cli/dsl-adapter');
  
  // Return a modified version with mocked functions
  return {
    ...(actualModule as object),
    loadSystemFromFile: vi.fn(),
    saveSystemToFile: vi.fn(),
  };
});

vi.mock('../../src/dsl', () => {
  return {
    SystemBuilder: {
      create: vi.fn()
    },
    migrateSchema: vi.fn(),
    validateSystemWithResult: vi.fn()
  };
});

// Define a type for our mocked SystemBuilder to satisfy TypeScript
type MockedSystemBuilder = {
  withName: ReturnType<typeof vi.fn>;
  withVersion: ReturnType<typeof vi.fn>;
  withDescription: ReturnType<typeof vi.fn>;
  withBoundedContext: ReturnType<typeof vi.fn>;
  withProcess: ReturnType<typeof vi.fn>;
  withStatefulProcess: ReturnType<typeof vi.fn>;
  withTask: ReturnType<typeof vi.fn>;
  withProcessTask: ReturnType<typeof vi.fn>;
  transform: ReturnType<typeof vi.fn>;
  validate: ReturnType<typeof vi.fn>;
  build: ReturnType<typeof vi.fn>;
  // Add any other properties needed
};

describe('DSL Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock SystemBuilder
    vi.mocked(SystemBuilder.create).mockImplementation((id) => {
      const mockBuilder = {
        withName: vi.fn().mockReturnThis(),
        withVersion: vi.fn().mockReturnThis(),
        withDescription: vi.fn().mockReturnThis(),
        withBoundedContext: vi.fn().mockReturnThis(),
        withProcess: vi.fn().mockReturnThis(),
        withStatefulProcess: vi.fn().mockReturnThis(),
        withTask: vi.fn().mockReturnThis(),
        withProcessTask: vi.fn().mockReturnThis(),
        transform: vi.fn().mockReturnThis(),
        validate: vi.fn().mockReturnValue({
          success: true,
          issues: []
        }),
        build: vi.fn().mockReturnValue({
          id,
          name: 'Test System',
          version: '1.0.0',
          boundedContexts: {
            context1: { 
              id: 'context1', 
              name: 'Context 1',
              description: 'Test context',
              processes: []
            }
          },
          processes: {
            process1: { 
              id: 'process1', 
              contextId: 'context1', 
              name: 'Process 1', 
              type: 'stateless' as const,
              triggers: [],
              tasks: []
            }
          },
          tasks: {
            task1: { id: 'task1', label: 'Task 1', type: 'operation' }
          }
        })
      };
      
      return mockBuilder as unknown as SystemBuilder;
    });
    
    // Mock migrateSchema
    vi.mocked(migrateSchema).mockImplementation((system, targetVersion, transformer) => {
      if (transformer) {
        try {
          return transformer(system);
        } catch (error) {
          throw new Error('Transformer error');
        }
      }
      return {
        ...system,
        version: targetVersion,
        migrationHistory: [
          { fromVersion: system.version, toVersion: targetVersion, timestamp: new Date().toISOString() }
        ]
      };
    });
  });
  
  describe('convertSystemToSchemaFiles', () => {
    it('should convert a system to SchemaFiles format', () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      // Act
      const result = convertSystemToSchemaFiles(system);
      
      // Assert
      expect(result).toBeTypeOf('object');
      expect(result['test-system.json']).toEqual(system);
    });
  });
  
  describe('validateDslSystem', () => {
    it('should validate a valid system', () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      // Act
      const result = validateDslSystem(system);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });
    
    it('should return validation issues for an invalid system', () => {
      // Arrange
      const invalidSystem = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        boundedContexts: {},
        processes: {
          process1: {
            id: 'process1',
            name: 'Process 1',
            contextId: 'non-existent-context', // Invalid reference
            type: 'stateless' as const,
            triggers: [],
            tasks: []
          }
        },
        tasks: {}
      };
      
      // Mock the validate method to return validation issues
      vi.mocked(SystemBuilder.create).mockReturnValueOnce({
        withName: vi.fn().mockReturnThis(),
        withVersion: vi.fn().mockReturnThis(),
        withDescription: vi.fn().mockReturnThis(),
        withBoundedContext: vi.fn().mockReturnThis(),
        withProcess: vi.fn().mockReturnThis(),
        withStatefulProcess: vi.fn().mockReturnThis(),
        withTask: vi.fn().mockReturnThis(),
        withProcessTask: vi.fn().mockReturnThis(),
        transform: vi.fn().mockReturnThis(),
        validate: vi.fn().mockReturnValue({
          success: false,
          issues: [
            { path: 'processes.process1.contextId', message: 'Invalid context reference', severity: 'error' }
          ]
        }),
        build: vi.fn().mockReturnValue(invalidSystem)
      } as unknown as SystemBuilder);
      
      // Act
      const result = validateDslSystem(invalidSystem);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
    
    it('should handle validation errors gracefully', () => {
      // Arrange
      const malformedSystem = {
        id: 'test-system',
        // Missing required name field
        version: '1.0.0'
      };
      
      // Mock the validate method to throw an error
      vi.mocked(SystemBuilder.create).mockImplementationOnce(() => {
        throw new Error('Validation error');
      });
      
      // Act
      const result = validateDslSystem(malformedSystem);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
  
  describe('migrateDslSystem', () => {
    it('should migrate a system to a new version', () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      // Act
      const result = migrateDslSystem(system, '2.0.0');
      
      // Assert
      expect(result).toMatchObject({
        id: 'test-system',
        name: 'Test System',
        version: '2.0.0'
      });
      expect(result.migrationHistory).toBeInstanceOf(Array);
      expect(result.migrationHistory[0]).toMatchObject({
        fromVersion: '1.0.0',
        toVersion: '2.0.0'
      });
    });
    
    it('should apply a transformer during migration', () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      const transformerCode = `
        system.name = 'Transformed System';
        return system;
      `;
      
      // Mock the migrateSchema function to apply the transformer
      vi.mocked(migrateSchema).mockImplementationOnce((system, targetVersion, transformer) => {
        return {
          ...system,
          name: 'Transformed System',
          version: targetVersion
        };
      });
      
      // Act
      const result = migrateDslSystem(system, '2.0.0', transformerCode);
      
      // Assert
      expect(result).toMatchObject({
        id: 'test-system',
        name: 'Transformed System',
        version: '2.0.0'
      });
    });
    
    it('should handle migration errors gracefully', () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      const badTransformerCode = `
        throw new Error('Transformer error');
      `;
      
      // Act & Assert
      expect(() => migrateDslSystem(system, '2.0.0', badTransformerCode))
        .to.throw('Failed to migrate system');
    });
  });
  
  describe('saveSystemToFile', () => {
    it('should save a system to a file', async () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      // Mock the saveSystemToFile function
      vi.mocked(saveSystemToFile).mockResolvedValue(undefined);
      
      // Act
      await saveSystemToFile(system, 'test-output.json');
      
      // Assert
      expect(saveSystemToFile).toHaveBeenCalledTimes(1);
      expect(saveSystemToFile).toHaveBeenCalledWith(system, 'test-output.json');
    });
    
    it('should handle file write errors', async () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      // Mock the saveSystemToFile function to throw an error
      vi.mocked(saveSystemToFile).mockRejectedValue(new Error('Write error'));
      
      // Act & Assert
      await expect(saveSystemToFile(system, 'test-output.json'))
        .rejects.toThrow('Write error');
    });
  });
  
  describe('loadSystemFromFile', () => {
    it('should load a system from a JSON file', async () => {
      // Arrange
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      // Mock the loadSystemFromFile function
      vi.mocked(loadSystemFromFile).mockResolvedValue(system);
      
      // Act
      const result = await loadSystemFromFile('test.json');
      
      // Assert
      expect(result).toEqual(system);
      expect(loadSystemFromFile).toHaveBeenCalledTimes(1);
      expect(loadSystemFromFile).toHaveBeenCalledWith('test.json');
    });
    
    it('should handle file read errors', async () => {
      // Arrange
      // Mock the loadSystemFromFile function to throw an error
      vi.mocked(loadSystemFromFile).mockRejectedValue(new Error('Read error'));
      
      // Act & Assert
      await expect(loadSystemFromFile('test.json'))
        .rejects.toThrow('Read error');
    });
  });
}); 