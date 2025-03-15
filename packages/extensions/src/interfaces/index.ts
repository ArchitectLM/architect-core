/**
 * Extension interfaces
 */

import { 
  ProcessDefinition, 
  TaskDefinition, 
  SystemConfig, 
  TestDefinition,
  Runtime
} from '../types/index';

/**
 * Extension interface
 * Base interface for all extensions
 */
export interface Extension {
  /**
   * Name of the extension
   */
  name: string;
  
  /**
   * Initialize the extension with the runtime
   */
  initialize(runtime: Runtime): Promise<void>;
}

/**
 * Service Registry interface
 * Used for registering and retrieving services
 */
export interface ServiceRegistry {
  /**
   * Register a service
   */
  registerService<T>(name: string, service: T): void;
  
  /**
   * Get a service by name
   */
  getService<T>(name: string): T | null;
}

/**
 * Architect Agent interface
 * Used for AI-assisted development capabilities
 */
export interface ArchitectAgent {
  /**
   * Generate a process definition from a specification
   */
  generateProcess(spec: ProcessSpec): Promise<ProcessDefinition>;
  
  /**
   * Generate a task definition from a specification
   */
  generateTask(spec: TaskSpec): Promise<TaskDefinition>;
  
  /**
   * Generate a system configuration from a specification
   */
  generateSystem(spec: SystemSpec): Promise<SystemConfig>;
  
  /**
   * Analyze feedback and suggest fixes
   */
  analyzeFeedback(feedback: SystemFeedback): Promise<SystemFixes>;
  
  /**
   * Generate tests for a component
   */
  generateTests(component: ProcessDefinition | TaskDefinition): Promise<TestDefinition[]>;
  
  /**
   * Generate documentation for a component
   */
  generateDocs(component: any): Promise<string>;
}

/**
 * Process Specification
 */
export interface ProcessSpec {
  name: string;
  description?: string;
  states?: string[];
  events?: string[];
  transitions?: Array<{
    from: string;
    to: string;
    on: string;
  }>;
  domainConcepts?: string[];
  businessRules?: string[];
  metadata?: Record<string, any>;
}

/**
 * Task Specification
 */
export interface TaskSpec {
  name: string;
  description?: string;
  input?: Record<string, string>;
  output?: Record<string, string>;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

/**
 * System Specification
 */
export interface SystemSpec {
  name: string;
  description?: string;
  processes?: ProcessSpec[];
  tasks?: TaskSpec[];
  metadata?: Record<string, any>;
}

/**
 * System Feedback
 */
export interface SystemFeedback {
  validation?: Record<string, any>;
  tests?: Record<string, any>;
  staticAnalysis?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * System Fixes
 */
export interface SystemFixes {
  processes?: Record<string, ProcessDefinition>;
  tasks?: Record<string, TaskDefinition>;
  explanation?: string;
  metadata?: Record<string, any>;
}
