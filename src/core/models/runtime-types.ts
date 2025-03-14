/**
 * Runtime Types for ArchitectLM
 * 
 * This file contains type definitions for the Runtime interface.
 */
import { Event, EventHandler, Subscription } from './event-types';
import { ProcessDefinition, ProcessInstance, ProcessOptions } from './process-types';
import { TaskDefinition, TaskOptions } from './task-types';
import { TestDefinition, TestOptions, TestResult, TestSuite, TestSuiteResult } from './testing-types';

/**
 * Runtime interface with type-safe methods
 */
export interface Runtime {
  // Process management
  createProcess: <TContext = Record<string, unknown>>(
    processId: string, 
    context: TContext, 
    options?: ProcessOptions
  ) => ProcessInstance;
  
  getProcess: (instanceId: string) => ProcessInstance | undefined;
  
  getAllProcesses: () => ProcessInstance[];
  
  transitionProcess: (
    instanceId: string, 
    eventType: string, 
    payload?: unknown
  ) => ProcessInstance;
  
  // Task execution
  executeTask: <TInput = unknown, TOutput = unknown>(
    taskId: string, 
    input: TInput, 
    options?: TaskOptions
  ) => Promise<TOutput>;
  
  // Event handling
  emitEvent: <T extends string = string, P = unknown>(
    event: Event<T, P>
  ) => void;
  
  subscribeToEvent: <T extends string = string, P = unknown>(
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
  registerPlugin: (plugin: unknown) => void;
  
  // Service management
  registerService: <T>(name: string, service: T) => void;
  
  /**
   * Get a service by name
   * @template T The type of service to return
   * @param name The name of the service to get
   * @returns The service instance or null if not found
   */
  getService: <T>(name: string) => T | null;
  
  // Lifecycle management
  start: () => Promise<void>;
  
  stop: () => Promise<void>;
} 