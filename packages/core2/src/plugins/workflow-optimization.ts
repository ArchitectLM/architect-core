import { Extension } from '../models/extension';
import { EventBus } from '../models/event';

export enum OptimizationStrategy {
  PARALLELIZATION = 'PARALLELIZATION',
  CACHING = 'CACHING',
  BATCHING = 'BATCHING',
  PRIORITIZATION = 'PRIORITIZATION'
}

export enum OptimizationType {
  PARALLELIZATION = 'PARALLELIZATION',
  CACHING = 'CACHING',
  BATCHING = 'BATCHING',
  PRIORITIZATION = 'PRIORITIZATION',
  CRITICAL_PATH = 'CRITICAL_PATH'
}

export interface WorkflowMetrics {
  totalExecutions: number;
  averageExecutionTime: number;
  parallelExecutions: number;
  sequentialExecutions: number;
  taskExecutionTimes: Record<string, number[]>;
  totalDependencies: number;
  dependencyGraph: Record<string, string[]>;
}

export interface OptimizationSuggestion {
  type: OptimizationType;
  description: string;
  potentialImprovement: number;
  taskIds: string[];
  confidence: number;
}

export interface Bottleneck {
  taskId: string;
  impact: number;
  suggestions: OptimizationSuggestion[];
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  missRate: number;
  savedExecutionTime: number;
  cachedValues: number;
}

export interface BatchMetrics {
  batchesCreated: number;
  tasksInBatches: number;
  averageBatchSize: number;
  savedExecutionTime: number;
}

export interface OptimizationMetrics {
  improvementPercentage: number;
  optimizedExecutions: number;
  savedExecutionTime: number;
  strategiesApplied: Record<OptimizationStrategy, number>;
}

export interface TaskExecution {
  taskId: string;
  startTime: number;
  endTime: number;
  duration: number;
  input: any;
  output: any;
  dependencies: string[];
  cached: boolean;
  batched: boolean;
}

export interface WorkflowOptimizationOptions {
  enabledStrategies: OptimizationStrategy[];
  optimizationThreshold: number;
  analysisWindow: number;
  maxSuggestions: number;
  enableAutoOptimization: boolean;
}

export interface WorkflowOptimizationPlugin extends Extension {
  getWorkflowMetrics(): WorkflowMetrics;
  analyzeBottlenecks(): Bottleneck[];
  getOptimizationSuggestions(): OptimizationSuggestion[];
  enableAutoOptimization(enable: boolean): void;
  enableCaching(enable: boolean): void;
  enableBatching(enable: boolean): void;
  enablePrioritization(enable: boolean): void;
  enableCriticalPathOptimization(enable: boolean): void;
  getCacheMetrics(): CacheMetrics;
  getBatchMetrics(): BatchMetrics;
  getOptimizationMetrics(): OptimizationMetrics;
  getTaskExecutionOrder(): string[];
  getCriticalPath(): { taskId: string; impact: number }[];
  handleWorkflowEvent(event: any): void;
}

class WorkflowOptimizationPluginImpl implements WorkflowOptimizationPlugin {
  name = 'workflow-optimization';
  description = 'Analyzes and optimizes workflow execution patterns';
  
  private options: WorkflowOptimizationOptions;
  private metrics: WorkflowMetrics;
  private taskExecutions: TaskExecution[] = [];
  private cachedResults: Map<string, any> = new Map();
  private pendingBatches: Map<string, any[]> = new Map();
  private taskDependencies: Record<string, string[]> = {};
  private taskPriorities: Record<string, number> = {};
  private optimizationMetrics: OptimizationMetrics;
  private cacheMetrics: CacheMetrics;
  private batchMetrics: BatchMetrics;
  private executionOrder: string[] = [];
  private eventBus?: EventBus;
  
