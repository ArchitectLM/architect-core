/**
 * Tests for RAG Agent Editor Extension
 * Using TDD/BDD approach to implement DSL editing functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RAGAgentEditorExtension } from '../../../src/core/extensions/rag-agent-editor';
import { ProcessDefinition, TaskDefinition } from '../../../src/core/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path modules
vi.mock('fs');
vi.mock('path');

describe('RAGAgentEditorExtension', () => {
  let editor: RAGAgentEditorExtension;
  let mockFs: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup mock filesystem
    mockFs = {
      existsSync: vi.fn().mockReturnValue(true),
      readdirSync: vi.fn().mockReturnValue(['process.ts', 'task.ts', 'system.ts']),
      readFileSync: vi.fn().mockImplementation((filePath) => {
        if (filePath.includes('process.ts')) {
          return `const orderProcess = ReactiveSystem.Process.create('order-process')
  .withDescription('Handles order processing')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('cancelled')
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING'
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE'
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .build();`;
        } else if (filePath.includes('task.ts')) {
          return `const processOrderTask = ReactiveSystem.Task.create('process-order')
  .withDescription('Processes an order')
  .withImplementation(async (input, context) => {
    // Process the order
    context.emitEvent('COMPLETE', { orderId: input.orderId });
    return { processed: true };
  })
  .build();`;
        } else {
          return '';
        }
      }),
      writeFileSync: vi.fn()
    };
    
    // Apply mocks
    Object.keys(mockFs).forEach(key => {
      (fs as any)[key] = mockFs[key];
    });
    
    // Create editor instance
    editor = new RAGAgentEditorExtension({
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-api-key',
      debug: true,
      useInMemoryVectorStore: true
    });
    
    // Mock the LLM invoke method
    (editor as any).llm = {
      invoke: vi.fn().mockResolvedValue({
        content: `I'll add a new state 'refunded' and a transition from 'cancelled' to 'refunded'.

\`\`\`typescript
const orderProcess = ReactiveSystem.Process.create('order-process')
  .withDescription('Handles order processing')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('cancelled')
  .addState('refunded')
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING'
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE'
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .addSimpleTransition('cancelled', 'refunded', 'REFUND')
  .build();
\`\`\``
      })
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('discoverDSLFiles', () => {
    it('should discover DSL files in the specified directory', async () => {
      const files = await editor.discoverDSLFiles('/path/to/dsl');
      
      expect(mockFs.existsSync).toHaveBeenCalledWith('/path/to/dsl');
      expect(mockFs.readdirSync).toHaveBeenCalledWith('/path/to/dsl');
      expect(files).toEqual([
        '/path/to/dsl/process.ts',
        '/path/to/dsl/task.ts',
        '/path/to/dsl/system.ts'
      ]);
    });
    
    it('should throw an error if the directory does not exist', async () => {
      mockFs.existsSync.mockReturnValueOnce(false);
      
      await expect(editor.discoverDSLFiles('/path/to/nonexistent')).rejects.toThrow(
        'Directory does not exist: /path/to/nonexistent'
      );
    });
  });
  
  describe('readDSLFiles', () => {
    it('should read the contents of DSL files', async () => {
      const filePaths = [
        '/path/to/dsl/process.ts',
        '/path/to/dsl/task.ts'
      ];
      
      const contents = await editor.readDSLFiles(filePaths);
      
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/dsl/process.ts', 'utf-8');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/dsl/task.ts', 'utf-8');
      expect(contents).toHaveProperty('/path/to/dsl/process.ts');
      expect(contents).toHaveProperty('/path/to/dsl/task.ts');
      expect(contents['/path/to/dsl/process.ts']).toContain('ReactiveSystem.Process.create');
      expect(contents['/path/to/dsl/task.ts']).toContain('ReactiveSystem.Task.create');
    });
  });
  
  describe('generateEditPlan', () => {
    it('should generate an edit plan based on user request', async () => {
      const context = {
        files: {
          '/path/to/dsl/process.ts': `const orderProcess = ReactiveSystem.Process.create('order-process')
  .withDescription('Handles order processing')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('cancelled')
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING'
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE'
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .build();`
        },
        userRequest: 'Add a refunded state and a transition from cancelled to refunded'
      };
      
      const editPlan = await editor.generateEditPlan(context);
      
      expect(editPlan).toHaveProperty('changes');
      expect(editPlan.changes).toHaveLength(1);
      expect(editPlan.changes[0]).toHaveProperty('filePath', '/path/to/dsl/process.ts');
      expect(editPlan.changes[0]).toHaveProperty('newContent');
      expect(editPlan.changes[0].newContent).toContain('.addState(\'refunded\')');
      expect(editPlan.changes[0].newContent).toContain('.addSimpleTransition(\'cancelled\', \'refunded\', \'REFUND\')');
    });
  });
  
  describe('applyChanges', () => {
    it('should apply changes to files', async () => {
      const changes = {
        changes: [
          {
            filePath: '/path/to/dsl/process.ts',
            newContent: `const orderProcess = ReactiveSystem.Process.create('order-process')
  .withDescription('Handles order processing')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('cancelled')
  .addState('refunded')
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING'
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE'
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .addSimpleTransition('cancelled', 'refunded', 'REFUND')
  .build();`
          }
        ]
      };
      
      await editor.applyChanges(changes);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/dsl/process.ts',
        changes.changes[0].newContent,
        'utf-8'
      );
    });
  });
  
  describe('editDSL', () => {
    it('should edit DSL files based on user request', async () => {
      const options = {
        dslDirectory: '/path/to/dsl',
        userRequest: 'Add a refunded state and a transition from cancelled to refunded',
        interactive: false
      };
      
      await editor.editDSL(options);
      
      // Check that files were discovered
      expect(mockFs.existsSync).toHaveBeenCalledWith('/path/to/dsl');
      expect(mockFs.readdirSync).toHaveBeenCalledWith('/path/to/dsl');
      
      // Check that files were read
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/dsl/process.ts', 'utf-8');
      
      // Check that changes were applied
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/dsl/process.ts',
        expect.stringContaining('.addState(\'refunded\')'),
        'utf-8'
      );
    });
  });
}); 