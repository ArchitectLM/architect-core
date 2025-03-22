import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../src/models/event';
import { 
  OutboxPattern, 
  OutboxEntry, 
  OutboxRepository, 
  createOutboxPattern 
} from '../../src/plugins/outbox-pattern';

describe('Outbox Pattern Plugin', () => {
  let eventBus: EventBus;
  let outboxRepository: OutboxRepository;
  let outboxPattern: OutboxPattern;

  beforeEach(() => {
    vi.useFakeTimers();
    
    eventBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      applyBackpressure: vi.fn()
    };

    outboxRepository = {
      saveEntry: vi.fn().mockResolvedValue(undefined),
      getUnprocessedEntries: vi.fn().mockResolvedValue([]),
      markAsProcessed: vi.fn().mockResolvedValue(undefined),
      getAllEntries: vi.fn().mockResolvedValue([]),
      purgeProcessedEntries: vi.fn().mockResolvedValue(undefined)
    };

    outboxPattern = createOutboxPattern(eventBus, outboxRepository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Plugin Initialization', () => {
    it('should subscribe to events on initialization', () => {
      outboxPattern.initialize();
      expect(eventBus.subscribe).toHaveBeenCalledWith('*', expect.any(Function));
    });

    it('should set up processing interval on initialization with defaults', () => {
      vi.spyOn(global, 'setInterval');
      outboxPattern.initialize();
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000); // Default interval
    });

    it('should set up processing interval with custom interval', () => {
      vi.spyOn(global, 'setInterval');
      outboxPattern.initialize(10000); // 10 seconds
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 10000);
    });
  });

  describe('Event Capturing', () => {
    it('should save events to outbox repository', async () => {
      outboxPattern.initialize();
      
      // Get the event handler function
      const eventHandler = (eventBus.subscribe as jest.Mock).mock.calls[0][1];
      
      const event = {
        type: 'TEST_EVENT',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      await eventHandler(event);
      
      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'TEST_EVENT',
        payload: { data: 'test' },
        status: 'pending',
        timestamp: expect.any(Number)
      }));
    });

    it('should handle event capturing errors', async () => {
      outboxPattern.initialize();
      
      // Configure repository to throw an error
      (outboxRepository.saveEntry as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      // Get the event handler function
      const eventHandler = (eventBus.subscribe as jest.Mock).mock.calls[0][1];
      
      const event = {
        type: 'TEST_EVENT',
        payload: { data: 'test' },
        timestamp: Date.now()
      };
      
      // The handler shouldn't throw
      await expect(eventHandler(event)).resolves.not.toThrow();
      
      // Should have published an error event
      expect(eventBus.publish).toHaveBeenCalledWith('outbox.error', expect.objectContaining({
        error: expect.stringContaining('Database error'),
        event: event
      }));
    });
  });

  describe('Message Processing', () => {
    it('should process pending messages on interval', async () => {
      const mockEntries: OutboxEntry[] = [
        {
          id: '1',
          eventType: 'EVENT_1',
          payload: { data: 'test1' },
          status: 'pending',
          timestamp: Date.now() - 10000,
          processedAt: null
        },
        {
          id: '2',
          eventType: 'EVENT_2',
          payload: { data: 'test2' },
          status: 'pending',
          timestamp: Date.now() - 5000,
          processedAt: null
        }
      ];
      
      (outboxRepository.getUnprocessedEntries as jest.Mock).mockResolvedValue(mockEntries);
      
      outboxPattern.initialize();
      
      // Trigger the interval function manually
      const intervalCallback = (setInterval as jest.Mock).mock.calls[0][0];
      await intervalCallback();
      
      // Should have marked both entries as processed
      expect(outboxRepository.markAsProcessed).toHaveBeenCalledWith('1');
      expect(outboxRepository.markAsProcessed).toHaveBeenCalledWith('2');
      
      // Should have published both events to the destination
      expect(eventBus.publish).toHaveBeenCalledWith('outbox.processed.EVENT_1', mockEntries[0].payload);
      expect(eventBus.publish).toHaveBeenCalledWith('outbox.processed.EVENT_2', mockEntries[1].payload);
    });

    it('should continue processing other messages if one fails', async () => {
      const mockEntries: OutboxEntry[] = [
        {
          id: '1',
          eventType: 'EVENT_1',
          payload: { data: 'test1' },
          status: 'pending',
          timestamp: Date.now() - 10000,
          processedAt: null
        },
        {
          id: '2',
          eventType: 'EVENT_2',
          payload: { data: 'test2' },
          status: 'pending',
          timestamp: Date.now() - 5000,
          processedAt: null
        }
      ];
      
      (outboxRepository.getUnprocessedEntries as jest.Mock).mockResolvedValue(mockEntries);
      
      // Make the first entry fail to process
      (outboxRepository.markAsProcessed as jest.Mock)
        .mockImplementationOnce(() => Promise.reject(new Error('Processing error')));
      
      outboxPattern.initialize();
      
      // Trigger the interval function manually
      const intervalCallback = (setInterval as jest.Mock).mock.calls[0][0];
      await intervalCallback();
      
      // Should have attempted to mark both entries as processed
      expect(outboxRepository.markAsProcessed).toHaveBeenCalledWith('1');
      expect(outboxRepository.markAsProcessed).toHaveBeenCalledWith('2');
      
      // Should have published an error for the first event
      expect(eventBus.publish).toHaveBeenCalledWith('outbox.error', expect.objectContaining({
        error: expect.stringContaining('Processing error'),
        entryId: '1'
      }));
      
      // Should have published the second event successfully
      expect(eventBus.publish).toHaveBeenCalledWith('outbox.processed.EVENT_2', mockEntries[1].payload);
    });
  });

  describe('Outbox Management', () => {
    it('should provide ability to manually trigger processing', async () => {
      const mockEntries: OutboxEntry[] = [
        {
          id: '1',
          eventType: 'EVENT_1',
          payload: { data: 'test1' },
          status: 'pending',
          timestamp: Date.now() - 10000,
          processedAt: null
        }
      ];
      
      (outboxRepository.getUnprocessedEntries as jest.Mock).mockResolvedValue(mockEntries);
      
      // Don't initialize to avoid the automatic interval
      await outboxPattern.processOutbox();
      
      // Should have processed the entry
      expect(outboxRepository.markAsProcessed).toHaveBeenCalledWith('1');
      expect(eventBus.publish).toHaveBeenCalledWith('outbox.processed.EVENT_1', mockEntries[0].payload);
    });

    it('should provide ability to get outbox status', async () => {
      const mockEntries: OutboxEntry[] = [
        {
          id: '1',
          eventType: 'EVENT_1',
          payload: { data: 'test1' },
          status: 'pending',
          timestamp: Date.now() - 10000,
          processedAt: null
        },
        {
          id: '2',
          eventType: 'EVENT_2',
          payload: { data: 'test2' },
          status: 'processed',
          timestamp: Date.now() - 20000,
          processedAt: Date.now() - 15000
        }
      ];
      
      (outboxRepository.getAllEntries as jest.Mock).mockResolvedValue(mockEntries);
      
      const status = await outboxPattern.getOutboxStatus();
      
      expect(status).toEqual({
        totalEntries: 2,
        pendingEntries: 1,
        processedEntries: 1,
        oldestPendingEntry: expect.objectContaining({ id: '1' })
      });
    });

    it('should purge processed entries older than the specified date', async () => {
      const purgeDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      
      await outboxPattern.purgeProcessedEntries(purgeDate);
      
      expect(outboxRepository.purgeProcessedEntries).toHaveBeenCalledWith(purgeDate);
    });
    
    it('should shutdown cleanly', () => {
      vi.spyOn(global, 'clearInterval');
      
      outboxPattern.initialize();
      outboxPattern.shutdown();
      
      expect(clearInterval).toHaveBeenCalled();
    });
  });
}); 