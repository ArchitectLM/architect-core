/**
 * Plugin system for extending the DSL
 */

import { ReactiveSystemBuilder } from './reactive-system';
import { ProcessBuilder } from './builders/process-builder';
import { TaskBuilder } from './builders/task-builder';
import { StateBuilder } from './builders/state-builder';
import { 
  PluginDefinition, 
  ServiceDefinition, 
  TaskDefinition 
} from './types/index';

/**
 * DSL extension interface
 */
export interface ReactiveSystemDSL {
  /**
   * Register a task type
   */
  registerTaskType(
    name: string, 
    config: {
      defaultInput?: Record<string, any>;
      defaultOutput?: Record<string, any>;
      defaultImplementation?: string;
    }
  ): void;

  /**
   * Register a state type
   */
  registerStateType(
    name: string,
    config: {
      defaultTransitions?: Array<{
        event: string;
        target: string;
        condition?: string;
      }>;
      onEnter?: string;
      onExit?: string;
    }
  ): void;

  /**
   * Register a service
   */
  registerService(
    name: string,
    config: {
      interface?: string;
      mockImplementation?: string;
    }
  ): void;

  /**
   * Get the plugin definition
   */
  getPluginDefinition(): PluginDefinition;
}

/**
 * DSL extension implementation
 */
export class ReactiveSystemDSLExtension implements ReactiveSystemDSL {
  protected taskTypes: Record<string, any> = {};
  protected stateTypes: Record<string, any> = {};
  protected services: Record<string, ServiceDefinition> = {};
  private plugin: PluginDefinition;

  constructor(name: string, description?: string) {
    this.plugin = {
      name,
      description,
      tasks: [],
      states: [],
      services: []
    };
  }

  /**
   * Register a task type
   */
  registerTaskType(
    name: string, 
    config: {
      defaultInput?: Record<string, any>;
      defaultOutput?: Record<string, any>;
      defaultImplementation?: string;
    }
  ): void {
    this.taskTypes[name] = config;
  }

  /**
   * Register a state type
   */
  registerStateType(
    name: string,
    config: {
      defaultTransitions?: Array<{
        event: string;
        target: string;
        condition?: string;
      }>;
      onEnter?: string;
      onExit?: string;
    }
  ): void {
    this.stateTypes[name] = config;
  }

  /**
   * Register a service
   */
  registerService(
    name: string,
    config: {
      interface?: string;
      mockImplementation?: string;
    }
  ): void {
    this.services[name] = {
      name,
      interface: config.interface,
      mockImplementation: config.mockImplementation
    };
  }

  /**
   * Get the plugin definition
   */
  getPluginDefinition(): PluginDefinition {
    return this.plugin;
  }
}
