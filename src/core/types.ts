/**
 * Core type definitions for ArchitectLM
 */

// Event type for the event bus
export interface Event {
  id?: string;                       // Unique event identifier
  type: string;                      // Event type
  payload?: any;                     // Event payload
  timestamp?: number | Date;         // Event timestamp (auto-populated if not provided)
  source?: string;                   // Source of the event
}

// Subscription for event bus
export interface Subscription {
  unsubscribe: () => void;           // Function to unsubscribe
}

// Event handler function
export type EventHandler = (event: Event) => void | Promise<void>;

// Process definition
export interface ProcessDefinition {
  id: string;                       // Unique process identifier
  states: string[] | Record<string, ProcessState>; // Valid states for this process
  initialState?: string;            // Initial state (defaults to first state)
  transitions?: Transition[];        // Valid state transitions
  description?: string;             // Process description
  contextSchema?: object;           // Schema for process context (optional)
  metadata?: Record<string, any>;   // Additional metadata for the process
}

// Process state definition
export interface ProcessState {
  type?: 'normal' | 'initial' | 'final'; // State type
  transitions?: Record<string, StateTransition>; // Transitions from this state
  metadata?: Record<string, any>;   // Additional metadata for the state
}

// State transition definition
export interface StateTransition {
  target: string;                   // Target state
  action?: string;                  // Task to execute during transition
  guard?: (context: any, event: any) => boolean | Promise<boolean>; // Optional condition
  metadata?: Record<string, any>;   // Additional metadata for the transition
}

// Transition definition
export interface Transition {
  from: string | string[];          // Source state(s) - can use '*' for any state
  to: string;                       // Target state
  on: string;                       // Event type that triggers transition
  guard?: (context: any, event: any) => boolean | Promise<boolean>; // Optional condition
  metadata?: Record<string, any>;   // Additional metadata for the transition
}

// Process instance representing a running process
export interface ProcessInstance {
  id: string;                        // Instance ID
  processId: string;                 // Process definition ID
  state: string;                     // Current state
  context: any;                      // Process context data
  createdAt: Date;                   // Creation timestamp
  updatedAt: Date;                   // Last update timestamp
}

// Task definition
export interface TaskDefinition {
  id: string;                       // Unique task identifier
  name?: string;                    // Task name
  input?: string[];                 // Input parameter names (for documentation)
  output?: string[];                // Output field names (for documentation)
  implementation: TaskImplementation; // Task implementation function
  description?: string;             // Task description
  metadata?: Record<string, any>;   // Additional metadata for the task
}

// Task implementation type
export type TaskImplementation = 
  | ((input: any, context: TaskContext) => Promise<any>)  // Task result
  | ((context: TaskContext) => Promise<any>);             // Task result

// Task context provides access to system during task execution
export interface TaskContext {
  input: any;                        // Task input
  services: Record<string, any>;     // Available services
  processId?: string;                // Current process ID if in process context
  instanceId?: string;               // Current instance ID if in process context
  getService: (name: string) => any; // Get a service (like a repository or external API)
  emitEvent: (type: string | Event, payload?: any) => void; // Emit an event
  executeTask: (taskId: string, input: any) => Promise<any>; // Execute another task
  getProcess?: (instanceId: string) => any; // Get a process instance
  getContext?: () => any;             // Get the current context
  updateContext?: (updates: any) => Promise<void>; // Update the context
}

// System configuration
export interface SystemConfig {
  id: string;                                           // Unique system identifier
  name?: string;                                        // System name
  description?: string;                                 // System description
  processes: Record<string, ProcessDefinition> | ProcessDefinition[];  // Process definitions
  tasks: Record<string, TaskDefinition> | TaskDefinition[];           // Task definitions
  tests?: TestDefinition[];                             // Test definitions
  mocks?: Record<string, Record<string, Function>>;     // Mock implementations
  extensions?: Record<string, ExtensionConfig>;         // Optional extensions
  metadata?: Record<string, any>;                       // Additional metadata for the system
}

// Runtime configuration
export interface RuntimeConfig {
  environment?: 'development' | 'test' | 'production';  // Runtime environment
  debug?: boolean;                                      // Enable debug mode
  storage?: StorageConfig;                              // Storage configuration
  extensions?: Record<string, boolean | object>;        // Enabled extensions
}

// Storage configuration
export interface StorageConfig {
  type: 'memory' | 'local' | 'custom';                  // Storage type
  adapter?: any;                                        // Custom storage adapter
  options?: any;                                        // Storage-specific options
}

// Reactive system
export interface ReactiveSystem {
  id: string;
  processes: Record<string, ProcessDefinition>;
  tasks: Record<string, TaskDefinition>;
  tests: TestDefinition[];
  mocks: Record<string, Record<string, Function>>;
  runtime: Runtime;
}

