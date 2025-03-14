/**
 * System definition module
 */
import { SystemConfig } from './models/system-types';
import { Runtime } from './models/runtime-types';

/**
 * Define a reactive system with processes and tasks
 * @param config System configuration
 * @returns Reactive system instance
 */
export function defineSystem(config: SystemConfig): SystemConfig {
  // Validate required fields
  if (!config.id) {
    throw new Error('System ID is required');
  }
  
  // Create the reactive system
  const system: SystemConfig = {
    id: config.id,
    processes: config.processes || {},
    tasks: config.tasks || {},
    plugins: config.plugins || [],
    metadata: config.metadata || {},
    name: config.name,
    description: config.description,
    observability: config.observability,
    llmMetadata: config.llmMetadata
  };
  
  return system;
} 