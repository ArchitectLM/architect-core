import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Transaction, TransactionManager } from '../src/models/transaction.js';
import { EventBus } from '../src/models/event.js';

describe('Transaction/Unit of Work', () => {
  let transactionManager: TransactionManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      applyBackpressure: vi.fn()
    };
    transactionManager = new TransactionManager(eventBus);
  });

  describe('Transaction Creation', () => {
    it('should create a new transaction', () => {
      const transaction = transactionManager.beginTransaction();
      expect(transaction).toBeDefined();
      expect(transaction.id).toBeDefined();
      expect(transaction.status).toBe('active');
    });

    it('should track active transactions', () => {
      const transaction = transactionManager.beginTransaction();
      expect(transactionManager.getActiveTransactions()).toContain(transaction);
    });
  });

  describe('Transaction Operations', () => {
    it('should commit a transaction', () => {
      const transaction = transactionManager.beginTransaction();
      transactionManager.commitTransaction(transaction.id);
      expect(transaction.status).toBe('committed');
      expect(transactionManager.getActiveTransactions()).not.toContain(transaction);
    });

    it('should rollback a transaction', () => {
      const transaction = transactionManager.beginTransaction();
      transactionManager.rollbackTransaction(transaction.id);
      expect(transaction.status).toBe('rolled_back');
      expect(transactionManager.getActiveTransactions()).not.toContain(transaction);
    });

    it('should throw error when committing non-existent transaction', () => {
      expect(() => {
        transactionManager.commitTransaction('non-existent-id');
      }).toThrow('Transaction not found');
    });

    it('should throw error when rolling back non-existent transaction', () => {
      expect(() => {
        transactionManager.rollbackTransaction('non-existent-id');
      }).toThrow('Transaction not found');
    });
  });

  describe('Transaction Events', () => {
    it('should emit transaction started event', () => {
      const transaction = transactionManager.beginTransaction();
      expect(eventBus.publish).toHaveBeenCalledWith('transaction.started', {
        transactionId: transaction.id
      });
    });

    it('should emit transaction committed event', () => {
      const transaction = transactionManager.beginTransaction();
      transactionManager.commitTransaction(transaction.id);
      expect(eventBus.publish).toHaveBeenCalledWith('transaction.committed', {
        transactionId: transaction.id
      });
    });

    it('should emit transaction rolled back event', () => {
      const transaction = transactionManager.beginTransaction();
      transactionManager.rollbackTransaction(transaction.id);
      expect(eventBus.publish).toHaveBeenCalledWith('transaction.rolled_back', {
        transactionId: transaction.id
      });
    });
  });

  describe('Transaction Context', () => {
    it('should maintain transaction context', () => {
      const transaction = transactionManager.beginTransaction();
      const context = transactionManager.getTransactionContext(transaction.id);
      expect(context).toBeDefined();
      expect(context.transactionId).toBe(transaction.id);
    });

    it('should throw error when getting context for non-existent transaction', () => {
      expect(() => {
        transactionManager.getTransactionContext('non-existent-id');
      }).toThrow('Transaction not found');
    });
  });
}); 