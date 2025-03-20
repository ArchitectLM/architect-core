import { 
  ComponentType, 
  ComponentDefinition, 
  ActorDefinition,
  SystemDefinition,
  MessageHandlerDefinition,
  ProcessDefinition
} from '../models/component.js';

export class DSL {
  private components: Record<string, ComponentDefinition> = {};
  private implementations: Record<string, any> = {};
  
  /**
   * Register a component in the DSL registry
   * @param component The component definition
   * @returns The registered component
   */
  private registerComponent<T extends ComponentDefinition>(component: T): T {
    this.components[component.id] = component;
    return component;
  }
  
  /**
   * Create a general component
   * @param id Component ID
   * @param definition Component definition
   * @returns Component definition
   */
  component<T extends Omit<ComponentDefinition, 'id'>>(
    id: string,
    definition: T
  ): ComponentDefinition {
    const component = {
      id,
      ...definition
    } as ComponentDefinition;
    
    return this.registerComponent(component);
  }
  
  /**
   * Define an actor with message handlers
   * @param id Actor ID
   * @param definition Actor definition
   * @returns Actor definition
   */
  actor(
    id: string,
    definition: Omit<ActorDefinition, 'id' | 'type'> | {
      description: string;
      version: string;
      input: any;
      output: any;
      isReadOnly?: boolean;
      tests?: any[];
      config?: any;
    }
  ): ActorDefinition {
    // Check if this is a simplified task-like actor definition
    if ('input' in definition && 'output' in definition) {
      // Create a default message handler for the simplified interface
      const messageHandlers: Record<string, MessageHandlerDefinition> = {
        Execute: {
          description: definition.description,
          input: definition.input,
          output: definition.output,
          isReadOnly: definition.isReadOnly
        }
      };
      
      // Create a full actor definition
      const fullDefinition: Omit<ActorDefinition, 'id' | 'type'> = {
        description: definition.description,
        version: definition.version,
        messageHandlers,
        tests: definition.tests,
        config: definition.config
      };
      
      return this.actor(id, fullDefinition);
    }
    
    // Validate required fields
    if (!definition.description) {
      throw new Error(`Actor definition for '${id}': description is required`);
    }
    
    if (!definition.version) {
      throw new Error(`Actor definition for '${id}': version is required`);
    }
    
    if (!definition.messageHandlers || Object.keys(definition.messageHandlers).length === 0) {
      throw new Error(`Actor definition for '${id}': must have either messageHandlers or input/output`);
    }
    
    const actor: ActorDefinition = {
      id,
      type: ComponentType.ACTOR,
      ...definition
    };
    
    return this.registerComponent(actor);
  }
  
  /**
   * Implement an actor with message handlers
   * @param actorId ID of the actor to implement
   * @param implementation Object with message handler functions or a single function for simplified actors
   * @param context Optional context for the implementation
   * @returns The implementation
   */
  implementActor(
    actorId: string,
    implementation: Record<string, Function> | Function,
    context?: any
  ): Record<string, Function> | Function {
    const actorDef = this.getComponent(actorId) as ActorDefinition;
    
    if (!actorDef) {
      throw new Error(`Actor not found: ${actorId}`);
    }
    
    if (actorDef.type !== ComponentType.ACTOR) {
      throw new Error(`Component ${actorId} is not an actor`);
    }
    
    // Handle single function implementation for simplified actors
    if (typeof implementation === 'function') {
      // Verify this is a simplified actor with an Execute handler
      if (!actorDef.messageHandlers.Execute) {
        throw new Error(`Actor ${actorId} is not a simplified actor, but was given a function implementation`);
      }
      
      // Create a record with the Execute handler
      const wrappedImpl = {
        Execute: implementation
      };
      
      this.implementations[actorId] = wrappedImpl;
      return implementation;
    }
    
    // Validate that all message handlers have implementations
    const actorMessageHandlers = Object.keys(actorDef.messageHandlers);
    const implementedHandlers = Object.keys(implementation);
    
    // Check for missing handlers
    const missingHandlers = actorMessageHandlers.filter(
      handler => !implementedHandlers.includes(handler)
    );
    
    if (missingHandlers.length > 0) {
      throw new Error(
        `Actor implementation for ${actorId} is missing implementation for message handler(s): ${missingHandlers.join(', ')}`
      );
    }
    
    // Check for extra handlers
    const extraHandlers = implementedHandlers.filter(
      handler => !actorMessageHandlers.includes(handler) && handler !== 'tests'
    );
    
    if (extraHandlers.length > 0) {
      throw new Error(
        `Actor implementation for ${actorId} contains unknown message handler(s): ${extraHandlers.join(', ')}`
      );
    }
    
    // Store the implementation
    this.implementations[actorId] = {
      ...implementation,
      _context: context
    };
    
    return implementation;
  }
  
