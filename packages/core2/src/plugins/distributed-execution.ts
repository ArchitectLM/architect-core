import { Extension } from '../models/extension';

/**
 * Represents the status of a node in the distributed system
 */
export enum NodeStatus {
  /** Node is active and available for task execution */
  ACTIVE = 'active',
  
  /** Node is inactive and not available for task execution */
  INACTIVE = 'inactive',
  
  /** Node is active but currently overloaded */
  OVERLOADED = 'overloaded'
}

/**
 * Strategies for distributing tasks across nodes
 */
export enum DistributionStrategy {
  /** Select nodes that have the capabilities required by the task */
  CAPABILITY_MATCH = 'capability-match',
  
  /** Distribute tasks evenly based on node load */
  LOAD_BALANCED = 'load-balanced',
  
  /** Distribute tasks in a round-robin fashion */
  ROUND_ROBIN = 'round-robin'
}

/**
 * Configuration for node health checking
 */
export interface HealthCheckConfig {
  /** Number of consecutive failures before marking a node as inactive */
  failureThreshold: number;
  
  /** Interval in milliseconds for health checks */
  checkInterval: number;
}

/**
 * Represents a node in the distributed system
 */
export interface DistributedNode {
  /** Unique identifier for the node */
  id: string;
  
  /** Current status of the node */
  status: NodeStatus;
  
  /** Current load factor (0-1) where 0 is idle and 1 is fully loaded */
  load: number;
  
  /** Capabilities that this node supports */
  capabilities: string[];
  
  /** Optional metadata for the node */
  metadata?: Record<string, any>;
}

/**
 * Configuration for the distributed execution plugin
 */
export interface DistributedExecutionPluginOptions {
  /** Unique identifier for the local node */
  nodeId: string;
  
  /** Method for discovering other nodes */
  discoveryMethod: 'static' | 'dns' | 'api';
  
  /** Predefined list of nodes (for static discovery) */
  nodes?: DistributedNode[];
  
  /** Discovery service URL (for api discovery) */
  discoveryUrl?: string;
  
  /** Default distribution strategy */
  defaultStrategy: DistributionStrategy;
  
  /** Function to execute a task on a remote node */
  remoteExecute: (nodeId: string, taskId: string, input: any) => Promise<any>;
  
  /** Optional health check configuration */
  healthCheck?: HealthCheckConfig;
}

/**
 * Configuration for task-specific distribution
 */
export interface TaskDistributionConfig {
  /** Distribution strategy for this task */
  strategy?: DistributionStrategy;
  
  /** Force task to execute locally */
  forceLocal?: boolean;
  
  /** Force task to execute remotely */
  forceRemote?: boolean;
  
  /** Preferred nodes for this task */
  preferredNodes?: string[];
  
  /** Required capabilities for this task */
  requiredCapabilities?: string[];
}

/**
 * Metrics for distributed task execution
 */
export interface DistributionMetrics {
  /** Total number of tasks distributed */
  totalDistributedTasks: number;
  
  /** Number of tasks by node */
  tasksByNode: Record<string, number>;
  
  /** Number of tasks by task type */
  taskTypeDistribution: Record<string, number>;
  
  /** Average response time for distributed tasks */
  averageResponseTime: number;
  
  /** Number of failed executions */
  failedExecutions: number;
  
  /** Number of retried executions */
  retriedExecutions: number;
}

/**
 * Plugin for distributing task execution across multiple nodes
 */
export class DistributedExecutionPlugin implements Extension {
  name = 'distributed-execution-plugin';
  description = 'Enables distributed task execution across multiple nodes';
  
  private options: DistributedExecutionPluginOptions;
  private nodes: Map<string, DistributedNode> = new Map();
  private taskConfigs: Map<string, TaskDistributionConfig> = new Map();
  private failureCount: Map<string, number> = new Map();
  private lastNodeIndex = 0;
  private metrics: DistributionMetrics = {
    totalDistributedTasks: 0,
    tasksByNode: {},
    taskTypeDistribution: {},
    averageResponseTime: 0,
    failedExecutions: 0,
    retriedExecutions: 0
  };
  private responseTimeTotal = 0;
  private healthCheckInterval?: NodeJS.Timeout;
  
  constructor(options: DistributedExecutionPluginOptions) {
    this.options = options;
    
    // Initialize nodes
    if (options.nodes) {
      options.nodes.forEach(node => {
        this.nodes.set(node.id, { ...node });
      });
    }
    
    // Set up health checking if configured
    if (options.healthCheck) {
      this.enableHealthCheck(options.healthCheck);
    }
  }
  
