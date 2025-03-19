/**
 * Core DSL implementation
 */
import { z } from 'zod';
import {
  ComponentDefinition,
  ComponentImplementation,
  ComponentRegistry,
  ComponentType,
  ImplementationRegistry,
  SchemaComponentDefinition,
  CommandComponentDefinition,
  QueryComponentDefinition,
  WorkflowComponentDefinition,
  SystemDefinition,
  WorkflowDefinition,
  WorkflowTransition
} from '../models/component.js';

/**
 * DSL Extension interface
 */
export interface DSLExtension {
  id: string;
  init: (dsl: DSL, options?: any) => void;
  cleanup?: () => void;
}

/**
 * Core DSL class for defining components and systems
 */
export class DSL {
  private components: ComponentRegistry = new Map();
  private implementations: ImplementationRegistry = new Map();
  private extensions: Map<string, DSLExtension> = new Map();

  /**
   * Registers an extension with the DSL
   */
  registerExtension(extension: DSLExtension, options?: any): void {
    if (this.extensions.has(extension.id)) {
      throw new Error(`Extension already registered: ${extension.id}`);
    }
    
    this.extensions.set(extension.id, extension);
    extension.init(this, options);
  }

  /**
   * Gets a registered extension by ID
   */
  getExtension(id: string): DSLExtension | undefined {
    return this.extensions.get(id);
  }

  /**
   * Removes an extension from the DSL
   */
  removeExtension(id: string): void {
    const extension = this.extensions.get(id);
    if (extension && extension.cleanup) {
      extension.cleanup();
    }
    this.extensions.delete(id);
  }

  /**
   * Defines a component in the DSL
   */
  component<T extends ComponentDefinition>(id: string, definition: Omit<T, 'id'>): T {
    // Validate basic component requirements
    this.validateComponentDefinition(definition);

    // Create the component with its ID
    const component = {
      id,
      ...definition
    } as T;

    // Register the component
    this.components.set(id, component);

    return component;
  }

  /**
   * Retrieves a component by ID
   */
  getComponent<T extends ComponentDefinition>(id: string): T | undefined {
    return this.components.get(id) as T | undefined;
  }

  /**
   * Gets all components of a specific type
   */
  getComponentsByType<T extends ComponentDefinition>(type: ComponentType): T[] {
    const result: T[] = [];
    
    this.components.forEach((component) => {
      if (component.type === type) {
        result.push(component as T);
      }
    });
    
    return result;
  }

  /**
   * Implements a component with business logic
   */
  implement<T = any, R = any>(
    componentId: string,
    handler: (input: T, context: any) => Promise<R>,
    metadata: any = {}
  ): (input: T, context: any) => Promise<R> {
    // Verify the component exists
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    // Create the implementation
    const implementation: ComponentImplementation<T, R> = {
      componentId,
      handler,
      metadata
    };

    // Register the implementation
    this.implementations.set(componentId, implementation);

    // Return the handler function for convenience
    return handler;
  }

  /**
   * Defines a system in the DSL
   */
  system(id: string, definition: Omit<SystemDefinition, 'id' | 'type'>): SystemDefinition {
    // Create the system definition
    const system: SystemDefinition = {
      id,
      type: ComponentType.SYSTEM,
      ...definition
    };

    // Validate the system definition
    this.validateSystemDefinition(system);

    // Register the system as a component
    this.components.set(id, system);

    return system;
  }

  /**
   * Gets a component implementation
   */
  getImplementation<T = any, R = any>(componentId: string): ComponentImplementation<T, R> | undefined {
    return this.implementations.get(componentId) as ComponentImplementation<T, R> | undefined;
  }

