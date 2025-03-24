import { EventBus } from '../models/event-system';
import { Extension, ExtensionHookRegistration, ExtensionPointName } from '../models/extension-system';
import { v4 as uuidv4 } from 'uuid';

export interface OutboxEntry {
  id: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'processed' | 'failed';
  timestamp: number;
  processedAt: number | null;
}

export interface OutboxRepository {
  saveEntry(entry: Omit<OutboxEntry, 'id'>): Promise<OutboxEntry>;
  markAsProcessed(id: string): Promise<void>;
  getUnprocessedEntries(): Promise<OutboxEntry[]>;
  getAllEntries(): Promise<OutboxEntry[]>;
  purgeProcessedEntries(before: Date): Promise<void>;
}

export interface OutboxStatus {
  totalEntries: number;
  pendingEntries: number;
  processedEntries: number;
  oldestPendingEntry: OutboxEntry | null;
}

export interface OutboxPattern {
  initialize(options?: OutboxPatternOptions): void;
  processOutbox(): Promise<void>;
  getOutboxStatus(): Promise<OutboxStatus>;
  purgeProcessedEntries(before: Date): Promise<void>;
  shutdown(): void;
}

export interface OutboxPatternOptions {
  processingInterval?: number;
}

export class OutboxPatternImpl implements OutboxPattern {
  private processingInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(
    private eventBus: EventBus,
    private outboxRepository: OutboxRepository
  ) {}

  initialize(options: OutboxPatternOptions = {}): void {
    if (this.initialized) return;

    // Subscribe to all events to capture them in the outbox
    this.eventBus.subscribe('*', this.handleEvent.bind(this));

    // Set up processing interval
    const interval = options.processingInterval || 5000; // Default 5 seconds
    this.processingInterval = setInterval(() => {
      this.processOutbox().catch((error) => {
        console.error('Error processing outbox:', error);
      });
    }, interval);

    this.initialized = true;
  }

  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.initialized = false;
  }
  
  // Handler for captured events
  private async handleEvent(event: any): Promise<void> {
    if (!this.initialized) return;
    
    try {
      // Save the event to the outbox
      await this.outboxRepository.saveEntry({
        eventType: event.type,
        payload: event.payload,
        status: 'pending',
        timestamp: Date.now(),
        processedAt: null
      });
    } catch (error) {
      console.error('Error saving event to outbox:', error);
      // Publish error event using DomainEvent format
      this.eventBus.publish({
        id: uuidv4(),
        type: 'outbox.error',
        timestamp: Date.now(),
        payload: {
          error: error instanceof Error ? error.message : String(error),
          event: event
        }
      });
    }
  }

  async processOutbox(): Promise<void> {
    // Don't check if initialized here, to allow manual triggering as expected by tests
    
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    try {
      // Get unprocessed entries
      const entries = await this.outboxRepository.getUnprocessedEntries();
      
      // Process each entry
      for (const entry of entries) {
        try {
          // Publish using DomainEvent format
          this.eventBus.publish({
            id: uuidv4(),
            type: `outbox.processed.${entry.eventType}`,
            timestamp: Date.now(),
            payload: entry.payload
          });
          
          // Mark as processed
          await this.outboxRepository.markAsProcessed(entry.id);
          processed++;
        } catch (error) {
          // If processing a single entry fails, continue with others
          // Publish error using DomainEvent format
          this.eventBus.publish({
            id: uuidv4(),
            type: 'outbox.error',
            timestamp: Date.now(),
            payload: {
              error: error instanceof Error ? error.message : String(error),
              entryId: entry.id
            }
          });
          failed++;
        }
      }
    } catch (error) {
      // Handle errors in fetching the entries
      // Publish error using DomainEvent format
      this.eventBus.publish({
        id: uuidv4(),
        type: 'outbox.error',
        timestamp: Date.now(),
        payload: {
          error: error instanceof Error ? error.message : String(error),
          phase: 'fetching-entries'
        }
      });
    }
  }

  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return [
      {
        pointName: 'event:beforePublish',
        hook: async (context: any) => {
          // We already capture events through the global subscription
          return context;
        }
      }
    ];
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCapabilities(): string[] {
    return ['outbox-pattern', 'reliable-messaging'];
  }

  async getOutboxStatus(): Promise<OutboxStatus> {
    const allEntries = await this.outboxRepository.getAllEntries();
    const pendingEntries = allEntries.filter(entry => entry.status === 'pending');
    
    // Find the oldest pending entry
    let oldestPendingEntry: OutboxEntry | null = null;
    if (pendingEntries.length > 0) {
      oldestPendingEntry = pendingEntries.reduce((oldest, current) => {
        return current.timestamp < oldest.timestamp ? current : oldest;
      }, pendingEntries[0]);
    }
    
    return {
      totalEntries: allEntries.length,
      pendingEntries: pendingEntries.length,
      processedEntries: allEntries.filter(entry => entry.status === 'processed').length,
      oldestPendingEntry
    };
  }

  async purgeProcessedEntries(before: Date): Promise<void> {
    await this.outboxRepository.purgeProcessedEntries(before);
  }
}

export function createOutboxPattern(
  eventBus: EventBus,
  outboxRepository: OutboxRepository
): OutboxPattern {
  return new OutboxPatternImpl(eventBus, outboxRepository);
} 