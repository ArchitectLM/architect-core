/**
 * Runtime implementation for ArchitectLM
 */
import { ReactiveEventBus } from './event-bus';
import { 
  Runtime, 
  ProcessInstance, 
  ProcessDefinition, 
  TaskDefinition,
  Event, 
  EventHandler, 
  Subscription,
  ProcessOptions,
  TaskOptions,
  TestDefinition,
  TestOptions,
  TestResult,
  TestSuite,
  TestSuiteResult,
  TaskImplementation,
  TaskContext
} from './types';
import { v4 as uuidv4 } from 'uuid';

interface RuntimeOptions {
  onProcessCreated?: (instance: ProcessInstance) => void;
  taskMiddleware?: {
    before?: (taskId: string, input: any, context: TaskContext) => void;
    after?: (taskId: string, input: any, result: any, context: TaskContext) => void;
  };
  storage?: {
    saveState: (instances: ProcessInstance[]) => void;
    loadState: () => ProcessInstance[];
  };
}

/**
 * Create a runtime for a reactive system
 */
export class ReactiveRuntime implements Runtime {
  private eventBus: ReactiveEventBus;
  private processes: Record<string, ProcessDefinition>;
  private tasks: Record<string, TaskDefinition>;
  private instances: Map<string, ProcessInstance> = new Map();
  private mocks: Record<string, Record<string, Function>>;
  
  constructor(
    processes: Record<string, ProcessDefinition>,
    tasks: Record<string, TaskDefinition>,
    mocks: Record<string, Record<string, Function>> = {}
  ) {
    this.eventBus = new ReactiveEventBus();
    this.processes = processes;
    this.tasks = tasks;
    this.mocks = mocks;
    
    // Subscribe to events for process transitions
    this.eventBus.subscribe('*', this.handleEvent.bind(this));
  }
  
  /**
   * Handle an event and check for process transitions
   */
  private async handleEvent(event: Event): Promise<void> {
    // Check all process instances for possible transitions
    for (const [instanceId, instance] of this.instances.entries()) {
      const processDefinition = this.processes[instance.processId];
      if (!processDefinition) continue;
      
      // Find transitions that match the current state and event
      const matchingTransitions = processDefinition.transitions.filter(transition => {
        // Check if the transition is triggered by this event
        if (transition.on !== event.type) return false;
        
        // Check if the current state matches the transition's from state
        if (Array.isArray(transition.from)) {
          return transition.from.includes(instance.state) || transition.from.includes('*');
        } else {
          return transition.from === instance.state || transition.from === '*';
        }
      });
      
      // Apply the first matching transition
      if (matchingTransitions.length > 0) {
        const transition = matchingTransitions[0];
        
        // Check guard condition if present
        if (transition.guard) {
          const guardResult = await transition.guard(instance.context, event);
          if (!guardResult) continue;
        }
        
        // Update the instance state
        const updatedInstance: ProcessInstance = {
          ...instance,
          state: transition.to,
          updatedAt: new Date()
        };
        
        // Update context with event payload if available
        if (event.payload) {
          updatedInstance.context = {
            ...updatedInstance.context,
            ...event.payload
          };
        }
        
        // Save the updated instance
        this.instances.set(instanceId, updatedInstance);
        
        // Emit a state change event
        this.eventBus.emit({
          type: 'STATE_CHANGED',
          payload: {
            instanceId,
            processId: instance.processId,
            previousState: instance.state,
            newState: updatedInstance.state
          }
        });
      }
    }
  }
  
