/**
 * Monitoring Extension
 * 
 * This extension provides monitoring capabilities for the system, including metrics collection,
 * logging, and alerting. It can be used to track performance, errors, and other important events.
 */

import { Extension } from '../extension-system.js';
import { Event } from '../models.js';

/**
 * Interface for metrics collector
 */
export interface MetricsCollector {
  recordCounter(name: string, value: number, tags?: Record<string, any>): void;
  recordGauge(name: string, value: number, tags?: Record<string, any>): void;
  recordHistogram(name: string, value: number, tags?: Record<string, any>): void;
  recordTimer(name: string, value: number, tags?: Record<string, any>): void;
}

/**
 * Configuration options for the monitoring extension
 */
export interface MonitoringOptions {
  /**
   * Metrics configuration
   */
  metrics?: {
    /**
     * Whether metrics collection is enabled
     */
    enabled: boolean;
    
    /**
     * Prefix for metric names
     */
    prefix?: string;
    
    /**
     * Global tags to apply to all metrics
     */
    tags?: Record<string, string>;
  };
  
  /**
   * Logging configuration
   */
  logging?: {
    /**
     * Whether logging is enabled
     */
    enabled: boolean;
    
    /**
     * Log level (debug, info, warn, error)
     */
    level?: 'debug' | 'info' | 'warn' | 'error';
    
    /**
     * Log format (json, text)
     */
    format?: 'json' | 'text';
  };
  
  /**
   * Alerting configuration
   */
  alerting?: {
    /**
     * Whether alerting is enabled
     */
    enabled: boolean;
    
    /**
     * Thresholds for different metrics that trigger alerts
     */
    thresholds?: Record<string, number>;
    
    /**
     * Alert handlers to call when thresholds are exceeded
     */
    handlers?: Array<(metric: string, value: number, threshold: number) => void>;
  };
}

/**
 * Metric types supported by the monitoring extension
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

/**
 * Metric data structure
 */
export interface Metric {
  /**
   * Name of the metric
   */
  name: string;
  
  /**
   * Type of the metric
   */
  type: MetricType;
  
  /**
   * Value of the metric
   */
  value: number;
  
  /**
   * Tags associated with the metric
   */
  tags?: Record<string, string>;
  
  /**
   * Timestamp when the metric was recorded
   */
  timestamp: number;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /**
   * Log level
   */
  level: 'debug' | 'info' | 'warn' | 'error';
  
  /**
   * Log message
   */
  message: string;
  
  /**
   * Additional context for the log entry
   */
  context?: Record<string, unknown>;
  
  /**
   * Timestamp when the log was recorded
   */
  timestamp: number;
}

/**
 * Alert structure
 */
export interface Alert {
  /**
   * Name of the metric that triggered the alert
   */
  metric: string;
  
  /**
   * Current value of the metric
   */
  value: number;
  
  /**
   * Threshold that was exceeded
   */
  threshold: number;
  
  /**
   * Timestamp when the alert was triggered
   */
  timestamp: number;
}

/**
 * Monitoring Extension
 * 
 * Provides monitoring capabilities for the system.
 */
export class MonitoringExtension implements Extension {
  name: string = "monitoring";
  description: string = "Provides monitoring capabilities for the system";
  hooks: Record<string, (context: unknown) => unknown> = {};
  metadata?: Record<string, unknown>;
  
  private options: MonitoringOptions;
  private metrics: Map<string, Metric> = new Map();
  private logs: LogEntry[] = [];
  private alerts: Alert[] = [];
  private metricsCollector: MetricsCollector;
  
  // Event interceptor to add timing information and record metrics
  eventInterceptor = {
    before: (event: any) => {
      // Add start time to event metadata
      event.metadata = event.metadata || {};
      event.metadata.interceptedAt = Date.now();
      return event;
    },
    
    after: (event: any) => {
      // Add processed time to event metadata
      event.metadata = event.metadata || {};
      event.metadata.processedAt = Date.now();
      
      // Record metrics for resilience-related events
      if (event.type.startsWith('resilience.')) {
        this.metricsCollector.recordCounter(
          `event.${event.type}`,
          1,
          { operation: event.payload?.operation, attempt: event.payload?.attempt?.toString() }
        );
      }
      
      return event;
    }
  };

