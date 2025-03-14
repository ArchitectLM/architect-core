/**
 * Global DSL Declarations Tests
 * 
 * This file tests the global DSL declarations to ensure they work as expected.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { setupGlobalDSL, resetGlobalDSL } from '../global-dsl';
import { DSLRegistry } from '../dsl-registry';

describe('Global DSL Declarations', () => {
  beforeEach(() => {
    // Reset the registry before each test
    DSLRegistry.getInstance().clear();
    // Setup global DSL
    setupGlobalDSL();
  });
  
  afterEach(() => {
    // Clean up after each test
    resetGlobalDSL();
  });
  
  it('should define global Process object', () => {
    // @ts-ignore - Process is defined globally
    expect(global.Process).toBeDefined();
    // @ts-ignore - Process.create should be a function
    expect(typeof global.Process.create).toBe('function');
  });
  
  it('should define global Task object', () => {
    // @ts-ignore - Task is defined globally
    expect(global.Task).toBeDefined();
    // @ts-ignore - Task.create should be a function
    expect(typeof global.Task.create).toBe('function');
  });
  
  it('should define global ReactiveSystem object', () => {
    // @ts-ignore - ReactiveSystem is defined globally
    expect(global.ReactiveSystem).toBeDefined();
    // @ts-ignore - ReactiveSystem.define should be a function
    expect(typeof global.ReactiveSystem.define).toBe('function');
  });
  
  it('should create a process and register it', () => {
    // @ts-ignore - Process is defined globally
    const process = global.Process.create('test-process')
      .withInitialState('initial')
      .addState('initial')
      .addState('processing')
      .addTransition({ from: 'initial', to: 'processing', on: 'START' })
      .build();
    
    expect(process).toBeDefined();
    expect(process.id).toBe('test-process');
    expect(DSLRegistry.getInstance().hasProcess('test-process')).toBe(true);
  });
  
  it('should create a task and register it', () => {
    // @ts-ignore - Task is defined globally
    const task = global.Task.create('test-task')
      .withDescription('Test task')
      .withImplementation(() => ({ success: true }))
      .build();
    
    expect(task).toBeDefined();
    expect(task.id).toBe('test-task');
    expect(DSLRegistry.getInstance().hasTask('test-task')).toBe(true);
  });
  
  it('should create a system and register it', () => {
    // First create a process to add to the system
    // @ts-ignore - Process is defined globally
    const process = global.Process.create('test-process')
      .withInitialState('initial')
      .addState('initial')
      .addState('processing')
      .addTransition({ from: 'initial', to: 'processing', on: 'START' })
      .build();
    
    // @ts-ignore - ReactiveSystem is defined globally
    const system = global.ReactiveSystem.define('test-system')
      .withName('Test System')
      .withDescription('A test system')
      // Add the process to the system
      .addProcess(process)
      .build();
    
    expect(system).toBeDefined();
    expect(system.id).toBe('test-system');
    expect(DSLRegistry.getInstance().hasSystem('test-system')).toBe(true);
  });
  
  it('should reset global DSL objects', () => {
    resetGlobalDSL();
    
    // @ts-ignore - Process should be undefined after reset
    expect(global.Process).toBeUndefined();
    // @ts-ignore - Task should be undefined after reset
    expect(global.Task).toBeUndefined();
    // @ts-ignore - ReactiveSystem should be undefined after reset
    expect(global.ReactiveSystem).toBeUndefined();
  });
}); 