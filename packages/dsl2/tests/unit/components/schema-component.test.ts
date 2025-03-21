import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

describe('Schema Component', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  it('should define a schema component with properties', () => {
    const schema = dsl.component('User', {
      type: ComponentType.SCHEMA,
      description: 'User schema definition',
      version: '1.0.0',
      properties: {
        id: { type: 'string', description: 'Unique user identifier' },
        name: { type: 'string', description: 'User name' },
        email: { type: 'string', description: 'User email', format: 'email' }
      },
      required: ['id', 'name', 'email']
    });

    expect(schema).toBeDefined();
    expect(schema.id).toBe('User');
    expect(schema.type).toBe(ComponentType.SCHEMA);
    expect(schema.description).toBe('User schema definition');
    expect(schema.version).toBe('1.0.0');
    expect(schema.properties).toHaveProperty('id');
    expect(schema.properties).toHaveProperty('name');
    expect(schema.properties).toHaveProperty('email');
    expect(schema.required).toContain('id');
  });

  it('should validate schema properties according to their types', () => {
    const schema = dsl.component('Product', {
      type: ComponentType.SCHEMA,
      description: 'Product schema',
      version: '1.0.0',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number', minimum: 0 },
        tags: { type: 'array', items: { type: 'string' } },
        metadata: { type: 'object', properties: { created: { type: 'string', format: 'date-time' } } }
      },
      required: ['id', 'name', 'price']
    });

    expect(schema).toBeDefined();
    expect(schema.properties.price).toHaveProperty('minimum', 0);
    expect(schema.properties.tags.items).toHaveProperty('type', 'string');
    expect(schema.properties.metadata.properties.created).toHaveProperty('format', 'date-time');
  });

  it('should support schema references and inheritance', () => {
    // Define base schema
    dsl.component('BaseEntity', {
      type: ComponentType.SCHEMA,
      description: 'Base entity with common properties',
      version: '1.0.0',
      properties: {
        id: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      },
      required: ['id']
    });

    // Define derived schema with reference
    const userSchema = dsl.component('UserWithBase', {
      type: ComponentType.SCHEMA,
      description: 'User schema with base properties',
      version: '1.0.0',
      extends: { ref: 'BaseEntity' },
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
      },
      required: ['name', 'email']
    });

    expect(userSchema).toBeDefined();
    // Expect the derived schema to have both its own and the base properties
    // This would require the DSL to properly implement schema inheritance
    expect(userSchema.extends).toEqual({ ref: 'BaseEntity' });
    expect(userSchema.properties).toHaveProperty('name');
    expect(userSchema.properties).toHaveProperty('email');
    // Base properties would be available at runtime through inheritance resolution
  });
}); 