  constructor(options: WorkflowOptimizationOptions) {
    this.options = {
      enabledStrategies: options.enabledStrategies || [
        OptimizationStrategy.PARALLELIZATION,
        OptimizationStrategy.CACHING
      ],
      optimizationThreshold: options.optimizationThreshold || 0.1, // 10% improvement
      analysisWindow: options.analysisWindow || 1000, // 1 second
      maxSuggestions: options.maxSuggestions || 5,
      enableAutoOptimization: options.enableAutoOptimization || false
    };
    
    this.metrics = {
      totalExecutions: 0,
      averageExecutionTime: 0,
      parallelExecutions: 0,
      sequentialExecutions: 0,
      taskExecutionTimes: {},
      totalDependencies: 0,
      dependencyGraph: {}
    };
    
    this.optimizationMetrics = {
      improvementPercentage: 0,
      optimizedExecutions: 0,
      savedExecutionTime: 0,
      strategiesApplied: {
        [OptimizationStrategy.PARALLELIZATION]: 0,
        [OptimizationStrategy.CACHING]: 0,
        [OptimizationStrategy.BATCHING]: 0,
        [OptimizationStrategy.PRIORITIZATION]: 0
      }
    };
    
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      missRate: 1, // Start with 100% miss rate
      savedExecutionTime: 0,
      cachedValues: 0
    };
    
