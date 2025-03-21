/**
 * Implementation Composability Example
 * 
 * This example demonstrates how implementations can be composed or extended
 * using the unified component approach, showing the power of using dsl.component
 * for all definition types.
 */
import { DSL } from '../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../src/models/component.js';

// Create a new DSL instance
const dsl = new DSL();

/**
 * 1. Define Base Actors and Behaviors
 */

// Logger Behavior Actor
dsl.component('LoggerBehavior', {
  type: ComponentType.ACTOR,
  description: 'Reusable logging behavior',
  version: '1.0.0',
  attributes: {
    tags: ['infrastructure', 'logging']
  },
  messageHandlers: {
    log: {
      input: {
        properties: {
          level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
          message: { type: 'string' },
          context: { type: 'object' }
        },
        required: ['level', 'message']
      },
      output: { type: 'null' }
    }
  }
});

// Metrics Behavior Actor
dsl.component('MetricsBehavior', {
  type: ComponentType.ACTOR,
  description: 'Reusable metrics behavior',
  version: '1.0.0',
  attributes: {
    tags: ['infrastructure', 'metrics']
  },
  messageHandlers: {
    recordMetric: {
      input: {
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
          tags: { 
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        },
        required: ['name', 'value']
      },
      output: { type: 'null' }
    }
  }
});

// User Service Actor
dsl.component('UserServiceActor', {
  type: ComponentType.ACTOR,
  description: 'User management service',
  version: '1.0.0',
  attributes: {
    tags: ['domain', 'user']
  },
  behaviors: [
    { ref: 'LoggerBehavior' },
    { ref: 'MetricsBehavior' }
  ],
  state: {
    properties: {
      users: { 
        type: 'object',
        additionalProperties: { 
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' }
          }
        }
      }
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
          name: { type: 'string' },
          email: { type: 'string' }
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
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      }
    }
  }
});

/**
 * 2. Base Implementation Components
 */

// Logger Behavior Implementation
dsl.component('ConsoleLoggerImpl', {
  type: ComponentType.IMPLEMENTATION,
  description: 'Console-based logger implementation',
  version: '1.0.0',
  targetComponent: 'LoggerBehavior',
  attributes: {
    tags: ['infrastructure', 'logging', 'implementation']
  },
  handlers: {
    log: async (input: any, context: ActorContext) => {
      const { level, message, context: logContext } = input;
      
      // In a real implementation, this would use the appropriate console method
      console.log(`[${level.toUpperCase()}] ${message}`, logContext || '');
      
      return null;
    }
  }
});

// Metrics Behavior Implementation
dsl.component('InMemoryMetricsImpl', {
  type: ComponentType.IMPLEMENTATION,
  description: 'In-memory metrics implementation',
  version: '1.0.0',
  targetComponent: 'MetricsBehavior',
  attributes: {
    tags: ['infrastructure', 'metrics', 'implementation']
  },
  handlers: {
    recordMetric: async (input: any, context: ActorContext) => {
      const { name, value, tags } = input;
      
      // In a real implementation, this would store metrics somewhere
      console.log(`METRIC: ${name} = ${value}`, tags || {});
      
      return null;
    }
  }
});

/**
 * 3. Composite Service Implementation Using Component References
 */

// User Service Implementation with Behavior Composition
dsl.component('UserServiceActorImpl', {
  type: ComponentType.IMPLEMENTATION,
  description: 'User service implementation with composed behaviors',
  version: '1.0.0',
  targetComponent: 'UserServiceActor',
  attributes: {
    tags: ['domain', 'user', 'implementation'],
    composedImplementations: [
      { ref: 'ConsoleLoggerImpl' },
      { ref: 'InMemoryMetricsImpl' }
    ]
  },
  handlers: {
    createUser: async (input: any, context: ActorContext) => {
      const { name, email } = input;
      const userId = `user-${Date.now()}`;
      
      // Initialize state if needed
      if (!context.state) {
        context.state = { users: {} };
      } else if (!context.state.users) {
        context.state.users = {};
      }
      
      // Create user
      const user = { id: userId, name, email };
      context.state.users[userId] = user;
      
      // Use composed logger behavior
      await context.flow().sendToActor('LoggerBehavior', {
        level: 'info',
        message: 'User created',
        context: { userId, email }
      }).execute();
      
      // Use composed metrics behavior
      await context.flow().sendToActor('MetricsBehavior', {
        name: 'user.created',
        value: 1,
        tags: { userId }
      }).execute();
      
      return user;
    },
    
    getUser: async (input: any, context: ActorContext) => {
      const { id } = input;
      
      // Ensure state exists
      if (!context.state || !context.state.users) {
        return null;
      }
      
      const user = context.state.users[id];
      
      // Log user access
      if (user) {
        await context.flow().sendToActor('LoggerBehavior', {
          level: 'debug',
          message: 'User accessed',
          context: { userId: id }
        }).execute();
      } else {
        await context.flow().sendToActor('LoggerBehavior', {
          level: 'warn',
          message: 'User not found',
          context: { userId: id }
        }).execute();
      }
      
      return user || null;
    }
  }
});

/**
 * 4. Extending an Implementation
 */

