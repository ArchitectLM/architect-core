/**
 * Core type definitions for the optimized DSL API
 */

/**
 * Component types enum
 */
export enum ComponentType {
  SCHEMA = 'schema',
  COMMAND = 'command',
  QUERY = 'query',
  EVENT = 'event',
  WORKFLOW = 'workflow',
  EXTENSION = 'extension',
  PLUGIN = 'plugin',
}

/**
 * Base component interface with common metadata
 */
export interface BaseComponent<T extends ComponentType = ComponentType, D = any> {
  /**
   * Type of the component
   */
  type: T;

  /**
   * Name of the component (must be unique)
   */
  name: string;

  /**
   * Description of the component
   */
  description?: string;

  /**
   * Version of the component (semver)
   */
  version?: string;

  /**
   * Tags for categorizing and searching components
   */
  tags?: string[];

  /**
   * Authors of the component
   */
  authors?: string[];

  /**
   * Related components with relationship descriptions
   */
  relatedComponents?: RelatedComponent[];

  /**
   * Path to the component file (for lazy loading)
   */
  path?: string;

  /**
   * Examples of the component usage
   */
  examples?: any[];

  /**
   * Component-specific definition
   */
  definition: D;

  /**
   * Additional metadata
   */
  [key: string]: any;
}

/**
 * Related component reference
 */
export interface RelatedComponent {
  /**
   * Reference to another component
   */
  ref: string;

  /**
   * Type of relationship
   */
  relationship: string;

  /**
   * Description of the relationship
   */
  description?: string;
}

/**
 * Reference to another component
 */
export interface ComponentRef {
  /**
   * Reference to another component
   */
  ref: string;

  /**
   * Whether the referenced component is required
   */
  required?: boolean;

  /**
   * Description of how this component is used
   */
  description?: string;
}

/**
 * Schema component
 */
export interface SchemaComponent extends BaseComponent {
  type: ComponentType.SCHEMA;

  /**
   * JSON Schema definition
   */
  definition: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

/**
 * Command component
 */
export interface CommandComponent extends BaseComponent {
  type: ComponentType.COMMAND;

  /**
   * Input schema reference
   */
  input: ComponentRef;

  /**
   * Output schema reference
   */
  output: ComponentRef;

  /**
   * Plugin dependencies
   */
  plugins?: Record<string, {
    ref: string;
    description?: string;
    operations?: string[];
  }>;

  /**
   * Extension points
   */
  extensionPoints?: Record<string, {
    description: string;
    parameters?: string[];
    examples?: string[];
  }>;

  /**
   * Events produced by this command
   */
  produces?: Array<{
    event: string;
    description?: string;
  }>;
}

/**
 * Query component
 */
export interface QueryComponent extends BaseComponent {
  type: ComponentType.QUERY;

  /**
   * Input schema reference
   */
  input: ComponentRef;

  /**
   * Output schema reference
   */
  output: ComponentRef;

  /**
   * Plugin dependencies
   */
  plugins?: Record<string, {
    ref: string;
    description?: string;
    operations?: string[];
  }>;
}

/**
 * Event component
 */
export interface EventComponent extends BaseComponent {
  type: ComponentType.EVENT;

  /**
   * Schema reference for the event payload
   */
  payload: ComponentRef;

  /**
   * Components that produce this event
   */
  producers?: ComponentRef[];

  /**
   * Components that consume this event
   */
  consumers?: ComponentRef[];
}

/**
 * Workflow component
 */
export interface WorkflowComponent extends BaseComponent {
  type: ComponentType.WORKFLOW;

  /**
   * Steps in the workflow
   */
  steps: Array<{
    name: string;
    command: string;
    next?: string;
    onFailure?: string;
    end?: boolean;
  }>;
}

/**
 * Extension component
 */
export interface ExtensionComponent extends BaseComponent {
  type: ComponentType.EXTENSION;

  /**
   * Extension hooks
   */
  hooks: Record<string, {
    description: string;
    parameters?: string[];
  }>;

  /**
   * Configuration schema
   */
  config?: ComponentRef;
}

/**
 * Plugin component
 */
export interface PluginComponent extends BaseComponent {
  type: ComponentType.PLUGIN;

