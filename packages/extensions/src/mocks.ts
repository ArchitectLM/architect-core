/**
 * Mocks
 */

import { ProcessInstance, Event } from './types/index';

/**
 * Create a mock process instance
 */
export function createMockProcessInstance(id: string, processId: string): ProcessInstance {
  return {
    id,
    processId,
    state: 'initial',
    data: {},
    events: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Create a mock event
 */
export function createMockEvent(type: string, payload: any): Event {
  return {
    type,
    payload,
    timestamp: new Date()
  };
}
