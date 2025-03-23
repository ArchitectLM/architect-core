import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransactionManager, TransactionManagerImpl } from '../src/models/transaction';

describe('Transaction/Unit of Work', () => {
  let transactionManager: TransactionManager;
  let mockPublish: any;

  beforeEach(() => {
    // Create a mock publish function
    mockPublish = vi.fn().mockResolvedValue(undefined);
    
    // Create transaction manager with a simple mock event bus
    transactionManager = new TransactionManagerImpl({
      publish: mockPublish,
      // The other methods aren't used by TransactionManager
      subscribe: vi.fn(),
      subscribeWithFilter: vi.fn(),
      publishAll: vi.fn(),
      unsubscribe: vi.fn(),
      clearSubscriptions: vi.fn(),
      clearAllSubscriptions: vi.fn()
    } as any);
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
    it('should emit transaction started event', () => {
      const transaction = transactionManager.beginTransaction();
      
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transaction.started',
          payload: expect.objectContaining({
            transactionId: transaction.id
          })
        })
      );
    });

    it('should emit transaction committed event', () => {
      const transaction = transactionManager.beginTransaction();
      mockPublish.mockClear(); // Clear previous calls
      
      transactionManager.commitTransaction(transaction.id);
      
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transaction.committed',
          payload: expect.objectContaining({
            transactionId: transaction.id
          })
        })
      );
    });

    it('should emit transaction rolled back event', () => {
      const transaction = transactionManager.beginTransaction();
      mockPublish.mockClear(); // Clear previous calls
      
      transactionManager.rollbackTransaction(transaction.id);
      
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transaction.rolled_back',
          payload: expect.objectContaining({
            transactionId: transaction.id
          })
        })
      );
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