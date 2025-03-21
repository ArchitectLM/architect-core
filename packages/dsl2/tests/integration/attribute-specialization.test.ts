import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

/**
 * Attribute-Based Specialization Test Suite
 * 
 * This test file demonstrates how component attributes can be used instead of specialized
 * component types, enabling a more flexible and composition-based approach to component
 * definition and specialization.
 */
describe('Attribute-Based Specialization', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  // Define a mock Core2 adapter that processes component attributes
  const mockCore2Adapter = {
    registerComponentProcessor: vi.fn(),
    
    // Processors for different component specializations
    processors: {
      schema: vi.fn().mockImplementation((component) => ({
        ...component,
        __processed: 'schema',
        __validate: (data) => {
          const schemaProperties = component.properties || {};
          const required = component.required || [];
          
          // Basic validation
          for (const field of required) {
            if (data[field] === undefined) {
              return { valid: false, error: `Missing required field: ${field}` };
            }
          }
          
          // Type validation
          for (const [key, value] of Object.entries(data)) {
            const propSchema = schemaProperties[key];
            if (propSchema && propSchema.type) {
              if (propSchema.type === 'string' && typeof value !== 'string') {
                return { valid: false, error: `Field ${key} should be a string` };
              }
              if (propSchema.type === 'number' && typeof value !== 'number') {
                return { valid: false, error: `Field ${key} should be a number` };
              }
              if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
                return { valid: false, error: `Field ${key} should be a boolean` };
              }
            }
          }
          
          return { valid: true };
        }
      })),
      
      actor: vi.fn().mockImplementation((component) => ({
        ...component,
        __processed: 'actor',
        __createInstance: (id, initialState = {}) => {
          const handlers = {};
          
          // Create handlers for each messageHandler
          if (component.messageHandlers) {
            for (const [name, schema] of Object.entries(component.messageHandlers)) {
              handlers[name] = async (message) => {
                return { 
                  success: true, 
                  message: `Processed ${name}`, 
                  data: message,
                  handlerSchema: schema
                };
              };
            }
          }
          
          return {
            id,
            component: component.id,
            state: { ...initialState },
            handlers,
            sendMessage: async (handlerName, message) => {
              if (handlers[handlerName]) {
                return handlers[handlerName](message);
              }
              throw new Error(`No handler for message: ${handlerName}`);
            }
          };
        }
      })),
      
      process: vi.fn().mockImplementation((component) => ({
        ...component,
        __processed: 'process',
        __createWorkflow: (context = {}) => {
          const steps = component.steps || [];
          
          return {
            id: `workflow-${component.id}`,
            component: component.id,
            context,
            execute: async () => {
              const results = [];
              
              for (const step of steps) {
                results.push({
                  stepId: step.id,
                  actorRef: step.actor?.ref,
                  message: step.message,
                  mock: true
                });
              }
              
              return {
                success: true,
                results
              };
            }
          };
        }
      })),
      
      event: vi.fn().mockImplementation((component) => ({
        ...component,
        __processed: 'event',
        __createEvent: (payload = {}) => ({
          type: component.id,
          timestamp: new Date().toISOString(),
          payload
        })
      })),
      
      test: vi.fn().mockImplementation((component) => ({
        ...component,
        __processed: 'test',
        __runTest: async (implementation) => {
          const scenarios = component.scenarios || [];
          const results = [];
          
          for (const scenario of scenarios) {
            results.push({
              name: scenario.name,
              success: true,
              mockImplementation: implementation ? implementation.id : 'default'
            });
          }
          
          return {
            success: results.every(r => r.success),
            results
          };
        }
      }))
    },
    
    // Process a component based on its attributes
    processComponent: function(component) {
      // Determine component specialization from attributes
      if (component.attributes) {
        if (component.attributes.componentType === 'schema') {
          return this.processors.schema(component);
        }
        if (component.attributes.componentType === 'actor') {
          return this.processors.actor(component);
        }
        if (component.attributes.componentType === 'process') {
          return this.processors.process(component);
        }
        if (component.attributes.componentType === 'event') {
          return this.processors.event(component);
        }
        if (component.attributes.componentType === 'test') {
          return this.processors.test(component);
        }
      }
      
      // Legacy approach - determine by component type
      switch (component.type) {
        case ComponentType.SCHEMA:
          return this.processors.schema(component);
        case ComponentType.ACTOR:
          return this.processors.actor(component);
        case ComponentType.PROCESS:
          return this.processors.process(component);
        case ComponentType.EVENT:
          return this.processors.event(component);
        case ComponentType.TEST:
          return this.processors.test(component);
        default:
          return component;
      }
    }
  };

  describe('Component Specialization via Attributes', () => {
    it('should support schema definition via attributes', () => {
      // Define a schema using the unified component approach with attributes
      const userSchema = dsl.component('User', {
        type: ComponentType.ACTOR, // Generic component type
        description: 'User schema definition',
        version: '1.0.0',
        attributes: {
          componentType: 'schema', // Specialization via attribute
          domain: 'identity'
        },
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['id', 'name', 'email']
      });
      
      // Process the component as a schema
      const processedSchema = mockCore2Adapter.processComponent(userSchema);
      
      // Verify it was processed as a schema
      expect(processedSchema.__processed).toBe('schema');
      
      // Test schema validation
      const validUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };
      
      const validationResult = processedSchema.__validate(validUser);
      expect(validationResult.valid).toBe(true);
      
      // Test validation with invalid data
      const invalidUser = {
        id: 'user-2',
        name: 'Jane Doe',
        // Missing email
        age: 'twenty-five' // Wrong type
      };
      
      const invalidResult = processedSchema.__validate(invalidUser);
      expect(invalidResult.valid).toBe(false);
    });
    
    it('should support actor definition via attributes', () => {
      // Define an actor using the unified component approach with attributes
      const userActor = dsl.component('UserActor', {
        type: ComponentType.ACTOR, // Generic component type
        description: 'User management actor',
        version: '1.0.0',
        attributes: {
          componentType: 'actor', // Specialization via attribute
          domain: 'identity',
          stateful: true
        },
        state: {
          properties: {
            users: { type: 'array', items: { type: 'object' } }
          }
        },
        messageHandlers: {
          createUser: {
            input: {
              properties: {
                name: { type: 'string' },
                email: { type: 'string' }
              },
              required: ['name', 'email']
            },
            output: {
              properties: {
                id: { type: 'string' },
                success: { type: 'boolean' }
              }
            }
          },
          getUser: {
            input: {
              properties: {
                id: { type: 'string' }
              },
              required: ['id']
            },
            output: {
              properties: {
                user: { type: 'object' }
              }
            }
          }
        }
      });
      
      // Process the component as an actor
      const processedActor = mockCore2Adapter.processComponent(userActor);
      
      // Verify it was processed as an actor
      expect(processedActor.__processed).toBe('actor');
      
      // Create an actor instance
      const actorInstance = processedActor.__createInstance('user-actor-instance');
      
      // Test message handling
      return actorInstance.sendMessage('createUser', {
        name: 'John Doe',
        email: 'john@example.com'
      }).then(result => {
        expect(result.success).toBe(true);
        expect(result.message).toBe('Processed createUser');
        expect(result.data.name).toBe('John Doe');
      });
    });
    
    it('should support process definition via attributes', () => {
      // Define an actor first
      dsl.component('OrderActor', {
        type: ComponentType.ACTOR,
        description: 'Order management actor',
        version: '1.0.0',
        messageHandlers: {
          createOrder: {
            input: {
              properties: {
                items: { type: 'array' },
                customer: { type: 'object' }
              }
            },
            output: {
              properties: {
                orderId: { type: 'string' }
              }
            }
          },
          processPayment: {
            input: {
              properties: {
                orderId: { type: 'string' },
                paymentMethod: { type: 'string' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      });
      
      // Define a process using the unified component approach with attributes
      const orderProcess = dsl.component('OrderProcess', {
        type: ComponentType.ACTOR, // Generic component type
        description: 'Order processing workflow',
        version: '1.0.0',
        attributes: {
          componentType: 'process', // Specialization via attribute
          domain: 'order',
          transactional: true
        },
        steps: [
          {
            id: 'create-order',
            actor: { ref: 'OrderActor' },
            message: 'createOrder',
            input: {
              items: { $from: 'context.items' },
              customer: { $from: 'context.customer' }
            },
            output: { $as: 'orderId' }
          },
          {
            id: 'process-payment',
            actor: { ref: 'OrderActor' },
            message: 'processPayment',
            input: {
              orderId: { $from: 'steps.create-order.output.orderId' },
              paymentMethod: { $from: 'context.paymentMethod' }
            }
          }
        ]
      });
      
      // Process the component as a process
      const processedProcess = mockCore2Adapter.processComponent(orderProcess);
      
      // Verify it was processed as a process
      expect(processedProcess.__processed).toBe('process');
      
      // Create a workflow instance
      const workflow = processedProcess.__createWorkflow({
        items: [{ id: 'item-1', quantity: 1 }],
        customer: { id: 'cust-1' },
        paymentMethod: 'credit-card'
      });
      
      // Execute workflow
      return workflow.execute().then(result => {
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(2);
        expect(result.results[0].actorRef).toBe('OrderActor');
        expect(result.results[0].message).toBe('createOrder');
        expect(result.results[1].actorRef).toBe('OrderActor');
        expect(result.results[1].message).toBe('processPayment');
      });
    });
    
    it('should support event definition via attributes', () => {
      // Define an event using the unified component approach with attributes
      const orderCreatedEvent = dsl.component('OrderCreated', {
        type: ComponentType.ACTOR, // Generic component type
        description: 'Order created event',
        version: '1.0.0',
        attributes: {
          componentType: 'event', // Specialization via attribute
          domain: 'order',
          eventType: 'domain-event'
        },
        properties: {
          orderId: { type: 'string' },
          customer: { type: 'object' },
          items: { type: 'array' },
          timestamp: { type: 'string' }
        },
        required: ['orderId', 'timestamp']
      });
      
      // Process the component as an event
      const processedEvent = mockCore2Adapter.processComponent(orderCreatedEvent);
      
      // Verify it was processed as an event
      expect(processedEvent.__processed).toBe('event');
      
      // Create an event instance
      const event = processedEvent.__createEvent({
        orderId: 'order-123',
        customer: { id: 'cust-1', name: 'John Doe' },
        items: [{ id: 'item-1', quantity: 1 }],
        timestamp: new Date().toISOString()
      });
      
      expect(event.type).toBe('OrderCreated');
      expect(event.payload.orderId).toBe('order-123');
    });
    
    it('should support test definition via attributes', () => {
      // Define an actor to test
      dsl.component('CalculatorActor', {
        type: ComponentType.ACTOR,
        description: 'Calculator actor',
        version: '1.0.0',
        messageHandlers: {
          add: {
            input: {
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
              }
            },
            output: {
              properties: {
                result: { type: 'number' }
              }
            }
          }
        }
      });
      
      // Define a test using the unified component approach with attributes
      const calculatorTest = dsl.component('CalculatorTest', {
        type: ComponentType.ACTOR, // Generic component type
        description: 'Calculator tests',
        version: '1.0.0',
        attributes: {
          componentType: 'test', // Specialization via attribute
          testType: 'unit-test'
        },
        target: { ref: 'CalculatorActor' },
        scenarios: [
          {
            name: 'Addition test',
            given: [
              { setup: 'emptyState' }
            ],
            when: [
              {
                send: {
                  message: 'add',
                  payload: { a: 2, b: 3 }
                },
                store: 'addResult'
              }
            ],
            then: [
              { assert: 'addResult.result', equals: 5 }
            ]
          }
        ]
      });
      
      // Process the component as a test
      const processedTest = mockCore2Adapter.processComponent(calculatorTest);
      
      // Verify it was processed as a test
      expect(processedTest.__processed).toBe('test');
      
      // Run the test
      return processedTest.__runTest().then(result => {
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].name).toBe('Addition test');
      });
    });
  });

  describe('Attribute Inheritance and Composition', () => {
    it('should support attribute inheritance for components', () => {
      // Define a base component with attributes
      const baseComponent = dsl.component('BaseActor', {
        type: ComponentType.ACTOR,
        description: 'Base actor with common attributes',
        version: '1.0.0',
        attributes: {
          domain: 'core',
          logging: 'enabled',
          metrics: 'enabled'
        },
        messageHandlers: {
          ping: {
            input: { type: 'null' },
            output: { type: 'string' }
          }
        }
      });
      
      // Define a derived component that inherits and extends attributes
      const derivedComponent = dsl.component('DerivedActor', {
        type: ComponentType.ACTOR,
        description: 'Derived actor with inherited attributes',
        version: '1.0.0',
        attributes: {
          extends: 'BaseActor', // Inherit attributes from BaseActor
          domain: 'derived', // Override domain
          tracing: 'enabled' // Add new attribute
        },
        messageHandlers: {
          echo: {
            input: { type: 'string' },
            output: { type: 'string' }
          }
        }
      });
      
      // Define a resolver for attribute inheritance
      const attributeResolver = {
        resolveAttributes: (component) => {
          if (!component.attributes || !component.attributes.extends) {
            return component.attributes || {};
          }
          
          const parentId = component.attributes.extends;
          const parent = dsl.getComponent(parentId);
          
          if (!parent) {
            return component.attributes || {};
          }
          
          // Recursively resolve parent attributes
          const parentAttributes = attributeResolver.resolveAttributes(parent);
          
          // Merge attributes, with component's own attributes taking precedence
          return {
            ...parentAttributes,
            ...component.attributes,
            extends: undefined // Remove extends attribute
          };
        }
      };
      
      // Resolve attributes for the derived component
      const resolvedAttributes = attributeResolver.resolveAttributes(derivedComponent);
      
      // Verify attribute inheritance
      expect(resolvedAttributes.domain).toBe('derived'); // Overridden attribute
      expect(resolvedAttributes.logging).toBe('enabled'); // Inherited attribute
      expect(resolvedAttributes.metrics).toBe('enabled'); // Inherited attribute
      expect(resolvedAttributes.tracing).toBe('enabled'); // Added attribute
    });
    
    it('should support composition of components with complementary attributes', () => {
      // Define components with different attributes
      dsl.component('LoggingFeature', {
        type: ComponentType.ACTOR,
        description: 'Logging feature component',
        version: '1.0.0',
        attributes: {
          feature: 'logging',
          logLevel: 'info'
        },
        messageHandlers: {
          log: {
            input: {
              properties: {
                level: { type: 'string' },
                message: { type: 'string' }
              }
            },
            output: { type: 'null' }
          }
        }
      });
      
      dsl.component('MetricsFeature', {
        type: ComponentType.ACTOR,
        description: 'Metrics feature component',
        version: '1.0.0',
        attributes: {
          feature: 'metrics',
          metricsEnabled: true
        },
        messageHandlers: {
          recordMetric: {
            input: {
              properties: {
                name: { type: 'string' },
                value: { type: 'number' }
              }
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Define a composite component that composes others
      const compositeComponent = dsl.component('CompositeService', {
        type: ComponentType.ACTOR,
        description: 'Service component with composed features',
        version: '1.0.0',
        attributes: {
          domain: 'service',
          service: 'composite'
        },
        behaviors: [
          { ref: 'LoggingFeature' },
          { ref: 'MetricsFeature' }
        ],
        messageHandlers: {
          process: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      // Define a resolver for attribute composition
      const attributeComposer = {
        composeAttributes: (component) => {
          // Start with component's own attributes
          const composedAttributes = { ...(component.attributes || {}) };
          
          // Add attributes from behaviors
          if (component.behaviors && component.behaviors.length > 0) {
            for (const behavior of component.behaviors) {
              const behaviorComponent = dsl.getComponent(behavior.ref);
              
              if (behaviorComponent && behaviorComponent.attributes) {
                // For simplicity, just add attributes that don't conflict
                for (const [key, value] of Object.entries(behaviorComponent.attributes)) {
                  if (!composedAttributes[key]) {
                    composedAttributes[key] = value;
                  }
                }
              }
            }
          }
          
          return composedAttributes;
        }
      };
      
      // Compose attributes for the composite component
      const composedAttributes = attributeComposer.composeAttributes(compositeComponent);
      
      // Verify attribute composition
      expect(composedAttributes.domain).toBe('service'); // Own attribute
      expect(composedAttributes.service).toBe('composite'); // Own attribute
      expect(composedAttributes.feature).toBeDefined(); // From behavior (note: this is a simple implementation)
      expect(composedAttributes.logLevel).toBe('info'); // From LoggingFeature
      expect(composedAttributes.metricsEnabled).toBe(true); // From MetricsFeature
    });
  });

  describe('Runtime Specialization via Attributes', () => {
    it('should support runtime component specialization based on attributes', () => {
      // Define a generic component that can be specialized at runtime
      const genericComponent = dsl.component('GenericHandler', {
        type: ComponentType.ACTOR,
        description: 'Generic component that can be specialized at runtime',
        version: '1.0.0',
        attributes: {
          configurable: true
        },
        messageHandlers: {
          handle: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      // Define a runtime that specializes components based on configuration
      const runtimeSpecializer = {
        // Store specializations
        specializations: new Map(),
        
        // Register a specialization for a component
        registerSpecialization: (componentId, configKey, handler) => {
          if (!runtimeSpecializer.specializations.has(componentId)) {
            runtimeSpecializer.specializations.set(componentId, new Map());
          }
          
          runtimeSpecializer.specializations.get(componentId).set(configKey, handler);
        },
        
        // Create a specialized instance based on configuration
        createSpecializedInstance: (componentId, config) => {
          const component = dsl.getComponent(componentId);
          
          if (!component || !component.attributes || !component.attributes.configurable) {
            throw new Error(`Component ${componentId} is not configurable`);
          }
          
          const specializations = runtimeSpecializer.specializations.get(componentId);
          if (!specializations) {
            throw new Error(`No specializations registered for ${componentId}`);
          }
          
          // Default specialization
          let specialization = specializations.get('default');
          
          // Find specialization based on config
          for (const [configKey, handler] of specializations.entries()) {
            if (configKey !== 'default' && config[configKey]) {
              specialization = handler;
              break;
            }
          }
          
          if (!specialization) {
            throw new Error(`No matching specialization for ${componentId}`);
          }
          
          // Create specialized instance
          return {
            id: `${componentId}-${Date.now()}`,
            component: componentId,
            config,
            handle: (input) => specialization(input, config)
          };
        }
      };
      
      // Register specializations for the generic component
      runtimeSpecializer.registerSpecialization(
        'GenericHandler',
        'default',
        (input) => ({ result: 'default', input })
      );
      
      runtimeSpecializer.registerSpecialization(
        'GenericHandler',
        'json',
        (input) => ({ result: 'json', parsed: JSON.stringify(input) })
      );
      
      runtimeSpecializer.registerSpecialization(
        'GenericHandler',
        'xml',
        (input) => ({ result: 'xml', formatted: `<result>${JSON.stringify(input)}</result>` })
      );
      
      // Create instances with different specializations
      const defaultInstance = runtimeSpecializer.createSpecializedInstance(
        'GenericHandler',
        { type: 'basic' }
      );
      
      const jsonInstance = runtimeSpecializer.createSpecializedInstance(
        'GenericHandler',
        { json: true, format: 'compact' }
      );
      
      const xmlInstance = runtimeSpecializer.createSpecializedInstance(
        'GenericHandler',
        { xml: true, indent: 2 }
      );
      
      // Test the specialized instances
      const testData = { name: 'test', value: 123 };
      
      const defaultResult = defaultInstance.handle(testData);
      expect(defaultResult.result).toBe('default');
      expect(defaultResult.input).toEqual(testData);
      
      const jsonResult = jsonInstance.handle(testData);
      expect(jsonResult.result).toBe('json');
      expect(jsonResult.parsed).toBe(JSON.stringify(testData));
      
      const xmlResult = xmlInstance.handle(testData);
      expect(xmlResult.result).toBe('xml');
      expect(xmlResult.formatted).toBe(`<result>${JSON.stringify(testData)}</result>`);
    });
  });
}); 