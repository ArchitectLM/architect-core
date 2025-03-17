import { Extension } from '../extension-system.js';
import { Event } from '../models.js';

/**
 * Enum for metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

/**
 * Interface for metric labels/dimensions
 */
export type MetricLabels = Record<string, string | number | boolean>;

/**
 * Interface for metrics collector
 */
export interface MetricsCollector {
  /**
   * Record a counter metric
   * @param name The name of the counter
   * @param value The value to increment by
   * @param labels Optional labels for the counter
   */
  recordCounter(name: string, value: number, labels?: MetricLabels): void;
  
  /**
   * Record a gauge metric
   * @param name The name of the gauge
   * @param value The value to set
   * @param labels Optional labels for the gauge
   */
  recordGauge(name: string, value: number, labels?: MetricLabels): void;
  
  /**
   * Record a histogram metric
   * @param name The name of the histogram
   * @param value The value to record
   * @param labels Optional labels for the histogram
   */
  recordHistogram(name: string, value: number, labels?: MetricLabels): void;
  
  /**
   * Record a summary metric
   * @param name The name of the summary
   * @param value The value to record
   * @param labels Optional labels for the summary
   */
  recordSummary(name: string, value: number, labels?: MetricLabels): void;
  
  /**
   * Get all metrics
   * @returns The current metrics
   */
  getMetrics(): {
    counters: Map<string, number>;
    gauges: Map<string, number>;
    histograms: Map<string, any>;
    summaries: Map<string, any>;
  };
}

/**
 * Interface for the context passed to the metrics.record extension point
 */
export interface MetricsRecordContext {
  /** The name of the metric */
  name: string;
  /** The type of metric */
  type: MetricType;
  /** The value to record */
  value: number;
  /** Optional labels for the metric */
  labels?: MetricLabels;
}

/**
 * Default implementation of the metrics collector
 */
export class DefaultMetricsCollector implements MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private summaries: Map<string, number[]> = new Map();
  
  /**
   * Get a key for a metric with labels
   * @param name The metric name
   * @param labels The metric labels
   * @returns The key
   */
  private getKey(name: string, labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }
  
  recordCounter(name: string, value: number, labels?: MetricLabels): void {
    const key = this.getKey(name, labels);
    const currentValue = this.counters.get(key) || 0;
    this.counters.set(key, currentValue + value);
  }
  
  recordGauge(name: string, value: number, labels?: MetricLabels): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }
  
  recordHistogram(name: string, value: number, labels?: MetricLabels): void {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }
  
  recordSummary(name: string, value: number, labels?: MetricLabels): void {
    const key = this.getKey(name, labels);
    const values = this.summaries.get(key) || [];
    values.push(value);
    this.summaries.set(key, values);
  }
  
  getMetrics() {
    return {
      counters: new Map(this.counters),
      gauges: new Map(this.gauges),
      histograms: new Map(this.histograms),
      summaries: new Map(this.summaries)
    };
  }
}

/**
 * Extension that provides metrics collection capabilities
 */
export class MetricsCollectionExtension implements Extension {
  name = 'metrics-collection';
  description = 'Collects and exposes metrics for monitoring';
  
  private collector: MetricsCollector;
  private globalDimensions: MetricLabels = {};
  private eventStartTimes: Map<string, number> = new Map();
  
  constructor(collector?: MetricsCollector) {
    this.collector = collector || new DefaultMetricsCollector();
  }
  
  /**
   * Add a global dimension to all metrics
   * @param key The dimension key
   * @param value The dimension value
   */
  addGlobalDimension(key: string, value: string | number | boolean): void {
    this.globalDimensions[key] = value;
  }
  
  /**
   * Merge global dimensions with provided labels
   * @param labels The labels to merge with global dimensions
   * @returns The merged labels
   */
  private mergeWithGlobalDimensions(labels?: MetricLabels): MetricLabels {
    return {
      ...this.globalDimensions,
      ...(labels || {})
    };
  }
  
  /**
   * Record a metric
   * @param context The metrics record context
   */
  private recordMetric(context: MetricsRecordContext): void {
    const { name, type, value, labels } = context;
    const mergedLabels = this.mergeWithGlobalDimensions(labels);
    
    switch (type) {
      case MetricType.COUNTER:
        this.collector.recordCounter(name, value, mergedLabels);
        break;
      case MetricType.GAUGE:
        this.collector.recordGauge(name, value, mergedLabels);
        break;
      case MetricType.HISTOGRAM:
        this.collector.recordHistogram(name, value, mergedLabels);
        break;
      case MetricType.SUMMARY:
        this.collector.recordSummary(name, value, mergedLabels);
        break;
    }
  }
  
  /**
   * Generate a unique ID for an event
   * @param event The event
   * @returns The event ID
   */
  private getEventId(event: Event): string {
    return `${event.type}-${event.timestamp}`;
  }
  
  hooks = {
    'metrics.record': (context: MetricsRecordContext) => {
      this.recordMetric(context);
      return context;
    },
    
    'metrics.get': () => {
      return this.collector.getMetrics();
    },
    
    'event.beforeProcess': (context: { event: Event }) => {
      const { event } = context;
      const eventId = this.getEventId(event);
      
      // Record the start time
      this.eventStartTimes.set(eventId, Date.now());
      
      // Record that we received an event
      this.recordMetric({
        name: 'event.received',
        type: MetricType.COUNTER,
        value: 1,
        labels: { eventType: event.type }
      });
      
      return context;
    },
    
    'event.afterProcess': (context: { event: Event; result: any; startTime?: number }) => {
      const { event, result } = context;
      const eventId = this.getEventId(event);
      
      // Get the start time
      const startTime = context.startTime || this.eventStartTimes.get(eventId) || event.timestamp;
      const processingTime = Date.now() - startTime;
      
      // Clean up the start time
      this.eventStartTimes.delete(eventId);
      
      // Record processing time
      this.recordMetric({
        name: 'event.processing.time',
        type: MetricType.HISTOGRAM,
        value: processingTime,
        labels: { 
          eventType: event.type,
          success: String(result?.success === true)
        }
      });
      
      // Record that we processed an event
      this.recordMetric({
        name: 'event.processed',
        type: MetricType.COUNTER,
        value: 1,
        labels: { 
          eventType: event.type,
          success: String(result?.success === true)
        }
      });
      
      return context;
    }
  };
} 