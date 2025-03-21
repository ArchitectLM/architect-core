import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../src/models/component.js';

/**
 * This test file demonstrates the unified component approach
 * where everything is defined through dsl.component() including
 * implementations and tests, with colocated definitions.
 */
describe('Unified Component Approach', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('Unified API', () => {
    it('should use a unified component API for all definitions', () => {
      // Define a schema
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'name', 'email']
      });

      // Define an actor
      const userActor = dsl.component('UserActor', {
        type: ComponentType.ACTOR,
        description: 'User management actor',
        version: '1.0.0',
        state: {
          properties: {
            users: { type: 'array', items: { ref: 'User' } }
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
            output: { ref: 'User' }
          },
          getUser: {
            input: {
              properties: {
                userId: { type: 'string' }
              },
              required: ['userId']
            },
            output: { ref: 'User' }
          }
        }
      });

      // Define the implementation (using the new unified approach)
      const userActorImpl = dsl.implementation('UserActorImpl', {
        targetComponent: 'UserActor',
        description: 'Implementation of UserActor',
        version: '1.0.0',
        handlers: {
          createUser: async (input: any, context: ActorContext) => {
            const userId = `user-${Date.now()}`;
            const user = {
              id: userId,
              name: input.name,
              email: input.email
            };
            
            // Initialize state if needed
            if (!context.state) {
              context.state = { users: [] };
            } else if (!context.state.users) {
              context.state.users = [];
            }
            
            context.state.users.push(user);
            
            return user;
          },
          getUser: async (input: any, context: ActorContext) => {
            const { userId } = input;
            // Ensure state exists
            if (!context.state || !context.state.users) {
              return null;
            }
            return context.state.users.find((user: any) => user.id === userId);
          }
        }
      });

      // Define the test (colocated with the implementation)
      const userActorTest = dsl.component('UserActorTest', {
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
                    email: 'test@example.com' 
                  } 
                }
              }
            ],
            then: [
              { assert: 'result.name', equals: 'Test User' },
              { assert: 'result.email', equals: 'test@example.com' },
              { assert: 'actorState.users.length', equals: 1 }
            ]
          }
        ]
      });

      // Verify all components were created correctly
      expect(userSchema.type).toBe(ComponentType.SCHEMA);
      expect(userActor.type).toBe(ComponentType.ACTOR);
      expect(userActorImpl.type).toBe(ComponentType.IMPLEMENTATION);
      expect(userActorTest.type).toBe(ComponentType.TEST);
      
      // Verify relationships
      expect(userActorImpl.targetComponent).toBe('UserActor');
      expect(userActorTest.target?.ref).toBe('UserActor');
    });
  });

  describe('RAG-friendly organization', () => {
    it('should demonstrate a RAG-friendly component organization', () => {
      // In a RAG context, we want related components close together
      // For example, a component, its implementation, and tests could be stored
      // with related metadata to enable better retrieval

      // Define a component family with metadata that connects them
      const tagName = 'user-management';
      const version = '1.0.0';
      
      // Schema with tags/metadata
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User account data schema',
        version,
        attributes: {
          tags: [tagName, 'schema', 'data-model'],
          domain: 'identity',
          category: 'entity'
        },
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      });
      
      // Actor with same tags/metadata
      const userActor = dsl.component('UserActor', {
        type: ComponentType.ACTOR,
        description: 'User management actor',
        version,
        attributes: {
          tags: [tagName, 'actor', 'user-operations'],
          domain: 'identity',
          category: 'service'
        },
        messageHandlers: {
          createUser: {
            input: { /* schema */ },
            output: { ref: 'User' }
          }
        }
      });
      
      // Implementation with same tags/metadata - we'll use the component method directly since we can't add attributes to the implementation method yet
      const userActorImpl = dsl.component('UserActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Implementation of the user management actor',
        version,
        targetComponent: 'UserActor',
        attributes: {
          tags: [tagName, 'implementation', 'user-operations'],
          domain: 'identity',
          category: 'service-impl'
        },
        handlers: {
          createUser: async (input: any, context: ActorContext) => {
            // Implementation details
            return { id: '123', name: input.name, email: input.email };
          }
        }
      });
      
      // Test with same tags/metadata
      const userActorTest = dsl.component('UserActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for the user management actor',
        version,
        attributes: {
          tags: [tagName, 'test', 'user-operations'],
          domain: 'identity',
          category: 'service-test'
        },
        target: { ref: 'UserActor' },
        scenarios: [
          {
            name: 'Create user test',
            given: [{ setup: 'emptyState' }],
            when: [{ send: { message: 'createUser', payload: { name: 'Test', email: 'test@example.com' } } }],
            then: [{ assert: 'result.name', equals: 'Test' }]
          }
        ]
      });
      
      // For RAG retrieval, these components could be stored together or linked
      // through their common metadata, enabling the retrieval of related
      // components when any one of them is matched
      
      expect(userSchema.attributes?.tags).toContain(tagName);
      expect(userActor.attributes?.tags).toContain(tagName);
      expect(userActorImpl.attributes?.tags).toContain(tagName);
      expect(userActorTest.attributes?.tags).toContain(tagName);
    });
  });
}); 