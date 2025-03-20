import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the policy extension module to test
vi.mock('../../src/extensions/policy.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/policy.extension.js');
  return {
    ...actual,
    setupPolicyExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupPolicyExtension, 
  PolicyExtensionOptions,
  PolicyEvaluationResult,
  ConditionOperator
} from '../../src/extensions/policy.extension.js';

describe('Policy Extension', () => {
  let dsl: DSL;
  let policyOptions: PolicyExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    policyOptions = {
      enablePolicyLogging: true,
      enableConditionCache: true
    };
    
    // Setup extension
    setupPolicyExtension(dsl, policyOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Policy Definition', () => {
    it('should allow defining policy components with conditions and actions', () => {
      // Define a context schema
      const userSchema = dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          role: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
          department: { type: 'string' }
        }
      });
      
      const resourceSchema = dsl.component('ResourceSchema', {
        type: ComponentType.SCHEMA,
        description: 'Resource schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          ownerId: { type: 'string' },
          visibility: { type: 'string' }
        }
      });
      
      // Define commands that will be used as actions
      const grantAccessCommand = dsl.component('GrantAccess', {
        type: ComponentType.COMMAND,
        description: 'Grant access to a resource',
        version: '1.0.0',
        input: { ref: 'AccessInput' },
        output: { ref: 'AccessResult' }
      });
      
      const denyAccessCommand = dsl.component('DenyAccess', {
        type: ComponentType.COMMAND,
        description: 'Deny access to a resource',
        version: '1.0.0',
        input: { ref: 'AccessInput' },
        output: { ref: 'AccessResult' }
      });
      
      // Define a policy component
      const accessPolicy = dsl.component('ResourceAccessPolicy', {
        type: ComponentType.POLICY,
        description: 'Resource access control policy',
        version: '1.0.0',
        context: [
          { name: 'user', ref: 'UserSchema' },
          { name: 'resource', ref: 'ResourceSchema' }
        ],
        conditions: [
          {
            name: 'isAdmin',
            description: 'Check if user is an admin',
            expression: {
              operator: ConditionOperator.EQUALS,
              left: { path: 'user.role' },
              right: { value: 'admin' }
            }
          },
          {
            name: 'isOwner',
            description: 'Check if user is the resource owner',
            expression: {
              operator: ConditionOperator.EQUALS,
              left: { path: 'user.id' },
              right: { path: 'resource.ownerId' }
            }
          },
          {
            name: 'isPublic',
            description: 'Check if resource is public',
            expression: {
              operator: ConditionOperator.EQUALS,
              left: { path: 'resource.visibility' },
              right: { value: 'public' }
            }
          },
          {
            name: 'hasSameDepartment',
            description: 'Check if user is in same department as resource owner',
            expression: {
              operator: ConditionOperator.AND,
              expressions: [
                {
                  operator: ConditionOperator.NOT_EQUALS,
                  left: { path: 'user.department' },
                  right: { value: null }
                },
                {
                  operator: ConditionOperator.EQUALS,
                  left: { path: 'user.department' },
                  right: { path: 'resource.ownerDepartment' }
                }
              ]
            }
          }
        ],
        rules: [
          {
            name: 'adminAccess',
            description: 'Admins have access to all resources',
            when: 'isAdmin',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          },
          {
            name: 'ownerAccess',
            description: 'Resource owners have access',
            when: 'isOwner',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          },
          {
            name: 'publicAccess',
            description: 'Anyone can access public resources',
            when: 'isPublic',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          },
          {
            name: 'departmentAccess',
            description: 'Users can access resources from their department',
            when: 'hasSameDepartment',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          },
          {
            name: 'defaultDeny',
            description: 'Default deny all other access',
            when: null, // Default rule
            then: [
              { action: { ref: 'DenyAccess' } }
            ]
          }
        ]
      });

      // Verify the policy was defined correctly
      expect(accessPolicy.id).toBe('ResourceAccessPolicy');
      expect(accessPolicy.type).toBe(ComponentType.POLICY);
      expect((accessPolicy as any).conditions.length).toBe(4);
      expect((accessPolicy as any).rules.length).toBe(5);
    });
  });

  describe('Policy Evaluation', () => {
    it('should evaluate conditions and execute appropriate actions', async () => {
      // Setup mocks for action commands
      const grantAccessMock = vi.fn().mockResolvedValue({ granted: true });
      const denyAccessMock = vi.fn().mockResolvedValue({ granted: false });
      
      // Define schemas
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          role: { type: 'string' }
        }
      });
      
      dsl.component('ResourceSchema', {
        type: ComponentType.SCHEMA,
        description: 'Resource schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          ownerId: { type: 'string' },
          visibility: { type: 'string' }
        }
      });
      
      // Define action commands
      const grantAccess = dsl.component('GrantAccess', {
        type: ComponentType.COMMAND,
        description: 'Grant access',
        version: '1.0.0',
        input: { ref: 'AccessInput' },
        output: { ref: 'AccessResult' }
      });
      
      const denyAccess = dsl.component('DenyAccess', {
        type: ComponentType.COMMAND,
        description: 'Deny access',
        version: '1.0.0',
        input: { ref: 'AccessInput' },
        output: { ref: 'AccessResult' }
      });
      
      // Implement commands
      dsl.implement('GrantAccess', grantAccessMock);
      dsl.implement('DenyAccess', denyAccessMock);
      
      // Define a simple policy
      const accessPolicy = dsl.component('ResourceAccessPolicy', {
        type: ComponentType.POLICY,
        description: 'Resource access control policy',
        version: '1.0.0',
        context: [
          { name: 'user', ref: 'UserSchema' },
          { name: 'resource', ref: 'ResourceSchema' }
        ],
        conditions: [
          {
            name: 'isAdmin',
            description: 'Check if user is an admin',
            expression: {
              operator: ConditionOperator.EQUALS,
              left: { path: 'user.role' },
              right: { value: 'admin' }
            }
          },
          {
            name: 'isOwner',
            description: 'Check if user is the resource owner',
            expression: {
              operator: ConditionOperator.EQUALS,
              left: { path: 'user.id' },
              right: { path: 'resource.ownerId' }
            }
          }
        ],
        rules: [
          {
            name: 'adminAccess',
            description: 'Admins have access to all resources',
            when: 'isAdmin',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          },
          {
            name: 'ownerAccess',
            description: 'Resource owners have access',
            when: 'isOwner',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          },
          {
            name: 'defaultDeny',
            description: 'Default deny all other access',
            when: null,
            then: [
              { action: { ref: 'DenyAccess' } }
            ]
          }
        ]
      });
      
      // Test case 1: Admin access
      const adminContext = {
        user: { id: 'user-1', role: 'admin' },
        resource: { id: 'res-1', ownerId: 'user-2', visibility: 'private' }
      };
      
      const adminResult = await (accessPolicy as any).evaluate(adminContext);
      
      expect(adminResult.granted).toBe(true);
      expect(adminResult.matchedRule).toBe('adminAccess');
      expect(grantAccessMock).toHaveBeenCalledWith(
        expect.objectContaining(adminContext),
        expect.any(Object)
      );
      
      // Test case 2: Owner access
      const ownerContext = {
        user: { id: 'user-1', role: 'user' },
        resource: { id: 'res-1', ownerId: 'user-1', visibility: 'private' }
      };
      
      const ownerResult = await (accessPolicy as any).evaluate(ownerContext);
      
      expect(ownerResult.granted).toBe(true);
      expect(ownerResult.matchedRule).toBe('ownerAccess');
      expect(grantAccessMock).toHaveBeenCalledWith(
        expect.objectContaining(ownerContext),
        expect.any(Object)
      );
      
      // Test case 3: Default deny (no match)
      const noMatchContext = {
        user: { id: 'user-1', role: 'user' },
        resource: { id: 'res-1', ownerId: 'user-2', visibility: 'private' }
      };
      
      const noMatchResult = await (accessPolicy as any).evaluate(noMatchContext);
      
      expect(noMatchResult.granted).toBe(false);
      expect(noMatchResult.matchedRule).toBe('defaultDeny');
      expect(denyAccessMock).toHaveBeenCalledWith(
        expect.objectContaining(noMatchContext),
        expect.any(Object)
      );
    });
    
    it('should support complex condition expressions', async () => {
      // Define a policy with complex conditions
      const advancedPolicy = dsl.component('AdvancedPolicy', {
        type: ComponentType.POLICY,
        description: 'Advanced policy with complex conditions',
        version: '1.0.0',
        context: [
          { name: 'request', ref: 'RequestSchema' }
        ],
        conditions: [
          {
            name: 'complexCondition',
            description: 'A complex nested condition',
            expression: {
              operator: ConditionOperator.AND,
              expressions: [
                {
                  operator: ConditionOperator.GREATER_THAN,
                  left: { path: 'request.value' },
                  right: { value: 100 }
                },
                {
                  operator: ConditionOperator.OR,
                  expressions: [
                    {
                      operator: ConditionOperator.EQUALS,
                      left: { path: 'request.type' },
                      right: { value: 'premium' }
                    },
                    {
                      operator: ConditionOperator.IN,
                      left: { path: 'request.category' },
                      right: { value: ['special', 'vip', 'enterprise'] }
                    }
                  ]
                }
              ]
            }
          }
        ],
        rules: [
          {
            name: 'complexRule',
            description: 'Rule with complex condition',
            when: 'complexCondition',
            then: [
              { action: { ref: 'ApproveRequest' } }
            ]
          }
        ]
      });
      
      // Test evaluation of complex expression
      const evaluateCondition = (advancedPolicy as any).evaluateCondition;
      
      // Should match: value > 100 AND (type === 'premium')
      const match1 = {
        request: { value: 200, type: 'premium', category: 'regular' }
      };
      expect(await evaluateCondition('complexCondition', match1)).toBe(true);
      
      // Should match: value > 100 AND (category IN ['special', 'vip', 'enterprise'])
      const match2 = {
        request: { value: 150, type: 'standard', category: 'vip' }
      };
      expect(await evaluateCondition('complexCondition', match2)).toBe(true);
      
      // Should NOT match: value <= 100
      const noMatch1 = {
        request: { value: 50, type: 'premium', category: 'vip' }
      };
      expect(await evaluateCondition('complexCondition', noMatch1)).toBe(false);
      
      // Should NOT match: value > 100 but no other condition matches
      const noMatch2 = {
        request: { value: 200, type: 'standard', category: 'regular' }
      };
      expect(await evaluateCondition('complexCondition', noMatch2)).toBe(false);
    });
  });

  describe('Condition Caching', () => {
    it('should cache condition evaluation results when enabled', async () => {
      // Define a policy with an expensive condition
      const expensiveConditionMock = vi.fn().mockReturnValue(true);
      
      const cachingPolicy = dsl.component('CachingPolicy', {
        type: ComponentType.POLICY,
        description: 'Policy with expensive conditions',
        version: '1.0.0',
        context: [
          { name: 'data', ref: 'DataSchema' }
        ],
        conditions: [
          {
            name: 'expensiveCheck',
            description: 'An expensive condition to evaluate',
            // Use a custom function that's expensive to compute
            customFunction: expensiveConditionMock
          }
        ],
        rules: [
          {
            name: 'expensiveRule',
            description: 'Rule with expensive condition',
            when: 'expensiveCheck',
            then: [
              { action: { ref: 'DoSomething' } }
            ]
          }
        ]
      });
      
      // Evaluate the same condition multiple times with the same input
      const context = { data: { id: 'test-123' } };
      
      // First evaluation should calculate
      await (cachingPolicy as any).evaluateCondition('expensiveCheck', context);
      expect(expensiveConditionMock).toHaveBeenCalledTimes(1);
      
      // Second evaluation should use cache
      await (cachingPolicy as any).evaluateCondition('expensiveCheck', context);
      expect(expensiveConditionMock).toHaveBeenCalledTimes(1); // Still just 1 call
      
      // Different context should recalculate
      const newContext = { data: { id: 'test-456' } };
      await (cachingPolicy as any).evaluateCondition('expensiveCheck', newContext);
      expect(expensiveConditionMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Policy Extensibility', () => {
    it('should support custom condition functions', async () => {
      // Define a custom condition function
      const customCheckFn = vi.fn((context) => {
        // Complex business logic here
        const { user, resource } = context;
        return user.specialPermissions.includes(`access:${resource.type}`);
      });
      
      // Define a policy with custom function
      const customPolicy = dsl.component('CustomPolicy', {
        type: ComponentType.POLICY,
        description: 'Policy with custom functions',
        version: '1.0.0',
        context: [
          { name: 'user', ref: 'UserSchema' },
          { name: 'resource', ref: 'ResourceSchema' }
        ],
        conditions: [
          {
            name: 'hasSpecialPermission',
            description: 'Check if user has special permission for resource type',
            customFunction: customCheckFn
          }
        ],
        rules: [
          {
            name: 'specialPermission',
            description: 'Allow access based on special permissions',
            when: 'hasSpecialPermission',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          }
        ]
      });
      
      // Test evaluation with custom function
      const contextWithPermission = {
        user: { id: 'user-1', specialPermissions: ['access:document', 'access:image'] },
        resource: { id: 'res-1', type: 'document' }
      };
      
      await (customPolicy as any).evaluateCondition('hasSpecialPermission', contextWithPermission);
      
      expect(customCheckFn).toHaveBeenCalledWith(
        expect.objectContaining(contextWithPermission)
      );
    });
  });

  describe('System Integration', () => {
    it('should integrate policies with system definitions', () => {
      // Define necessary components
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { id: { type: 'string' }, role: { type: 'string' } }
      });
      
      dsl.component('ResourceSchema', {
        type: ComponentType.SCHEMA,
        description: 'Resource schema',
        version: '1.0.0',
        properties: { id: { type: 'string' }, ownerId: { type: 'string' } }
      });
      
      // Define a policy
      dsl.component('AccessPolicy', {
        type: ComponentType.POLICY,
        description: 'Access control policy',
        version: '1.0.0',
        context: [
          { name: 'user', ref: 'UserSchema' },
          { name: 'resource', ref: 'ResourceSchema' }
        ],
        conditions: [
          {
            name: 'isAdmin',
            description: 'Check if user is admin',
            expression: {
              operator: ConditionOperator.EQUALS,
              left: { path: 'user.role' },
              right: { value: 'admin' }
            }
          }
        ],
        rules: [
          {
            name: 'adminRule',
            description: 'Admin rule',
            when: 'isAdmin',
            then: [
              { action: { ref: 'GrantAccess' } }
            ]
          }
        ]
      });
      
      // Define a system that uses the policy
      const accessSystem = dsl.system('AccessSystem', {
        description: 'Access control system',
        version: '1.0.0',
        components: {
          schemas: [
            { ref: 'UserSchema' },
            { ref: 'ResourceSchema' }
          ],
          policies: [
            { ref: 'AccessPolicy' }
          ]
        }
      });
      
      // Verify the system can access policies
      expect(typeof (accessSystem as any).getPolicies).toBe('function');
      
      // Get policies from the system
      const policies = (accessSystem as any).getPolicies();
      expect(policies.length).toBe(1);
      expect(policies[0].id).toBe('AccessPolicy');
    });
  });
}); 