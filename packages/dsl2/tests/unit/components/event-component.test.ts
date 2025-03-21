import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

describe('Event Component', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  it('should define an event component with payload schema', () => {
    const event = dsl.component('UserCreated', {
      type: ComponentType.EVENT,
      description: 'Event emitted when a user is created',
      version: '1.0.0',
      payload: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        },
        required: ['userId', 'name', 'email']
      }
    });

    expect(event).toBeDefined();
    expect(event.id).toBe('UserCreated');
    expect(event.type).toBe(ComponentType.EVENT);
    expect(event.description).toBe('Event emitted when a user is created');
    expect(event.payload).toBeDefined();
    expect(event.payload.properties).toHaveProperty('userId');
    expect(event.payload.required).toContain('userId');
  });

  it('should allow events to reference schema components', () => {
    // Define a schema first
    dsl.component('UserData', {
      type: ComponentType.SCHEMA,
      description: 'User data schema',
      version: '1.0.0',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name']
    });

    // Define event that references the schema
    const event = dsl.component('UserDataChanged', {
      type: ComponentType.EVENT,
      description: 'Event emitted when user data changes',
      version: '1.0.0',
      payload: {
        ref: 'UserData'
      },
      metadata: {
        source: { type: 'string', description: 'Source of the change' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    });

    expect(event).toBeDefined();
    expect(event.payload).toEqual({ ref: 'UserData' });
    expect(event.metadata).toBeDefined();
    expect(event.metadata.source).toBeDefined();
  });

  it('should support event correlation and causation IDs', () => {
    const event = dsl.component('OrderShipped', {
      type: ComponentType.EVENT,
      description: 'Event emitted when an order is shipped',
      version: '1.0.0',
      payload: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          trackingNumber: { type: 'string' },
          shippedAt: { type: 'string', format: 'date-time' }
        },
        required: ['orderId', 'trackingNumber']
      },
      correlationIdPath: 'orderId',
      causationIdField: 'previousEventId'
    });

    expect(event).toBeDefined();
    expect(event.correlationIdPath).toBe('orderId');
    expect(event.causationIdField).toBe('previousEventId');
  });
}); 