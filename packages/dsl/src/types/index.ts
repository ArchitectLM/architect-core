/**
 * System configuration
 */
export interface SystemConfig {
  id: string;
  name: string;
  description?: string;
  processes: any[];
  tasks: any[];
  services?: any[];
  plugins?: any[];
  metadata?: Record<string, any>;
}

/**
 * Process definition
 */
export interface ProcessDefinition {
  id: string;
  name: string;
  description?: string;
  initialState: string;
  states: string[];
  transitions: any[];
  metadata?: Record<string, any>;
}

/**
 * State definition
 */
export interface StateDefinition {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Task definition
 */
export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  implementation?: any;
  errorHandler?: any;
  metadata?: Record<string, any>;
}

/**
 * Test definition
 */
export interface TestDefinition {
  id: string;
  name: string;
  description?: string;
  testCases: any[];
  metadata?: Record<string, any>;
}

/**
 * Reactive system definition
 */
export interface ReactiveSystemDefinition {
  id: string;
  name: string;
  description?: string;
  processes: ProcessDefinition[];
  tasks: TaskDefinition[];
  services?: any[];
  plugins?: any[];
  metadata?: Record<string, any>;
}

/**
 * Plugin definition
 */
export interface PluginDefinition {
  name: string;
  description?: string;
  tasks?: any[];
  states?: any[];
  services?: any[];
}

/**
 * Service definition
 */
export interface ServiceDefinition {
  name: string;
  interface?: string;
  mockImplementation?: string;
}