  hooks = {
    'task:beforeExecution': async (context: any) => {
      const taskId = context.taskType;
      const input = context.input;
      
      // Check if we should distribute this task
      if (!this.shouldDistributeTask(taskId)) {
        return context;
      }
      
      try {
        // Find the appropriate node to execute this task
        const nodeId = this.selectNode(taskId, input);
        
        if (!nodeId) {
          // No suitable node found, execute locally
          return context;
        }
        
        // Start tracking time
        const startTime = Date.now();
        
        // Execute the task on the selected node
        const result = await this.options.remoteExecute(nodeId, taskId, input);
        
        // Track metrics
        this.updateMetrics(taskId, nodeId, Date.now() - startTime);
        
        // Reset failure count for successful node
        this.failureCount.set(nodeId, 0);
        
        // Skip local execution
        return {
          ...context,
          skipExecution: true,
          result
        };
      } catch (error) {
        // Track failure
        this.metrics.failedExecutions++;
        
        // Retry on a different node if possible
        const taskConfig = this.taskConfigs.get(taskId);
        
        if (!context._retryCount || context._retryCount < 1) {
          this.metrics.retriedExecutions++;
          
          return {
            ...context,
            _retryCount: (context._retryCount || 0) + 1
          };
        }
        
        // If the task config specifies forceRemote, propagate the error
        if (taskConfig?.forceRemote) {
          throw error;
        }
        
        // Otherwise, allow local execution as fallback
        return context;
      }
    }
  };
  
  /**
   * Register a node in the distributed system
   */
  registerNode(node: DistributedNode): void {
    this.nodes.set(node.id, { ...node });
  }
  
