/**
 * Meta-Framework7: Core Schema Types
 * 
 * This file defines the TypeScript interfaces for the reactive system schema.
 */

// Core system types
export interface ReactiveSystem {
    id: string;
    name: string;
    description?: string;
    version: string;
    schemaVersion?: string;
    migrationHistory?: Array<{
      fromVersion: string;
      toVersion: string;
      timestamp: string;
      description?: string;
    }>;
    boundedContexts?: Record<string, BoundedContext>;
    processes?: Record<string, Process>;
    tasks?: Record<string, Task>;
    flows?: Record<string, Flow>;
    policies?: Record<string, Policy>;
    tags?: Tag[];
    metadata?: Record<string, unknown>;
  }
  
  export interface BoundedContext {
    id: string;
    name: string;
    description: string;
    processes: string[];
    responsibilities?: string[];
    dependencies?: string[];
    tags?: Tag[];
    metadata?: Record<string, unknown>;
  }
  
  export interface Process {
    id: string;
    name: string;
    description?: string;
    contextId: string;
    type: "stateful" | "stateless";
    triggers: Trigger[];
    tasks: string[];
    states?: string[];
    transitions?: Transition[];
    errorHandlers?: ErrorHandler[];
    tags?: Tag[];
    examples?: ProcessExample[];
    metadata?: Record<string, unknown>;
  }
  
  export interface Trigger {
    type: "user_event" | "api_call" | "system_event" | "schedule";
    name: string;
    description?: string;
    payload?: string[];
    contextProperties?: string[];
    url?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    schedule?: string;
  }
  
  export interface Transition {
    from: string;
    to: string;
    on: string;
    description?: string;
    actions?: string[];
  }
  
  export interface ErrorHandler {
    error: string;
    handler: string;
    description?: string;
    retry?: {
      maxAttempts: number;
      backoffStrategy?: "fixed" | "exponential";
      interval?: number;
    };
  }
  
  export interface Task {
    id: string;
    type: "operation" | "condition" | "transformation" | "notification" | "external_call" | "state_transition";
    label?: string;
    description?: string;
    input?: string | string[];
    output?: string | string[];
    url?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    message?: string;
    implementation?: {
      type: "function" | "external_service" | "mock";
      code?: string;
      service?: string;
      endpoint?: string;
    };
    tags?: Tag[];
    examples?: TestExample[];
    metadata?: Record<string, unknown>;
  }
  
  export interface Flow {
    id: string;
    name: string;
    description?: string;
    trigger: string;
    steps: FlowStep[];
    tags?: Tag[];
  }
  
  export interface FlowStep {
    id: string;
    name?: string;
    description?: string;
    type: "process" | "task" | "decision" | "parallel" | "wait";
    processId?: string;
    taskId?: string;
    condition?: string;
    branches?: FlowBranch[];
    timeout?: number;
    next?: string | ConditionalNext[];
  }
  
  export interface ConditionalNext {
    condition: string;
    stepId: string;
  }
  
  export interface FlowBranch {
    id: string;
    name?: string;
    steps: string[];
  }
  
  export interface Policy {
    id: string;
    name: string;
    description?: string;
    type: "access" | "rate-limiting" | "data-retention" | "workflow";
    condition: string;
    effect: "allow" | "deny" | "throttle" | "transform" | "audit";
    parameters?: Record<string, any>;
  }
  
  export interface Tag {
    key: string;
    value: string;
    scope: "system" | "context" | "process" | "task" | "data";
  }
  
  export interface TestExample {
    description: string;
    input: Record<string, any>;
    expectedOutput: Record<string, any>;
    tags?: string[];
  }
  
  export interface ProcessExample {
    description: string;
    initialState?: string;
    steps: {
      trigger?: string;
      task?: string;
      input?: Record<string, any>;
      expectedState?: string;
    }[];
    expectedFinalState?: string;
    tags?: string[];
  }