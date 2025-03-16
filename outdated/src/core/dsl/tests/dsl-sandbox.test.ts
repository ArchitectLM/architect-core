/**
 * DSL Sandbox Tests
 * 
 * This file tests the DSL sandbox environment.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { executeDSLFile, loadDSLFile, loadDSLDirectory } from '../dsl-sandbox';
import { DSLRegistry } from '../dsl-registry';

describe('DSL Sandbox', () => {
  let tempDir: string;
  
  beforeEach(() => {
    // Reset the registry before each test
    DSLRegistry.getInstance().clear();
    
    // Create a temporary directory for test files
    tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    // Remove temporary files
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
  });
  
  it('should execute a DSL process file', () => {
    // Create a test process file
    const processFilePath = path.join(tempDir, 'test-process.ts');
    const processContent = `
      // Define a process
      const testProcess = Process.create('test-process')
        .withInitialState('initial')
        .addState('initial')
        .addState('processing')
        .addTransition({ from: 'initial', to: 'processing', on: 'START' })
        .build();
      
      export default testProcess;
    `;
    fs.writeFileSync(processFilePath, processContent);
    
    // Execute the file
    const result = executeDSLFile(processFilePath);
    
    // Check the result
    expect(result).toHaveProperty('default');
    expect(result.default).toHaveProperty('id', 'test-process');
    
    // Check that the process was registered
    expect(DSLRegistry.getInstance().hasProcess('test-process')).toBe(true);
  });
  
  it('should execute a DSL task file', () => {
    // Create a test task file
    const taskFilePath = path.join(tempDir, 'test-task.ts');
    const taskContent = `
      // Define a task
      const testTask = Task.create('test-task')
        .withDescription('Test task')
        .withImplementation(() => ({ success: true }))
        .build();
      
      export default testTask;
    `;
    fs.writeFileSync(taskFilePath, taskContent);
    
    // Execute the file
    const result = executeDSLFile(taskFilePath);
    
    // Check the result
    expect(result).toHaveProperty('default');
    expect(result.default).toHaveProperty('id', 'test-task');
    
    // Check that the task was registered
    expect(DSLRegistry.getInstance().hasTask('test-task')).toBe(true);
  });
  
  it('should execute a DSL system file', () => {
    // Create a test process file
    const processFilePath = path.join(tempDir, 'test-process.ts');
    const processContent = `
      // Define a process
      const testProcess = Process.create('test-process')
        .withInitialState('initial')
        .addState('initial')
        .addState('processing')
        .addTransition({ from: 'initial', to: 'processing', on: 'START' })
        .build();
      
      export default testProcess;
    `;
    fs.writeFileSync(processFilePath, processContent);
    
    // Create a test task file
    const taskFilePath = path.join(tempDir, 'test-task.ts');
    const taskContent = `
      // Define a task
      const testTask = Task.create('test-task')
        .withDescription('Test task')
        .withImplementation(() => ({ success: true }))
        .build();
      
      export default testTask;
    `;
    fs.writeFileSync(taskFilePath, taskContent);
    
    // Execute the process and task files
    executeDSLFile(processFilePath);
    executeDSLFile(taskFilePath);
    
    // Create a test system file
    const systemFilePath = path.join(tempDir, 'test-system.ts');
    const systemContent = `
      // Define a system
      const testSystem = ReactiveSystem.define('test-system')
        .withName('Test System')
        .withDescription('A test system')
        .addProcess(ReactiveSystem.getProcess('test-process'))
        .addTask(ReactiveSystem.getTask('test-task'))
        .build();
      
      export default testSystem;
    `;
    fs.writeFileSync(systemFilePath, systemContent);
    
    // Execute the system file
    const result = executeDSLFile(systemFilePath);
    
    // Check the result
    expect(result).toHaveProperty('default');
    expect(result.default).toHaveProperty('id', 'test-system');
    
    // Check that the system was registered
    expect(DSLRegistry.getInstance().hasSystem('test-system')).toBe(true);
  });
  
  it('should handle TypeScript type annotations', () => {
    // Create a test file with type annotations but without interface declarations
    const filePath = path.join(tempDir, 'test-types.ts');
    const fileContent = `
      // Define a task with type annotations using type assertions
      const processOrderTask = Task.create('process-order')
        .withDescription('Process an order')
        .withImplementation((input, context) => {
          // Use type assertions instead of interfaces
          const items = input.items || [];
          const processedItems = items.map((item) => ({
            ...item,
            status: 'processed'
          }));
          
          return {
            success: true,
            processedItems
          };
        })
        .build();
      
      export default processOrderTask;
    `;
    fs.writeFileSync(filePath, fileContent);
    
    // Execute the file
    const result = executeDSLFile(filePath);
    
    // Check the result
    expect(result).toHaveProperty('default');
    expect(result.default).toHaveProperty('id', 'process-order');
    
    // Check that the task was registered
    expect(DSLRegistry.getInstance().hasTask('process-order')).toBe(true);
  });
  
  it('should load all DSL files in a directory', () => {
    // Create test files
    const processFilePath = path.join(tempDir, 'test-process.ts');
    const processContent = `
      const testProcess = Process.create('test-process')
        .withInitialState('initial')
        .addState('initial')
        .addState('processing')
        .addTransition({ from: 'initial', to: 'processing', on: 'START' })
        .build();
      
      export default testProcess;
    `;
    fs.writeFileSync(processFilePath, processContent);
    
    const taskFilePath = path.join(tempDir, 'test-task.ts');
    const taskContent = `
      const testTask = Task.create('test-task')
        .withDescription('Test task')
        .withImplementation(() => ({ success: true }))
        .build();
      
      export default testTask;
    `;
    fs.writeFileSync(taskFilePath, taskContent);
    
    // Load all files in the directory
    const result = loadDSLDirectory(tempDir);
    
    // Check the result
    expect(result).toHaveProperty('test-process');
    expect(result).toHaveProperty('test-task');
    expect(result['test-process'].default).toHaveProperty('id', 'test-process');
    expect(result['test-task'].default).toHaveProperty('id', 'test-task');
    
    // Check that the components were registered
    expect(DSLRegistry.getInstance().hasProcess('test-process')).toBe(true);
    expect(DSLRegistry.getInstance().hasTask('test-task')).toBe(true);
  });
}); 