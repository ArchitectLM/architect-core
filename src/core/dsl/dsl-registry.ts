/**
 * DSL Registry
 * 
 * This module provides a registry for DSL components that can be referenced by ID.
 * It allows for validation and lookup of processes and tasks during system building.
 */

/**
 * Registry for DSL components
 */
export class DSLRegistry {
  private static instance: DSLRegistry;
  private processes: Map<string, any> = new Map();
  private tasks: Map<string, any> = new Map();
  private systems: Map<string, any> = new Map();

  /**
   * Get the singleton instance of the registry
   */
  static getInstance(): DSLRegistry {
    if (!DSLRegistry.instance) {
      DSLRegistry.instance = new DSLRegistry();
    }
    return DSLRegistry.instance;
  }

  /**
   * Register a process
   * @param id The ID of the process
   * @param process The process to register
   */
  registerProcess(id: string, process: any): void {
    if (this.processes.has(id)) {
      console.warn(`Process with ID '${id}' already exists. Overwriting.`);
    }
    this.processes.set(id, process);
  }

  /**
   * Register a task
   * @param id The ID of the task
   * @param task The task to register
   */
  registerTask(id: string, task: any): void {
    if (this.tasks.has(id)) {
      console.warn(`Task with ID '${id}' already exists. Overwriting.`);
    }
    this.tasks.set(id, task);
  }

  /**
   * Register a system
   * @param id The ID of the system
   * @param system The system to register
   */
  registerSystem(id: string, system: any): void {
    if (this.systems.has(id)) {
      console.warn(`System with ID '${id}' already exists. Overwriting.`);
    }
    this.systems.set(id, system);
  }

  /**
   * Get a process by ID
   * @param id The ID of the process to get
   * @returns The process, or undefined if not found
   */
  getProcess(id: string): any | undefined {
    return this.processes.get(id);
  }

  /**
   * Get a task by ID
   * @param id The ID of the task to get
   * @returns The task, or undefined if not found
   */
  getTask(id: string): any | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get a system by ID
   * @param id The ID of the system to get
   * @returns The system, or undefined if not found
   */
  getSystem(id: string): any | undefined {
    return this.systems.get(id);
  }

  /**
   * Check if a process with the given ID exists
   * @param id The ID of the process to check
   * @returns True if the process exists, false otherwise
   */
  hasProcess(id: string): boolean {
    return this.processes.has(id);
  }

  /**
   * Check if a task with the given ID exists
   * @param id The ID of the task to check
   * @returns True if the task exists, false otherwise
   */
  hasTask(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * Check if a system with the given ID exists
   * @param id The ID of the system to check
   * @returns True if the system exists, false otherwise
   */
  hasSystem(id: string): boolean {
    return this.systems.has(id);
  }

  /**
   * Get all registered processes
   * @returns An array of all registered processes
   */
  getAllProcesses(): [string, any][] {
    return Array.from(this.processes.entries());
  }

  /**
   * Get all registered tasks
   * @returns An array of all registered tasks
   */
  getAllTasks(): [string, any][] {
    return Array.from(this.tasks.entries());
  }

  /**
   * Get all registered systems
   * @returns An array of all registered systems
   */
  getAllSystems(): [string, any][] {
    return Array.from(this.systems.entries());
  }

  /**
   * Clear the registry
   */
  clear(): void {
    this.processes.clear();
    this.tasks.clear();
    this.systems.clear();
  }
}

/**
 * Get the DSL registry
 * @returns The DSL registry
 */
export function getRegistry(): DSLRegistry {
  return DSLRegistry.getInstance();
}

/**
 * Register a process
 * @param id The ID of the process
 * @param process The process to register
 */
export function registerProcess(id: string, process: any): void {
  getRegistry().registerProcess(id, process);
}

/**
 * Register a task
 * @param id The ID of the task
 * @param task The task to register
 */
export function registerTask(id: string, task: any): void {
  getRegistry().registerTask(id, task);
}

/**
 * Register a system
 * @param id The ID of the system
 * @param system The system to register
 */
export function registerSystem(id: string, system: any): void {
  getRegistry().registerSystem(id, system);
}

/**
 * Get a process by ID
 * @param id The ID of the process to get
 * @returns The process, or undefined if not found
 */
export function getProcess(id: string): any | undefined {
  return getRegistry().getProcess(id);
}

/**
 * Get a task by ID
 * @param id The ID of the task to get
 * @returns The task, or undefined if not found
 */
export function getTask(id: string): any | undefined {
  return getRegistry().getTask(id);
}

/**
 * Get a system by ID
 * @param id The ID of the system to get
 * @returns The system, or undefined if not found
 */
export function getSystem(id: string): any | undefined {
  return getRegistry().getSystem(id);
} 