import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Runtime } from '../src/models/runtime.js';
import { ProcessDefinition, ProcessInstance, TaskExecution, Event, EventBus, ExtensionSystem } from '../src/models/index.js';
import { createReactiveRuntime, createEventBusInstance, createExtensionSystemInstance } from '../src/factories.js';
import { InMemoryEventStorage } from '../src/implementations/event-storage.js';

describe('Reactive Runtime', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystem;
  let eventBus: EventBus;
  let eventStorage: InMemoryEventStorage;

  beforeEach(() => {
    extensionSystem = createExtensionSystemInstance();
    eventBus = createEventBusInstance();
    eventStorage = new InMemoryEventStorage();
    
    runtime = createReactiveRuntime({}, {}, {
      extensionSystem,
      eventBus,
      eventStorage
    });
  });

  describe('Process Management', () => {
    const validDefinition: ProcessDefinition = {
      id: 'test.process',
      name: 'Test Process',
      description: 'A test process',
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'running', on: 'start' },
        { from: 'running', to: 'completed', on: 'complete' }
      ]
    };

    it('should create a process instance', async () => {
      const process = await runtime.createProcess(validDefinition.id, {});
      expect(process).toBeDefined();
      expect(process.type).toBe(validDefinition.id);
      expect(process.state).toBe('created');
    });

    it('should transition process state', async () => {
      const process = await runtime.createProcess(validDefinition.id, {});
      const updated = await runtime.transitionProcess(process.id, 'start');
      expect(updated.state).toBe('running');
    });

    it('should handle invalid state transitions', async () => {
      const process = await runtime.createProcess(validDefinition.id, {});
      await expect(runtime.transitionProcess(process.id, 'complete')).rejects.toThrow();
    });
  });

  describe('Task Management', () => {
    it('should execute a task', async () => {
      const task = await runtime.executeTask('test.task', { input: 'test' });
      expect(task).toBeDefined();
      expect(task.type).toBe('test.task');
      expect(task.status).toBe('completed');
    });

    it('should execute a task with dependencies', async () => {
      const task = await runtime.executeTaskWithDependencies('test.task', { input: 'test' }, ['dep1', 'dep2']);
      expect(task).toBeDefined();
      expect(task.type).toBe('test.task');
      expect(task.status).toBe('completed');
      expect(task.dependency?.dependsOn).toEqual(['dep1', 'dep2']);
    });

    it('should handle task failures', async () => {
      await expect(runtime.executeTask('invalid.task', {})).rejects.toThrow();
    });
  });

  describe('Event Management', () => {
    it('should publish and subscribe to events', async () => {
      const handler = vi.fn();
      const unsubscribe = runtime.subscribe('test.event', handler);
      
      runtime.publish('test.event', { data: 'test' });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
      
      unsubscribe();
      runtime.publish('test.event', { data: 'ignored' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should persist and replay events', async () => {
      const event = { type: 'test.event', data: 'test' };
      await runtime.persistEvent(event);

      const startTime = Date.now() - 1000;
      const endTime = Date.now() + 1000;
      await runtime.replayEvents(startTime, endTime, ['test.event']);
    });

    it('should correlate events', async () => {
      const correlationId = 'test-correlation';
      const events = [
        { type: 'test.event1', data: 'test1', correlationId },
        { type: 'test.event2', data: 'test2', correlationId }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const correlatedEvents = await runtime.correlateEvents(correlationId);
      expect(correlatedEvents).toHaveLength(2);
      expect(correlatedEvents.every(e => e.correlationId === correlationId)).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should track process metrics', async () => {
      const process = await runtime.createProcess('test.process', {});
      await runtime.transitionProcess(process.id, 'start');

      const metrics = await runtime.getProcessMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.processType === 'test.process')).toBe(true);
    });

    it('should track task metrics', async () => {
      await runtime.executeTask('test.task', { input: 'test' });

      const metrics = await runtime.getTaskMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.taskId === 'test.task')).toBe(true);
    });

    it('should track event metrics', async () => {
      await runtime.persistEvent({ type: 'test.event', data: 'test' });

      const metrics = await runtime.getEventMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.eventType === 'test.event')).toBe(true);
    });
  });

  describe('Health Status', () => {
    it('should report runtime health status', async () => {
      const status = await runtime.getHealthStatus();
      expect(status).toBeDefined();
      expect(status.status).toBe('healthy');
      expect(status.details).toBeDefined();
      expect(status.details.processes).toBeDefined();
      expect(status.details.tasks).toBeDefined();
      expect(status.details.events).toBeDefined();
    });

    it('should handle component failures', async () => {
      // Simulate a component failure
      eventBus.publish = () => { throw new Error('Event bus error'); };
      
      const status = await runtime.getHealthStatus();
      expect(status.status).toBe('unhealthy');
      expect(status.details.events.status).toBe('unhealthy');
    });
  });
}); 