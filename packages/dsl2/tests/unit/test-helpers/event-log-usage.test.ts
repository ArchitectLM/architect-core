import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEventLog } from './actor-system-test-utils.js';

/**
 * Demonstrates how to use the test event log utility
 */
describe('Event Log Utility', () => {
  let eventLog: ReturnType<typeof createTestEventLog>;
  
  beforeEach(() => {
    eventLog = createTestEventLog();
  });

  it('should record and retrieve events', () => {
    // Record some test events
    eventLog.recordEvent('TestSource', 'initialize', { id: 1 });
    eventLog.recordEvent('TestSource', 'process', { id: 1, status: 'processing' });
    eventLog.recordEvent('OtherSource', 'initialize', { id: 2 });
    eventLog.recordEvent('TestSource', 'complete', { id: 1, status: 'done' });
    
    // Get all events
    const allEvents = eventLog.getEvents();
    expect(allEvents.length).toBe(4);
    
    // Get events by source
    const testSourceEvents = eventLog.getEventsBySource('TestSource');
    expect(testSourceEvents.length).toBe(3);
    expect(testSourceEvents[0].action).toBe('initialize');
    expect(testSourceEvents[1].action).toBe('process');
    expect(testSourceEvents[2].action).toBe('complete');
    
    // Get events by action
    const initializeEvents = eventLog.getEventsByAction('initialize');
    expect(initializeEvents.length).toBe(2);
    expect(initializeEvents[0].source).toBe('TestSource');
    expect(initializeEvents[1].source).toBe('OtherSource');
  });

  it('should clear events when requested', () => {
    // Record some events
    eventLog.recordEvent('TestSource', 'initialize', { id: 1 });
    eventLog.recordEvent('TestSource', 'process', { id: 1, status: 'processing' });
    
    // Verify events were recorded
    expect(eventLog.getEvents().length).toBe(2);
    
    // Clear events
    eventLog.clearEvents();
    
    // Verify events were cleared
    expect(eventLog.getEvents().length).toBe(0);
  });

  it('should maintain proper event order', () => {
    // Record events in sequence
    eventLog.recordEvent('Workflow', 'step1', { status: 'start' });
    eventLog.recordEvent('Workflow', 'step2', { status: 'processing' });
    eventLog.recordEvent('Workflow', 'step3', { status: 'finishing' });
    eventLog.recordEvent('Workflow', 'step4', { status: 'complete' });
    
    // Get all events
    const events = eventLog.getEvents();
    
    // Verify events are in correct order
    expect(events[0].action).toBe('step1');
    expect(events[1].action).toBe('step2');
    expect(events[2].action).toBe('step3');
    expect(events[3].action).toBe('step4');
    
    // Verify data is preserved
    expect(events[0].data.status).toBe('start');
    expect(events[3].data.status).toBe('complete');
  });
}); 