import { EventBus } from './event.js';
import { v4 as uuidv4 } from 'uuid';

export interface Transaction {
  id: string;
  status: 'active' | 'committed' | 'rolled_back';
  startedAt: number;
  completedAt?: number;
}

export interface TransactionContext {
  transactionId: string;
  data: Map<string, any>;
  metadata: {
    startedAt: number;
    lastAccessedAt: number;
  };
}

export interface TransactionManager {
  beginTransaction(): Transaction;
  commitTransaction(transactionId: string): void;
  rollbackTransaction(transactionId: string): void;
  getTransactionContext(transactionId: string): TransactionContext;
  getActiveTransactions(): Transaction[];
  getTransaction(transactionId: string): Transaction | undefined;
}

export class TransactionManagerImpl implements TransactionManager {
  private transactions: Map<string, Transaction> = new Map();
  private contexts: Map<string, TransactionContext> = new Map();

  constructor(private eventBus: EventBus) {}

  beginTransaction(): Transaction {
    const transaction: Transaction = {
      id: uuidv4(),
      status: 'active',
      startedAt: Date.now()
    };

    this.transactions.set(transaction.id, transaction);
    this.contexts.set(transaction.id, {
      transactionId: transaction.id,
      data: new Map(),
      metadata: {
        startedAt: transaction.startedAt,
        lastAccessedAt: Date.now()
      }
    });

    this.eventBus.publish('transaction.started', {
      transactionId: transaction.id
    });

    return transaction;
  }

  commitTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'active') {
      throw new Error('Transaction is not active');
    }

    transaction.status = 'committed';
    transaction.endTime = Date.now();

    this.eventBus.publish('transaction.committed', {
      transactionId: transaction.id
    });
  }

  rollbackTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'active') {
      throw new Error('Transaction is not active');
    }

    transaction.status = 'rolled_back';
    transaction.endTime = Date.now();

    this.eventBus.publish('transaction.rolled_back', {
      transactionId: transaction.id
    });
  }

  getActiveTransactions(): Transaction[] {
    return Array.from(this.transactions.values())
      .filter(t => t.status === 'active');
  }

  getTransactionContext(transactionId: string): TransactionContext {
    const context = this.contexts.get(transactionId);
    if (!context) {
      throw new Error('Transaction not found');
    }
    return context;
  }
}

export function createTransactionManager(eventBus: EventBus): TransactionManager {
  return new TransactionManagerImpl(eventBus);
} 