  constructor(metricsCollector?: MetricsCollector, options: MonitoringOptions = {}) {
    this.options = options;
    
    // Use provided metrics collector or create default one
    this.metricsCollector = metricsCollector || {
      recordCounter: (name, value, tags) => this.recordMetric(name, value, MetricType.COUNTER, tags),
      recordGauge: (name, value, tags) => this.recordMetric(name, value, MetricType.GAUGE, tags),
      recordHistogram: (name, value, tags) => this.recordMetric(name, value, MetricType.HISTOGRAM, tags),
      recordTimer: (name, value, tags) => this.recordMetric(name, value, MetricType.HISTOGRAM, tags)
    };
    
    // Register hooks
    this.hooks["afterCommandExecution"] = this.recordCommandMetrics.bind(this);
    this.hooks["afterEventProcessing"] = this.recordEventMetrics.bind(this);
    this.hooks["onError"] = this.recordError.bind(this);
    
    // Register resilience hooks
    this.hooks["circuitBreaker.stateChange"] = this.recordCircuitBreakerStateChange.bind(this);
    this.hooks["retry.attempt"] = this.recordRetryAttempt.bind(this);
    this.hooks["bulkhead.rejected"] = this.recordBulkheadRejection.bind(this);
    this.hooks["rateLimit.throttled"] = this.recordRateLimitThrottling.bind(this);
    this.hooks["cache.access"] = this.recordCacheAccess.bind(this);
    this.hooks["resilience.operationStart"] = this.recordOperationStart.bind(this);
    this.hooks["resilience.operationEnd"] = this.recordOperationEnd.bind(this);
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, type: MetricType = MetricType.COUNTER, tags: Record<string, string> = {}): void {
    if (!this.options.metrics?.enabled) {
      return;
    }
    
    const metricName = this.options.metrics.prefix ? `${this.options.metrics.prefix}.${name}` : name;
    
    // Combine global tags with metric-specific tags
    const combinedTags = {
      ...this.options.metrics.tags,
      ...tags
    };
    
    const metric: Metric = {
      name: metricName,
      type,
      value,
      tags: combinedTags,
      timestamp: Date.now()
    };
    
    this.metrics.set(metricName, metric);
    
    // Check if this metric should trigger an alert
    this.checkAlertThresholds(metricName, value);
  }

  /**
   * Log a message
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context: Record<string, unknown> = {}): void {
    if (!this.options.logging?.enabled) {
      return;
    }
    
    // Check if the log level is high enough to be recorded
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configuredLevel = this.options.logging.level || 'info';
    
    if (logLevels[level] < logLevels[configuredLevel]) {
      return;
    }
    
    const logEntry: LogEntry = {
      level,
      message,
      context,
      timestamp: Date.now()
    };
    
    this.logs.push(logEntry);
    
    // Output the log based on the configured format
    if (this.options.logging.format === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Check if a metric exceeds any alert thresholds
   */
  private checkAlertThresholds(metric: string, value: number): void {
    if (!this.options.alerting?.enabled || !this.options.alerting.thresholds) {
      return;
    }
    
    const threshold = this.options.alerting.thresholds[metric];
    
    if (threshold !== undefined && value > threshold) {
      const alert: Alert = {
        metric,
        value,
        threshold,
        timestamp: Date.now()
      };
      
      this.alerts.push(alert);
      
      // Call alert handlers
      if (this.options.alerting.handlers) {
        for (const handler of this.options.alerting.handlers) {
          handler(metric, value, threshold);
        }
      }
    }
  }

  /**
   * Record metrics after command execution (hook implementation)
   */
  private recordCommandMetrics(context: unknown): unknown {
    // Implementation would depend on the context structure
    this.recordMetric('commands.executed', 1, MetricType.COUNTER);
    return context;
  }

