/**
 * Component models for the DSL
 */

/**
 * Component types supported by the DSL
 */
export enum ComponentType {
  ACTOR = 'actor',
  PROCESS = 'process',
  SYSTEM = 'system',
  SCHEMA = 'schema',
  EVENT = 'event',
  WORKFLOW = 'workflow',
  SAGA = 'saga',
  TEST = 'test',
  IMPLEMENTATION = 'implementation'
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
 * Reference to another component
 */
export interface ComponentReference {
  ref: string;
}

/**
 * Base interface for all component definitions
 */
export interface ComponentDefinition {
  id: string;
  type: ComponentType;
  description: string;
  version: string;
  properties?: Record<string, any>;
  input?: Record<string, any>;
  output?: Record<string, any>;
  initialState?: string;
  states?: Record<string, any>;
  steps?: any[];
  context?: any[];
  correlationProperty?: string;
  dataSchema?: { ref: string };
  attributes?: Record<string, any>;
  behaviors?: ComponentReference[];
  policies?: Record<string, any>;
  required?: string[];
  payload?: any;
  state?: any;
  messageHandlers?: Record<string, any>;
  target?: ComponentReference;
  scenarios?: TestScenario[];
  targetComponent?: string;
  handlers?: Record<string, (input: any, context: any) => Promise<any>>;
}

/**
 * Test scenario definition
 */
export interface TestScenario {
  name: string;
  given: TestStep[];
  when: TestStep[];
  then: TestAssertion[];
}

/**
 * Test step definition
 */
export interface TestStep {
  setup?: string;
  send?: {
    message: string;
    payload: any;
  };
  store?: string;
  from?: string;
  [key: string]: any;
}

/**
 * Test assertion definition
 */
export interface TestAssertion {
  assert: string;
  equals?: any;
  contains?: any;
  matches?: any;
  [key: string]: any;
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
 * Event component definition
 */
export interface EventComponentDefinition extends ComponentDefinition {
  type: ComponentType.EVENT;
  payload: { ref: string };
}

/**
 * System definition
 */
export interface SystemDefinition extends ComponentDefinition {
  type: ComponentType.SYSTEM;
  components: {
    schemas?: ComponentReference[];
    events?: ComponentReference[];
    actors?: ComponentReference[];
    processes?: ComponentReference[];
    systems?: ComponentReference[];
    workflows?: ComponentReference[];
    sagas?: ComponentReference[];
  };
  workflows?: Array<any>;
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
  events?: SystemComponentReference[];
  actors?: SystemComponentReference[];
  processes?: SystemComponentReference[];
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
  action?: ProcessAction;
}

export interface ProcessState {
  description: string;
  actions?: Array<ActorMessageAction | ProcessActionBase>;
  transitions?: Array<ProcessTransition>;
  final?: boolean;
  nested?: {
    initialState: string;
    states: Record<string, ProcessState>;
  };
  onEnter?: ProcessAction;
  onExit?: ProcessAction;
}

export interface ProcessAction {
  task?: string;
  script?: string | ((context: any) => Promise<void>);
}

export interface ProcessDefinition extends ComponentDefinition {
  type: ComponentType.PROCESS;
  states: Record<string, ProcessState>;
  transitions: Record<string, ProcessTransition[]>;
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