// Test definition
export interface TestDefinition {
  name: string;                     // Test name
  description?: string;             // Test description
  steps: TestStep[];                // Test steps
  fixtures?: Record<string, any>;   // Test fixtures
  expected?: {                      // Expected outcomes
    finalState?: string;
    events?: string[];
    errors?: string[];
    output?: Record<string, any>;
  };
}

// Test step types
export type TestStep =
  | { action: 'createProcess'; input: any; expectedState?: string }
  | { action: 'transition'; event: string; data?: any; expectedState?: string }
  | { action: 'executeTask'; taskId: string; input: any; expectedOutput?: any }
  | { action: 'verifyState'; state: string | ((state: string) => boolean) }
  | { action: 'verifyMockCalled'; service: string; method: string; withArgs?: (args: any) => boolean; times?: number }
  | { action: 'setMock'; service: string; method: string; implementation: Function }
  | { action: 'emitEvent'; type: string; payload: any }
  | { action: 'executeCode'; code: string };

// Test context
export interface TestContext {
  processId?: string;                // Current process ID
  instanceId?: string;               // Current instance ID
  getService: (name: string) => any; // Get a service
  emitEvent: (type: string, payload?: any) => void; // Emit an event
  executeTask: (taskId: string, input: any) => Promise<any>; // Execute a task
  transitionProcess: (event: string, data?: any) => Promise<void>; // Transition process
  getContext: () => any;             // Get the current context
  updateContext: (updates: any) => Promise<void>; // Update the context
  mockCalls: (serviceMethod: string) => any[]; // Get mock call history
  setMock: (service: string, method: string, impl: Function) => void; // Set a mock
}

// Test result
export interface TestResult {
  testId: string;                    // Test ID
  success: boolean;                  // Whether the test passed
  steps: Array<{                     // Results for each step
    step: TestStep;
    success: boolean;
    result?: any;
    error?: any;
  }>;
  duration: number;                  // Test duration in ms
  analysis?: {                       // LLM-generated analysis if failed
    cause?: string;
    suggestedFixes?: string;
  };
}

// Runtime interface
export interface Runtime {
  // Process management
  createProcess: (processId: string, input: any, options?: ProcessOptions) => ProcessInstance;
  getProcess: (instanceId: string) => ProcessInstance | undefined;
  transitionProcess: (instanceId: string, event: string, data?: any) => ProcessInstance;
  
  // Task execution
  executeTask: (taskId: string, input: any, options?: TaskOptions) => Promise<any>;
  
  // Event management
  emitEvent: (event: Event | string, payload?: any) => Event | void;
  subscribeToEvent: (type: string, handler: EventHandler) => Subscription;
  
  // Testing
  runTest?: (test: TestDefinition, options?: TestOptions) => Promise<TestResult>;
  runTestSuite?: (suite: TestSuite, options?: TestOptions) => Promise<TestSuiteResult>;
  
  // System management
  getTaskImplementation?: (taskId: string) => TaskImplementation | undefined;
  getProcessDefinition?: (processId: string) => ProcessDefinition | undefined;
  
  // Additional methods for introspection (optional)
  getAllProcesses?: () => ProcessInstance[];
  getProcessesByType?: (processId: string) => ProcessInstance[];
  getProcessesByState?: (state: string) => ProcessInstance[];
  getAvailableTasks?: () => string[];
  getAvailableProcesses?: () => string[];
}

// Process options
export interface ProcessOptions {
  instanceId?: string;               // Custom instance ID
  initialState?: string;             // Override initial state
  context?: any;                     // Initial context
}

// Task options
export interface TaskOptions {
  timeout?: number;                  // Task timeout in ms
  retry?: {                          // Retry configuration
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  };
}

// Test options
export interface TestOptions {
  timeout?: number;                  // Test timeout in ms
  stopOnFailure?: boolean;           // Whether to stop on first failure
  reporter?: TestReporter;           // Custom test reporter
  useLLMAnalysis?: boolean;          // Whether to use LLM to analyze failures
}

// Test suite
export interface TestSuite {
  name: string;
  tests: TestDefinition[];
  fixtures?: Record<string, any>;
  mocks?: Record<string, Record<string, Function>>;
}

// Test suite result
export interface TestSuiteResult {
  name: string;
  success: boolean;
  results: TestResult[];
  duration: number;
}

// Test reporter
export interface TestReporter {
  onTestStart: (test: TestDefinition) => void;
  onTestComplete: (result: TestResult) => void;
  onSuiteStart: (suite: TestSuite) => void;
  onSuiteComplete: (result: TestSuiteResult) => void;
}

// Extension configuration
export interface ExtensionConfig {
  enabled: boolean;
} 