  /**
   * Operations provided by the plugin
   */
  operations: Array<{
    name: string;
    description: string;
    input?: ComponentRef;
    output?: ComponentRef;
  }>;

  /**
   * Configuration schema
   */
  config?: ComponentRef;
}

/**
 * Union type for all component types
 */
export type Component =
  | SchemaComponent
  | CommandComponent
  | QueryComponent
  | EventComponent
  | WorkflowComponent
  | ExtensionComponent
  | PluginComponent;

/**
 * System definition
 */
export interface SystemDefinition {
  /**
   * Name of the system
   */
  name: string;

  /**
   * Description of the system
   */
  description?: string;

  /**
   * Version of the system
   */
  version?: string;

  /**
   * Tags for categorizing and searching
   */
  tags?: string[];

  /**
   * Components used in this system
   */
  components: {
    schemas?: ComponentRef[];
    commands?: ComponentRef[];
    queries?: ComponentRef[];
    events?: ComponentRef[];
    workflows?: ComponentRef[];
  };

  /**
   * Extensions applied to this system
   */
  extensions?: Array<{
    ref: string;
    config?: Record<string, any>;
  }>;

  /**
   * Plugins used by this system
   */
  plugins?: Record<string, {
    ref: string;
    config?: Record<string, any>;
  }>;

  /**
   * Workflows defined in this system
   */
  workflows?: Array<{
    name: string;
    description?: string;
    steps: Array<{
      command: string;
      next?: string;
      onFailure?: string;
      end?: boolean;
    }>;
  }>;
}

/**
 * Implementation metadata
 */
export interface ImplementationMetadata {
  /**
   * Complexity of the implementation
   */
  complexity?: 'low' | 'medium' | 'high';

  /**
   * Estimated latency
   */
  estimatedLatency?: 'low' | 'medium' | 'high';

  /**
   * Side effects
   */
  sideEffects?: string[];

  /**
   * Test cases
   */
  testCases?: Array<{
    description: string;
    input: any;
    expectedOutput: any;
    mockResponses?: Record<string, any>;
  }>;
}

/**
 * Component implementation
 */
export interface ComponentImplementation<T = any, R = any> {
  /**
   * Component name
   */
  componentName: string;

  /**
   * Implementation function
   */
  implementation: (input: T, context: any) => Promise<R>;

  /**
   * Implementation metadata
   */
  metadata?: ImplementationMetadata;
}

/**
 * Component search criteria
 */
export interface ComponentSearchCriteria {
  /**
   * Filter by component type
   */
  type?: ComponentType;

  /**
   * Filter by tags (matches any of the provided tags)
   */
  tags?: string[];

  /**
   * Filter by name pattern
   */
  namePattern?: string | RegExp;

  /**
   * Filter by author
   */
  author?: string;

  /**
   * Filter by version
   */
  version?: string;

  /**
   * Custom filter function
   */
  filter?: (component: Component) => boolean;
}

/**
 * Vector database adapter interface
 */
export interface VectorDBAdapter {
  /**
   * Store a component in the vector database
   */
  storeComponent(component: Component): Promise<string>;

  /**
   * Store a component implementation in the vector database
   */
  storeImplementation(implementation: ComponentImplementation): Promise<string>;

  /**
   * Store a relationship between components
   */
  storeRelationship(from: string, to: string, type: string, description?: string): Promise<void>;

  /**
   * Search for components
   */
  searchComponents(query: string, filters?: Partial<ComponentSearchCriteria>): Promise<Component[]>;

  /**
   * Get related components
   */
  getRelatedComponents(componentName: string, relationshipType?: string): Promise<Component[]>;
}

/**
 * Vector database adapter configuration
 */
export interface VectorDBAdapterConfig {
  /**
   * Type of vector database adapter
   */
  type: string;

  /**
   * Configuration options specific to the adapter type
   */
  options: Record<string, any>;
}

/**
 * Vector database adapter factory
 */
export interface VectorDBAdapterFactory {
  /**
   * Create a vector database adapter
   */
  createAdapter(config: VectorDBAdapterConfig): VectorDBAdapter;

  /**
   * Register a new adapter type
   */
  registerAdapterType(type: string, adapterClass: new (options: any) => VectorDBAdapter): void;

  /**
   * Get available adapter types
   */
  getAvailableAdapterTypes(): string[];
} 