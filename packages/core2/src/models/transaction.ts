import { EventBus } from './event-system';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from './core-types';

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

    const event: DomainEvent<{ transactionId: string }> = {
      id: uuidv4(),
      type: 'transaction.started',
      timestamp: Date.now(),
      payload: {
        transactionId: transaction.id
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    this.eventBus.publish(event);

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
    transaction.completedAt = Date.now();

    const event: DomainEvent<{ transactionId: string }> = {
      id: uuidv4(),
      type: 'transaction.committed',
      timestamp: Date.now(),
      payload: {
        transactionId: transaction.id
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    this.eventBus.publish(event);
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
    transaction.completedAt = Date.now();

    const event: DomainEvent<{ transactionId: string }> = {
      id: uuidv4(),
      type: 'transaction.rolled_back',
      timestamp: Date.now(),
      payload: {
        transactionId: transaction.id
      },
      metadata: {
        timestamp: Date.now()
      }
    };

    this.eventBus.publish(event);
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
    context.metadata.lastAccessedAt = Date.now();
    return context;
  }

  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactions.get(transactionId);
  }
}

export function createTransactionManager(eventBus: EventBus): TransactionManager {
  return new TransactionManagerImpl(eventBus);
} 