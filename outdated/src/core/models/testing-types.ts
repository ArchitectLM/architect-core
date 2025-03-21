/**
 * Testing Types for ArchitectLM
 */
import { ProcessInstance } from './process-types';

/**
 * Test step definition
 */
export interface TestStep {
  type?: 'create-process' | 'execute-task' | 'emit-event' | 'verify-state' | 'wait' | string;
  action?: string; // For backward compatibility
  description?: string;
  params?: Record<string, any>;
  expected?: any;
  timeout?: number;
  
  // Additional properties used in test-builder.ts
  input?: Record<string, any>;
  event?: string;
  taskId?: string;
  state?: string | Record<string, any> | ((state: string) => boolean);
  service?: string;
  code?: string | ((context: any, runtime: any) => any);
  expectedState?: any;
  data?: any;
  expectedOutput?: any;
  method?: string;
  payload?: any;
  withArgs?: (args: any) => boolean;
  implementation?: Function;
  times?: number;
}

/**
 * Test definition
 */
export interface TestDefinition {
  id: string;
  name?: string;
  description?: string;
  steps: TestStep[];
  expected?: {
    finalState?: Record<string, any>;
    events?: string[];
    errors?: string[];
    output?: any;
  };
  timeout?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Test options
 */
export interface TestOptions {
  timeout?: number;
  stopOnFailure?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Test step result
 */
export interface TestStepResult {
  step: TestStep;
  success: boolean;
  actual?: any;
  expected?: any;
  error?: Error;
  duration: number;
}

/**
 * Test result
 */
export interface TestResult {
  testId: string;
  success: boolean;
  steps: TestStepResult[];
  duration: number;
  startTime: Date;
  endTime: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Test suite
 */
export interface TestSuite {
  id: string;
  name?: string;
  description?: string;
  tests: TestDefinition[];
  beforeAll?: () => Promise<void> | void;
  afterAll?: () => Promise<void> | void;
  beforeEach?: () => Promise<void> | void;
  afterEach?: () => Promise<void> | void;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  suiteId: string;
  success: boolean;
  results: TestResult[];
  duration: number;
  startTime: Date;
  endTime: Date;
  metadata?: Record<string, unknown>;
} 