  /**
   * Record metrics after event processing (hook implementation)
   */
  private recordEventMetrics(context: unknown): unknown {
    const event = context as Event;
    this.recordMetric('events.processed', 1, MetricType.COUNTER, { eventType: event.type });
    return context;
  }

  /**
   * Record error metrics and logs (hook implementation)
   */
  private recordError(context: unknown): unknown {
    const error = context as Error;
    this.recordMetric('errors', 1, MetricType.COUNTER, { errorType: error.name });
    this.log('error', error.message, { stack: error.stack });
    return context;
  }

  /**
   * Record circuit breaker state change metrics
   */
  private recordCircuitBreakerStateChange(context: any): any {
    this.metricsCollector.recordCounter(
      'circuit_breaker.state_change',
      1,
      { name: context.name, state: context.newState }
    );
    
    this.metricsCollector.recordGauge(
      'circuit_breaker.failure_count',
      context.failureCount,
      { name: context.name }
    );
    
    return context;
  }
  
  /**
   * Record retry attempt metrics
   */
  private recordRetryAttempt(context: any): any {
    this.metricsCollector.recordCounter(
      'retry.attempt',
      1,
      { name: context.name, attempt: context.attemptNumber?.toString() }
    );
    
    this.metricsCollector.recordHistogram(
      'retry.delay',
      context.delay,
      { name: context.name }
    );
    
    return context;
  }
  
  /**
   * Record bulkhead rejection metrics
   */
  private recordBulkheadRejection(context: any): any {
    this.metricsCollector.recordCounter(
      'bulkhead.rejected',
      1,
      { name: context.name }
    );
    
    this.metricsCollector.recordGauge(
      'bulkhead.active_count',
      context.activeCount,
      { name: context.name }
    );
    
    this.metricsCollector.recordGauge(
      'bulkhead.queue_size',
      context.queueSize,
      { name: context.name }
    );
    
    return context;
  }
  
  /**
   * Record rate limit throttling metrics
   */
  private recordRateLimitThrottling(context: any): any {
    this.metricsCollector.recordCounter(
      'rate_limiter.throttled',
      1,
      { name: context.name }
    );
    
    this.metricsCollector.recordGauge(
      'rate_limiter.usage_percentage',
      context.currentUsage,
      { name: context.name }
    );
    
    return context;
  }
  
  /**
   * Record cache access metrics
   */
  private recordCacheAccess(context: any): any {
    if (context.hit) {
      this.metricsCollector.recordCounter(
        'cache.hit',
        1,
        { name: context.name, key: context.key }
      );
      
      this.metricsCollector.recordHistogram(
        'cache.age',
        Date.now() - context.storedAt,
        { name: context.name }
      );
    } else {
      this.metricsCollector.recordCounter(
        'cache.miss',
        1,
        { name: context.name, key: context.key }
      );
    }
    
    return context;
  }
  
  /**
   * Record operation start metrics
   */
  private recordOperationStart(context: any): any {
    context.startTime = Date.now();
    return context;
  }
  
  /**
   * Record operation end metrics
   */
  private recordOperationEnd(context: any): any {
    const duration = Date.now() - context.startTime;
    
    this.metricsCollector.recordTimer(
      'resilience.operation.duration',
      duration,
      { name: context.name, success: context.success?.toString() }
    );
    
    this.metricsCollector.recordCounter(
      'resilience.operation.completed',
      1,
      { name: context.name, success: context.success?.toString() }
    );
    
    return context;
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get all recorded logs
   */
  getLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Get all triggered alerts
   */
  getAlerts(): Alert[] {
    return this.alerts;
  }

  /**
   * Create a new monitoring extension
   */
  static create(options: MonitoringOptions = {}): MonitoringExtension {
    return new MonitoringExtension(undefined, options);
  }
}

/**
 * Create a new monitoring extension
 */
export function createMonitoring(options: MonitoringOptions = {}): MonitoringExtension {
  return MonitoringExtension.create(options);
} 