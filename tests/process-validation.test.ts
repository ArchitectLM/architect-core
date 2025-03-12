import { describe, it, expect } from 'vitest';
import { ProcessSchema } from '../src/schema/process-validation';
import { TriggerSchema } from '../src/schema/validation';

describe('Process Schema', () => {
  it('should validate a valid stateless process', () => {
    const validProcess = {
      id: 'notification-dispatch',
      name: 'Notification Dispatch',
      description: 'Process for sending notifications to users',
      contextId: 'notification-service',
      type: 'stateless',
      triggers: [
        {
          type: 'system_event',
          name: 'Notification Request',
          description: 'Internal request to send a notification',
          payload: ['recipientId', 'type', 'content', 'channel']
        }
      ],
      tasks: ['validate-notification', 'determine-channels', 'send-notification'],
      errorHandlers: [
        {
          error: 'ValidationError',
          handler: 'handle-validation-error',
          description: 'Handles validation errors for notifications'
        }
      ]
    };
    
    const result = ProcessSchema.safeParse(validProcess);
    expect(result.success).toBe(true);
  });
  
  it('should validate a valid stateful process', () => {
    const validProcess = {
      id: 'order-processing',
      name: 'Order Processing',
      description: 'Process for handling customer orders',
      contextId: 'order-management',
      type: 'stateful',
      triggers: [
        {
          type: 'user_event',
          name: 'Checkout Completion',
          description: 'User completes checkout process',
          payload: ['cartId', 'customerId', 'paymentDetails']
        }
      ],
      tasks: ['validate-order', 'process-payment', 'create-order'],
      states: ['initial', 'validating', 'payment-processing', 'completed', 'failed'],
      transitions: [
        {
          from: 'initial',
          to: 'validating',
          on: 'start_validation'
        },
        {
          from: 'validating',
          to: 'payment-processing',
          on: 'validation_success'
        },
        {
          from: 'payment-processing',
          to: 'completed',
          on: 'payment_success'
        },
        {
          from: 'payment-processing',
          to: 'failed',
          on: 'payment_failure'
        }
      ],
      errorHandlers: [
        {
          error: 'ValidationError',
          handler: 'handle-validation-error'
        },
        {
          error: 'PaymentError',
          handler: 'handle-payment-error',
          retry: {
            maxAttempts: 3,
            backoffStrategy: 'exponential',
            interval: 1000
          }
        }
      ]
    };
    
    const result = ProcessSchema.safeParse(validProcess);
    expect(result.success).toBe(true);
  });
  
  it('should reject a stateful process without states', () => {
    const invalidProcess = {
      id: 'order-processing',
      name: 'Order Processing',
      description: 'Process for handling customer orders',
      contextId: 'order-management',
      type: 'stateful',
      triggers: [
        {
          type: 'user_event',
          name: 'Checkout Completion',
          payload: ['cartId', 'customerId', 'paymentDetails']
        }
      ],
      tasks: ['validate-order', 'process-payment', 'create-order'],
      // Missing states
      transitions: [
        {
          from: 'initial',
          to: 'validating',
          on: 'start_validation'
        }
      ]
    };
    
    const result = ProcessSchema.safeParse(invalidProcess);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.message).toContain('Stateful processes must have states');
    }
  });
  
  it('should reject a stateful process with transitions referencing invalid states', () => {
    const invalidProcess = {
      id: 'order-processing',
      name: 'Order Processing',
      contextId: 'order-management',
      type: 'stateful',
      triggers: [
        {
          type: 'user_event',
          name: 'Checkout Completion',
          payload: ['cartId', 'customerId']
        }
      ],
      tasks: ['validate-order', 'process-payment'],
      states: ['initial', 'validating', 'completed'], // Missing 'payment-processing'
      transitions: [
        {
          from: 'initial',
          to: 'validating',
          on: 'start_validation'
        },
        {
          from: 'validating',
          to: 'payment-processing', // Invalid state
          on: 'validation_success'
        }
      ]
    };
    
    const result = ProcessSchema.safeParse(invalidProcess);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.message).toContain('Transitions must reference valid states');
    }
  });
});

describe('Trigger Schema', () => {
  it('should validate a system event trigger', () => {
    const validTrigger = {
      type: 'system_event',
      name: 'Order Created',
      description: 'Triggered when a new order is created',
      payload: ['orderId', 'customerId', 'amount']
    };
    
    const result = TriggerSchema.safeParse(validTrigger);
    expect(result.success).toBe(true);
  });
  
  it('should validate a trigger with context properties', () => {
    const validTrigger = {
      type: 'user_event',
      name: 'Profile Updated',
      description: 'User updated their profile',
      payload: ['userId', 'fields'],
      contextProperties: ['tenantId', 'region']
    };
    
    const result = TriggerSchema.safeParse(validTrigger);
    expect(result.success).toBe(true);
  });
}); 