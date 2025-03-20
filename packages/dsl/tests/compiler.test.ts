import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DSLCompiler, 
  SchemaComponentTransformer, 
  CommandComponentTransformer,
  CompilationOptions,
  ComponentTransformer
} from '../src/compiler.js';
import { Component, ComponentType } from '../src/types.js';

describe('DSL Compiler', () => {
  describe('SchemaComponentTransformer', () => {
    const transformer = new SchemaComponentTransformer();
    
    it('should transform a schema component to TypeScript interface', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        description: 'User schema',
        definition: {
          type: 'object',
          properties: {
            id: { 
              type: 'string',
              description: 'User ID'
            },
            name: { 
              type: 'string',
              description: 'User name'
            },
            age: { 
              type: 'integer',
              description: 'User age'
            },
            isActive: { 
              type: 'boolean',
              description: 'Whether the user is active'
            }
          },
          required: ['id', 'name']
        }
      };
      
      const options: CompilationOptions = {
        targetLanguage: 'typescript'
      };
      
      // Act
      const result = transformer.transform(component, options);
      
      // Assert
      expect(result).toContain('export interface User {');
      expect(result).toContain('id: string;');
      expect(result).toContain('name: string;');
      expect(result).toContain('age?: number;');
      expect(result).toContain('isActive?: boolean;');
      expect(result).toContain('* User ID');
      expect(result).toContain('* User name');
    });
    
    it('should transform a schema component to JavaScript class', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        description: 'User schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            age: { type: 'integer' }
          },
          required: ['id', 'name']
        }
      };
      
      const options: CompilationOptions = {
        targetLanguage: 'javascript'
      };
      
      // Act
      const result = transformer.transform(component, options);
      
      // Assert
      expect(result).toContain('export class User {');
      expect(result).toContain('constructor(data)');
      expect(result).toContain('validate()');
      expect(result).toContain('this.id = data.id;');
      expect(result).toContain('this.name = data.name;');
      expect(result).toContain('if (this.id === undefined || this.id === null)');
      expect(result).toContain('errors.push(`id is required`);');
    });
    
    it('should throw an error for non-schema components', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'CreateUser',
        input: { ref: 'UserInput' },
        output: { ref: 'User' }
      };
      
      // Act & Assert
      expect(() => transformer.transform(component, {})).toThrow('Expected schema component');
    });
  });
  
  describe('CommandComponentTransformer', () => {
    const transformer = new CommandComponentTransformer();
    
    it('should transform a command component to TypeScript function', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'createUser',
        description: 'Create a new user',
        input: { ref: 'UserInput' },
        output: { ref: 'User' }
      };
      
      const options: CompilationOptions = {
        targetLanguage: 'typescript'
      };
      
      // Act
      const result = transformer.transform(component, options);
      
      // Assert
      expect(result).toContain('export async function createUser(input: UserInput): Promise<User>');
      expect(result).toContain('* Create a new user');
      expect(result).toContain('* @param input Input of type UserInput');
      expect(result).toContain('* @returns Output of type User');
    });
    
    it('should transform a command component to JavaScript function', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'createUser',
        description: 'Create a new user',
        input: { ref: 'UserInput' },
        output: { ref: 'User' }
      };
      
      const options: CompilationOptions = {
        targetLanguage: 'javascript'
      };
      
      // Act
      const result = transformer.transform(component, options);
      
      // Assert
      expect(result).toContain('export async function createUser(input)');
      expect(result).toContain('* Create a new user');
      expect(result).toContain('* @param {Object} input Input of type UserInput');
      expect(result).toContain('* @returns {Promise<Object>} Output of type User');
    });
    
    it('should throw an error for non-command components', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: {
          type: 'object',
          properties: {}
        }
      };
      
      // Act & Assert
      expect(() => transformer.transform(component, {})).toThrow('Expected command component');
    });
  });
  
  describe('DSLCompiler', () => {
    let compiler: DSLCompiler;
    
    beforeEach(() => {
      compiler = new DSLCompiler();
    });
    
    it('should compile a schema component', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Act
      const result = compiler.compileComponent(component);
      
      // Assert
      expect(result).toContain('export interface User');
    });
    
    it('should compile a command component', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'createUser',
        input: { ref: 'UserInput' },
        output: { ref: 'User' }
      };
      
      // Act
      const result = compiler.compileComponent(component);
      
      // Assert
      expect(result).toContain('export async function createUser');
    });
    
    it('should validate components before compilation if specified', () => {
      // Arrange
      const invalidComponent: Component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: {
          type: 'object'
          // Missing properties
        }
      };
      
      const options: CompilationOptions = {
        validateComponents: true
      };
      
      // Act & Assert
      expect(() => compiler.compileComponent(invalidComponent, options)).toThrow('Invalid component');
    });
    
    it('should skip validation if specified', () => {
      // Arrange
      const invalidComponent: Component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: {
          type: 'object'
          // Missing properties
        }
      };
      
      const options: CompilationOptions = {
        validateComponents: false,
        targetLanguage: 'javascript'
      };
      
      // Act
      const result = compiler.compileComponent(invalidComponent, options);
      
      // Assert
      expect(result).toContain('export class User');
    });
    
    it('should use custom transformers if provided', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: {
          type: 'object',
          properties: {}
        }
      };
      
      const customTransformer: ComponentTransformer = {
        transform: () => 'CUSTOM_TRANSFORM_RESULT'
      };
      
      const options: CompilationOptions = {
        transformers: {
          [ComponentType.SCHEMA]: customTransformer
        }
      };
      
      // Act
      const result = compiler.compileComponent(component, options);
      
      // Assert
      expect(result).toBe('CUSTOM_TRANSFORM_RESULT');
    });
  });
}); 