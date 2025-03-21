/**
 * Extensions for ArchitectLM
 * 
 * This file exports all the extension interfaces and mock implementations.
 */

// Import ServiceIntegration
import { ServiceIntegration } from './service-integration';

// Export extension interfaces from interfaces.ts
export {
  Extension,
  ServiceRegistry,
  ArchitectAgent,
  ProcessSpec,
  TaskSpec,
  SystemSpec,
  SystemFeedback,
  SystemFixes,
  DatabaseSchemaSpec,
  DatabaseSchemaDefinition,
  APIEndpointSpec,
  APIEndpointDefinition,
  UIComponentSpec,
  UIComponentDefinition
} from './interfaces';

// Export extension interfaces (except ExtensionConfig which is already exported from types.ts)
export {
  SagaCoordinator, SagaDefinition, SagaInstance, SagaStatus, SagaStepStatus, SagaEventType, SagaEvent,
  Scheduler, ScheduledTaskConfig, RecurringTaskConfig, ScheduledTask, ScheduledTaskStatus, ScheduledTaskFilter,
  Supervisor, ProcessSupervisionConfig, TaskSupervisionConfig, SupervisionStatus, SupervisionStatusType, SupervisionEventType, SupervisionEvent,
  LoadManager, ResourceConfig, ResourceStatus, CircuitStatus, LoadEventType, LoadEvent, ResourceType,
  ServiceIntegrationExtension, ServiceConfig, Service, ServiceType, ServiceOperation, WebhookHandlerConfig, WebhookHandler, WebhookEvent, RetryPolicy,
  CircuitBreaker, CircuitBreakerOptions, CircuitBreakerState
} from './types';

// Export agent extensions
export { AgentExtension, AgentConfig, createAgent } from './agent';
export { RAGAgentExtension, RAGAgentConfig, createRAGAgent } from './rag-agent';
export { RAGAgentEditorExtension, EditPlan, EditDSLOptions, createRAGAgentEditor } from './rag-agent-editor';
export { EnhancedRAGAgentEditorExtension, createEnhancedRAGAgentEditor } from './rag-agent-editor-enhanced';
export { ServiceIntegration } from './service-integration';

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

export const createServiceIntegration = (config = {}) => {
  return new ServiceIntegration(config);
};

// Configuration type for createExtensions
interface ExtensionsConfig {
  agent?: Record<string, unknown>;
  ragAgent?: Record<string, unknown>;
  ragAgentEditor?: Record<string, unknown>;
  enhancedRagAgentEditor?: Record<string, unknown>;
  serviceIntegration?: Record<string, unknown>;
}

// Export a function to create all extensions
export const createExtensions = (config: ExtensionsConfig = {}) => {
  const { createAgent } = require('./agent');
  const { createRAGAgent } = require('./rag-agent');
  const { createRAGAgentEditor } = require('./rag-agent-editor');
  const { createEnhancedRAGAgentEditor } = require('./rag-agent-editor-enhanced');
  
  return {
    sagaCoordinator: createSagaCoordinator(),
    scheduler: createScheduler(),
    supervisor: createSupervisor(),
    loadManager: createLoadManager(),
    agent: config.agent ? createAgent(config.agent) : undefined,
    ragAgent: config.ragAgent ? createRAGAgent(config.ragAgent) : undefined,
    ragAgentEditor: config.ragAgentEditor ? createRAGAgentEditor(config.ragAgentEditor) : undefined,
    enhancedRagAgentEditor: config.enhancedRagAgentEditor ? createEnhancedRAGAgentEditor(config.enhancedRagAgentEditor) : undefined,
    serviceIntegration: config.serviceIntegration ? new ServiceIntegration(config.serviceIntegration) : undefined
  };
}; 