  /**
   * Create a new process instance
   */
  createProcess(processId: string, input: any, options?: ProcessOptions): ProcessInstance {
    const processDefinition = this.processes[processId];
    if (!processDefinition) {
      throw new Error(`Process definition not found: ${processId}`);
    }
    
    const instanceId = options?.instanceId || `${processId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const initialState = options?.initialState || processDefinition.initialState || processDefinition.states[0];
    
    const instance: ProcessInstance = {
      id: instanceId,
      processId,
      state: initialState,
      context: { ...input, ...(options?.context || {}) },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.instances.set(instanceId, instance);
    
    // Emit process created event
    this.eventBus.emit({
      type: 'PROCESS_CREATED',
      payload: {
        instanceId,
        processId,
        initialState,
        context: instance.context
      }
    });
    
    return instance;
  }
  
  /**
   * Get a process instance by ID
   */
  getProcess(instanceId: string): ProcessInstance | undefined {
    return this.instances.get(instanceId);
  }
  
  /**
   * Transition a process to a new state based on an event
   */
  transitionProcess(instanceId: string, event: string, data?: any): ProcessInstance {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Process instance not found: ${instanceId}`);
    }
    
    // Emit the event to trigger the transition
    this.eventBus.emit({
      type: event,
      payload: data,
      source: `process:${instance.processId}`
    });
    
    // Get the updated instance
    const updatedInstance = this.instances.get(instanceId);
    if (!updatedInstance) {
      throw new Error(`Process instance not found after transition: ${instanceId}`);
    }
    
    return updatedInstance;
  }
  
  /**
   * Execute a task
   */
  async executeTask(taskId: string, input: any, options?: TaskOptions): Promise<any> {
    const taskDefinition = this.tasks[taskId];
    if (!taskDefinition) {
      throw new Error(`Task definition not found: ${taskId}`);
    }
    
    // Create a task context
    const context: TaskContext = {
      getService: (name: string) => {
        // Return mock if available
        if (this.mocks[name]) {
          return this.mocks[name];
        }
        return {}; // Default empty service
      },
      emitEvent: (type: string, payload?: any) => {
        this.emitEvent(type, payload);
      },
      executeTask: (nestedTaskId: string, nestedInput: any) => {
        return this.executeTask(nestedTaskId, nestedInput);
      },
      getContext: () => ({}), // Default empty context
      updateContext: async () => {} // No-op for now
    };
    
    try {
      // Emit task started event
      this.eventBus.emit({
        type: 'TASK_STARTED',
        payload: {
          taskId,
          input
        }
      });
      
      // Execute the task
      const result = await taskDefinition.implementation(input, context);
      
      // Emit task completed event
      this.eventBus.emit({
        type: 'TASK_COMPLETED',
        payload: {
          taskId,
          input,
          result
        }
      });
      
      return result;
    } catch (error) {
      // Emit task failed event
      this.eventBus.emit({
        type: 'TASK_FAILED',
        payload: {
          taskId,
          input,
          error
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Emit an event
   */
  emitEvent(event: Event | string, payload?: any): void {
    if (typeof event === 'string') {
      this.eventBus.emit({
        type: event,
        payload
      });
    } else {
      this.eventBus.emit(event);
    }
  }
  
  /**
   * Subscribe to events
   */
  subscribeToEvent(type: string, handler: EventHandler): Subscription {
    return this.eventBus.subscribe(type, handler);
  }
  
  /**
   * Run a test
   */
  async runTest(test: TestDefinition, options?: TestOptions): Promise<TestResult> {
    throw new Error('Not implemented');
  }
  
  /**
   * Run a test suite
   */
  async runTestSuite(suite: TestSuite, options?: TestOptions): Promise<TestSuiteResult> {
    throw new Error('Not implemented');
  }
  
  /**
   * Get a task implementation by ID
   */
  getTaskImplementation(taskId: string): TaskImplementation | undefined {
    return this.tasks[taskId]?.implementation;
  }
  
  /**
   * Get a process definition by ID
   */
  getProcessDefinition(processId: string): ProcessDefinition | undefined {
    return this.processes[processId];
  }
}

/**
 * Create a runtime for a reactive system
 */
export function createRuntime(
  processes: Record<string, ProcessDefinition>,
  tasks: Record<string, TaskDefinition>,
  options?: RuntimeOptions
): Runtime & {
  getAllProcesses: () => ProcessInstance[];
  getProcessesByType: (processId: string) => ProcessInstance[];
  getProcessesByState: (state: string) => ProcessInstance[];
  getAvailableTasks: () => string[];
  getAvailableProcesses: () => string[];
} {
  // Store process instances
  let instances: ProcessInstance[] = options?.storage?.loadState() || [];
  
  // Store event subscriptions
  const subscriptions: Record<string, EventHandler[]> = {};
  
  // Helper to save state if storage is configured
  const saveState = () => {
    if (options?.storage?.saveState) {
      options.storage.saveState([...instances]);
    }
  };
  
  // The runtime implementation
  const runtime = {
    createProcess: (processId: string, input: any, processOptions?: ProcessOptions): ProcessInstance => {
      const processDefinition = processes[processId];
      if (!processDefinition) {
        throw new Error(`Process not found: ${processId}`);
      }
      
      const initialState = processOptions?.initialState || processDefinition.initialState || processDefinition.states[0];
      
      const instance: ProcessInstance = {
        id: processOptions?.instanceId || uuidv4(),
        processId,
        state: initialState,
        context: input,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      instances.push(instance);
      
      // Emit process created event
      runtime.emitEvent('PROCESS_CREATED', {
        instanceId: instance.id,
        processId,
        state: initialState,
        context: input
      });
      
      // Call custom handler if provided
      if (options?.onProcessCreated) {
        options.onProcessCreated(instance);
      }
      
      saveState();
      
      return instance;
    },
    
    getProcess: (instanceId: string): ProcessInstance | undefined => {
      return instances.find(instance => instance.id === instanceId);
    },
    
    transitionProcess: (instanceId: string, eventType: string, data: any = {}): ProcessInstance => {
      const instance = runtime.getProcess(instanceId);
      if (!instance) {
        throw new Error(`Process instance not found: ${instanceId}`);
      }
      
      const processDefinition = processes[instance.processId];
      if (!processDefinition) {
        throw new Error(`Process definition not found: ${instance.processId}`);
      }
      
      // Find a matching transition
      const transition = processDefinition.transitions.find(t => 
        (t.from === instance.state || t.from === '*') && t.on === eventType
      );
      
      if (!transition) {
        // No matching transition, return the instance unchanged
        return instance;
      }
      
      // Update the instance
      const previousState = instance.state;
      instance.state = transition.to;
      instance.context = { ...instance.context, ...data };
      instance.updatedAt = new Date();
      
      // Emit state changed event
      runtime.emitEvent('STATE_CHANGED', {
        instanceId,
        processId: instance.processId,
        previousState,
        newState: instance.state,
        context: instance.context
      });
      
      saveState();
      
      return instance;
    },
    
    executeTask: async (taskId: string, input: any = {}, taskOptions?: TaskOptions): Promise<any> => {
      const taskDefinition = tasks[taskId];
      if (!taskDefinition) {
        throw new Error(`Task not found: ${taskId}`);
      }
      
      // Create a task context
      const context: TaskContext = {
        emitEvent: (eventType: string | Event, payload?: any) => {
          return runtime.emitEvent(eventType, payload);
        },
        executeTask: async (taskId: string, input: any) => {
          return runtime.executeTask(taskId, input);
        },
        getProcess: (instanceId: string) => {
          return runtime.getProcess(instanceId);
        }
      };
      
      // Emit task started event
      runtime.emitEvent('TASK_STARTED', {
        taskId,
        input
      });
      
      // Call before middleware if provided
      if (options?.taskMiddleware?.before) {
        options.taskMiddleware.before(taskId, input, context);
      }
      
      try {
        // Execute the task
        const result = await taskDefinition.implementation(input, context);
        
        // Emit task completed event
        runtime.emitEvent('TASK_COMPLETED', {
          taskId,
          input,
          result
        });
        
        // Call after middleware if provided
        if (options?.taskMiddleware?.after) {
          options.taskMiddleware.after(taskId, input, result, context);
        }
        
        return result;
      } catch (error) {
        // Emit task failed event
        runtime.emitEvent('TASK_FAILED', {
          taskId,
          input,
          error
        });
        
        throw error;
      }
    },
    
    emitEvent: (typeOrEvent: string | Event, payload?: any): Event => {
      const event: Event = typeof typeOrEvent === 'string'
        ? {
            id: uuidv4(),
            type: typeOrEvent,
            payload: payload || {},
            timestamp: Date.now()
          }
        : typeOrEvent;
      
      // Get handlers for this event type
      const handlers = [
        ...(subscriptions[event.type] || []),
        ...(subscriptions['*'] || [])
      ];
      
      // Call all handlers
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          // Emit system error event
          const systemErrorEvent: Event = {
            id: uuidv4(),
            type: 'SYSTEM_ERROR',
            payload: {
              error,
              source: 'event_handler',
              originalEvent: event
            },
            timestamp: Date.now()
          };
          
          // Call system error handlers
          (subscriptions['SYSTEM_ERROR'] || []).forEach(errorHandler => {
            try {
              errorHandler(systemErrorEvent);
            } catch (e) {
              // Ignore errors in system error handlers
              console.error('Error in system error handler:', e);
            }
          });
        }
      });
      
      // Check if this event should trigger any process transitions
      instances.forEach(instance => {
        const processDefinition = processes[instance.processId];
        if (!processDefinition) return;
        
        // Check if this event matches any transitions for this instance
        const transition = processDefinition.transitions.find(t => 
          (t.from === instance.state || t.from === '*') && t.on === event.type
        );
        
        if (transition) {
          // Transition the process
          runtime.transitionProcess(instance.id, event.type, event.payload);
        }
      });
      
      return event;
    },
    
    subscribeToEvent: (type: string, handler: EventHandler): Subscription => {
      if (!subscriptions[type]) {
        subscriptions[type] = [];
      }
      
      subscriptions[type].push(handler);
      
      return {
        unsubscribe: () => {
          subscriptions[type] = subscriptions[type].filter(h => h !== handler);
        }
      };
    },
    
    // Additional methods for testing and introspection
    getAllProcesses: (): ProcessInstance[] => {
      return [...instances];
    },
    
    getProcessesByType: (processId: string): ProcessInstance[] => {
      return instances.filter(instance => instance.processId === processId);
    },
    
    getProcessesByState: (state: string): ProcessInstance[] => {
      return instances.filter(instance => instance.state === state);
    },
    
    getAvailableTasks: (): string[] => {
      return Object.keys(tasks);
    },
    
    getAvailableProcesses: (): string[] => {
      return Object.keys(processes);
    }
  };
  
  return runtime;
} 