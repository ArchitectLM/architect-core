/**
 * Reactive System DSL Interfaces
 * 
 * This module defines the interfaces for the reactive system DSL.
 */

import { Plugin } from './plugin';
import { TaskImplementationFn } from '../types';

/**
 * Reactive System Definition
 */
export interface ReactiveSystemDefinition {
  id: string;
  name?: string;
  description?: string;
  processes: ProcessDefinition[];
  tasks: TaskDefinition[];
  plugins?: (PluginDefinition | Plugin)[];
  metadata?: Record<string, unknown>;
}

/**
 * Process Definition
 */
export interface ProcessDefinition {
  id: string;
  name?: string;
  description?: string;
  initialState: string;
  states: StateDefinition[];
  metadata?: Record<string, unknown>;
}

/**
 * State Definition
 */
export interface StateDefinition {
  name: string;
  description?: string;
  isFinal?: boolean;
  transitions: TransitionDefinition[];
  tasks?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Transition Definition
 */
export interface TransitionDefinition {
  event: string;
  target: string;
  condition?: TaskImplementationFn<any, boolean>;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Task Definition
 */
export interface TaskDefinition {
  id: string;
  name?: string;
  description?: string;
  input?: Record<string, InputFieldDefinition>;
  output?: Record<string, OutputFieldDefinition>;
  implementation?: TaskImplementationFn;
  tests?: TestDefinition[];
  metadata?: Record<string, unknown>;
}

/**
 * Input Field Definition
 */
export interface InputFieldDefinition {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * Output Field Definition
 */
export interface OutputFieldDefinition {
  type: string;
  description?: string;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Test Definition
 */
export interface TestDefinition {
  name: string;
  description?: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Plugin Definition
 */
export interface PluginDefinition {
  name: string;
  description?: string;
  taskTypes?: Record<string, unknown>;
  stateTypes?: Record<string, unknown>;
  services?: Record<string, ServiceDefinition>;
  metadata?: Record<string, unknown>;
}

/**
 * Service Definition
 */
export interface ServiceDefinition {
  interface?: string;
  mockImplementation?: string;
  metadata?: Record<string, unknown>;
} 