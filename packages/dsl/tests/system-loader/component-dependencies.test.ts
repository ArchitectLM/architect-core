import { describe, it, expect } from 'vitest';
import { getComponentDependencies } from '../../src/system-loader/component-dependencies.js';
import { Component, ComponentType } from '../../src/types.js';

describe('Component Dependencies', () => {
  describe('getComponentDependencies', () => {
    it('should return an empty array for a component with no dependencies', () => {
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'SimpleSchema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toEqual([]);
    });

    it('should extract dependencies from a schema component with extends', () => {
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'ExtendedSchema',
        extends: 'BaseSchema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toEqual(['BaseSchema']);
    });

    it('should extract dependencies from a command component', () => {
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'CreateUser',
        input: { ref: 'UserInput' },
        output: { ref: 'User' },
        plugins: {
          validation: { ref: 'ValidationPlugin' },
          logging: { ref: 'LoggingPlugin' }
        },
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toContain('UserInput');
      expect(dependencies).toContain('User');
      expect(dependencies).toContain('ValidationPlugin');
      expect(dependencies).toContain('LoggingPlugin');
      expect(dependencies.length).toBe(4);
    });

    it('should extract dependencies from a command component with only input', () => {
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'DeleteUser',
        input: { ref: 'UserIdentifier' },
        output: { ref: '' },
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toEqual(['UserIdentifier']);
    });

    it('should extract dependencies from a command component with only output', () => {
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'GetCurrentUser',
        input: { ref: '' },
        output: { ref: 'User' },
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toEqual(['User']);
    });

    it('should extract dependencies from an event component', () => {
      const component: Component = {
        type: ComponentType.EVENT,
        name: 'UserCreated',
        payload: { ref: 'User' },
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toEqual(['User']);
    });

    it('should extract dependencies from a query component', () => {
      const component: Component = {
        type: ComponentType.QUERY,
        name: 'GetUserById',
        input: { ref: 'UserIdentifier' },
        output: { ref: 'User' },
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toContain('UserIdentifier');
      expect(dependencies).toContain('User');
      expect(dependencies.length).toBe(2);
    });

    it('should extract dependencies from a workflow component', () => {
      const component: Component = {
        type: ComponentType.WORKFLOW,
        name: 'UserRegistrationFlow',
        steps: [
          {
            name: 'step1',
            command: 'ValidateUserInput',
            next: 'CreateUser'
          },
          {
            name: 'step2',
            command: 'CreateUser',
            next: 'SendWelcomeEmail',
            onFailure: 'HandleRegistrationError'
          },
          {
            name: 'step3',
            command: 'SendWelcomeEmail'
          }
        ],
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toContain('ValidateUserInput');
      expect(dependencies).toContain('CreateUser');
      expect(dependencies).toContain('SendWelcomeEmail');
      expect(dependencies).toContain('HandleRegistrationError');
      expect(dependencies.length).toBe(4);
    });

    it('should extract dependencies from related components', () => {
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'Product',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        },
        relatedComponents: [
          { ref: 'Category', relationship: 'belongsTo' },
          { ref: 'Inventory', relationship: 'hasOne' }
        ]
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toContain('Category');
      expect(dependencies).toContain('Inventory');
      expect(dependencies.length).toBe(2);
    });

    it('should remove duplicate dependencies', () => {
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'UpdateUser',
        input: { ref: 'User' },
        output: { ref: 'User' },
        relatedComponents: [
          { ref: 'User', relationship: 'updates' },
          { ref: 'UserHistory', relationship: 'creates' }
        ],
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toContain('User');
      expect(dependencies).toContain('UserHistory');
      expect(dependencies.length).toBe(2);
    });

    it('should filter out empty strings', () => {
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'EmptyRefCommand',
        input: { ref: '' },
        output: { ref: 'Result' },
        relatedComponents: [
          { ref: '', relationship: 'empty' },
          { ref: 'ValidComponent', relationship: 'valid' }
        ],
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toContain('Result');
      expect(dependencies).toContain('ValidComponent');
      expect(dependencies).not.toContain('');
      expect(dependencies.length).toBe(2);
    });

    it('should handle components with undefined fields gracefully', () => {
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'PartialCommand',
        input: { ref: '' },
        output: { ref: '' },
        definition: {}
      };

      const dependencies = getComponentDependencies(component);
      expect(dependencies).toEqual([]);
    });
  });
}); 