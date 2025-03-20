import { BackpressureStrategy } from './backpressure.js';

export interface Event<T = any> {
  type: string;
  payload: T;
  timestamp: number;
}

export type EventHandler = (event: Event) => void;

export interface EventBus {
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
  publish(eventType: string, payload: any): void;
  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void;
} 