export enum ComponentType {
  SCHEMA = 'schema',
  COMMAND = 'command',
  QUERY = 'query',
  EVENT = 'event',
  WORKFLOW = 'workflow',
  ACTOR = 'actor',
  PROCESS = 'process',
  SAGA = 'saga'
}

export interface ComponentDefinition {
  id: string;
  type: ComponentType;
  description: string;
  version: string;
}

export interface SchemaDefinition {
  type: string;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  $ref?: string;
  ref?: string;
  format?: string;
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
    mailboxCapacity: number;
    overflowStrategy: 'dropHead' | 'dropTail' | 'block';
  };
  supervision?: {
    restartStrategy: 'oneForOne' | 'allForOne' | 'exponentialBackoff';
    maxRestarts?: number;
    withinTimeRange?: string;
  };
  stateManagement?: {
    persistence: boolean;
    snapshotInterval?: number;
  };
}

export interface ActorTest {
  description: string;
  given?: {
    state?: Record<string, any>;
    setup?: Array<any>;
  };
  when: {
    message: string;
    input: any;
  };
  then: {
    expect: {
      output?: any;
      state?: Record<string, any>;
      error?: any;
      calls?: Array<any>;
    };
  };
}

export interface ActorDefinition extends ComponentDefinition {
  type: ComponentType.ACTOR;
  messageHandlers: Record<string, MessageHandlerDefinition>;
  tests?: Array<ActorTest>;
  config?: ActorConfigDefinition;
}

// System definition interfaces
export interface SystemComponentReference {
  ref: string;
}

export interface SystemComponentReferences {
  schemas?: Array<SystemComponentReference>;
  commands?: Array<SystemComponentReference>;
  queries?: Array<SystemComponentReference>;
  events?: Array<SystemComponentReference>;
  workflows?: Array<SystemComponentReference>;
  actors?: Array<SystemComponentReference>;
  processes?: Array<SystemComponentReference>;
  sagas?: Array<SystemComponentReference>;
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

export interface ProcessDefinition {
  name: string;
  description: string;
  initialState: string;
  states: Record<string, ProcessState>;
}

export interface SystemDefinition extends ComponentDefinition {
  type: ComponentType.WORKFLOW;
  components: SystemComponentReferences;
  processes?: Array<ProcessDefinition>;
  tenancy?: {
    mode: 'single' | 'multi';
    tenantIdentifier?: string;
    tenantResolution?: string;
    tenantHeader?: string;
    databaseStrategy?: string;
  };
  security?: {
    authentication?: {
      providers: string[];
      jwtConfig?: Record<string, any>;
      oauth2Config?: Record<string, any>;
    };
    authorization?: {
      type: string;
      defaultRole?: string;
      superAdminRole?: string;
    };
    cors?: {
      enabled: boolean;
      origins?: string[];
      methods?: string[];
    };
  };
  observability?: {
    metrics?: {
      enabled: boolean;
      providers?: string[];
      endpoint?: string;
    };
    logging?: {
      level: string;
      format: string;
      destination: string;
    };
    tracing?: {
      enabled: boolean;
      sampler?: string;
      samplingRate?: number;
    };
  };
  deployment?: {
    environment?: string;
    region?: string;
    scaling?: {
      minInstances: number;
      maxInstances: number;
      targetCpuUtilization?: number;
    };
    resources?: {
      memory: string;
      cpu: string;
    };
  };
} 