import { EventBus, EventHandler } from '../models/event-system';
import { Extension, ExtensionHook, ExtensionContext, ExtensionPoint } from '../models/extension';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '../models/core-types';

export interface TransactionPlugin extends Extension {
  beginTransaction(): string;
  commitTransaction(transactionId: string): void;
  rollbackTransaction(transactionId: string): void;
  getTransactionContext(transactionId: string): { transactionId: string };
}

export interface TransactionContext {
  transactionId: string;
  startTime: number;
  status: 'active' | 'committed' | 'rolled-back';
}

export class TransactionPluginImpl implements TransactionPlugin {
  private transactions: Map<string, TransactionContext> = new Map();
  hooks: Partial<Record<ExtensionPoint, ExtensionHook>> = {
    'system:init': async (context: ExtensionContext) => {
      // Initialize transaction tracking
      return context;
    },
    'system:cleanup': async (context: ExtensionContext) => {
      // Clean up any pending transactions
      const activeTransactions = Array.from(this.transactions.values())
        .filter(tx => tx.status === 'active');
      
      for (const tx of activeTransactions) {
        try {
          this.rollbackTransaction(tx.transactionId);
        } catch (error) {
          // Log error but continue cleanup
          console.error(`Failed to rollback transaction ${tx.transactionId}:`, error);
        }
      }
      
      return context;
    }
  };
  name = 'transaction-management';
  description = 'Manages transaction lifecycle and provides transaction context';

  constructor(private eventBus: EventBus) {
    // Subscribe to transaction events
    this.eventBus.subscribe('transaction:begin', this.handleTransactionBegin.bind(this));
    this.eventBus.subscribe('transaction:commit', this.handleTransactionCommit.bind(this));
    this.eventBus.subscribe('transaction:rollback', this.handleTransactionRollback.bind(this));
  }

  private async handleTransactionBegin(event: DomainEvent<{ transactionId: string }>): Promise<void> {
    const { transactionId } = event.payload;
    this.beginTransaction();
  }

  private async handleTransactionCommit(event: DomainEvent<{ transactionId: string }>): Promise<void> {
    const { transactionId } = event.payload;
    this.commitTransaction(transactionId);
  }

  private async handleTransactionRollback(event: DomainEvent<{ transactionId: string }>): Promise<void> {
    const { transactionId } = event.payload;
    this.rollbackTransaction(transactionId);
  }

  getExtension(): Extension {
    return {
      name: this.name,
      description: this.description,
      hooks: this.hooks
    };
  }

  initialize(): void {
    // No initialization needed
  }

  beginTransaction(): string {
    const transactionId = uuidv4();
    const context: TransactionContext = {
      transactionId,
      startTime: Date.now(),
      status: 'active'
    };
    this.transactions.set(transactionId, context);
    return transactionId;
  }

  commitTransaction(transactionId: string): void {
    const context = this.transactions.get(transactionId);
    if (!context) {
      throw new Error('Transaction not found');
    }
    if (context.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    context.status = 'committed';
  }

  rollbackTransaction(transactionId: string): void {
    const context = this.transactions.get(transactionId);
    if (!context) {
      throw new Error('Transaction not found');
    }
    if (context.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    context.status = 'rolled-back';
  }

  getTransactionContext(transactionId: string): { transactionId: string } {
    const context = this.transactions.get(transactionId);
    if (!context) {
      throw new Error('Transaction not found');
    }
    return { transactionId: context.transactionId };
  }
} 