  /**
   * Deregister a node from the distributed system
   */
  deregisterNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }
  
  /**
   * Update the status of a node
   */
  updateNodeStatus(nodeId: string, update: Partial<DistributedNode>): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.nodes.set(nodeId, { ...node, ...update });
    }
  }
  
  /**
   * Get information about a specific node
   */
  getNodeInfo(nodeId: string): DistributedNode | undefined {
    return this.nodes.get(nodeId);
  }
  
  /**
   * Get all available (active) nodes
   */
  getAvailableNodes(): DistributedNode[] {
    return Array.from(this.nodes.values())
      .filter(node => node.status === NodeStatus.ACTIVE);
  }
  
  /**
   * Set the distribution strategy for the plugin
   */
  setDistributionStrategy(strategy: DistributionStrategy): void {
    this.options.defaultStrategy = strategy;
  }
  
  /**
   * Set task-specific distribution configuration
   */
  setTaskDistributionConfig(taskId: string, config: TaskDistributionConfig): void {
    this.taskConfigs.set(taskId, config);
  }
  
  /**
   * Get distribution metrics
   */
  getDistributionMetrics(): DistributionMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Enable health checking for nodes
   */
  enableHealthCheck(config: HealthCheckConfig): void {
    // Clear existing interval if any
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Set up new health check interval
    this.healthCheckInterval = setInterval(() => {
      // Check each node's failure count
      for (const [nodeId, count] of this.failureCount.entries()) {
        if (count >= config.failureThreshold) {
          // Mark node as inactive
          this.updateNodeStatus(nodeId, { status: NodeStatus.INACTIVE });
        }
      }
    }, config.checkInterval);
  }
  
  /**
   * Execute a map-reduce operation across distributed nodes
   */
  async executeMapReduce<T, R, F>(
    taskId: string,
    items: T[],
    mapFn: (item: T) => Promise<R> | R,
    reduceFn: (results: R[]) => Promise<F> | F
  ): Promise<F> {
    // Get available nodes
    const availableNodes = this.getAvailableNodes();
    
    if (availableNodes.length === 0) {
      // No nodes available, execute locally
      const mappedResults = await Promise.all(items.map(mapFn));
      return reduceFn(mappedResults);
    }
    
    // Distribute items across nodes
    const nodeCount = availableNodes.length;
    const itemsPerNode = Math.ceil(items.length / nodeCount);
    
    const nodeJobs: Promise<R[]>[] = [];
    
    for (let i = 0; i < nodeCount; i++) {
      const node = availableNodes[i];
      const nodeItems = items.slice(i * itemsPerNode, (i + 1) * itemsPerNode);
      
      if (nodeItems.length === 0) continue;
      
      // Execute map function for this batch on the selected node
      nodeJobs.push(
        Promise.all(
          nodeItems.map(async item => {
            try {
              return await mapFn(item);
            } catch (error) {
              // Track node failure
              this.incrementFailureCount(node.id);
              throw error;
            }
          })
        )
      );
    }
    
    // Wait for all node jobs to complete
    const nodeResults = await Promise.all(nodeJobs);
    
    // Flatten results from all nodes
    const allResults = nodeResults.flat();
    
    // Apply reduce function
    return reduceFn(allResults);
  }
  
  /**
   * Determine whether a task should be distributed
   */
  private shouldDistributeTask(taskId: string): boolean {
    const taskConfig = this.taskConfigs.get(taskId);
    
    // If forceLocal is set, don't distribute
    if (taskConfig?.forceLocal) {
      return false;
    }
    
    // If forceRemote is set, always distribute
    if (taskConfig?.forceRemote) {
      return true;
    }
    
    // By default, attempt to distribute all tasks
    return true;
  }
  
  /**
   * Select the best node for executing a task
   */
  private selectNode(taskId: string, input: any): string | null {
    const taskConfig = this.taskConfigs.get(taskId);
    const availableNodes = this.getAvailableNodes();
    
    if (availableNodes.length === 0) {
      return null;
    }
    
    // If preferred nodes are specified and available, use them
    if (taskConfig?.preferredNodes && taskConfig.preferredNodes.length > 0) {
      const preferredNode = availableNodes.find(node => 
        taskConfig.preferredNodes!.includes(node.id)
      );
      
      if (preferredNode) {
        return preferredNode.id;
      }
    }
    
    // Get required capabilities
    const requiredCapabilities = taskConfig?.requiredCapabilities || [];
    
    // Use the specified strategy to select a node
    const strategy = taskConfig?.strategy || this.options.defaultStrategy;
    
    switch (strategy) {
      case DistributionStrategy.CAPABILITY_MATCH:
        return this.selectNodeByCapability(taskId, requiredCapabilities);
        
      case DistributionStrategy.LOAD_BALANCED:
        return this.selectNodeByLoad();
        
      case DistributionStrategy.ROUND_ROBIN:
        return this.selectNodeRoundRobin();
        
      default:
        return availableNodes.length > 0 ? availableNodes[0].id : null;
    }
  }
  
  /**
   * Select a node based on capabilities
   */
  private selectNodeByCapability(taskId: string, requiredCapabilities: string[]): string | null {
    const availableNodes = this.getAvailableNodes();
    
    // If no specific capabilities are required, find capabilities from task metadata
    if (requiredCapabilities.length === 0) {
      // We would need to get task metadata here to determine capabilities
      // Extract capabilities from task ID as a fallback
      if (taskId.includes('memory')) {
        requiredCapabilities.push('memory');
      } else if (taskId.includes('io')) {
        requiredCapabilities.push('io');
      } else if (taskId.includes('compute')) {
        requiredCapabilities.push('compute');
      }
    }
    
    // Log for debugging
    console.log(`[DistributedExecution] Required capabilities for ${taskId}:`, requiredCapabilities);
    
    // Filter nodes by required capabilities
    const capableNodes = availableNodes.filter(node => {
      // If no capabilities are required, all nodes are capable
      if (requiredCapabilities.length === 0) {
        return true;
      }
      
      // Check if the node has all required capabilities
      return requiredCapabilities.every(cap => node.capabilities.includes(cap));
    });
    
    // Log for debugging
    console.log(`[DistributedExecution] Capable nodes for ${taskId}:`, capableNodes.map(n => n.id));
    
    if (capableNodes.length === 0) {
      return null;
    }
    
    // Sort by load to prioritize less loaded nodes
    const sortedNodes = [...capableNodes].sort((a, b) => a.load - b.load);
    return sortedNodes[0].id;
  }
  
  /**
   * Select a node based on load
   */
  private selectNodeByLoad(): string | null {
    const availableNodes = this.getAvailableNodes();
    
    if (availableNodes.length === 0) {
      return null;
    }
    
    // Sort by load and return the least loaded node
    availableNodes.sort((a, b) => a.load - b.load);
    return availableNodes[0].id;
  }
  
  /**
   * Select a node using round-robin algorithm
   */
  private selectNodeRoundRobin(): string | null {
    const availableNodes = this.getAvailableNodes();
    
    if (availableNodes.length === 0) {
      return null;
    }
    
    // Move to the next node index
    this.lastNodeIndex = (this.lastNodeIndex + 1) % availableNodes.length;
    return availableNodes[this.lastNodeIndex].id;
  }
  
  /**
   * Update metrics after a distributed task execution
   */
  private updateMetrics(taskId: string, nodeId: string, executionTime: number): void {
    // Increment total count
    this.metrics.totalDistributedTasks++;
    
    // Track tasks by node
    this.metrics.tasksByNode[nodeId] = (this.metrics.tasksByNode[nodeId] || 0) + 1;
    
    // Track tasks by type
    this.metrics.taskTypeDistribution[taskId] = (this.metrics.taskTypeDistribution[taskId] || 0) + 1;
    
    // Update average response time
    this.responseTimeTotal += executionTime;
    this.metrics.averageResponseTime = this.responseTimeTotal / this.metrics.totalDistributedTasks;
  }
  
  /**
   * Increment the failure count for a node
   */
  private incrementFailureCount(nodeId: string): void {
    const currentCount = this.failureCount.get(nodeId) || 0;
    this.failureCount.set(nodeId, currentCount + 1);
  }
}

/**
 * Create a new distributed execution plugin
 */
export function createDistributedExecutionPlugin(options: DistributedExecutionPluginOptions): Extension {
  return new DistributedExecutionPlugin(options);
} 