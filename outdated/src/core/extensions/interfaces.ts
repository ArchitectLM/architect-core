/**
 * Extension Interfaces for ArchitectLM
 * 
 * This file defines the core interfaces for extensions and agents.
 */

import { ProcessDefinition, TaskDefinition, SystemConfig, TestDefinition } from '../types';
import { Runtime } from '../models/runtime-types';

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
  
  /**
   * Generate a database schema from a specification
   */
  generateDatabaseSchema?(schemaSpec: DatabaseSchemaSpec): Promise<DatabaseSchemaDefinition>;
  
  /**
   * Generate an API endpoint from a specification
   */
  generateAPIEndpoint?(endpointSpec: APIEndpointSpec): Promise<APIEndpointDefinition>;
  
  /**
   * Generate a UI component from a specification
   */
  generateUIComponent?(componentSpec: UIComponentSpec): Promise<UIComponentDefinition>;
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

/**
 * Database Schema Specification
 */
export interface DatabaseSchemaSpec {
  name: string;
  description?: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    default?: any;
  }>;
  timestamps?: boolean;
  indexes?: Array<{
    fields: string[];
    unique?: boolean;
  }>;
  metadata?: Record<string, any>;
}

/**
 * Database Schema Definition
 */
export interface DatabaseSchemaDefinition {
  name: string;
  description?: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    default?: any;
  }>;
  code: string;
  metadata?: Record<string, any>;
}

/**
 * API Endpoint Specification
 */
export interface APIEndpointSpec {
  name: string;
  description?: string;
  model: string;
  operations: string[];
  authentication?: boolean;
  validation?: boolean;
  metadata?: Record<string, any>;
}

/**
 * API Endpoint Definition
 */
export interface APIEndpointDefinition {
  name: string;
  description?: string;
  model: string;
  operations: Array<{
    name: string;
    method: string;
    path: string;
  }>;
  code: string;
  metadata?: Record<string, any>;
}

/**
 * UI Component Specification
 */
export interface UIComponentSpec {
  name: string;
  description?: string;
  framework: string;
  props: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
  styling?: string;
  state?: Record<string, any>;
  events?: string[];
  metadata?: Record<string, any>;
}

/**
 * UI Component Definition
 */
export interface UIComponentDefinition {
  name: string;
  description?: string;
  props: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
  code: string;
  metadata?: Record<string, any>;
} 