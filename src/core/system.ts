/**
 * System definition module
 */
import { SystemConfig, ReactiveSystem } from './types';

/**
 * Define a reactive system with processes and tasks
 * @param config System configuration
 * @returns Reactive system instance
 */
export function defineSystem(config: SystemConfig): ReactiveSystem {
  // Validate required fields
  if (!config.id) {
    throw new Error('System ID is required');
  }
  
  // Create the reactive system
  const system: ReactiveSystem = {
    id: config.id,
    processes: config.processes || {},
    tasks: config.tasks || {},
    tests: config.tests || [],
    mocks: config.mocks || {},
    runtime: {} as any // Placeholder for runtime implementation
  };
  
  return system;
} 