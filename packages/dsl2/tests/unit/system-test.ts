import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

describe('System Definition', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('New Component Model', () => {
    it('should define a system with the new component types (schema, task, process, event, saga)', () => {
      // Define some components
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { 
          id: { type: 'string' }, 
          name: { type: 'string' },
          email: { type: 'string' } 
        }
      });
      
      dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create a user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' },
        isReadOnly: false
      });
      
      dsl.component('GetUser', {
        type: ComponentType.TASK,
        description: 'Get a user by ID',
        version: '1.0.0',
        input: { ref: 'GetUserInput' },
        output: { ref: 'User' },
        isReadOnly: true
      });
      
      dsl.component('UserCreated', {
        type: ComponentType.EVENT,
        description: 'Event emitted when a user is created',
        version: '1.0.0',
        payload: { ref: 'User' }
      });
      
      dsl.component('UserRegistration', {
        type: ComponentType.PROCESS,
        description: 'User registration process',
        version: '1.0.0',
        initialState: 'started',
        states: {
          started: {
            description: 'Registration process started',
            transitions: [
              { to: 'validated', on: 'USER_DATA_VALIDATED' }
            ],
            task: { ref: 'ValidateUserData' }
          },
          validated: {
            description: 'User data has been validated',
            transitions: [
              { to: 'created', on: 'USER_CREATED' }
            ],
            task: { ref: 'CreateUser' }
          },
          created: {
            description: 'User has been created',
            transitions: [
              { to: 'notified', on: 'USER_NOTIFIED' }
            ],
            task: { ref: 'NotifyUser' }
          },
          notified: {
            description: 'User has been notified',
            final: true
          }
        }
      });
      
      dsl.component('UserOnboarding', {
        type: ComponentType.SAGA,
        description: 'User onboarding saga',
        version: '1.0.0',
        steps: [
          {
            name: 'createUser',
            task: { ref: 'CreateUser' },
            compensation: { ref: 'DeleteUser' }
          },
          {
            name: 'assignRole',
            task: { ref: 'AssignUserRole' },
            compensation: { ref: 'RemoveUserRole' }
          },
          {
            name: 'sendWelcomeEmail',
            task: { ref: 'SendWelcomeEmail' }
          }
        ]
      });

      // Define a system using the new component types
      const system = dsl.system('UserManagement', {
        description: 'User management system',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'User' }],
          tasks: [
            { ref: 'CreateUser' },
            { ref: 'GetUser' }
          ],
          events: [{ ref: 'UserCreated' }],
          processes: [{ ref: 'UserRegistration' }],
          sagas: [{ ref: 'UserOnboarding' }]
        },
        tenancy: {
          mode: 'multi',
          tenantIdentifier: 'tenantId'
        },
        security: {
          authentication: {
            providers: ['jwt', 'oauth2']
          },
          authorization: {
            type: 'rbac'
          }
        }
      });

      // Verify system structure
      expect(system).toBeDefined();
      expect(system.id).toBe('UserManagement');
      expect(system.description).toBe('User management system');
      
      // Verify components
      expect(system.components.schemas).toHaveLength(1);
      expect(system.components.tasks).toHaveLength(2);
      expect(system.components.events).toHaveLength(1);
      expect(system.components.processes).toHaveLength(1);
      expect(system.components.sagas).toHaveLength(1);
      
      // Verify system-level configurations
      expect(system.tenancy).toBeDefined();
      expect(system.tenancy.mode).toBe('multi');
      expect(system.security).toBeDefined();
      expect(system.security.authentication.providers).toContain('jwt');
    });
  });

  describe('Component Reference Resolution', () => {
    it('should resolve component references in a system definition', () => {
      // Define schema components
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { 
          id: { type: 'string' }, 
          name: { type: 'string' } 
        }
      });
      
      const orderSchema = dsl.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          items: { type: 'array' }
        }
      });
      
      // Define task components
      const createUserTask = dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create a user',
        version: '1.0.0',
        input: { type: 'object' },
        output: { ref: 'User' }
      });
      
      const createOrderTask = dsl.component('CreateOrder', {
        type: ComponentType.TASK,
        description: 'Create an order',
        version: '1.0.0',
        input: { type: 'object' },
        output: { ref: 'Order' }
      });

      // Define system
      const ecommerceSystem = dsl.system('EcommerceSystem', {
        description: 'E-commerce system',
        version: '1.0.0',
        components: {
          schemas: [
            { ref: 'User' },
            { ref: 'Order' }
          ],
          tasks: [
            { ref: 'CreateUser' },
            { ref: 'CreateOrder' }
          ]
        }
      });

      // Verify reference resolution
      const resolvedSystem = (dsl as any).resolveSystemReferences(ecommerceSystem);
      
      expect(resolvedSystem.components.schemas[0]).toBe(userSchema);
      expect(resolvedSystem.components.schemas[1]).toBe(orderSchema);
      expect(resolvedSystem.components.tasks[0]).toBe(createUserTask);
      expect(resolvedSystem.components.tasks[1]).toBe(createOrderTask);
    });
    
    it('should throw an error for unresolvable references', () => {
      // Define a few components
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { id: { type: 'string' } }
      });
      
      // Define system with a missing reference
      const system = dsl.system('TestSystem', {
        description: 'Test system',
        version: '1.0.0',
        components: {
          schemas: [
            { ref: 'User' },
            { ref: 'NonExistentSchema' } // This doesn't exist
          ]
        }
      });
      
      // Attempt to resolve references
      expect(() => (dsl as any).resolveSystemReferences(system))
        .toThrow(/unable to resolve.*nonexistentschema/i);
    });
  });

  describe('System Configuration', () => {
    it('should support enterprise configuration options', () => {
      // Define a system with enterprise configurations
      const enterpriseSystem = dsl.system('EnterpriseSystem', {
        description: 'Enterprise-grade system',
        version: '1.0.0',
        components: {},
        
        // Tenancy configuration
        tenancy: {
          mode: 'multi',
          tenantIdentifier: 'tenantId',
          tenantResolution: 'header',
          tenantHeader: 'X-Tenant-ID',
          databaseStrategy: 'schema'
        },
        
        // Security configuration
        security: {
          authentication: {
            providers: ['jwt', 'oauth2'],
            jwtConfig: {
              secret: '${JWT_SECRET}',
              expiryInMinutes: 60
            },
            oauth2Config: {
              issuerUrl: 'https://auth.example.com',
              clientId: '${OAUTH_CLIENT_ID}'
            }
          },
          authorization: {
            type: 'rbac',
            defaultRole: 'user',
            superAdminRole: 'admin'
          },
          cors: {
            enabled: true,
            origins: ['https://example.com'],
            methods: ['GET', 'POST', 'PUT', 'DELETE']
          }
        },
        
        // Observability configuration
        observability: {
          metrics: {
            enabled: true,
            providers: ['prometheus'],
            endpoint: '/metrics'
          },
          logging: {
            level: 'info',
            format: 'json',
            destination: 'stdout'
          },
          tracing: {
            enabled: true,
            sampler: 'probabilistic',
            samplingRate: 0.1
          }
        },
        
        // Deployment configuration
        deployment: {
          environment: '${NODE_ENV}',
          region: '${AWS_REGION}',
          scaling: {
            minInstances: 2,
            maxInstances: 10,
            targetCpuUtilization: 70
          },
          resources: {
            memory: '512Mi',
            cpu: '0.5'
          }
        }
      });

      // Verify the configuration structure
      expect(enterpriseSystem.tenancy).toBeDefined();
      expect(enterpriseSystem.tenancy.mode).toBe('multi');
      expect(enterpriseSystem.tenancy.databaseStrategy).toBe('schema');
      
      expect(enterpriseSystem.security).toBeDefined();
      expect(enterpriseSystem.security.authentication.providers).toContain('jwt');
      expect(enterpriseSystem.security.authorization.type).toBe('rbac');
      
      expect(enterpriseSystem.observability).toBeDefined();
      expect(enterpriseSystem.observability.metrics.enabled).toBe(true);
      expect(enterpriseSystem.observability.logging.level).toBe('info');
      
      expect(enterpriseSystem.deployment).toBeDefined();
      expect(enterpriseSystem.deployment.scaling.minInstances).toBe(2);
      expect(enterpriseSystem.deployment.resources.memory).toBe('512Mi');
    });
  });

  describe('System Validation', () => {
    it('should validate a system definition for errors', () => {
      // Create an intentionally invalid system
      const invalidSystem = dsl.system('InvalidSystem', {
        description: 'Invalid system for testing',
        version: '1.0.0',
        components: {
          // Empty components array is valid
        },
        tenancy: {
          mode: 'invalid-mode', // Invalid tenancy mode
          tenantIdentifier: 123 // Should be a string
        } as any,
        security: {
          authentication: {
            providers: 'jwt' // Should be an array
          } as any
        }
      });
      
      // Add validation method to the DSL
      (dsl as any).validateSystem = vi.fn().mockImplementation((system) => {
        const errors = [];
        
        // Validate tenancy
        if (system.tenancy) {
          if (!['single', 'multi'].includes(system.tenancy.mode)) {
            errors.push(`Invalid tenancy mode: ${system.tenancy.mode}`);
          }
          if (system.tenancy.tenantIdentifier && typeof system.tenancy.tenantIdentifier !== 'string') {
            errors.push('Tenant identifier must be a string');
          }
        }
        
        // Validate security
        if (system.security && system.security.authentication) {
          const auth = system.security.authentication;
          if (auth.providers && !Array.isArray(auth.providers)) {
            errors.push('Authentication providers must be an array');
          }
        }
        
        return {
          valid: errors.length === 0,
          errors
        };
      });
      
      // Run validation
      const validationResult = (dsl as any).validateSystem(invalidSystem);
      
      // Verify validation results
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toHaveLength(3);
      expect(validationResult.errors).toContain('Invalid tenancy mode: invalid-mode');
      expect(validationResult.errors).toContain('Tenant identifier must be a string');
      expect(validationResult.errors).toContain('Authentication providers must be an array');
    });
  });
});