  /**
   * Validates a component definition
   */
  private validateComponentDefinition(definition: Omit<ComponentDefinition, 'id'>): void {
    // Check for required type field first
    if (definition.type === undefined) {
      throw new Error('type is required for component definition');
    }

    // Basic validation schema for all components
    const baseSchema = z.object({
      type: z.nativeEnum(ComponentType),
      description: z.string(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
      tags: z.array(z.string()).optional()
    });

    try {
      // Parse and validate the definition
      baseSchema.parse(definition);

      // Additional validation based on component type
      switch (definition.type) {
        case ComponentType.SCHEMA:
          this.validateSchemaComponent(definition as Omit<SchemaComponentDefinition, 'id'>);
          break;
        case ComponentType.COMMAND:
          this.validateCommandComponent(definition as Omit<CommandComponentDefinition, 'id'>);
          break;
        case ComponentType.QUERY:
          this.validateQueryComponent(definition as Omit<QueryComponentDefinition, 'id'>);
          break;
        case ComponentType.WORKFLOW:
          this.validateWorkflowComponent(definition as Omit<WorkflowComponentDefinition, 'id'>);
          break;
        // Add other component type validations as needed
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid component definition: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validates a schema component
   */
  private validateSchemaComponent(definition: Omit<SchemaComponentDefinition, 'id'>): void {
    const schemaSchema = z.object({
      properties: z.record(z.any()),
      required: z.array(z.string()).optional(),
      examples: z.array(z.any()).optional()
    });

    try {
      schemaSchema.parse(definition);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid schema component: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validates a command component
   */
  private validateCommandComponent(definition: Omit<CommandComponentDefinition, 'id'>): void {
    const commandSchema = z.object({
      input: z.object({ ref: z.string() }),
      output: z.object({ ref: z.string() }),
      produces: z.array(
        z.object({
          event: z.string(),
          description: z.string()
        })
      ).optional(),
      extensionPoints: z.record(
        z.object({
          description: z.string(),
          parameters: z.array(z.string()).optional(),
          examples: z.array(z.string()).optional()
        })
      ).optional()
    });

    try {
      commandSchema.parse(definition);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid command component: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validates a query component
   */
  private validateQueryComponent(definition: Omit<QueryComponentDefinition, 'id'>): void {
    const querySchema = z.object({
      input: z.object({ ref: z.string() }),
      output: z.object({ ref: z.string() }),
      cacheTtl: z.number().optional(),
      cacheKey: z.string().optional(),
      extensionPoints: z.record(
        z.object({
          description: z.string(),
          parameters: z.array(z.string()).optional(),
          examples: z.array(z.string()).optional()
        })
      ).optional()
    });

    try {
      querySchema.parse(definition);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid query component: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validates a workflow component
   */
  private validateWorkflowComponent(definition: Omit<WorkflowComponentDefinition, 'id'>): void {
    // Schema for workflow transitions
    const transitionSchema = z.object({
      from: z.string(),
      to: z.string(),
      action: z.string(),
      conditions: z.array(z.string()).optional(),
      parallel: z.boolean().optional(),
      join: z.boolean().optional()
    });

    // Schema for the workflow itself
    const workflowSchema = z.object({
      initialState: z.string(),
      transitions: z.array(transitionSchema),
      parallelSupport: z.boolean().optional(),
      states: z.record(z.any()).optional()
    });

    try {
      workflowSchema.parse(definition);
      
      // Additional validation: check for valid state transitions
      this.validateWorkflowTransitions(
        definition.initialState,
        definition.transitions as WorkflowTransition[]
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid workflow component: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validates workflow transitions
   */
  private validateWorkflowTransitions(initialState: string, transitions: WorkflowTransition[]): void {
    // Ensure initial state exists
    if (!initialState) {
      throw new Error('Workflow must have an initial state');
    }

    // Ensure there is at least one transition
    if (!transitions || transitions.length === 0) {
      throw new Error('Workflow must have at least one transition');
    }

    // Collect all states
    const states = new Set<string>();
    states.add(initialState);
    
    transitions.forEach(transition => {
      states.add(transition.from);
      states.add(transition.to);
    });

    // Check that all transition 'from' states are reachable
    const reachableStates = new Set<string>([initialState]);
    let prevSize = 0;
    
    // Keep expanding reachable states until no new states are added
    while (reachableStates.size > prevSize) {
      prevSize = reachableStates.size;
      
      transitions.forEach(transition => {
        if (reachableStates.has(transition.from)) {
          reachableStates.add(transition.to);
        }
      });
    }

    // Check for unreachable states in transitions
    transitions.forEach(transition => {
      if (!reachableStates.has(transition.from)) {
        console.warn(`Workflow contains transition from unreachable state: ${transition.from}`);
      }
    });
  }

  /**
   * Validates a system definition
   */
  private validateSystemDefinition(system: SystemDefinition): void {
    const systemSchema = z.object({
      id: z.string(),
      type: z.literal(ComponentType.SYSTEM),
      description: z.string(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
      components: z.object({
        schemas: z.array(z.object({ ref: z.string() })).optional(),
        commands: z.array(z.object({ ref: z.string() })).optional(),
        queries: z.array(z.object({ ref: z.string() })).optional(),
        events: z.array(z.object({ ref: z.string() })).optional(),
        workflows: z.array(z.object({ ref: z.string() })).optional()
      }),
      workflows: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          initialState: z.string(),
          transitions: z.array(
            z.object({
              from: z.string(),
              to: z.string(),
              on: z.string()
            })
          )
        })
      ).optional(),
      plugins: z.record(z.any()).optional(),
      extensions: z.array(
        z.object({
          ref: z.string(),
          config: z.any().optional()
        })
      ).optional()
    });

    try {
      systemSchema.parse(system);

      // Additional validation: check if referenced components exist
      this.validateSystemReferences(system);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid system definition: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validates references in a system definition
   */
  private validateSystemReferences(system: SystemDefinition): void {
    // Collect all component references
    const componentRefs: string[] = [];

    // Add references from each component type
    Object.values(system.components).forEach(componentList => {
      if (componentList) {
        componentList.forEach(component => {
          componentRefs.push(component.ref);
        });
      }
    });

    // Check if all referenced components exist
    // Note: In a real implementation, you might want to make this a warning instead of an error
    // to allow for forward references or external components
    // componentRefs.forEach(ref => {
    //   if (!this.components.has(ref)) {
    //     throw new Error(`System references non-existent component: ${ref}`);
    //   }
    // });
  }
} 