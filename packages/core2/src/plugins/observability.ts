import { Extension } from '../models/extension';

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: MetricType;
  values: MetricValue[];
  sum?: number;
  count?: number;
  min?: number;
  max?: number;
}

export interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  attributes: Record<string, any>;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context: Record<string, any>;
}

export interface ObservabilityOptions {
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableLogging?: boolean;
  samplingRate?: number;
  logLevel?: LogLevel;
}

export interface MetricExport {
  timestamp: number;
  metrics: Record<string, Metric>;
}

export interface TraceExport {
  timestamp: number;
  traces: TraceSpan[];
}

export interface LogExport {
  timestamp: number;
  logs: LogEntry[];
}

export class ObservabilityPlugin implements Extension {
  name = 'observability-plugin';
  description = 'Provides metrics, tracing, and logging capabilities';

  private options: Required<ObservabilityOptions>;
  private metrics: Map<string, Metric> = new Map();
  private traces: TraceSpan[] = [];
  private logs: LogEntry[] = [];
  private activeSpans: Map<string, TraceSpan> = new Map();
  private spanStack: string[] = [];

  constructor(options: ObservabilityOptions = {}) {
    this.options = {
      enableMetrics: options.enableMetrics ?? true,
      enableTracing: options.enableTracing ?? true,
      enableLogging: options.enableLogging ?? true,
      samplingRate: options.samplingRate ?? 1.0,
      logLevel: options.logLevel ?? LogLevel.INFO
    };
  }

  hooks = {
    'task:beforeExecution': async (context: any) => {
      const { taskId, task, metadata } = context;
      
      if (this.shouldSample()) {
        if (this.options.enableTracing) {
          this.startSpan('task.execute', {
            'task.id': taskId,
            'task.name': task.name,
            ...metadata
          });
        }
        
        if (this.options.enableLogging) {
          this.log(LogLevel.INFO, 'Task execution started', {
            taskId,
            taskName: task.name,
            ...metadata
          });
        }
      }
      
      return context;
    },

    'task:afterExecution': async (context: any) => {
      const { taskId, task, result, duration } = context;
      
      if (this.shouldSample()) {
        if (this.options.enableMetrics) {
          this.recordMetric('task.execution.count', 1, MetricType.COUNTER);
          this.recordMetric('task.execution.duration', duration, MetricType.HISTOGRAM);
          this.recordMetric(`task.execution.count.${taskId}`, 1, MetricType.COUNTER);
        }
        
        if (this.options.enableTracing) {
          this.endSpan();
        }
        
        if (this.options.enableLogging) {
          this.log(LogLevel.INFO, 'Task execution completed', {
            taskId,
            taskName: task.name,
            duration,
            result
          });
        }
      }
      
      return context;
    },

    'task:error': async (context: any) => {
      const { taskId, task, error } = context;
      
      if (this.shouldSample()) {
        if (this.options.enableMetrics) {
          this.recordMetric('task.error.count', 1, MetricType.COUNTER);
          this.recordMetric(`task.error.count.${taskId}`, 1, MetricType.COUNTER);
        }
        
        if (this.options.enableTracing) {
          this.endSpan();
        }
        
        if (this.options.enableLogging) {
          this.log(LogLevel.ERROR, 'Task execution failed', {
            taskId,
            taskName: task.name,
            error
          });
        }
      }
      
      return context;
    }
  };

  private shouldSample(): boolean {
    return Math.random() < this.options.samplingRate;
  }

  private startSpan(name: string, attributes: Record<string, any> = {}): void {
    const span: TraceSpan = {
      id: this.generateId(),
      parentId: this.spanStack.length > 0 ? this.spanStack[this.spanStack.length - 1] : undefined,
      name,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      attributes
    };

    this.activeSpans.set(span.id, span);
    this.spanStack.push(span.id);
  }

  private endSpan(): void {
    if (this.spanStack.length === 0) return;

    const spanId = this.spanStack.pop()!;
    const span = this.activeSpans.get(spanId);
    
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      this.traces.push(span);
      this.activeSpans.delete(spanId);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  recordMetric(name: string, value: number, type: MetricType): void {
    if (!this.options.enableMetrics) return;

    let metric = this.metrics.get(name);
    
    if (!metric) {
      metric = {
        name,
        type,
        values: []
      };
      this.metrics.set(name, metric);
    }

    const metricValue: MetricValue = {
      value,
      timestamp: Date.now()
    };

    metric.values.push(metricValue);

    // Update aggregated values
    if (type === MetricType.HISTOGRAM) {
      metric.sum = (metric.sum || 0) + value;
      metric.count = (metric.count || 0) + 1;
      metric.min = Math.min(metric.min ?? value, value);
      metric.max = Math.max(metric.max ?? value, value);
    }
  }

  log(level: LogLevel, message: string, context: Record<string, any> = {}): void {
    if (!this.options.enableLogging || this.getLogLevelValue(level) < this.getLogLevelValue(this.options.logLevel)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context
    };

    this.logs.push(logEntry);
  }

  private getLogLevelValue(level: LogLevel): number {
    const levels = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    };
    return levels[level];
  }

  getMetrics(): Record<string, Metric> {
    return Object.fromEntries(this.metrics);
  }

  getTraces(): TraceSpan[] {
    return [...this.traces];
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  exportMetrics(): MetricExport {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics()
    };
  }

  exportTraces(): TraceExport {
    return {
      timestamp: Date.now(),
      traces: this.getTraces()
    };
  }

  exportLogs(): LogExport {
    return {
      timestamp: Date.now(),
      logs: this.getLogs()
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  clearTraces(): void {
    this.traces = [];
    this.activeSpans.clear();
    this.spanStack = [];
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLogLevel(level: LogLevel): void {
    this.options.logLevel = level;
  }

  setSamplingRate(rate: number): void {
    this.options.samplingRate = Math.max(0, Math.min(1, rate));
  }
}

export function createObservabilityPlugin(options: ObservabilityOptions = {}): Extension {
  return new ObservabilityPlugin(options);
} 