import { EventBus } from '../models/event.js';
import { Extension, ExtensionHandler, ExtensionContext } from '../models/extension.js';

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
  hooks: Record<string, ExtensionHandler> = {};
  name = 'transaction-management';
  description = 'Manages transaction lifecycle and provides transaction context';

  constructor(private eventBus: EventBus) {}

  initialize(): void {
    // No initialization needed
  }

  beginTransaction(): string {
    const transactionId = crypto.randomUUID();
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
      throw new Error(`Transaction ${transactionId} not found`);
    }
    if (context.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    context.status = 'committed';
  }

  rollbackTransaction(transactionId: string): void {
    const context = this.transactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    if (context.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    context.status = 'rolled-back';
  }

  getTransactionContext(transactionId: string): { transactionId: string } {
    const context = this.transactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    return { transactionId: context.transactionId };
  }
} 