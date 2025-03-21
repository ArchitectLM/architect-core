/**
 * Component models for the DSL
 */

/**
 * Component types supported by the DSL
 */
export enum ComponentType {
  ACTOR = 'actor',
  COMMAND = 'command',
  EVENT = 'event',
  PROCESS = 'process',
  QUERY = 'query',
  SAGA = 'saga',
  SCHEMA = 'schema',
  SYSTEM = 'system',
  WORKFLOW = 'workflow'
}

/**
 * Flow builder interface
 */
export interface FlowBuilder {
  sendToActor: (actorId: string, message: any) => FlowBuilder;
  then: (callback: (result: any) => any) => FlowBuilder;
  catch: (errorHandler: (error: Error) => any) => FlowBuilder;
  finally: (callback: () => void) => FlowBuilder;
  execute: () => Promise<any>;
}

/**
 * Actor context interface
 */
export interface ActorContext {
  flow: () => FlowBuilder;
  state?: Record<string, any>;
  [key: string]: any;
}

/**
 * Base interface for all component definitions
 */
export interface ComponentDefinition {
  id: string;
  type: ComponentType;
  description: string;
  version: string;
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
    actors?: Array<{ ref: string }>;
    events?: Array<{ ref: string }>;
    processes?: Array<{ ref: string }>;
    sagas?: Array<{ ref: string }>;
  };
  processes?: Array<ProcessDefinition>;
  tenancy?: {
    mode: 'single' | 'multi';
    tenantIdentifier?: string;
    tenantResolution?: string;
  };
  security?: {
    authentication?: {
      providers: string[];
      jwtConfig?: Record<string, any>;
    };
    authorization?: {
      type: string;
      defaultRole?: string;
    };
  };
  observability?: {
    metrics?: {
      enabled: boolean;
      providers?: string[];
    };
    logging?: {
      level: string;
      format: string;
      destination: string;
    };
  };
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

/**
 * Schema definition
 */
export interface SchemaDefinition {
  type: string;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: SchemaDefinition;
  nullable?: boolean;
}

// Actor-specific interfaces
export interface MessageHandlerDefinition {
  description?: string;
  input: SchemaDefinition;
  output: SchemaDefinition;
  isReadOnly?: boolean;
}

export interface ActorConfigDefinition {
  backpressure?: {
    strategy: 'drop' | 'buffer' | 'throttle';
    maxMailboxSize: number;
  };
  supervision?: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    resetTimeout: number;
    circuitBreaker?: {
      enabled: boolean;
      failureThreshold: number;
      resetTimeout: number;
    };
  };
  stateManagement?: {
    persistence: boolean;
    snapshotInterval?: number;
  };
}

export interface InterfaceTest {
  name: string;
  messageHandler: string;
  input: any;
  expectedSchema?: SchemaDefinition;
  expectedResult?: any;
  expectError?: boolean;
}

export interface ImplementationTest {
  name: string;
  setup?: string;
  messageHandler: string;
  input: any;
  expectError?: boolean;
  assertions: string;
}

export interface ActorTestSuite {
  interface?: InterfaceTest[];
  implementation?: ImplementationTest[];
}

export interface ActorDefinition extends ComponentDefinition {
  type: ComponentType.ACTOR;
  messageHandlers: Record<string, MessageHandlerDefinition>;
  tests?: ActorTestSuite;
  config?: ActorConfigDefinition;
}

// System definition interfaces
export interface SystemComponentReference {
  ref: string;
}

export interface SystemComponents {
  schemas?: SystemComponentReference[];
  commands?: SystemComponentReference[];
  queries?: SystemComponentReference[];
  events?: SystemComponentReference[];
  workflows?: SystemComponentReference[];
  actors?: SystemComponentReference[];
  processes?: SystemComponentReference[];
  sagas?: SystemComponentReference[];
}

export interface ProcessActionBase {
  type: string;
}

export interface ActorMessageAction extends ProcessActionBase {
  type: 'actorMessage';
  actor: string;
  message: string;
  input?: {
    mapping: Record<string, string>;
  };
  output?: string;
}

export interface ProcessTransition {
  to: string;
  condition?: string;
  on?: string;
}

export interface ProcessState {
  description: string;
  actions?: Array<ActorMessageAction | ProcessActionBase>;
  transitions?: Array<ProcessTransition>;
  final?: boolean;
}

export interface ProcessDefinition extends ComponentDefinition {
  type: ComponentType.PROCESS;
  states: Record<string, ProcessState>;
  transitions: Record<string, any>;
}

/**
 * Actor implementation type
 */
export type ActorImplementation = Record<string, (input: any, context: ActorContext) => Promise<any>>;

/**
 * Flow builder interface
 */
export interface FlowBuilder {
  // ... existing code ...
} 