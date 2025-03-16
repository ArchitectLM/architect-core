/**
 * Base metadata interface for all DSL components
 */
export interface Metadata {
  name?: string;
  version?: string;
  description?: string;
  purpose?: string;
  domain?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * JSON Schema definition
 */
export interface Schema {
  type: string;
  required?: string[];
  properties?: Record<string, any>;
  items?: any;
  additionalProperties?: boolean | Record<string, any>;
  oneOf?: any[];
  anyOf?: any[];
  allOf?: any[];
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
  [key: string]: any;
}

/**
 * Function definition
 */
export interface Function {
  meta: Metadata;
  implementation: (...args: any[]) => any;
}

/**
 * Resilience configuration
 */
export interface ResilienceConfig {
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeout: number;
  };
  retry?: {
    maxAttempts: number;
    backoff: "fixed" | "exponential" | "linear";
    initialDelay?: number;
  };
  timeout?: number;
}

/**
 * Command definition
 */
export interface Command {
  meta: Metadata;
  input: string;
  output: string;
  implementation: (...args: any[]) => any;
  resilience?: ResilienceConfig;
}

/**
 * Pipeline step definition
 */
export interface PipelineStep {
  name: string;
  function: string;
  input?: string;
  output?: string;
  condition?: string;
}

/**
 * Error handling configuration for pipelines
 */
export interface ErrorHandling {
  fallback?: string;
  retryable?: string[];
  maxRetries?: number;
}

/**
 * Pipeline definition
 */
export interface Pipeline {
  description?: string;
  input: string;
  output: string;
  steps: PipelineStep[];
  errorHandling?: ErrorHandling;
}

/**
 * Extension point definition
 */
export interface ExtensionPoint {
  description?: string;
  parameters?: string[];
}

/**
 * Extension hook definition
 */
export interface ExtensionHook {
  meta?: Metadata;
  implementation: (...args: any[]) => any;
}

/**
 * Extension definition
 */
export interface Extension {
  meta: Metadata;
  hooks: Record<string, ExtensionHook>;
  configuration?: Record<string, any>;
}

/**
 * Complete DSL configuration
 */
export interface DSLConfig {
  meta: Metadata;
  schemas: Record<string, Schema>;
  functions: Record<string, Function>;
  commands: Record<string, Command>;
  pipelines: Record<string, Pipeline>;
  extensionPoints: Record<string, ExtensionPoint>;
  extensions?: Record<string, Extension>;
}