    this.batchMetrics = {
      batchesCreated: 0,
      tasksInBatches: 0,
      averageBatchSize: 0,
      savedExecutionTime: 0
    };
  }
  
  hooks = {
    'task:beforeExecution': async (context: any) => {
      const taskId = context.taskType;
      const input = context.input;
      
      // Apply caching if enabled
      if (this.options.enabledStrategies.includes(OptimizationStrategy.CACHING)) {
        const cacheKey = this.generateCacheKey(taskId, input);
        if (this.cachedResults.has(cacheKey)) {
          // Cache hit
          this.cacheMetrics.hits++;
          const cachedResult = this.cachedResults.get(cacheKey);
          const averageExecutionTime = this.getAverageExecutionTime(taskId);
          this.cacheMetrics.savedExecutionTime += averageExecutionTime;
          
          // Record optimization metrics
          this.optimizationMetrics.optimizedExecutions++;
          this.optimizationMetrics.savedExecutionTime += averageExecutionTime;
          this.optimizationMetrics.strategiesApplied[OptimizationStrategy.CACHING]++;
          
          return {
            ...context,
            _optimization: {
              cached: true,
              startTime: performance.now()
            },
            result: cachedResult
          };
        } else {
          // Cache miss
          this.cacheMetrics.misses++;
        }
      }
      
      // Apply batching if enabled
      if (this.options.enabledStrategies.includes(OptimizationStrategy.BATCHING)) {
        // TODO: Implement batching logic
      }
      
      // Record task start for metrics
      return {
        ...context,
        _optimization: {
          startTime: performance.now(),
          cached: false,
          batched: false
        }
      };
    },
    
    'task:afterExecution': async (context: any) => {
      if (!context._optimization) return context;
      
      const taskId = context.taskType;
      const input = context.input;
      const result = context.result;
      const startTime = context._optimization.startTime;
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Update execution metrics
      this.metrics.totalExecutions++;
      
      if (!this.metrics.taskExecutionTimes[taskId]) {
        this.metrics.taskExecutionTimes[taskId] = [];
      }
      this.metrics.taskExecutionTimes[taskId].push(duration);
      
      // Update average execution time
      const totalTimes = Object.values(this.metrics.taskExecutionTimes)
        .flat()
        .reduce((sum, time) => sum + time, 0);
      this.metrics.averageExecutionTime = totalTimes / this.metrics.totalExecutions;
      
      // Record task execution
      const execution: TaskExecution = {
        taskId,
        startTime,
        endTime,
        duration,
        input,
        output: result,
        dependencies: this.taskDependencies[taskId] || [],
        cached: context._optimization.cached || false,
        batched: context._optimization.batched || false
      };
      
      this.taskExecutions.push(execution);
      this.executionOrder.push(taskId);
      
      // Apply caching if enabled
      if (this.options.enabledStrategies.includes(OptimizationStrategy.CACHING) && !execution.cached) {
        const cacheKey = this.generateCacheKey(taskId, input);
        this.cachedResults.set(cacheKey, result);
        this.cacheMetrics.cachedValues++;
        
        // Update miss rate
        this.cacheMetrics.missRate = this.cacheMetrics.misses / 
          (this.cacheMetrics.hits + this.cacheMetrics.misses);
      }
      
      // Emit optimization event
      if (this.eventBus) {
        this.eventBus.publish('workflow:optimization', {
          type: 'task_executed',
          metrics: this.getWorkflowMetrics(),
          suggestions: this.getOptimizationSuggestions()
        });
      }
      
      return context;
    },
    
    'runtime:initialized': async (context: any) => {
      if (context.eventBus) {
        this.eventBus = context.eventBus;
        this.eventBus.subscribe('workflow:event', this.handleWorkflowEvent.bind(this));
      }
      return context;
    }
  };
  
  getWorkflowMetrics(): WorkflowMetrics {
    return {...this.metrics};
  }
  
  analyzeBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Calculate average execution time for each task
    const taskTimes: Record<string, { avg: number, count: number }> = {};
    
    Object.entries(this.metrics.taskExecutionTimes).forEach(([taskId, times]) => {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      taskTimes[taskId] = { avg, count: times.length };
    });
    
    // Calculate total workflow time
    const totalTime = Object.values(taskTimes)
      .reduce((sum, { avg, count }) => sum + (avg * count), 0);
    
    // Find bottlenecks - tasks with high contribution to total time
    Object.entries(taskTimes)
      .sort((a, b) => (b[1].avg * b[1].count) - (a[1].avg * a[1].count))
      .slice(0, 3) // Top 3 time consumers
      .forEach(([taskId, { avg, count }]) => {
        const impact = (avg * count) / totalTime;
        
        // Generate suggestions for this bottleneck
        const suggestions: OptimizationSuggestion[] = [];
        
        // Check for parallelization opportunity
        if (this.canParallelize(taskId)) {
          suggestions.push({
            type: OptimizationType.PARALLELIZATION,
            description: `Execute ${taskId} in parallel with other tasks`,
            potentialImprovement: impact * 0.5, // Estimate 50% improvement
            taskIds: [taskId],
            confidence: 0.7
          });
        }
        
        // Check for caching opportunity
        if (this.canCache(taskId)) {
          suggestions.push({
            type: OptimizationType.CACHING,
            description: `Cache results for ${taskId} to avoid redundant execution`,
            potentialImprovement: impact * 0.8, // Estimate 80% improvement
            taskIds: [taskId],
            confidence: 0.8
          });
        }
        
        // Check for batching opportunity
        if (this.canBatch(taskId)) {
          suggestions.push({
            type: OptimizationType.BATCHING,
            description: `Batch multiple executions of ${taskId} together`,
            potentialImprovement: impact * 0.3, // Estimate 30% improvement
            taskIds: [taskId],
            confidence: 0.6
          });
        }
        
        bottlenecks.push({
          taskId,
          impact,
          suggestions
        });
      });
    
    return bottlenecks;
  }
  
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const bottlenecks = this.analyzeBottlenecks();
    const allSuggestions = bottlenecks.flatMap(b => b.suggestions);
    
    // Sort by potential improvement
    const sortedSuggestions = [...allSuggestions]
      .sort((a, b) => b.potentialImprovement - a.potentialImprovement);
    
    // Return top N suggestions
    return sortedSuggestions.slice(0, this.options.maxSuggestions);
  }
  
  enableAutoOptimization(enable: boolean): void {
    this.options.enableAutoOptimization = enable;
  }
  
  enableCaching(enable: boolean): void {
    if (enable) {
      if (!this.options.enabledStrategies.includes(OptimizationStrategy.CACHING)) {
        this.options.enabledStrategies.push(OptimizationStrategy.CACHING);
      }
    } else {
      this.options.enabledStrategies = this.options.enabledStrategies
        .filter(s => s !== OptimizationStrategy.CACHING);
    }
  }
  
  enableBatching(enable: boolean): void {
    if (enable) {
      if (!this.options.enabledStrategies.includes(OptimizationStrategy.BATCHING)) {
        this.options.enabledStrategies.push(OptimizationStrategy.BATCHING);
      }
    } else {
      this.options.enabledStrategies = this.options.enabledStrategies
        .filter(s => s !== OptimizationStrategy.BATCHING);
    }
  }
  
  enablePrioritization(enable: boolean): void {
    if (enable) {
      if (!this.options.enabledStrategies.includes(OptimizationStrategy.PRIORITIZATION)) {
        this.options.enabledStrategies.push(OptimizationStrategy.PRIORITIZATION);
      }
    } else {
      this.options.enabledStrategies = this.options.enabledStrategies
        .filter(s => s !== OptimizationStrategy.PRIORITIZATION);
    }
  }
  
  enableCriticalPathOptimization(enable: boolean): void {
    // This is a special case of prioritization
    this.enablePrioritization(enable);
  }
  
  getCacheMetrics(): CacheMetrics {
    return {...this.cacheMetrics};
  }
  
  getBatchMetrics(): BatchMetrics {
    return {...this.batchMetrics};
  }
  
  getOptimizationMetrics(): OptimizationMetrics {
    return {...this.optimizationMetrics};
  }
  
  getTaskExecutionOrder(): string[] {
    return [...this.executionOrder];
  }
  
  getCriticalPath(): { taskId: string; impact: number }[] {
    // Calculate critical path based on dependency graph and execution times
    const criticalPath: { taskId: string; impact: number }[] = [];
    
    // Build a graph of dependencies
    const graph: Record<string, { task: string, duration: number, next: string[] }> = {};
    
    this.taskExecutions.forEach(execution => {
      if (!graph[execution.taskId]) {
        graph[execution.taskId] = {
          task: execution.taskId,
          duration: execution.duration,
          next: []
        };
      }
      
      // Add dependencies
      execution.dependencies.forEach(dep => {
        if (!graph[dep]) {
          // Dependency task not seen yet, create placeholder
          graph[dep] = {
            task: dep,
            duration: 0, // Will be updated when we see this task
            next: [execution.taskId]
          };
        } else {
          // Add current task as next for dependency
          if (!graph[dep].next.includes(execution.taskId)) {
            graph[dep].next.push(execution.taskId);
          }
        }
      });
    });
    
    // Calculate longest path for each node
    const longestPath: Record<string, number> = {};
    const visited: Record<string, boolean> = {};
    
    const calculateLongestPath = (node: string): number => {
      if (visited[node]) return longestPath[node];
      
      visited[node] = true;
      
      if (!graph[node] || graph[node].next.length === 0) {
        longestPath[node] = graph[node]?.duration || 0;
        return longestPath[node];
      }
      
      let maxPathLength = 0;
      for (const next of graph[node].next) {
        const pathLength = calculateLongestPath(next);
        maxPathLength = Math.max(maxPathLength, pathLength);
      }
      
      longestPath[node] = (graph[node]?.duration || 0) + maxPathLength;
      return longestPath[node];
    };
    
    // Calculate longest path starting from each node
    Object.keys(graph).forEach(node => {
      if (!visited[node]) {
        calculateLongestPath(node);
      }
    });
    
    // Find tasks on the critical path
    const totalPathLength = Math.max(...Object.values(longestPath));
    
    if (totalPathLength > 0) {
      Object.entries(longestPath)
        .filter(([_, length]) => length > totalPathLength * 0.5) // Tasks contributing significantly
        .sort((a, b) => b[1] - a[1])
        .forEach(([taskId, length]) => {
          criticalPath.push({
            taskId,
            impact: length / totalPathLength
          });
        });
    }
    
    return criticalPath;
  }
  
  handleWorkflowEvent(event: any): void {
    // Process workflow events from other components
    if (event.type === 'task_completed') {
      // Record dependencies if provided
      if (event.dependencies && event.taskId) {
        this.taskDependencies[event.taskId] = event.dependencies;
        this.metrics.totalDependencies += event.dependencies.length;
        this.metrics.dependencyGraph[event.taskId] = event.dependencies;
      }
      
      // Update execution metrics if duration provided
      if (event.duration && event.taskId) {
        if (!this.metrics.taskExecutionTimes[event.taskId]) {
          this.metrics.taskExecutionTimes[event.taskId] = [];
        }
        this.metrics.taskExecutionTimes[event.taskId].push(event.duration);
      }
    }
  }
  
  private generateCacheKey(taskId: string, input: any): string {
    try {
      // Simple way to create cache key - in real implementation may want to use hashing
      return `${taskId}:${JSON.stringify(input)}`;
    } catch (error) {
      // If JSON serialization fails (e.g. circular references), fall back to a simpler approach
      return `${taskId}:${Object.keys(input).join(',')}`;
    }
  }
  
  private getAverageExecutionTime(taskId: string): number {
    if (!this.metrics.taskExecutionTimes[taskId] || this.metrics.taskExecutionTimes[taskId].length === 0) {
      return 0;
    }
    
    return this.metrics.taskExecutionTimes[taskId].reduce((sum, time) => sum + time, 0) / 
      this.metrics.taskExecutionTimes[taskId].length;
  }
  
  private canParallelize(taskId: string): boolean {
    // Check if task has non-dependent tasks that could be run in parallel
    const dependencies = this.taskDependencies[taskId] || [];
    
    // If task has no dependencies, it can potentially be parallelized
    if (dependencies.length === 0) {
      return true;
    }
    
    // Check if there are other tasks that don't depend on this one
    const hasNonDependentTasks = Object.keys(this.metrics.taskExecutionTimes)
      .some(otherTaskId => {
        if (otherTaskId === taskId) return false;
        const otherDependencies = this.taskDependencies[otherTaskId] || [];
        return !otherDependencies.includes(taskId) && !dependencies.includes(otherTaskId);
      });
    
    return hasNonDependentTasks;
  }
  
  private canCache(taskId: string): boolean {
    // Check if task has been executed multiple times with same input
    const executions = this.taskExecutions.filter(e => e.taskId === taskId);
    
    if (executions.length < 2) {
      return false;
    }
    
    // Check for repeated inputs
    const inputStrings = executions.map(e => JSON.stringify(e.input));
    const uniqueInputs = new Set(inputStrings);
    
    // If fewer unique inputs than executions, there are repeated calls
    return uniqueInputs.size < executions.length;
  }
  
  private canBatch(taskId: string): boolean {
    // Check if task has been executed multiple times in quick succession
    const executions = this.taskExecutions.filter(e => e.taskId === taskId);
    
    if (executions.length < 3) {
      return false; // Need at least 3 executions to consider batching
    }
    
    // Sort by start time
    const sortedExecutions = [...executions].sort((a, b) => a.startTime - b.startTime);
    
    // Check for executions within a short time window
    for (let i = 0; i < sortedExecutions.length - 2; i++) {
      const windowStart = sortedExecutions[i].startTime;
      const windowEnd = windowStart + this.options.analysisWindow;
      
      // Count executions in this time window
      const executionsInWindow = sortedExecutions.filter(
        e => e.startTime >= windowStart && e.startTime <= windowEnd
      );
      
      if (executionsInWindow.length >= 3) {
        return true;
      }
    }
    
    return false;
  }
}

export function createWorkflowOptimizationPlugin(
  options: WorkflowOptimizationOptions = {
    enabledStrategies: [
      OptimizationStrategy.PARALLELIZATION,
      OptimizationStrategy.CACHING
    ],
    optimizationThreshold: 0.1,
    analysisWindow: 1000,
    maxSuggestions: 5,
    enableAutoOptimization: false
  }
): Extension {
  return new WorkflowOptimizationPluginImpl(options);
} 