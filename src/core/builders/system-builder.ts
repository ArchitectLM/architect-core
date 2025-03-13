/**
 * System Builder - Fluent API for defining systems
 */
import { SystemConfig, ProcessDefinition, TaskDefinition, Extension, ObservabilityConfig, TestDefinition } from '../types';

/**
 * Builder class for creating system configurations with a fluent interface
 */
export class SystemBuilder {
  private config: Partial<SystemConfig> = {
    processes: {},
    tasks: {},
    tests: []
  };

  /**
   * Create a new system with the given ID
   * @example
   * const ecommerceSystem = System.create('ecommerce')
   *   .withDescription('E-commerce system for order processing')
   *   .addProcess(orderProcess)
   *   .addTask(processOrderTask);
   */
  static create(id: string): SystemBuilder {
    const builder = new SystemBuilder();
    builder.config.id = id;
    return builder;
  }

  /**
   * Add a description to help understand the system purpose
   * @example
   * .withDescription('E-commerce system for order processing')
   */
  withDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  /**
   * Set the system name
   * @example
   * .withName('E-Commerce System')
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Add a process to the system
   * @example
   * .addProcess(orderProcess)
   */
  addProcess(process: ProcessDefinition): this {
    if (!this.config.processes) {
      this.config.processes = {};
    }
    this.config.processes[process.id] = process;
    return this;
  }

  /**
   * Add multiple processes to the system
   * @example
   * .addProcesses([orderProcess, paymentProcess, shipmentProcess])
   */
  addProcesses(processes: ProcessDefinition[]): this {
    for (const process of processes) {
      this.addProcess(process);
    }
    return this;
  }

  /**
   * Add a task to the system
   * @example
   * .addTask(processOrderTask)
   */
  addTask(task: TaskDefinition): this {
    if (!this.config.tasks) {
      this.config.tasks = {};
    }
    this.config.tasks[task.id] = task;
    return this;
  }

  /**
   * Add multiple tasks to the system
   * @example
   * .addTasks([processOrderTask, sendEmailTask, updateInventoryTask])
   */
  addTasks(tasks: TaskDefinition[]): this {
    for (const task of tasks) {
      this.addTask(task);
    }
    return this;
  }

  /**
   * Add a test to the system
   * @example
   * .addTest(orderProcessingTest)
   */
  addTest(test: TestDefinition): this {
    if (!this.config.tests) {
      this.config.tests = [];
    }
    this.config.tests.push(test);
    return this;
  }

  /**
   * Add multiple tests to the system
   * @example
   * .addTests([orderProcessingTest, paymentProcessingTest])
   */
  addTests(tests: TestDefinition[]): this {
    if (!this.config.tests) {
      this.config.tests = [];
    }
    this.config.tests.push(...tests);
    return this;
  }

  /**
   * Add an extension to the system
   * @example
   * .withExtension(new LoggingExtension())
   */
  withExtension(extension: Extension): this {
    if (!this.config.extensions) {
      this.config.extensions = {};
    }
    this.config.extensions[extension.name] = extension;
    return this;
  }

  /**
   * Configure observability for the system
   * @example
   * .withObservability({
   *   metrics: true,
   *   tracing: {
   *     provider: 'opentelemetry',
   *     exporters: ['jaeger']
   *   },
   *   logging: {
   *     level: 'info',
   *     format: 'json'
   *   }
   * })
   */
  withObservability(config: ObservabilityConfig): this {
    this.config.observability = config;
    return this;
  }

  /**
   * Add metadata to the system
   * @example
   * .withMetadata({
   *   version: '1.0.0',
   *   owner: 'platform-team',
   *   tags: ['core', 'critical']
   * })
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.config.metadata = {
      ...this.config.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Builds the complete system configuration
   */
  build(): SystemConfig {
    // Validate the configuration before returning
    if (!this.config.id) {
      throw new Error('System ID is required');
    }

    return this.config as SystemConfig;
  }
}

/**
 * System factory for creating system configurations
 */
export const System = {
  create: SystemBuilder.create
}; 