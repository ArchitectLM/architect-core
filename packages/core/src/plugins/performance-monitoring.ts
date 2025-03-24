import { Extension, ExtensionHookRegistration, ExtensionPointName } from '../models/extension-system';
import { DomainEvent } from '../models/core-types';

export interface TaskMetrics {
  total: number;
  min: number;
  max: number;
  average: number;
  times: number[];
}

export interface PerformanceMetrics {
  taskExecutionTime: Record<string, TaskMetrics>;
  eventCounts: Record<string, number>;
  activeTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
}

export class PerformanceMonitoringPlugin implements Extension {
  name = 'performance-monitoring';
  description = 'Collects and exposes performance metrics for the runtime';
  id = 'performance-monitoring';
  dependencies: string[] = [];
  
  private metrics: PerformanceMetrics = this.createEmptyMetrics();
  
  // Implement Extension interface methods
  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return Object.entries(this.hooks).map(([pointName, hook]) => ({
      pointName: pointName as ExtensionPointName,
      hook,
      priority: 0
    }));
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return ['performance-monitoring'];
  }
  
  hooks = {
    // Task lifecycle hooks
    'task:beforeExecution': async (context: any) => {
      this.metrics.activeTaskCount++;
      
      // Add execution start time to context for later use
      return {
        ...context,
        _metrics: {
          startTime: performance.now()
        }
      };
    },
    
    'task:afterExecution': async (context: any) => {
      this.metrics.activeTaskCount--;
      this.metrics.completedTaskCount++;
      
      const taskType = context.taskType;
      const endTime = performance.now();
      const startTime = context._metrics?.startTime || endTime; // Fallback if not set
      const executionTime = endTime - startTime;
      
      // Create metrics record for task if it doesn't exist
      if (!this.metrics.taskExecutionTime[taskType]) {
        this.metrics.taskExecutionTime[taskType] = {
          total: 0,
          min: Infinity,
          max: -Infinity,
          average: 0,
          times: []
        };
      }
      
      const taskMetrics = this.metrics.taskExecutionTime[taskType];
      
      // Update task metrics
      taskMetrics.times.push(executionTime);
      taskMetrics.total++;
      taskMetrics.min = Math.min(taskMetrics.min, executionTime);
      taskMetrics.max = Math.max(taskMetrics.max, executionTime);
      
      // Recalculate average
      const sum = taskMetrics.times.reduce((a, b) => a + b, 0);
      taskMetrics.average = sum / taskMetrics.times.length;
      
      return context;
    },
    
    'task:onError': async (context: any) => {
      this.metrics.activeTaskCount--;
      this.metrics.failedTaskCount++;
      
      return context;
    }
  };
  
  eventInterceptor = (event: DomainEvent<any>) => {
    // Count events by type
    if (!this.metrics.eventCounts[event.type]) {
      this.metrics.eventCounts[event.type] = 0;
    }
    this.metrics.eventCounts[event.type]++;
    
    return event;
  };
  
  // Public API to get metrics
  getMetrics(): PerformanceMetrics {
    return this.metrics;
  }
  
  // Reset metrics to initial state
  resetMetrics(): void {
    this.metrics = this.createEmptyMetrics();
  }
  
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      taskExecutionTime: {},
      eventCounts: {},
      activeTaskCount: 0,
      completedTaskCount: 0,
      failedTaskCount: 0
    };
  }
}

// Factory function to create the plugin
export function createPerformanceMonitoringPlugin(): Extension {
  return new PerformanceMonitoringPlugin();
} 