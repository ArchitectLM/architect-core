import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryEventBus } from '../src/implementations/event-bus';
import { TransactionManager, createTransactionManager } from '../src/models/transaction';
import { DomainEvent } from '../src/models/core-types';
import { EventBus } from '../src/models/event-system';
import { createModernRuntime } from '../src/implementations/modern-factory';

describe('Transaction/Unit of Work', () => {
  let transactionManager: TransactionManager;
  let eventBus: EventBus;
  let runtime: any;

  beforeEach(() => {
    runtime = createModernRuntime({
      persistEvents: false,
      runtimeOptions: {
        version: '1.0.0',
        namespace: 'test'
      }
    });
    eventBus = runtime.eventBus;
    transactionManager = createTransactionManager(eventBus);
  });

  describe('Transaction Creation', () => {
    it('should create a new transaction', () => {
      const transaction = transactionManager.beginTransaction();
      expect(transaction.id).toBeDefined();
      expect(transaction.status).toBe('active');
      expect(transaction.startedAt).toBeDefined();
    });

    it('should track active transactions', () => {
      const transaction = transactionManager.beginTransaction();
      const context = transactionManager.getTransactionContext(transaction.id);
      expect(context).toBeDefined();
      expect(context.transactionId).toBe(transaction.id);
    });
  });

  describe('Transaction Operations', () => {
    it('should commit a transaction', () => {
      const transaction = transactionManager.beginTransaction();
      transactionManager.commitTransaction(transaction.id);
      
      const updatedTransaction = transactionManager.getTransaction(transaction.id);
      expect(updatedTransaction?.status).toBe('committed');
      expect(updatedTransaction?.completedAt).toBeDefined();
    });

    it('should rollback a transaction', () => {
      const transaction = transactionManager.beginTransaction();
      transactionManager.rollbackTransaction(transaction.id);
      
      const updatedTransaction = transactionManager.getTransaction(transaction.id);
      expect(updatedTransaction?.status).toBe('rolled_back');
      expect(updatedTransaction?.completedAt).toBeDefined();
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
    it('should emit transaction started event', async () => {
      const handler = vi.fn();
      eventBus.subscribe('transaction.started', handler);
      
      transactionManager.beginTransaction();
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('transaction.started');
      expect(handler.mock.calls[0][0].payload.transactionId).toBeDefined();
    });

    it('should emit transaction committed event', async () => {
      const handler = vi.fn();
      eventBus.subscribe('transaction.committed', handler);
      
      const transaction = transactionManager.beginTransaction();
      transactionManager.commitTransaction(transaction.id);
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('transaction.committed');
      expect(handler.mock.calls[0][0].payload.transactionId).toBe(transaction.id);
    });

    it('should emit transaction rolled back event', async () => {
      const handler = vi.fn();
      eventBus.subscribe('transaction.rolled_back', handler);
      
      const transaction = transactionManager.beginTransaction();
      transactionManager.rollbackTransaction(transaction.id);
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('transaction.rolled_back');
      expect(handler.mock.calls[0][0].payload.transactionId).toBe(transaction.id);
    });
  });

  describe('Transaction Context', () => {
    it('should maintain transaction context', () => {
      const transaction = transactionManager.beginTransaction();
      const context = transactionManager.getTransactionContext(transaction.id);
      
      expect(context).toBeDefined();
      expect(context.transactionId).toBe(transaction.id);
      expect(context.data).toBeDefined();
      expect(context.metadata.startedAt).toBeDefined();
      expect(context.metadata.lastAccessedAt).toBeDefined();
    });

    it('should throw error when getting context for non-existent transaction', () => {
      expect(() => {
        transactionManager.getTransactionContext('non-existent-id');
      }).toThrow('Transaction not found');
    });

    it('should track active transactions', () => {
      const transaction1 = transactionManager.beginTransaction();
      const transaction2 = transactionManager.beginTransaction();
      
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(2);
      expect(activeTransactions.map(t => t.id)).toContain(transaction1.id);
      expect(activeTransactions.map(t => t.id)).toContain(transaction2.id);
      
      transactionManager.commitTransaction(transaction1.id);
      const remainingActive = transactionManager.getActiveTransactions();
      expect(remainingActive).toHaveLength(1);
      expect(remainingActive[0].id).toBe(transaction2.id);
    });
  });
}); 