  /**
   * Define a process with states and transitions
   * @param id Process ID
   * @param definition Process definition
   * @returns Process component
   */
  process(
    id: string,
    definition: Omit<ProcessDefinition, 'name'> & Omit<ComponentDefinition, 'id' | 'type'>
  ): ComponentDefinition & ProcessDefinition {
    // Validate required fields
    if (!definition.description) {
      throw new Error(`Process definition for '${id}': description is required`);
    }
    
    if (!definition.version) {
      throw new Error(`Process definition for '${id}': version is required`);
    }
    
    if (!definition.initialState) {
      throw new Error(`Process definition for '${id}': initialState is required`);
    }
    
    if (!definition.states || Object.keys(definition.states).length === 0) {
      throw new Error(`Process definition for '${id}': states are required`);
    }
    
    const process = {
      id,
      type: ComponentType.PROCESS,
      name: id,
      ...definition
    };
    
    return this.registerComponent(process as any);
  }
  
  /**
   * Define a system with components
   * @param id System ID
   * @param definition System definition
   * @returns System definition
   */
  system(
    id: string,
    definition: Omit<SystemDefinition, 'id' | 'type'>
  ): SystemDefinition {
    // Validate required fields
    if (!definition.description) {
      throw new Error(`System definition for '${id}': description is required`);
    }
    
    if (!definition.version) {
      throw new Error(`System definition for '${id}': version is required`);
    }
    
    if (!definition.components) {
      throw new Error(`System definition for '${id}': components are required`);
    }
    
    const system: SystemDefinition = {
      id,
      type: ComponentType.WORKFLOW,
      ...definition
    };
    
    return this.registerComponent(system);
  }
  
  /**
   * Get a component by ID
   * @param id Component ID
   * @returns Component definition or undefined
   */
  getComponent(id: string): ComponentDefinition | undefined {
    return this.components[id];
  }
  
  /**
   * Get an implementation by component ID
   * @param id Component ID
   * @returns Implementation or undefined
   */
  getImplementation(id: string): any {
    return this.implementations[id];
  }
  
  /**
   * Helper to get an actor implementation
   * @param actorId Actor ID
   * @returns Actor implementation
   */
  getActorImplementation(actorId: string): Record<string, Function> | undefined {
    return this.getImplementation(actorId);
  }
  
