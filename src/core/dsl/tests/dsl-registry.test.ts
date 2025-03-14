/**
 * DSL Registry Tests
 * 
 * This file tests the DSL registry with enhanced validation.
 */

import { describe, it, beforeEach, expect } from 'vitest';
import { DSLRegistry, getRegistry, registerProcess, registerTask, registerSystem } from '../dsl-registry';

describe('DSL Registry', () => {
  beforeEach(() => {
    // Reset the registry before each test
    DSLRegistry.getInstance().clear();
  });
  
  it('should register and retrieve a process', () => {
    const process = { id: 'test-process', states: ['initial', 'processing'] };
    registerProcess('test-process', process);
    
    const retrievedProcess = getRegistry().getProcess('test-process');
    expect(retrievedProcess).toEqual(process);
  });
  
  it('should register and retrieve a task', () => {
    const task = { id: 'test-task', implementation: () => ({}) };
    registerTask('test-task', task);
    
    const retrievedTask = getRegistry().getTask('test-task');
    expect(retrievedTask).toEqual(task);
  });
  
  it('should register and retrieve a system', () => {
    const system = { id: 'test-system', processes: [], tasks: [] };
    registerSystem('test-system', system);
    
    const retrievedSystem = getRegistry().getSystem('test-system');
    expect(retrievedSystem).toEqual(system);
  });
  
  it('should check if a process exists', () => {
    const process = { id: 'test-process', states: ['initial', 'processing'] };
    registerProcess('test-process', process);
    
    expect(getRegistry().hasProcess('test-process')).toBe(true);
    expect(getRegistry().hasProcess('non-existent-process')).toBe(false);
  });
  
  it('should check if a task exists', () => {
    const task = { id: 'test-task', implementation: () => ({}) };
    registerTask('test-task', task);
    
    expect(getRegistry().hasTask('test-task')).toBe(true);
    expect(getRegistry().hasTask('non-existent-task')).toBe(false);
  });
  
  it('should check if a system exists', () => {
    const system = { id: 'test-system', processes: [], tasks: [] };
    registerSystem('test-system', system);
    
    expect(getRegistry().hasSystem('test-system')).toBe(true);
    expect(getRegistry().hasSystem('non-existent-system')).toBe(false);
  });
  
  it('should get all registered processes', () => {
    const process1 = { id: 'test-process-1', states: ['initial', 'processing'] };
    const process2 = { id: 'test-process-2', states: ['initial', 'completed'] };
    
    registerProcess('test-process-1', process1);
    registerProcess('test-process-2', process2);
    
    const allProcesses = getRegistry().getAllProcesses();
    expect(allProcesses.length).toBe(2);
    expect(allProcesses).toContainEqual(['test-process-1', process1]);
    expect(allProcesses).toContainEqual(['test-process-2', process2]);
  });
  
  it('should get all registered tasks', () => {
    const task1 = { id: 'test-task-1', implementation: () => ({}) };
    const task2 = { id: 'test-task-2', implementation: () => ({}) };
    
    registerTask('test-task-1', task1);
    registerTask('test-task-2', task2);
    
    const allTasks = getRegistry().getAllTasks();
    expect(allTasks.length).toBe(2);
    expect(allTasks).toContainEqual(['test-task-1', task1]);
    expect(allTasks).toContainEqual(['test-task-2', task2]);
  });
  
  it('should get all registered systems', () => {
    const system1 = { id: 'test-system-1', processes: [], tasks: [] };
    const system2 = { id: 'test-system-2', processes: [], tasks: [] };
    
    registerSystem('test-system-1', system1);
    registerSystem('test-system-2', system2);
    
    const allSystems = getRegistry().getAllSystems();
    expect(allSystems.length).toBe(2);
    expect(allSystems).toContainEqual(['test-system-1', system1]);
    expect(allSystems).toContainEqual(['test-system-2', system2]);
  });
  
  it('should clear the registry', () => {
    const process = { id: 'test-process', states: ['initial', 'processing'] };
    const task = { id: 'test-task', implementation: () => ({}) };
    const system = { id: 'test-system', processes: [], tasks: [] };
    
    registerProcess('test-process', process);
    registerTask('test-task', task);
    registerSystem('test-system', system);
    
    getRegistry().clear();
    
    expect(getRegistry().hasProcess('test-process')).toBe(false);
    expect(getRegistry().hasTask('test-task')).toBe(false);
    expect(getRegistry().hasSystem('test-system')).toBe(false);
  });
}); 