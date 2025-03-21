/**
 * User Management Domain Example
 * 
 * This example demonstrates the unified component approach for a user management domain,
 * using a single API (dsl.component) for all definitions, including implementations and tests.
 */
import { DSL } from '../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../src/models/component.js';

// Create a new DSL instance
const dsl = new DSL();

/**
 * 1. Domain Definitions (Schemas)
 */

// User schema
dsl.component('User', {
  type: ComponentType.SCHEMA,
  description: 'User account information',
  version: '1.0.0',
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['user', 'admin', 'manager'] },
    createdAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'name', 'email', 'role', 'createdAt']
});

// User event schemas
dsl.component('UserCreated', {
  type: ComponentType.EVENT,
  description: 'Event emitted when a user is created',
  version: '1.0.0',
  payload: {
    properties: {
      userId: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['userId', 'name', 'email', 'role', 'timestamp']
  }
});

dsl.component('UserUpdated', {
  type: ComponentType.EVENT,
  description: 'Event emitted when a user is updated',
  version: '1.0.0',
  payload: {
    properties: {
      userId: { type: 'string' },
      changes: { type: 'object' },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['userId', 'changes', 'timestamp']
  }
});

/**
 * 2. Actor Definitions
 */

// User Management Actor
dsl.component('UserActor', {
  type: ComponentType.ACTOR,
  description: 'Actor managing user operations',
  version: '1.0.0',
  attributes: {
    eventSourced: {
      enabled: true,
      events: [
        { ref: 'UserCreated' },
        { ref: 'UserUpdated' }
      ],
      snapshotFrequency: 100
    }
  },
  state: {
    properties: {
      users: { type: 'array', items: { ref: 'User' } }
    }
  },
  messageHandlers: {
    createUser: {
      input: {
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin', 'manager'] }
        },
        required: ['name', 'email', 'role']
      },
      output: { ref: 'User' },
      produces: [{ event: 'UserCreated' }]
    },
    updateUser: {
      input: {
        properties: {
          userId: { type: 'string' },
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin', 'manager'] }
        },
        required: ['userId']
      },
      output: { ref: 'User' },
      produces: [{ event: 'UserUpdated' }]
    },
    getUser: {
      input: {
        properties: {
          userId: { type: 'string' }
        },
        required: ['userId']
      },
      output: { ref: 'User' }
    },
    listUsers: {
      input: {
        properties: {
          role: { type: 'string', enum: ['user', 'admin', 'manager'] },
          limit: { type: 'number', minimum: 1, maximum: 100 },
          offset: { type: 'number', minimum: 0 }
        }
      },
      output: { 
        type: 'array',
        items: { ref: 'User' } 
      }
    }
  }
});

/**
 * 3. Actor Implementation
 */

// Using the unified component approach for implementation
dsl.component('UserActorImpl', {
  type: ComponentType.IMPLEMENTATION,
  description: 'Implementation of the UserActor',
  version: '1.0.0',
  targetComponent: 'UserActor',
  handlers: {
    createUser: async (input: any, context: ActorContext) => {
      // Generate a new user ID and timestamp
      const userId = `user-${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      // Create the user object
      const user = {
        id: userId,
        name: input.name,
        email: input.email,
        role: input.role,
        createdAt: timestamp
      };
      
      // Initialize state if needed
      if (!context.state) {
        context.state = { users: [] };
      } else if (!context.state.users) {
        context.state.users = [];
      }
      
      // Add the user to the state
      context.state.users.push(user);
      
      // Emit the UserCreated event using Flow API
      const flow = context.flow();
      await flow.sendToActor('EventBus', {
        type: 'UserCreated',
        payload: {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          timestamp
        }
      }).execute();
      
      return user;
    },
    
    updateUser: async (input: any, context: ActorContext) => {
      // Ensure state exists
      if (!context.state || !context.state.users) {
        throw new Error('Users state not found');
      }
      
      // Find the user
      const userIndex = context.state.users.findIndex((u: any) => u.id === input.userId);
      if (userIndex === -1) {
        throw new Error(`User with ID ${input.userId} not found`);
      }
      
      // Create a copy of the user
      const user = { ...context.state.users[userIndex] };
      
      // Track changes
      const changes: Record<string, any> = {};
      
      // Update fields if provided
      if (input.name !== undefined && input.name !== user.name) {
        changes.name = input.name;
        user.name = input.name;
      }
      
      if (input.email !== undefined && input.email !== user.email) {
        changes.email = input.email;
        user.email = input.email;
      }
      
      if (input.role !== undefined && input.role !== user.role) {
        changes.role = input.role;
        user.role = input.role;
      }
      
      // Update the user in the state
      context.state.users[userIndex] = user;
      
      // Only emit event if there were changes
      if (Object.keys(changes).length > 0) {
        // Emit the UserUpdated event
        const flow = context.flow();
        await flow.sendToActor('EventBus', {
          type: 'UserUpdated',
          payload: {
            userId: user.id,
            changes,
            timestamp: new Date().toISOString()
          }
        }).execute();
      }
      
      return user;
    },
    
    getUser: async (input: any, context: ActorContext) => {
      // Ensure state exists
      if (!context.state || !context.state.users) {
        return null;
      }
      
      // Find and return the user
      return context.state.users.find((u: any) => u.id === input.userId) || null;
    },
    
    listUsers: async (input: any, context: ActorContext) => {
      // Ensure state exists
      if (!context.state || !context.state.users) {
        return [];
      }
      
      let users = context.state.users;
      
      // Filter by role if provided
      if (input.role) {
        users = users.filter((u: any) => u.role === input.role);
      }
      
      // Apply pagination
      const limit = input.limit || 10;
      const offset = input.offset || 0;
      
      return users.slice(offset, offset + limit);
    }
  }
});

/**
 * 4. User Management Process
 */

dsl.component('UserRegistrationProcess', {
  type: ComponentType.PROCESS,
  description: 'User registration workflow',
  version: '1.0.0',
  initialState: 'started',
  states: {
    started: {
      description: 'Registration started',
      transitions: [
        { 
          event: 'USER_DATA_SUBMITTED',
          target: 'validating',
          action: {
            actor: 'ValidationActor',
            message: 'validateUserData'
          }
        }
      ]
    },
    validating: {
      description: 'Validating user data',
      transitions: [
        {
          event: 'VALIDATION_SUCCEEDED',
          target: 'creating_user',
          action: {
            actor: 'UserActor',
            message: 'createUser'
          }
        },
        {
          event: 'VALIDATION_FAILED',
          target: 'validation_failed'
        }
      ]
    },
    creating_user: {
      description: 'Creating the user',
      transitions: [
        {
          event: 'USER_CREATED',
          target: 'sending_welcome_email',
          action: {
            actor: 'EmailActor',
            message: 'sendWelcomeEmail'
          }
        }
      ]
    },
    sending_welcome_email: {
      description: 'Sending welcome email',
      transitions: [
        {
          event: 'EMAIL_SENT',
          target: 'completed'
        },
        {
          event: 'EMAIL_FAILED',
          target: 'completed',
          action: {
            actor: 'NotificationActor',
            message: 'logEmailFailure'
          }
        }
      ]
    },
    validation_failed: {
      description: 'Validation failed',
      transitions: [
        {
          event: 'RETRY',
          target: 'started'
        }
      ]
    },
    completed: {
      description: 'Registration completed',
      final: true
    }
  }
});

/**
 * 5. User Management System
 */

dsl.system('UserManagementSystem', {
  description: 'System for managing users',
  version: '1.0.0',
  components: {
    schemas: [{ ref: 'User' }],
    events: [
      { ref: 'UserCreated' },
      { ref: 'UserUpdated' }
    ],
    actors: [{ ref: 'UserActor' }],
    processes: [{ ref: 'UserRegistrationProcess' }]
  }
});

/**
 * 6. Tests
 */

// Test for the User Actor - using the same component API
dsl.component('UserActorTest', {
  type: ComponentType.TEST,
  description: 'Tests for UserActor',
  version: '1.0.0',
  target: { ref: 'UserActor' },
  scenarios: [
    {
      name: 'Create user successfully',
      given: [
        { setup: 'emptyState' }
      ],
      when: [
        { 
          send: { 
            message: 'createUser', 
            payload: { 
              name: 'Test User',
              email: 'test@example.com',
              role: 'user'
            } 
          }
        }
      ],
      then: [
        { assert: 'result.name', equals: 'Test User' },
        { assert: 'result.email', equals: 'test@example.com' },
        { assert: 'result.role', equals: 'user' },
        { assert: 'actorState.users.length', equals: 1 },
        { assert: 'eventsEmitted', contains: { type: 'UserCreated' } }
      ]
    },
    {
      name: 'Update user successfully',
      given: [
        { 
          setup: 'executeMessage', 
          message: 'createUser',
          payload: {
            name: 'Original Name',
            email: 'original@example.com',
            role: 'user'
          },
          store: 'originalUser'
        }
      ],
      when: [
        {
          send: {
            message: 'updateUser',
            payload: {
              userId: '{{originalUser.id}}',
              name: 'Updated Name'
            }
          }
        }
      ],
      then: [
        { assert: 'result.name', equals: 'Updated Name' },
        { assert: 'result.email', equals: 'original@example.com' },
        { assert: 'eventsEmitted', contains: { type: 'UserUpdated' } },
        { assert: 'eventsEmitted[0].payload.changes', contains: { name: 'Updated Name' } }
      ]
    }
  ]
});

/**
 * 7. Usage with the Runtime
 */

// This part would typically be in a separate file that uses the exported DSL

// Example of how to use the DSL with a runtime adapter
async function runUserExample() {
  // Create a runtime adapter
  // (This would be imported from somewhere or created internally)
  const runtimeAdapter = {
    createActorSystem: async (config: any) => {
      console.log('Creating actor system from config:', config);
      return {
        rootActor: { id: 'root' },
        start: async () => console.log('Actor system started'),
        stop: async () => console.log('Actor system stopped'),
        getActor: (id: string) => ({
          id,
          tell: async (message: string, payload: any) => 
            console.log(`Sending ${message} to ${id} with payload:`, payload)
        })
      };
    },
    convertDefinitionToRuntime: (definition: any) => {
      console.log('Converting definition to runtime config:', definition.id);
      return { 
        id: definition.id,
        type: definition.type,
        runtime: { convertedAt: new Date().toISOString() }
      };
    }
  };

  // Get the system definition
  const system = dsl.getSystem('UserManagementSystem');
  if (!system) {
    throw new Error('UserManagementSystem not found');
  }

  // Convert system to runtime configuration
  const runtimeConfig = runtimeAdapter.convertDefinitionToRuntime(system);

  // Create actor system
  const actorSystem = await runtimeAdapter.createActorSystem(runtimeConfig);

  // Start the system
  await actorSystem.start();

  // Get the UserActor
  const userActor = actorSystem.getActor('UserActor');

  // Send a message to create a user
  const user = await userActor.tell('createUser', {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user'
  });

  console.log('Created user:', user);

  // Stop the system when done
  await actorSystem.stop();
}

// Export the DSL instance for use elsewhere
export default dsl; 