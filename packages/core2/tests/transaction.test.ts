import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/models/event.js';
import { createEventBusInstance, createTransactionPluginInstance } from '../src/factories.js';

describe('Transaction/Unit of Work', () => {
  let transactionPlugin: ReturnType<typeof createTransactionPluginInstance>;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = createEventBusInstance();
    transactionPlugin = createTransactionPluginInstance(eventBus);
  });

  describe('Transaction Creation', () => {
    it('should create a new transaction', () => {
      const transactionId = transactionPlugin.beginTransaction();
      expect(transactionId).toBeDefined();
      expect(typeof transactionId).toBe('string');
    });

    it('should track active transactions', () => {
      const transactionId = transactionPlugin.beginTransaction();
      const context = transactionPlugin.getTransactionContext(transactionId);
      expect(context).toBeDefined();
    });
  });

  describe('Transaction Operations', () => {
    it('should commit a transaction', () => {
      const transactionId = transactionPlugin.beginTransaction();
      transactionPlugin.commitTransaction(transactionId);
      // Verify transaction was committed by checking context
      const context = transactionPlugin.getTransactionContext(transactionId);
      expect(context).toBeDefined();
    });

    it('should rollback a transaction', () => {
      const transactionId = transactionPlugin.beginTransaction();
      transactionPlugin.rollbackTransaction(transactionId);
      // Verify transaction was rolled back by checking context
      const context = transactionPlugin.getTransactionContext(transactionId);
      expect(context).toBeDefined();
    });

    it('should throw error when committing non-existent transaction', () => {
      expect(() => {
        transactionPlugin.commitTransaction('non-existent-id');
      }).toThrow('Transaction not found');
    });

    it('should throw error when rolling back non-existent transaction', () => {
      expect(() => {
        transactionPlugin.rollbackTransaction('non-existent-id');
      }).toThrow('Transaction not found');
    });
  });

  describe('Transaction Events', () => {
    it('should emit transaction started event', () => {
      const transactionId = transactionPlugin.beginTransaction();
      expect(eventBus.publish).toHaveBeenCalledWith('transaction.started', {
        transactionId
      });
    });

    it('should emit transaction committed event', () => {
      const transactionId = transactionPlugin.beginTransaction();
      transactionPlugin.commitTransaction(transactionId);
      expect(eventBus.publish).toHaveBeenCalledWith('transaction.committed', {
        transactionId
      });
    });

    it('should emit transaction rolled back event', () => {
      const transactionId = transactionPlugin.beginTransaction();
      transactionPlugin.rollbackTransaction(transactionId);
      expect(eventBus.publish).toHaveBeenCalledWith('transaction.rolled_back', {
        transactionId
      });
    });
  });

  describe('Transaction Context', () => {
    it('should maintain transaction context', () => {
      const transactionId = transactionPlugin.beginTransaction();
      const context = transactionPlugin.getTransactionContext(transactionId);
      expect(context).toBeDefined();
      expect(context.transactionId).toBe(transactionId);
    });

    it('should throw error when getting context for non-existent transaction', () => {
      expect(() => {
        transactionPlugin.getTransactionContext('non-existent-id');
      }).toThrow('Transaction not found');
    });
  });
}); 