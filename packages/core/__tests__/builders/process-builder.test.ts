import { describe, it, expect } from 'vitest';
import { Process } from './process-builder';

describe('Parallel State Execution', () => {
  describe('Parallel State Definition', () => {
    it('should define a process with parallel states', () => {
      const process = Process.create('order-process')
        .withDescription('Order processing workflow')
        .withInitialState('created')
        .addState('created')
        .addState('processing', { type: 'parallel' })
        .addState('processing.payment', { parent: 'processing' })
        .addState('processing.inventory', { parent: 'processing' })
        .addState('processing.shipping', { parent: 'processing' })
        .addState('processing.payment.completed', { parent: 'processing.payment' })
        .addState('processing.inventory.completed', { parent: 'processing.inventory' })
        .addState('processing.shipping.completed', { parent: 'processing.shipping' })
        .addState('completed', { isFinal: true })
        .addSimpleTransition('created', 'processing', 'START_PROCESSING')
        .addSimpleTransition('processing.payment', 'processing.payment.completed', 'PAYMENT_PROCESSED')
        .addSimpleTransition('processing.inventory', 'processing.inventory.completed', 'INVENTORY_RESERVED')
        .addSimpleTransition('processing.shipping', 'processing.shipping.completed', 'SHIPPING_PREPARED')
        .build();

      expect(process.states).toContainEqual(expect.objectContaining({ name: 'processing', type: 'parallel' }));
      expect(process.states).toContainEqual(expect.objectContaining({ name: 'processing.payment', parent: 'processing' }));
      expect(process.states).toContainEqual(expect.objectContaining({ name: 'processing.inventory', parent: 'processing' }));
      expect(process.states).toContainEqual(expect.objectContaining({ name: 'processing.shipping', parent: 'processing' }));
    });

    it('should support join transitions from multiple states', () => {
      const process = Process.create('order-process')
        .withDescription('Order processing workflow')
        .withInitialState('created')
        .addState('created')
        .addState('processing', { type: 'parallel' })
        .addState('processing.payment', { parent: 'processing' })
        .addState('processing.inventory', { parent: 'processing' })
        .addState('processing.payment.completed', { parent: 'processing.payment' })
        .addState('processing.inventory.completed', { parent: 'processing.inventory' })
        .addState('completed', { isFinal: true })
        .addSimpleTransition('created', 'processing', 'START_PROCESSING')
        .addSimpleTransition('processing.payment', 'processing.payment.completed', 'PAYMENT_PROCESSED')
        .addSimpleTransition('processing.inventory', 'processing.inventory.completed', 'INVENTORY_RESERVED')
        .addTransition({
          from: ['processing.payment.completed', 'processing.inventory.completed'],
          to: 'completed',
          on: 'JOIN'
        })
        .build();

      const joinTransition = process.transitions.find(t => 
        Array.isArray(t.from) && 
        t.from.includes('processing.payment.completed') && 
        t.from.includes('processing.inventory.completed') &&
        t.to === 'completed' &&
        t.on === 'JOIN'
      );

      expect(joinTransition).toBeDefined();
    });
  });
}); 