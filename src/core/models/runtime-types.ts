/**
 * Runtime Types for ArchitectLM
 */
import { Event, EventHandler, Subscription } from './event-types';
import { ProcessDefinition, ProcessInstance, ProcessOptions } from './process-types';
import { TaskDefinition, TaskOptions } from './task-types';
import { TestDefinition, TestOptions, TestResult, TestSuite, TestSuiteResult } from './testing-types';

/**
 * Runtime interface
 */
export interface Runtime {
  // Process management
  createProcess: <TContext = any>(
    processId: string, 
    context: TContext, 
    options?: ProcessOptions
  ) => ProcessInstance;
  
  getProcess: (instanceId: string) => ProcessInstance | undefined;
  
  getAllProcesses: () => ProcessInstance[];
  
  transitionProcess: (
    instanceId: string, 
    eventType: string, 
    payload?: any
  ) => ProcessInstance;
  
  // Task execution
  executeTask: <TInput = any, TOutput = any>(
    taskId: string, 
    input: TInput, 
    options?: TaskOptions
  ) => Promise<TOutput>;
  
  // Event handling
  emitEvent: <T extends string = string, P = any>(
    event: Event<T, P>
  ) => void;
  
  subscribeToEvent: <T extends string = string, P = any>(
    eventType: T | T[] | '*', 
    handler: EventHandler<T, P>
  ) => Subscription;
  
  // Testing
  runTest: (
    test: TestDefinition, 
    options?: TestOptions
  ) => Promise<TestResult>;
  
  runTestSuite: (
    suite: TestSuite, 
    options?: TestOptions
  ) => Promise<TestSuiteResult>;
  
  // Plugin management
  registerPlugin: (plugin: any) => void;
  
  // Service management
  registerService: (name: string, service: any) => void;
  
  getService: <T = any>(name: string) => T;
  
  // Lifecycle management
  start: () => Promise<void>;
  
  stop: () => Promise<void>;
} 