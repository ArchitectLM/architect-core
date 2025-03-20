/**
 * Event-driven component registry
 * 
 * This module provides an event-driven implementation of the component registry
 * that uses the ReactiveEventBus from the core package.
 */

import { ReactiveEventBus } from '@architectlm/core';
import { BaseComponent } from './types.js';

/**
 * DSL event types
 */
export enum DSLEventType {
  COMPONENT_REGISTERED = 'dsl.component.registered',
  COMPONENT_UPDATED = 'dsl.component.updated',
  COMPONENT_REMOVED = 'dsl.component.removed',
  COMPONENT_VALIDATED = 'dsl.component.validated',
  COMPONENT_COMPILED = 'dsl.component.compiled',
  SYSTEM_LOADED = 'dsl.system.loaded',
  SYSTEM_STARTED = 'dsl.system.started',
  SYSTEM_STOPPED = 'dsl.system.stopped'
}

/**
 * Event-driven component registry
 */
export class EventDrivenComponentRegistry {
  private components = new Map<string, BaseComponent>();
  
  /**
   * Constructor
   * @param eventBus The event bus to use
   */
  constructor(private eventBus: ReactiveEventBus) {
    // Subscribe to component events
    this.eventBus.subscribe(DSLEventType.COMPONENT_REGISTERED, this.handleComponentRegistered.bind(this));
    this.eventBus.subscribe(DSLEventType.COMPONENT_UPDATED, this.handleComponentUpdated.bind(this));
    this.eventBus.subscribe(DSLEventType.COMPONENT_REMOVED, this.handleComponentRemoved.bind(this));
  }
  
  /**
   * Handle component registered events
   * @param event The event
   */
  private handleComponentRegistered(event: any): void {
    const component = event.payload.component;
    this.components.set(component.name, component);
  }
  
  /**
   * Handle component updated events
   * @param event The event
   */
  private handleComponentUpdated(event: any): void {
    const component = event.payload.component;
    this.components.set(component.name, component);
  }
  
  /**
   * Handle component removed events
   * @param event The event
   */
  private handleComponentRemoved(event: any): void {
    const componentName = event.payload.componentName;
    this.components.delete(componentName);
  }
  
  /**
   * Register a component
   * @param component The component to register
   */
  registerComponent(component: BaseComponent): void {
    this.eventBus.publish({
      type: DSLEventType.COMPONENT_REGISTERED,
      payload: { component },
      timestamp: Date.now()
    });
  }
  
  /**
   * Update a component
   * @param component The component to update
   */
  updateComponent(component: BaseComponent): void {
    this.eventBus.publish({
      type: DSLEventType.COMPONENT_UPDATED,
      payload: { component },
      timestamp: Date.now()
    });
  }
  
  /**
   * Remove a component
   * @param componentName The name of the component to remove
   */
  removeComponent(componentName: string): void {
    this.eventBus.publish({
      type: DSLEventType.COMPONENT_REMOVED,
      payload: { componentName },
      timestamp: Date.now()
    });
  }
  
  /**
   * Get a component by name
   * @param name The name of the component
   * @returns The component, or undefined if not found
   */
  getComponent(name: string): BaseComponent | undefined {
    return this.components.get(name);
  }
  
  /**
   * Get all components
   * @returns An array of all components
   */
  getAllComponents(): BaseComponent[] {
    return Array.from(this.components.values());
  }
  
  /**
   * Get components by type
   * @param type The component type
   * @returns An array of components of the specified type
   */
  getComponentsByType(type: string): BaseComponent[] {
    return this.getAllComponents().filter(component => component.type === type);
  }
  
  /**
   * Check if a component exists
   * @param name The name of the component
   * @returns True if the component exists, false otherwise
   */
  hasComponent(name: string): boolean {
    return this.components.has(name);
  }
} 