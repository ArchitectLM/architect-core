/**
 * Runtime model definitions
 */

export interface RuntimeOptions {
  logger?: {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };
}

export interface ProcessDefinition {
  id: string;
  name: string;
  description?: string;
  initialState: string;
  transitions: Array<{
    from: string;
    to: string;
    on: string;
  }>;
  tasks: any[];
}

export interface ProcessInstance {
  id: string;
  definitionId: string;
  currentState: string;
  data: any;
  history: Array<{
    state: string;
    timestamp: number;
    transition?: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface Event {
  type: string;
  payload?: any;
  timestamp: number;
}

export interface TaskDefinition {
  id: string;
  handler: (context: any) => Promise<any>;
  dependencies?: string[];
  maxRetries?: number;
  retryDelay?: number;
} 