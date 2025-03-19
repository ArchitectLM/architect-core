import { EventBus } from './event.js';
import { v4 as uuidv4 } from 'uuid';

export type TransactionStatus = 'active' | 'committed' | 'rolled_back';

export interface Transaction {
  id: string;
  status: TransactionStatus;
  startTime: number;
  endTime?: number;
}

export interface TransactionContext {
  transactionId: string;
  data: Map<string, any>;
}

export interface TransactionManager {
  beginTransaction(): Transaction;
  commitTransaction(transactionId: string): void;
  rollbackTransaction(transactionId: string): void;
  getActiveTransactions(): Transaction[];
  getTransactionContext(transactionId: string): TransactionContext;
}

export class TransactionManagerImpl implements TransactionManager {
  private transactions: Map<string, Transaction> = new Map();
  private contexts: Map<string, TransactionContext> = new Map();

  constructor(private eventBus: EventBus) {}

  beginTransaction(): Transaction {
    const transaction: Transaction = {
      id: uuidv4(),
      status: 'active',
      startTime: Date.now()
    };

    this.transactions.set(transaction.id, transaction);
    this.contexts.set(transaction.id, {
      transactionId: transaction.id,
      data: new Map()
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