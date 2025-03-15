/**
 * Runtime implementation
 */

import { Runtime, Event, ProcessInstance } from '@architectlm/extensions';

/**
 * Create Runtime
 */
export function createRuntime(): Runtime {
  // Simple in-memory implementation
  const processes = new Map<string, ProcessInstance>();
  const eventHandlers = new Map<string, Set<(event: Event) => void>>();

  return {
    async createProcess(processId: string, input: any): Promise<ProcessInstance> {
      const instance: ProcessInstance = {
        id: `${processId}-${Date.now()}`,
        processId,
        state: 'initial',
        data: input,
        events: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      processes.set(instance.id, instance);
      return instance;
    },

    async getProcess(instanceId: string): Promise<ProcessInstance | null> {
      return processes.get(instanceId) || null;
    },

    async executeTask<TInput = any, TOutput = any>(
      taskId: string,
      input: TInput
    ): Promise<TOutput> {
      // Stub implementation
      console.log(`Executing task ${taskId} with input:`, input);
      return {} as TOutput;
    },

    emitEvent(event: Event): void {
      if (eventHandlers.has(event.type)) {
        for (const handler of eventHandlers.get(event.type)!) {
          handler(event);
        }
      }
    },

    on(eventType: string, handler: (event: Event) => void): void {
      if (!eventHandlers.has(eventType)) {
        eventHandlers.set(eventType, new Set());
      }
      eventHandlers.get(eventType)!.add(handler);
    },

    off(eventType: string, handler: (event: Event) => void): void {
      if (eventHandlers.has(eventType)) {
        eventHandlers.get(eventType)!.delete(handler);
      }
    }
  };
}
