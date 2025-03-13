/**
 * Core type definitions for ArchitectLM
 */
import { z } from 'zod';

// -----------------------------------------------------------------------------
// Event System Types
// -----------------------------------------------------------------------------

/**
 * Event type for the event bus
 */
export interface Event<T extends string = string, P = any> {
  id?: string;                       // Unique event identifier
  type: T;                           // Event type
  payload?: P;                       // Event payload
  timestamp?: Date;                  // Event timestamp (auto-populated if not provided)
  source?: string;                   // Source of the event
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Subscription for event bus
 */
export interface Subscription {
  unsubscribe: () => void;           // Function to unsubscribe
}

/**
 * Event handler function
 */
export type EventHandler<T extends string = string, P = any> = 
  (event: Event<T, P>) => void | Promise<void>;

// -----------------------------------------------------------------------------
// Process Types
// -----------------------------------------------------------------------------

/**
 * Process state definition
 */
export interface ProcessState<TContext = any> {
  name: string;                      // State name
  description?: string;              // State description
  type?: 'normal' | 'initial' | 'final'; // State type
  onEnter?: (context: TContext) => Promise<void> | void; // Handler when entering state
  onExit?: (context: TContext) => Promise<void> | void;  // Handler when exiting state
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Transition definition with improved typing
 */
export interface Transition<
  TState extends string = string,
  TEvent extends string = string,
  TContext = any
> {
  from: TState | TState[] | '*';     // Source state(s) - can use '*' for any state
  to: TState;                        // Target state
  on: TEvent;                        // Event type that triggers transition
  description?: string;              // Transition description
  guard?: (context: TContext, event: Event<TEvent>) => boolean | Promise<boolean>; // Optional condition
  action?: (context: TContext, event: Event<TEvent>) => Promise<void> | void; // Action to perform during transition
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Process definition with generic type parameters
 */
export interface ProcessDefinition<
  TState extends string = string,
  TEvent extends string = string,
  TContext = any
> {
  id: string;                        // Unique process identifier
  description?: string;              // Process description
  states: Array<ProcessState<TContext>> | Record<TState, ProcessState<TContext>>; // Valid states
  initialState?: TState;             // Initial state (defaults to first state)
  transitions: Array<Transition<TState, TEvent, TContext>>; // Valid state transitions
  contextSchema?: z.ZodType<TContext>; // Schema for process context validation
  metadata?: Record<string, unknown>; // Additional metadata
  
  // LLM-specific metadata to help with generation and understanding
  llmMetadata?: {
    domainConcepts?: string[];       // Domain concepts this process relates to
    businessRules?: string[];        // Business rules implemented by this process
    designPatterns?: string[];       // Design patterns used in this process
    relatedProcesses?: string[];     // Other processes this one interacts with
  };
}

/**
 * Process instance representing a running process
 */
export interface ProcessInstance<TState extends string = string, TContext = any> {
  id: string;                        // Instance ID
  processId: string;                 // Process definition ID
  tenantId?: string;                 // Optional tenant ID for multi-tenancy
  state: TState;                     // Current state
  context: TContext;                 // Process context data
  createdAt: Date;                   // Creation timestamp
  updatedAt: Date;                   // Last update timestamp
  history?: Array<{                  // Optional state transition history
    from: TState;
    to: TState;
    event: string;
    timestamp: Date;
  }>;
}

// -----------------------------------------------------------------------------
// Task Types
// -----------------------------------------------------------------------------

/**
 * Task context provides access to system during task execution
 */
export interface TaskContext<TState = any> {
  tenantId?: string;                 // Optional tenant ID for multi-tenancy
  state: TState;                     // Current state
  metadata: Record<string, unknown>; // Additional metadata
  services: ServiceRegistry;         // Available services
  
  // Helper methods
  emitEvent: <T extends string, P>(type: T, payload?: P) => void;
  executeTask: <Input, Output>(taskId: string, input: Input) => Promise<Output>;
  getProcess?: (instanceId: string) => ProcessInstance | undefined;
  getContext?: () => TState;
  updateContext?: (updates: Partial<TState>) => Promise<void>;
}

/**
 * Task implementation with improved typing
 */
export type TaskImplementation<Input = any, Output = any, State = any> = 
  (input: Input, context: TaskContext<State>) => Promise<Output>;

/**
 * Task definition with generic type parameters
 */
export interface TaskDefinition<Input = any, Output = any, State = any> {
  id: string;                        // Unique task identifier
  name?: string;                     // Task name
  description?: string;              // Task description
  implementation: TaskImplementation<Input, Output, State>; // Task implementation
  inputSchema?: z.ZodType<Input>;    // Schema for input validation
  outputSchema?: z.ZodType<Output>;  // Schema for output validation
  
  // Optional handlers
  onError?: (error: Error, input: Input, context: TaskContext<State>) => Promise<void>;
  onSuccess?: (result: Output, input: Input, context: TaskContext<State>) => Promise<void>;
  
  // Execution options
  timeout?: number;                  // Timeout in milliseconds
  retry?: {                          // Retry configuration
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  };
  
  metadata?: Record<string, unknown>; // Additional metadata
}

// -----------------------------------------------------------------------------
// System Types
// -----------------------------------------------------------------------------

/**
 * System configuration with improved typing
 */
export interface SystemConfig {
  id: string;                        // Unique system identifier
  name?: string;                     // System name
  description?: string;              // System description
  processes: Record<string, ProcessDefinition>; // Process definitions
  tasks: Record<string, TaskDefinition>;       // Task definitions
  tests?: TestDefinition[];          // Test definitions
  extensions?: Record<string, Extension | ExtensionConfig>; // Extensions
  observability?: ObservabilityConfig; // Observability configuration
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Reactive system with improved typing
 */
export interface ReactiveSystem {
  id: string;
  name?: string;
  description?: string;
  processes: Record<string, ProcessDefinition>;
  tasks: Record<string, TaskDefinition>;
  tests: TestDefinition[];
  extensions: Record<string, Extension>;
  runtime: Runtime;
  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Extension System Types
// -----------------------------------------------------------------------------

/**
 * Extension configuration
 */
export interface ExtensionConfig {
  enabled: boolean;
  options?: Record<string, unknown>;
}

/**
 * Extension interface
 */
export interface Extension {
  name: string;
  initialize: (runtime: Runtime) => Promise<void>;
  shutdown?: () => Promise<void>;
  
  // Lifecycle hooks
  hooks?: {
    beforeProcessTransition?: (process: ProcessInstance, event: Event) => Promise<void>;
    afterProcessTransition?: (process: ProcessInstance, event: Event) => Promise<void>;
    beforeTaskExecution?: (task: TaskDefinition, input: unknown) => Promise<void>;
    afterTaskExecution?: (task: TaskDefinition, result: unknown) => Promise<void>;
    onError?: (error: Error, context: any) => Promise<void>;
  };
  
  // Services provided by this extension
  services?: Record<string, any>;
}

/**
 * Service registry for dependency injection
 */
export interface ServiceRegistry {
  register: <T>(name: string, service: T) => void;
  get: <T>(name: string) => T;
  has: (name: string) => boolean;
  getAll: () => Record<string, any>;
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  metrics?: boolean | {
    provider: string;
    options?: Record<string, unknown>;
  };
  tracing?: boolean | {
    provider: string;
    exporters?: string[];
    options?: Record<string, unknown>;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format?: 'json' | 'text';
    options?: Record<string, unknown>;
  };
}

// -----------------------------------------------------------------------------
// Runtime Types
// -----------------------------------------------------------------------------

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  environment?: 'development' | 'test' | 'production';
  debug?: boolean;
  storage?: StorageConfig;
  extensions?: Record<string, boolean | object>;
  observability?: ObservabilityConfig;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: 'memory' | 'local' | 'custom';
  adapter?: any;
  options?: Record<string, unknown>;
}

/**
 * Process options
 */
export interface ProcessOptions {
  instanceId?: string;               // Custom instance ID
  tenantId?: string;                 // Tenant ID for multi-tenancy
  initialState?: string;             // Override initial state
  context?: any;                     // Initial context
}

/**
 * Task options
 */
export interface TaskOptions {
  timeout?: number;                  // Task timeout in ms
  retry?: {                          // Retry configuration
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  };
}

/**
 * Runtime interface
 */
export interface Runtime {
  // Process management
  createProcess: <TContext = any>(
    processId: string, 
    input: TContext, 
    options?: ProcessOptions
  ) => ProcessInstance;
  
  getProcess: (instanceId: string) => ProcessInstance | undefined;
  
  transitionProcess: <TEvent extends string = string, TPayload = any>(
    instanceId: string, 
    event: TEvent | Event<TEvent, TPayload>
  ) => ProcessInstance;
  
  // Task execution
  executeTask: <Input = any, Output = any>(
    taskId: string, 
    input: Input, 
    options?: TaskOptions
  ) => Promise<Output>;
  
  // Event management
  emitEvent: <TEvent extends string = string, TPayload = any>(
    event: TEvent | Event<TEvent, TPayload>, 
    payload?: TPayload
  ) => void;
  
  subscribeToEvent: <TEvent extends string = string, TPayload = any>(
    type: TEvent | '*', 
    handler: EventHandler<TEvent, TPayload>
  ) => Subscription;
  
  // Extension management
  registerExtension: (extension: Extension) => void;
  getExtension: <T extends Extension>(name: string) => T | undefined;
  
  // Service management
  getService: <T>(name: string) => T;
  registerService: <T>(name: string, service: T) => void;
  
  // System management
  getTaskDefinition: (taskId: string) => TaskDefinition | undefined;
  getProcessDefinition: (processId: string) => ProcessDefinition | undefined;
  
  // Additional methods for introspection
  getAllProcesses: () => ProcessInstance[];
  getProcessesByType: (processId: string) => ProcessInstance[];
  getProcessesByState: (state: string) => ProcessInstance[];
  getAvailableTasks: () => string[];
  getAvailableProcesses: () => string[];
}

// -----------------------------------------------------------------------------
// Testing Types
// -----------------------------------------------------------------------------

/**
 * Test definition
 */
export interface TestDefinition {
  name: string;                      // Test name
  description?: string;              // Test description
  steps: TestStep[];                 // Test steps
  fixtures?: Record<string, unknown>; // Test fixtures
  expected?: {                       // Expected outcomes
    finalState?: string;
    events?: string[];
    errors?: string[];
    output?: Record<string, unknown>;
  };
}

/**
 * Test step with discriminated union
 */
export type TestStep =
  | { action: 'createProcess'; input: any; expectedState?: string }
  | { action: 'transition'; event: string; data?: any; expectedState?: string }
  | { action: 'executeTask'; taskId: string; input: any; expectedOutput?: any }
  | { action: 'verifyState'; state: string | ((state: string) => boolean) }
  | { action: 'verifyMockCalled'; service: string; method: string; withArgs?: (args: any) => boolean; times?: number }
  | { action: 'setMock'; service: string; method: string; implementation: Function }
  | { action: 'emitEvent'; type: string; payload: any }
  | { action: 'executeCode'; code: (context: any, runtime: any) => any };

/**
 * Test context
 */
export interface TestContext {
  processId?: string;                // Current process ID
  instanceId?: string;               // Current instance ID
  getService: <T>(name: string) => T; // Get a service
  emitEvent: <T extends string, P>(type: T, payload?: P) => void; // Emit an event
  executeTask: <Input, Output>(taskId: string, input: Input) => Promise<Output>; // Execute a task
  transitionProcess: <T extends string>(event: T, data?: any) => Promise<void>; // Transition process
  getContext: <T>() => T;            // Get the current context
  updateContext: <T>(updates: Partial<T>) => Promise<void>; // Update the context
  mockCalls: (serviceMethod: string) => any[]; // Get mock call history
  setMock: (service: string, method: string, impl: Function) => void; // Set a mock
}

/**
 * Test result
 */
export interface TestResult {
  testId: string;                    // Test ID
  success: boolean;                  // Whether the test passed
  steps: Array<{                     // Results for each step
    step: TestStep;
    success: boolean;
    result?: any;
    error?: Error;
  }>;
  duration: number;                  // Test duration in ms
  analysis?: {                       // LLM-generated analysis if failed
    cause?: string;
    suggestedFixes?: string;
  };
}

/**
 * Test options
 */
export interface TestOptions {
  timeout?: number;                  // Test timeout in ms
  stopOnFailure?: boolean;           // Whether to stop on first failure
  reporter?: TestReporter;           // Custom test reporter
  useLLMAnalysis?: boolean;          // Whether to use LLM to analyze failures
}

/**
 * Test suite
 */
export interface TestSuite {
  name: string;
  description?: string;
  tests: TestDefinition[];
  fixtures?: Record<string, unknown>;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  name: string;
  success: boolean;
  results: TestResult[];
  duration: number;
}

/**
 * Test reporter
 */
export interface TestReporter {
  onTestStart: (test: TestDefinition) => void;
  onTestComplete: (result: TestResult) => void;
  onSuiteStart: (suite: TestSuite) => void;
  onSuiteComplete: (result: TestSuiteResult) => void;
}

// -----------------------------------------------------------------------------
// LLM Agent Types
// -----------------------------------------------------------------------------

/**
 * LLM Agent interface
 */
export interface ArchitectAgent {
  // Generate and modify system components
  generateProcess: (spec: ProcessSpec) => Promise<ProcessDefinition>;
  generateTask: (spec: TaskSpec) => Promise<TaskDefinition>;
  generateSystem: (spec: SystemSpec) => Promise<SystemConfig>;
  
  // Feedback loop
  analyzeFeedback: (feedback: SystemFeedback) => Promise<SystemFixes>;
  
  // Test generation
  generateTests: (component: ProcessDefinition | TaskDefinition) => Promise<TestDefinition[]>;
  
  // Documentation
  generateDocs: (component: any) => Promise<string>;
}

/**
 * Process specification for LLM generation
 */
export interface ProcessSpec {
  name: string;
  description: string;
  domainConcepts?: string[];
  businessRules?: string[];
  states?: string[];
  events?: string[];
}

/**
 * Task specification for LLM generation
 */
export interface TaskSpec {
  name: string;
  description: string;
  input?: Record<string, string>;
  output?: Record<string, string>;
  dependencies?: string[];
}

/**
 * System specification for LLM generation
 */
export interface SystemSpec {
  name: string;
  description: string;
  processes: ProcessSpec[];
  tasks: TaskSpec[];
}

/**
 * System feedback for LLM analysis
 */
export interface SystemFeedback {
  validation: ValidationResult[];
  tests: TestResult[];
  staticAnalysis: StaticAnalysisResult[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  component: string;
  valid: boolean;
  errors: string[];
}

/**
 * Static analysis result
 */
export interface StaticAnalysisResult {
  component: string;
  issues: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    location?: string;
  }>;
}

/**
 * System fixes from LLM
 */
export interface SystemFixes {
  components: Record<string, any>;
  explanation: string;
} 