  /**
   * Validate actor tests against actor definition
   * @param actor Actor definition
   * @returns Validation result
   */
  validateActorTests(actor: ActorDefinition): { valid: boolean; errors: any[] } {
    // Simple validation - check that message handlers exist for test cases
    const errors: any[] = [];
    
    if (!actor.tests || actor.tests.length === 0) {
      return { valid: true, errors: [] };
    }
    
    actor.tests.forEach((test, index) => {
      const messageType = test.when.message;
      if (!actor.messageHandlers[messageType]) {
        errors.push({
          path: `tests[${index}].when.message`,
          message: `Message handler "${messageType}" is not defined in actor`
        });
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate implementation tests for an actor
   * @param actorId Actor ID
   * @returns Validation result
   */
  validateActorImplementationTests(actorId: string): { valid: boolean; errors: any[] } {
    const impl = this.getActorImplementation(actorId);
    const actor = this.getComponent(actorId) as ActorDefinition;
    
    if (!impl || !impl.tests || !actor) {
      return { valid: true, errors: [] };
    }
    
    const errors: any[] = [];
    
    // Verify that test message handlers exist
    impl.tests.forEach((test: any, index: number) => {
      const messageType = test.when.message;
      if (!actor.messageHandlers[messageType]) {
        errors.push({
          path: `tests[${index}].when.message`,
          message: `Message handler "${messageType}" is not defined in actor`
        });
      }
      
      if (!impl[messageType]) {
        errors.push({
          path: `tests[${index}].when.message`,
          message: `Message handler "${messageType}" is not implemented`
        });
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Run tests for an actor
   * @param actorId Actor ID
   * @returns Test results
   */
  async runActorTests(actorId: string): Promise<{ success: boolean; results: any[] }> {
    const actor = this.getComponent(actorId) as ActorDefinition;
    const impl = this.getActorImplementation(actorId);
    
    if (!actor || !actor.tests || actor.tests.length === 0) {
      return { success: false, results: [] };
    }
    
    if (!impl) {
      return { 
        success: false, 
        results: [{ 
          passed: false, 
          message: `No implementation found for actor ${actorId}` 
        }] 
      };
    }
    
    // Run tests
    const results = await Promise.all(actor.tests.map(async (test) => {
      try {
        const { message, input } = test.when;
        const messageHandler = impl[message];
        
        if (!messageHandler) {
          throw new Error(`No handler for ${message}`);
        }
        
        // Call the handler
        const context = impl._context || {};
        const output = await messageHandler(input, context);
        
        // Validate output against expectations
        const expected = test.then.expect.output;
        const error = test.then.expect.error;
        
        if (error) {
          return {
            name: test.description,
            passed: false,
            message: `Expected error but got success`
          };
        }
        
        if (expected) {
          // Very simplified matcher, should be replaced with proper assertion library
          const matches = this.matchesExpectation(output, expected);
          
          return {
            name: test.description,
            passed: matches,
            message: matches ? 'Test passed' : 'Output did not match expectations'
          };
        }
        
        return {
          name: test.description,
          passed: true,
          message: 'Test passed'
        };
      } catch (error) {
        // Check if we expected an error
        if (test.then.expect.error) {
          // Very simplified error matcher
          const matches = this.matchesErrorExpectation(error, test.then.expect.error);
          
          return {
            name: test.description,
            passed: matches,
            message: matches ? 'Expected error occurred' : 'Error did not match expected error'
          };
        }
        
        return {
          name: test.description,
          passed: false,
          message: `Test failed with error: ${error}`
        };
      }
    }));
    
    return {
      success: results.every(r => r.passed),
      results
    };
  }
  
  /**
   * Run implementation tests for an actor
   * @param actorId Actor ID
   * @returns Test results
   */
  async runActorImplementationTests(actorId: string): Promise<{ success: boolean; results: any[] }> {
    const impl = this.getActorImplementation(actorId);
    
    if (!impl || !impl.tests || impl.tests.length === 0) {
      return { success: false, results: [] };
    }
    
    // Run implementation tests
    const results = await Promise.all(impl.tests.map(async (test: any) => {
      try {
        const { message, input } = test.when;
        const handler = impl[message];
        
        if (!handler) {
          throw new Error(`No handler for ${message}`);
        }
        
        // Setup mocks if provided
        let context = { ...impl._context };
        
        if (test.given && test.given.setup) {
          // Apply setup steps
          // This would be a place to setup mocks, initial state, etc.
        }
        
        // Call the handler
        const output = await handler(input, context);
        
        // Check expectations
        const expected = test.then.expect;
        
        if (expected.error) {
          return {
            name: test.description,
            passed: false,
            message: `Expected error but got success`
          };
        }
        
        if (expected.output) {
          const matches = this.matchesExpectation(output, expected.output);
          
          return {
            name: test.description,
            passed: matches,
            message: matches ? 'Test passed' : 'Output did not match expectations'
          };
        }
        
        return {
          name: test.description,
          passed: true,
          message: 'Test passed'
        };
      } catch (error) {
        // Check if we expected an error
        if (test.then.expect.error) {
          // Very simplified error matcher
          const matches = this.matchesErrorExpectation(error, test.then.expect.error);
          
          return {
            name: test.description,
            passed: matches,
            message: matches ? 'Expected error occurred' : 'Error did not match expected error'
          };
        }
        
        return {
          name: test.description,
          passed: false,
          message: `Test failed with error: ${error}`
        };
      }
    }));
    
    return {
      success: results.every((r: any) => r.passed),
      results
    };
  }
  
  /**
   * Simple matcher for expectations
   * @param actual Actual value
   * @param expected Expected value
   * @returns True if matches
   */
  private matchesExpectation(actual: any, expected: any): boolean {
    if (typeof expected !== 'object' || expected === null) {
      return actual === expected;
    }
    
    // Check if expected is a special matcher
    if (expected && expected.constructor && expected.constructor.name === 'Function' && 
        expected.name === 'any' && typeof expected.type === 'function') {
      return typeof actual === expected.type.name.toLowerCase();
    }
    
    // Regular object matching
    for (const key in expected) {
      if (Object.prototype.hasOwnProperty.call(expected, key)) {
        if (!(key in actual) || !this.matchesExpectation(actual[key], expected[key])) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Simple matcher for error expectations
   * @param actual Actual error
   * @param expected Expected error
   * @returns True if matches
   */
  private matchesErrorExpectation(actual: any, expected: any): boolean {
    if (typeof expected === 'string') {
      return actual.message === expected;
    }
    
    if (expected.code) {
      return actual.code === expected.code;
    }
    
    if (expected.message) {
      if (typeof expected.message === 'string') {
        return actual.message === expected.message;
      }
      
      if (expected.message.includes && typeof expected.message.includes === 'function') {
        return actual.message.includes(expected.message.includes);
      }
    }
    
    return false;
  }
  
  /**
   * Resolve references to components in a system
   * @param system System definition
   * @returns Resolved system with actual components
   */
  resolveSystemReferences(system: SystemDefinition): SystemDefinition {
    const resolvedSystem = { ...system };
    const resolvedComponents: any = {};
    
    // Helper to resolve component references
    const resolveComponentList = (componentType: string) => {
      const componentList = (system.components as any)[componentType];
      
      if (!componentList) return [];
      
      return componentList.map((ref: any) => {
        const component = this.getComponent(ref.ref);
        
        if (!component) {
          throw new Error(`Unable to resolve component reference: ${ref.ref}`);
        }
        
        return component;
      });
    };
    
    // Resolve each component type
    for (const componentType in system.components) {
      if (Object.prototype.hasOwnProperty.call(system.components, componentType)) {
        resolvedComponents[componentType] = resolveComponentList(componentType);
      }
    }
    
    resolvedSystem.components = resolvedComponents as any;
    return resolvedSystem;
  }
} 