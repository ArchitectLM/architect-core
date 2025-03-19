/**
 * Component models for the DSL
 */

/**
 * Component types supported by the DSL
 */
export enum ComponentType {
  SCHEMA = 'SCHEMA',
  COMMAND = 'COMMAND',
  QUERY = 'QUERY',
  EVENT = 'EVENT',
  WORKFLOW = 'WORKFLOW',
  POLICY = 'POLICY',
  SYSTEM = 'SYSTEM'
}

/**
 * Base interface for all component definitions
 */
export interface ComponentDefinition {
  id: string;
  type: ComponentType;
  description: string;
  version: string;
  tags?: string[];
}

/**
 * Schema component definition
 */
export interface SchemaComponentDefinition extends ComponentDefinition {
  type: ComponentType.SCHEMA;
  properties: Record<string, SchemaPropertyDefinition>;
  required?: string[];
  examples?: any[];
}

/**
 * Property definition for schema components
 */
export interface SchemaPropertyDefinition {
  type: string;
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  enum?: (string | number)[];
  items?: SchemaPropertyDefinition;
  properties?: Record<string, SchemaPropertyDefinition>;
}

/**
 * Command component definition
 */
export interface CommandComponentDefinition extends ComponentDefinition {
  type: ComponentType.COMMAND;
  input: { ref: string };
  output: { ref: string };
  produces?: Array<{ event: string; description: string }>;
  extensionPoints?: Record<string, ExtensionPointDefinition>;
}

/**
 * Query component definition
 */
export interface QueryComponentDefinition extends ComponentDefinition {
  type: ComponentType.QUERY;
  input: { ref: string };
  output: { ref: string };
}

/**
 * Event component definition
 */
export interface EventComponentDefinition extends ComponentDefinition {
  type: ComponentType.EVENT;
  payload: { ref: string };
}

/**
 * Workflow component definition
 */
export interface WorkflowComponentDefinition extends ComponentDefinition {
  type: ComponentType.WORKFLOW;
  initialState: string;
  transitions: WorkflowTransition[];
}

/**
 * Workflow transition definition
 */
export interface WorkflowTransition {
  from: string;
  to: string;
  on: string;
}

/**
 * System definition
 */
export interface SystemDefinition extends ComponentDefinition {
  type: ComponentType.SYSTEM;
  components: {
    schemas?: Array<{ ref: string }>;
    commands?: Array<{ ref: string }>;
    queries?: Array<{ ref: string }>;
    events?: Array<{ ref: string }>;
    workflows?: Array<{ ref: string }>;
  };
  workflows?: Array<WorkflowDefinition>;
  plugins?: Record<string, any>;
  extensions?: Array<{ ref: string; config?: any }>;
}

/**
 * Workflow definition within a system
 */
export interface WorkflowDefinition {
  name: string;
  description: string;
  initialState: string;
  transitions: WorkflowTransition[];
}

/**
 * Extension point definition
 */
export interface ExtensionPointDefinition {
  description: string;
  parameters?: string[];
  examples?: string[];
}

/**
 * Component implementation
 */
export interface ComponentImplementation<T = any, R = any> {
  componentId: string;
  handler: (input: T, context: any) => Promise<R>;
  metadata?: any;
}

/**
 * Type for the registry of components in the DSL
 */
export type ComponentRegistry = Map<string, ComponentDefinition>;

/**
 * Type for the registry of implementations in the DSL
 */
export type ImplementationRegistry = Map<string, ComponentImplementation>; 