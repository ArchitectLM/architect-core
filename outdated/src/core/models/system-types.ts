/**
 * System Types for ArchitectLM
 */
import { ProcessDefinition } from './process-types';
import { TaskDefinition } from './task-types';
import { TestDefinition } from './testing-types';
import { Plugin } from '../dsl/plugin';
import { Extension } from '../extensions/interfaces';

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  metrics?: boolean;                            // Whether to collect metrics
  tracing?: {
    provider: 'opentelemetry' | 'custom';       // Tracing provider
    exporters?: string[];                       // Tracing exporters
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error'; // Logging level
    format?: 'json' | 'text';                   // Logging format
  };
}

/**
 * System configuration
 */
export interface SystemConfig {
  id: string;                                     // Unique system identifier
  name?: string;                                  // System name
  description?: string;                           // System description
  processes: Record<string, ProcessDefinition>;   // Process definitions
  tasks: Record<string, TaskDefinition>;          // Task definitions
  tests?: TestDefinition[];                       // Test definitions
  extensions?: Record<string, Extension>;         // System extensions
  plugins?: Plugin[];                             // System plugins
  metadata?: Record<string, unknown>;             // Additional metadata
  
  // Observability configuration
  observability?: ObservabilityConfig;
  
  // LLM-specific metadata to help with generation and understanding
  llmMetadata?: {
    domain?: string;                              // Business domain
    purpose?: string;                             // System purpose
    stakeholders?: string[];                      // System stakeholders
    requirements?: string[];                      // System requirements
  };
  
  // Mock services for testing
  mocks?: Record<string, any>;                    // Mock services
  
  // Runtime configuration
  runtime?: Record<string, any>;                  // Runtime configuration
} 