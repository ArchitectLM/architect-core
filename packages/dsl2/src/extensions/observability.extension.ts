import { DSL } from '../core/dsl.js';

export interface ObservabilityExtensionOptions {
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableLogging?: boolean;
  metricsProvider?: string;
  tracingProvider?: string;
  loggingProvider?: string;
}

export interface MetricsConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description?: string;
  labels?: string[];
}

export interface TracingConfig {
  name: string;
  type: 'span' | 'trace';
  attributes?: Record<string, string>;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format?: string;
  destination?: string;
}

export function setupObservabilityExtension(dsl: DSL, options?: ObservabilityExtensionOptions): void {
  // Implementation will be added later
} 