// Extended metrics implementation with persistent storage
dsl.component('PersistentMetricsImpl', {
  type: ComponentType.IMPLEMENTATION,
  description: 'Persistent metrics implementation that extends InMemoryMetricsImpl',
  version: '1.0.0',
  targetComponent: 'MetricsBehavior',
  attributes: {
    tags: ['infrastructure', 'metrics', 'implementation', 'persistent'],
    extends: { ref: 'InMemoryMetricsImpl' }
  },
  handlers: {
    recordMetric: async (input: any, context: ActorContext) => {
      const { name, value, tags } = input;
      
      // First, call the base implementation
      const baseImpl = dsl.getComponent('InMemoryMetricsImpl');
      if (baseImpl && baseImpl.handlers && baseImpl.handlers.recordMetric) {
        await baseImpl.handlers.recordMetric(input, context);
      }
      
      // Then add our persistence logic
      console.log(`PERSISTING METRIC: ${name} = ${value} to database`);
      
      // In a real implementation, this would save to a database
      
      return null;
    }
  }
});

/**
 * 5. Alternative Implementation
 * 
 * Multiple implementations can target the same component
 */

// Alternative user service implementation (e.g., for testing)
dsl.component('MockUserServiceImpl', {
  type: ComponentType.IMPLEMENTATION,
  description: 'Mock user service implementation for testing',
  version: '1.0.0',
  targetComponent: 'UserServiceActor',
  attributes: {
    tags: ['domain', 'user', 'implementation', 'testing'],
    environment: 'test'
  },
  handlers: {
    createUser: async (input: any, context: ActorContext) => {
      const { name, email } = input;
      
      // Always return a mock user without persisting
      return {
        id: 'mock-user-123',
        name: name || 'Mock User',
        email: email || 'mock@example.com'
      };
    },
    
    getUser: async (input: any, context: ActorContext) => {
      // Always return a predefined user
      return {
        id: input.id || 'mock-user-123',
        name: 'Mock User',
        email: 'mock@example.com'
      };
    }
  }
});

/**
 * 6. System Definition
 */

// Define a system using these components
dsl.system('UserManagementSystem', {
  description: 'User management system with composed behaviors',
  version: '1.0.0',
  attributes: {
    tags: ['domain', 'user-management']
  },
  components: {
    actors: [
      { ref: 'LoggerBehavior' },
      { ref: 'MetricsBehavior' },
      { ref: 'UserServiceActor' }
    ]
  }
});

/**
 * 7. Environment-Specific System Configurations
 */

// Production configuration - uses the standard implementation
dsl.system('ProductionUserSystem', {
  description: 'Production configuration for user system',
  version: '1.0.0',
  attributes: {
    environment: 'production',
    implementations: {
      'LoggerBehavior': { ref: 'ConsoleLoggerImpl' },
      'MetricsBehavior': { ref: 'PersistentMetricsImpl' },
      'UserServiceActor': { ref: 'UserServiceActorImpl' }
    }
  },
  components: {
    systems: [{ ref: 'UserManagementSystem' }]
  }
});

// Test configuration - uses mock implementations
dsl.system('TestUserSystem', {
  description: 'Test configuration for user system',
  version: '1.0.0',
  attributes: {
    environment: 'test',
    implementations: {
      'LoggerBehavior': { ref: 'ConsoleLoggerImpl' },
      'MetricsBehavior': { ref: 'InMemoryMetricsImpl' },
      'UserServiceActor': { ref: 'MockUserServiceImpl' }
    }
  },
  components: {
    systems: [{ ref: 'UserManagementSystem' }]
  }
});

/**
 * 8. Runtime creation based on environment
 */

// Select implementation based on environment
function createRuntime(environment: string) {
  // Get the appropriate system configuration
  const systemConfig = environment === 'production' ? 
    dsl.getComponent('ProductionUserSystem') :
    dsl.getComponent('TestUserSystem');
  
  if (!systemConfig) {
    throw new Error(`System configuration for environment ${environment} not found`);
  }
  
  // In a real application, this would:
  // 1. Create a runtime adapter
  // 2. Find all required implementations from the configuration
  // 3. Convert the system definition to runtime configuration
  // 4. Create and start the actor system
  
  console.log(`Creating runtime for ${environment} environment using system ${systemConfig.id}`);
  console.log(`Implementations to use:`, systemConfig.attributes?.implementations);
  
  return {
    start: async () => {
      console.log(`${environment} runtime started`);
    },
    stop: async () => {
      console.log(`${environment} runtime stopped`);
    },
    getActor: (id: string) => {
      const implRef = systemConfig.attributes?.implementations?.[id];
      console.log(`Getting actor ${id} with implementation ${implRef?.ref || 'default'}`);
      
      return {
        tell: async (message: string, payload: any) => {
          console.log(`Sending ${message} to ${id} with payload:`, payload);
        }
      };
    }
  };
}

/**
 * 9. Example Usage
 */

async function runExample() {
  // Create production runtime
  const prodRuntime = createRuntime('production');
  await prodRuntime.start();
  
  // Use the UserServiceActor with its production implementation
  await prodRuntime.getActor('UserServiceActor').tell('createUser', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  
  await prodRuntime.stop();
  
  // Create test runtime
  const testRuntime = createRuntime('test');
  await testRuntime.start();
  
  // Use the UserServiceActor with its mock implementation
  await testRuntime.getActor('UserServiceActor').tell('createUser', {
    name: 'Test User',
    email: 'test@example.com'
  });
  
  await testRuntime.stop();
}

// Export both the DSL instance and example runner
export { dsl, runExample }; 