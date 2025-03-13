import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createRuntime } from '../runtime';
import { defineProcess } from '../process';
import { defineTask } from '../task';
import { defineSystem } from '../system';
import { 
  MockSagaCoordinator, 
  MockScheduler, 
  MockSupervisor, 
  MockLoadManager 
} from './mocks';
import { 
  SagaEventType, 
  SagaStatus, 
  ScheduledTaskStatus, 
  SupervisionEventType, 
  SupervisionStatusType,
  LoadEventType,
  CircuitStatus,
  ResourceType
} from './types';

describe('Extensions Integration', () => {
  describe('Saga Coordinator Extension', () => {
    it('should integrate with the core system', async () => {
      // Create a mock saga coordinator
      const sagaCoordinator = new MockSagaCoordinator();
      
      // Define a saga
      const sagaDefinition = sagaCoordinator.defineSaga({
        id: 'order-saga',
        name: 'Order Processing Saga',
        description: 'Coordinates the order processing workflow',
        steps: [
          { id: 'validate-order', name: 'Validate Order' },
          { id: 'process-payment', name: 'Process Payment' },
          { id: 'update-inventory', name: 'Update Inventory' },
          { id: 'ship-order', name: 'Ship Order' }
        ]
      });
      
      // Create a task that uses the saga coordinator
      const processOrderTask = defineTask({
        id: 'process-order',
        name: 'Process Order',
        implementation: async (input, context) => {
          const { sagaCoordinator } = context.services;
          
          // Start a saga instance
          const sagaInstance = await sagaCoordinator.startSaga('order-saga', input);
          
          return {
            sagaInstanceId: sagaInstance.id,
            status: 'saga-started'
          };
        }
      });
      
      // Create a process that uses the task
      const orderProcess = defineProcess({
        id: 'order-process',
        name: 'Order Process',
        initialState: 'new',
        states: {
          new: {
            transitions: {
              processing: {
                target: 'processing',
                action: 'process-order'
              }
            }
          },
          processing: {
            transitions: {
              completed: {
                target: 'completed'
              }
            }
          },
          completed: {
            type: 'final'
          }
        }
      });
      
      // Create a system with the process and task
      const system = defineSystem({
        id: 'order-system',
        name: 'Order System',
        processes: [orderProcess],
        tasks: [processOrderTask]
      });
      
      // Create a runtime with the saga coordinator as a service
      const runtime = createRuntime({
        system,
        services: {
          sagaCoordinator
        }
      });
      
      // Create a process instance
      const processInstance = await runtime.createProcessInstance('order-process', {
        orderId: uuidv4(),
        items: [{ id: 'item-1', quantity: 2 }],
        customer: { id: 'customer-1' }
      });
      
      // Transition the process to start the saga
      await runtime.transitionProcess(processInstance.id, 'processing');
      
      // Wait for the saga to start (in a real scenario, we would use events)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get all saga instances
      let sagaInstances = Array.from(sagaCoordinator['instances'].values());
      expect(sagaInstances.length).toBeGreaterThan(0);
      
      // Manually complete the saga
      await sagaCoordinator.completeSaga(sagaInstances[0].id);
      
      // Get updated saga instances
      sagaInstances = Array.from(sagaCoordinator['instances'].values());
      
      // Verify that a saga instance was created and completed
      expect(sagaInstances.length).toBeGreaterThan(0);
      expect(sagaInstances[0].sagaId).toBe('order-saga');
      expect(sagaInstances[0].status).toBe(SagaStatus.COMPLETED);
    });
  });
  
  describe('Scheduler Extension', () => {
    it('should schedule tasks for future execution', async () => {
      // Create a mock scheduler
      const scheduler = new MockScheduler();
      
      // Create a task
      const sendReminderTask = defineTask({
        id: 'send-reminder',
        name: 'Send Reminder',
        implementation: async (input, context) => {
          // Use input directly as a parameter
          return {
            sent: true,
            to: input.email,
            message: input.message
          };
        }
      });
      
      // Create a process
      const reminderProcess = defineProcess({
        id: 'reminder-process',
        name: 'Reminder Process',
        initialState: 'pending',
        states: {
          pending: {
            transitions: {
              scheduled: {
                target: 'scheduled'
              }
            }
          },
          scheduled: {
            transitions: {
              sent: {
                target: 'sent',
                action: 'send-reminder'
              }
            }
          },
          sent: {
            type: 'final'
          }
        }
      });
      
      // Create a task that uses the scheduler
      const scheduleReminderTask = defineTask({
        id: 'schedule-reminder',
        implementation: async (input, context) => {
          const { scheduler } = context.services;
          
          // Schedule a task for future execution
          const scheduledTaskId = await scheduler.scheduleTask({
            taskId: 'send-reminder',
            input: {
              email: input.email,
              message: 'Your reminder is due!'
            },
            executeAt: new Date(Date.now() + 60000), // 1 minute from now
            description: 'Send reminder email'
          });
          
          return {
            scheduledTaskId,
            status: 'scheduled'
          };
        }
      });
      
      // Create a system with the task
      const system = defineSystem({
        id: 'reminder-system',
        name: 'Reminder System',
        processes: [reminderProcess],
        tasks: [scheduleReminderTask, sendReminderTask]
      });
      
      // Create a runtime with the scheduler as a service
      const runtime = createRuntime({
        system,
        services: {
          scheduler
        }
      });
      
      // Create a process instance
      const processInstance = await runtime.createProcessInstance('reminder-process', {
        email: 'user@example.com'
      });
      
      // Transition to scheduled state
      await runtime.transitionProcess(processInstance.id, 'scheduled');
      
      // Execute the schedule-reminder task
      const result = await runtime.executeTask('schedule-reminder', {
        email: 'user@example.com'
      });
      
      // Verify that a task was scheduled
      expect(result.scheduledTaskId).toBeDefined();
      
      // Get the scheduled task
      const scheduledTask = await scheduler.getTask(result.scheduledTaskId);
      
      // Verify the scheduled task properties
      expect(scheduledTask).toBeDefined();
      expect(scheduledTask?.taskId).toBe('send-reminder');
      expect(scheduledTask?.status).toBe(ScheduledTaskStatus.SCHEDULED);
      expect(scheduledTask?.input).toEqual({
        email: 'user@example.com',
        message: 'Your reminder is due!'
      });
    });
  });
  
  describe('Supervisor Extension', () => {
    it('should monitor and recover processes', async () => {
      // Create a mock supervisor
      const supervisor = new MockSupervisor();
      
      // Create a task that might fail
      const processPaymentTask = defineTask({
        id: 'process-payment',
        name: 'Process Payment',
        implementation: async (input, context) => {
          // Use input directly as a parameter
          
          // Simulate success
          return {
            success: true,
            transactionId: uuidv4()
          };
        }
      });
      
      // Create a process
      const paymentProcess = defineProcess({
        id: 'payment-process',
        name: 'Payment Process',
        initialState: 'new',
        states: {
          new: {
            transitions: {
              processing: {
                target: 'processing',
                action: 'process-payment'
              }
            }
          },
          processing: {
            transitions: {
              completed: {
                target: 'completed'
              },
              failed: {
                target: 'failed'
              }
            }
          },
          completed: {
            type: 'final'
          },
          failed: {
            type: 'final'
          }
        }
      });
      
      // Create a system
      const system = defineSystem({
        id: 'payment-system',
        name: 'Payment System',
        processes: [paymentProcess],
        tasks: [processPaymentTask]
      });
      
      // Create a runtime with the supervisor as a service
      const runtime = createRuntime({
        system,
        services: {
          supervisor
        }
      });
      
      // Configure supervision for the payment process
      supervisor.superviseProcess({
        processId: 'payment-process',
        maxRecoveryAttempts: 3,
        checkInterval: 1000, // Check every second
        recoveryStrategy: 'retry-last-action'
      });
      
      // Create a process instance
      const processInstance = await runtime.createProcessInstance('payment-process', {
        amount: 100,
        currency: 'USD',
        paymentMethod: 'credit-card'
      });
      
      // Transition to processing state
      await runtime.transitionProcess(processInstance.id, 'processing');
      
      // Mock event handler for supervision events
      const eventHandler = vi.fn();
      supervisor.onSupervisionEvent(SupervisionEventType.RECOVERY_STARTED, eventHandler);
      
      // Simulate an unhealthy process
      supervisor.simulateUnhealthyProcess(processInstance.id, 'payment-process');
      
      // Wait for the recovery to be triggered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify that the recovery was started
      expect(eventHandler).toHaveBeenCalled();
      
      // Get the supervision status
      const status = await supervisor.getProcessSupervisionStatus(processInstance.id);
      
      // Verify the supervision status
      expect(status).toBeDefined();
      expect(status?.targetId).toBe(processInstance.id);
      expect(status?.targetType).toBe('process');
      expect(status?.recoveryAttempts).toBeGreaterThan(0);
    });
  });
  
  describe('Load Manager Extension', () => {
    it('should manage system resources and circuit breaking', async () => {
      // Create a mock load manager
      const loadManager = new MockLoadManager();
      
      // Register a resource
      loadManager.registerResource({
        id: 'payment-api',
        type: ResourceType.API,
        capacity: 100,
        thresholds: {
          warning: 70,
          critical: 85,
          circuit: 95
        },
        resetTimeout: 5000 // 5 seconds
      });
      
      // Create a task that uses the load manager
      const processPaymentTask = defineTask({
        id: 'process-payment',
        name: 'Process Payment',
        implementation: async (input, context) => {
          const { services } = context;
          const { loadManager } = services;
          
          // Check if the payment API is available
          const isAvailable = await loadManager.isResourceAvailable('payment-api');
          if (!isAvailable) {
            return {
              success: false,
              error: 'Payment API is not available'
            };
          }
          
          // Acquire the resource
          const acquired = await loadManager.acquireResource('payment-api');
          if (!acquired) {
            return {
              success: false,
              error: 'Failed to acquire payment API resource'
            };
          }
          
          try {
            // Simulate payment processing
            // In a real implementation, this would call the payment API
            
            return {
              success: true,
              transactionId: uuidv4()
            };
          } finally {
            // Release the resource
            await loadManager.releaseResource('payment-api');
          }
        }
      });
      
      // Create a process
      const paymentProcess = defineProcess({
        id: 'payment-process',
        name: 'Payment Process',
        initialState: 'new',
        states: {
          new: {
            transitions: {
              processing: {
                target: 'processing',
                action: 'process-payment'
              }
            }
          },
          processing: {
            transitions: {
              completed: {
                target: 'completed'
              },
              failed: {
                target: 'failed'
              }
            }
          },
          completed: {
            type: 'final'
          },
          failed: {
            type: 'final'
          }
        }
      });
      
      // Create a system
      const system = defineSystem({
        id: 'payment-system',
        name: 'Payment System',
        processes: [paymentProcess],
        tasks: [processPaymentTask]
      });
      
      // Create a runtime with the load manager as a service
      const runtime = createRuntime({
        system,
        services: {
          loadManager
        }
      });
      
      // Mock event handler for load events
      const eventHandler = vi.fn();
      loadManager.onLoadEvent(LoadEventType.THRESHOLD_WARNING, eventHandler);
      
      // Create a process instance
      const processInstance = await runtime.createProcessInstance('payment-process', {
        amount: 100,
        currency: 'USD',
        paymentMethod: 'credit-card'
      });
      
      // Transition to processing state
      await runtime.transitionProcess(processInstance.id, 'processing');
      
      // Simulate high load by acquiring resources
      for (let i = 0; i < 75; i++) {
        await loadManager.acquireResource('payment-api');
      }
      
      // Get the resource status
      const status = await loadManager.getResourceStatus('payment-api');
      
      // Verify the resource status
      expect(status).toBeDefined();
      expect(status?.id).toBe('payment-api');
      expect(status?.type).toBe(ResourceType.API);
      expect(status?.usagePercentage).toBeGreaterThanOrEqual(70);
      expect(status?.status).toBe(CircuitStatus.WARNING);
      
      // Verify that the warning event was triggered
      expect(eventHandler).toHaveBeenCalled();
    });
  });
  
  describe('Combined Extensions', () => {
    it('should work together in an integrated system', async () => {
      // Create mock extensions
      const sagaCoordinator = new MockSagaCoordinator();
      const scheduler = new MockScheduler();
      const supervisor = new MockSupervisor();
      const loadManager = new MockLoadManager();
      
      // Register a resource
      loadManager.registerResource({
        id: 'order-api',
        type: ResourceType.API,
        capacity: 100,
        thresholds: {
          warning: 70,
          critical: 85,
          circuit: 95
        },
        resetTimeout: 5000
      });
      
      // Define a saga
      sagaCoordinator.defineSaga({
        id: 'order-saga',
        name: 'Order Processing Saga',
        description: 'Coordinates the order processing workflow',
        steps: [
          { id: 'validate-order', name: 'Validate Order' },
          { id: 'process-payment', name: 'Process Payment' },
          { id: 'update-inventory', name: 'Update Inventory' },
          { id: 'ship-order', name: 'Ship Order' }
        ]
      });
      
      // Create tasks
      const processOrderTask = defineTask({
        id: 'process-order',
        name: 'Process Order',
        implementation: async (input, context) => {
          const { sagaCoordinator } = context.services;
          
          // Check if the order API is available
          const isAvailable = await loadManager.isResourceAvailable('order-api');
          if (!isAvailable) {
            return {
              success: false,
              error: 'Order API is not available'
            };
          }
          
          // Acquire the resource
          const acquired = await loadManager.acquireResource('order-api');
          if (!acquired) {
            return {
              success: false,
              error: 'Failed to acquire order API resource'
            };
          }
          
          try {
            // Start a saga instance
            const sagaInstance = await sagaCoordinator.startSaga('order-saga', input);
            
            return {
              success: true,
              sagaInstanceId: sagaInstance.id
            };
          } finally {
            // Release the resource
            await loadManager.releaseResource('order-api');
          }
        }
      });
      
      const scheduleFollowUpTask = defineTask({
        id: 'schedule-follow-up',
        name: 'Schedule Follow-up',
        implementation: async (context) => {
          const { input, services } = context;
          const { scheduler } = services;
          
          // Schedule a follow-up task
          const scheduledTaskId = await scheduler.scheduleTask({
            taskId: 'send-follow-up',
            executeAt: new Date(Date.now() + 86400000), // 24 hours in the future
            input: {
              orderId: input.orderId,
              email: input.email
            },
            description: 'Send follow-up email for order'
          });
          
          return {
            success: true,
            scheduledTaskId
          };
        }
      });
      
      const sendFollowUpTask = defineTask({
        id: 'send-follow-up',
        name: 'Send Follow-up',
        implementation: async (context) => {
          const { input } = context;
          
          // Simulate sending an email
          return {
            success: true,
            sent: true,
            to: input.email,
            orderId: input.orderId
          };
        }
      });
      
      // Create a process
      const orderProcess = defineProcess({
        id: 'order-process',
        name: 'Order Process',
        initialState: 'new',
        states: {
          new: {
            transitions: {
              processing: {
                target: 'processing',
                action: 'process-order'
              }
            }
          },
          processing: {
            transitions: {
              completed: {
                target: 'completed',
                action: 'schedule-follow-up'
              },
              failed: {
                target: 'failed'
              }
            }
          },
          completed: {
            type: 'final'
          },
          failed: {
            type: 'final'
          }
        }
      });
      
      // Create a system
      const system = defineSystem({
        id: 'order-system',
        name: 'Order System',
        processes: [orderProcess],
        tasks: [processOrderTask, scheduleFollowUpTask, sendFollowUpTask]
      });
      
      // Create a runtime with all extensions as services
      const runtime = createRuntime({
        system,
        services: {
          sagaCoordinator,
          scheduler,
          supervisor,
          loadManager
        }
      });
      
      // Configure supervision for the order process
      supervisor.superviseProcess({
        processId: 'order-process',
        maxRecoveryAttempts: 3,
        checkInterval: 1000,
        recoveryStrategy: 'retry-last-action'
      });
      
      // Create a process instance
      const processInstance = await runtime.createProcessInstance('order-process', {
        orderId: uuidv4(),
        items: [{ id: 'item-1', quantity: 2 }],
        customer: { id: 'customer-1' },
        email: 'customer@example.com'
      });
      
      // Transition to processing state
      await runtime.transitionProcess(processInstance.id, 'processing');
      
      // Wait for the saga to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get saga instances
      let sagaInstances = Array.from(sagaCoordinator['instances'].values());
      expect(sagaInstances.length).toBeGreaterThan(0);
      
      // Manually complete the saga
      await sagaCoordinator.completeSaga(sagaInstances[0].id);
      
      // Transition to completed state
      await runtime.transitionProcess(processInstance.id, 'completed');
      
      // Get updated saga instances
      sagaInstances = Array.from(sagaCoordinator['instances'].values());
      
      // Verify that a saga instance was created and completed
      expect(sagaInstances.length).toBeGreaterThan(0);
      expect(sagaInstances[0].status).toBe(SagaStatus.COMPLETED);
      
      // Verify that a follow-up task was scheduled
      const scheduledTasks = await scheduler.getTasks();
      expect(scheduledTasks.length).toBeGreaterThan(0);
      expect(scheduledTasks[0].taskId).toBe('send-follow-up');
      
      // Verify that the resource was used and released
      const resourceStatus = await loadManager.getResourceStatus('order-api');
      expect(resourceStatus).toBeDefined();
      expect(resourceStatus?.used).toBe(0); // Should be released
    });
  });
}); 