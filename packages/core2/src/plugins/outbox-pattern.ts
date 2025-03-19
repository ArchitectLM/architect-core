import { EventBus } from '../models/event.js';
import { v4 as uuidv4 } from 'uuid';

export type OutboxEntryStatus = 'pending' | 'processed' | 'failed';

export interface OutboxEntry {
  id: string;
  eventType: string;
  payload: any;
  status: OutboxEntryStatus;
  timestamp: number;
  processedAt: number | null;
}

export interface OutboxStatus {
  totalEntries: number;
  pendingEntries: number;
  processedEntries: number;
  oldestPendingEntry: OutboxEntry | null;
}

export interface OutboxRepository {
  saveEntry(entry: Omit<OutboxEntry, 'id'>): Promise<void>;
  getUnprocessedEntries(): Promise<OutboxEntry[]>;
  markAsProcessed(id: string): Promise<void>;
  getAllEntries(): Promise<OutboxEntry[]>;
  purgeProcessedEntries(before: Date): Promise<void>;
}

export interface OutboxPattern {
  initialize(processIntervalMs?: number): void;
  shutdown(): void;
  processOutbox(): Promise<void>;
  getOutboxStatus(): Promise<OutboxStatus>;
  purgeProcessedEntries(before: Date): Promise<void>;
}

export class OutboxPatternImpl implements OutboxPattern {
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_INTERVAL_MS = 5000;

  constructor(
    private eventBus: EventBus,
    private outboxRepository: OutboxRepository
  ) {}

  initialize(processIntervalMs: number = this.DEFAULT_INTERVAL_MS): void {
    // Subscribe to all events for outbox storage
    this.eventBus.subscribe('*', this.handleEvent.bind(this));

    // Set up periodic processing
    this.processingInterval = setInterval(
      this.processOutbox.bind(this),
      processIntervalMs
    );
  }

  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async processOutbox(): Promise<void> {
    try {
      const pendingEntries = await this.outboxRepository.getUnprocessedEntries();
      
      // Process each pending entry
      for (const entry of pendingEntries) {
        try {
          // Publish the event to its destination
          this.eventBus.publish(`outbox.processed.${entry.eventType}`, entry.payload);
          
          // Mark as processed
          await this.outboxRepository.markAsProcessed(entry.id);
        } catch (error) {
          // If processing a single entry fails, continue with others
          this.eventBus.publish('outbox.error', {
            error: error instanceof Error ? error.message : String(error),
            entryId: entry.id
          });
        }
      }
    } catch (error) {
      // Handle errors in fetching the entries
      this.eventBus.publish('outbox.error', {
        error: error instanceof Error ? error.message : String(error),
        phase: 'fetching-entries'
      });
    }
  }

  async getOutboxStatus(): Promise<OutboxStatus> {
    const entries = await this.outboxRepository.getAllEntries();
    
    const pendingEntries = entries.filter(e => e.status === 'pending');
    const processedEntries = entries.filter(e => e.status === 'processed');
    
    // Find the oldest pending entry
    let oldestPendingEntry: OutboxEntry | null = null;
    
    if (pendingEntries.length > 0) {
      oldestPendingEntry = pendingEntries.reduce((oldest, current) => 
        current.timestamp < oldest.timestamp ? current : oldest
      );
    }
    
    return {
      totalEntries: entries.length,
      pendingEntries: pendingEntries.length,
      processedEntries: processedEntries.length,
      oldestPendingEntry
    };
  }

  async purgeProcessedEntries(before: Date): Promise<void> {
    await this.outboxRepository.purgeProcessedEntries(before);
  }

  private async handleEvent(event: any): Promise<void> {
    try {
      const outboxEntry: Omit<OutboxEntry, 'id'> = {
        eventType: event.type,
        payload: event.payload,
        status: 'pending',
        timestamp: Date.now(),
        processedAt: null
      };
      
      await this.outboxRepository.saveEntry(outboxEntry);
    } catch (error) {
      // Log error but don't rethrow to avoid disrupting the event flow
      this.eventBus.publish('outbox.error', {
        error: error instanceof Error ? error.message : String(error),
        event
      });
    }
  }
}

export function createOutboxPattern(
  eventBus: EventBus,
  outboxRepository: OutboxRepository
): OutboxPattern {
  return new OutboxPatternImpl(eventBus, outboxRepository);
} 