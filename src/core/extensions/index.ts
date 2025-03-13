/**
 * Extensions for ArchitectLM
 * 
 * This file exports all the extension interfaces and mock implementations.
 */

// Export extension interfaces (except ExtensionConfig which is already exported from types.ts)
export {
  SagaCoordinator, SagaDefinition, SagaInstance, SagaStatus, SagaStepStatus, SagaEventType, SagaEvent,
  Scheduler, ScheduledTaskConfig, RecurringTaskConfig, ScheduledTask, ScheduledTaskStatus, ScheduledTaskFilter,
  Supervisor, ProcessSupervisionConfig, TaskSupervisionConfig, SupervisionStatus, SupervisionStatusType, SupervisionEventType, SupervisionEvent,
  LoadManager, ResourceConfig, ResourceStatus, CircuitStatus, LoadEventType, LoadEvent, ResourceType
} from './types';

// Export mock implementations
export * from './mocks';

// Export extension factory functions
export const createSagaCoordinator = () => {
  const { MockSagaCoordinator } = require('./mocks');
  return new MockSagaCoordinator();
};

export const createScheduler = () => {
  const { MockScheduler } = require('./mocks');
  return new MockScheduler();
};

export const createSupervisor = () => {
  const { MockSupervisor } = require('./mocks');
  return new MockSupervisor();
};

export const createLoadManager = () => {
  const { MockLoadManager } = require('./mocks');
  return new MockLoadManager();
};

// Export a function to create all extensions
export const createExtensions = () => {
  return {
    sagaCoordinator: createSagaCoordinator(),
    scheduler: createScheduler(),
    supervisor: createSupervisor(),
    loadManager: createLoadManager()
  };
}; 