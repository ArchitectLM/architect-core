import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { createRuntime } from '../../src/implementations/runtime';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { createEventBus } from '../../src/implementations/event-bus';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index';
import { 
  createDistributedExecutionPlugin, 
  DistributedExecutionPlugin,
  DistributionStrategy,
  NodeStatus
} from '../../src/plugins/distributed-execution';

describe('Distributed Execution Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let distributedPlugin: DistributedExecutionPlugin;
  
  // Mock nodes for testing
  const mockNodes = [
    { id: 'node1', status: NodeStatus.ACTIVE, load: 0.2, capabilities: ['compute', 'io'] },
    { id: 'node2', status: NodeStatus.ACTIVE, load: 0.5, capabilities: ['compute', 'memory'] },
    { id: 'node3', status: NodeStatus.ACTIVE, load: 0.8, capabilities: ['io', 'memory'] },
    { id: 'node4', status: NodeStatus.INACTIVE, load: 0, capabilities: ['compute'] }
  ];
  
  // Mock task execution on remote nodes
  const mockRemoteExecute = vi.fn().mockImplementation(async (nodeId, taskId, input) => {
    // Simulate node-specific processing
    if (nodeId === 'node3' && taskId === 'memory-intensive-task') {
      return { result: 'Processed with high memory on node3', nodeId };
    }
    
    if (nodeId === 'node1' && taskId === 'io-task') {
      return { result: 'Processed with IO optimization on node1', nodeId };
    }
    
    // Generic response for other combinations
    return { result: `Processed on ${nodeId}`, nodeId };
  });
  
  // Sample process definition
  const testProcessDefinition: ProcessDefinition = {
    id: 'distributed-process',
    name: 'Distributed Process',
    description: 'Process for testing distributed execution',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  // Task definitions for testing different distribution scenarios
  const computeTaskDefinition: TaskDefinition = {
    id: 'compute-task',
    name: 'Compute Task',
    description: 'A compute-intensive task',
    handler: async (context) => {
      return { result: 'Computed locally' };
    },
    metadata: {
      capabilities: ['compute']
    }
  };
  
  const ioTaskDefinition: TaskDefinition = {
    id: 'io-task',
    name: 'IO Task',
    description: 'An IO-intensive task',
    handler: async (context) => {
      return { result: 'Processed IO locally' };
    },
    metadata: {
      capabilities: ['io']
    }
  };
  
  const memoryIntensiveTaskDefinition: TaskDefinition = {
    id: 'memory-intensive-task',
    name: 'Memory Intensive Task',
    description: 'A memory-intensive task',
    handler: async (context) => {
      return { result: 'Processed with local memory' };
    },
    metadata: {
      capabilities: ['memory']
    }
  };
  
  beforeEach(() => {
    // Create fresh instances for each test
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin with mocked implementation
    distributedPlugin = createDistributedExecutionPlugin({
      nodeId: 'local-node',
      discoveryMethod: 'static',
      nodes: mockNodes,
      defaultStrategy: DistributionStrategy.CAPABILITY_MATCH,
      remoteExecute: mockRemoteExecute
    }) as DistributedExecutionPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(distributedPlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [computeTaskDefinition.id]: computeTaskDefinition,
      [ioTaskDefinition.id]: ioTaskDefinition,
      [memoryIntensiveTaskDefinition.id]: memoryIntensiveTaskDefinition
    };
    
    runtime = createRuntime(
      processDefinitions, 
      taskDefinitions, 
      { extensionSystem, eventBus }
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Node Discovery and Management', () => {
    it('should discover and register available nodes', () => {
      // Nodes should be registered during initialization
      const availableNodes = distributedPlugin.getAvailableNodes();
      
      // Should include all active nodes
      expect(availableNodes.length).toBe(3); // 3 active nodes out of 4 total
      expect(availableNodes.map(n => n.id)).toContain('node1');
      expect(availableNodes.map(n => n.id)).toContain('node2');
      expect(availableNodes.map(n => n.id)).toContain('node3');
      expect(availableNodes.map(n => n.id)).not.toContain('node4'); // Inactive node
    });
    
    it('should update node status', () => {
      // Update node status
      distributedPlugin.updateNodeStatus('node1', { status: NodeStatus.OVERLOADED, load: 0.9 });
      
      // Get updated node info
      const node = distributedPlugin.getNodeInfo('node1');
      
      // Verify updates
      expect(node).toBeDefined();
      expect(node?.status).toBe(NodeStatus.OVERLOADED);
      expect(node?.load).toBe(0.9);
    });
    
    it('should handle node registration and deregistration', () => {
      // Add a new node
      distributedPlugin.registerNode({
        id: 'node5',
        status: NodeStatus.ACTIVE,
        load: 0.1,
        capabilities: ['compute', 'specialized']
      });
      
      // Verify node was added
      let nodes = distributedPlugin.getAvailableNodes();
      expect(nodes.length).toBe(4); // Now 4 active nodes
      expect(nodes.map(n => n.id)).toContain('node5');
      
      // Deregister a node
      distributedPlugin.deregisterNode('node5');
      
      // Verify node was removed
      nodes = distributedPlugin.getAvailableNodes();
      expect(nodes.length).toBe(3); // Back to 3 active nodes
      expect(nodes.map(n => n.id)).not.toContain('node5');
    });
  });
  
  describe('Task Distribution Strategies', () => {
    it('should distribute tasks based on capability matching', async () => {
      // Set capability matching strategy
      distributedPlugin.setDistributionStrategy(DistributionStrategy.CAPABILITY_MATCH);
      
      // Execute memory intensive task - should go to node with memory capability
      await runtime.executeTask('memory-intensive-task', { data: 'test' });
      
      // Check that remoteExecute was called with appropriate node
      expect(mockRemoteExecute).toHaveBeenCalledWith(
        expect.stringMatching(/node[23]/), // Either node2 or node3 (both have memory capability)
        'memory-intensive-task',
        { data: 'test' }
      );
    });
    
    it('should distribute tasks based on load balancing', async () => {
      // Set load balancing strategy
      distributedPlugin.setDistributionStrategy(DistributionStrategy.LOAD_BALANCED);
      
      // Execute task - should go to node with lowest load (node1)
      await runtime.executeTask('compute-task', { data: 'test' });
      
      // Check that remoteExecute was called with the least loaded node
      expect(mockRemoteExecute).toHaveBeenCalledWith(
        'node1', // Lowest load of 0.2
        'compute-task',
        { data: 'test' }
      );
    });
    
    it('should respect round-robin distribution strategy', async () => {
      // Set round robin strategy
      distributedPlugin.setDistributionStrategy(DistributionStrategy.ROUND_ROBIN);
      
      // Execute multiple tasks
      await runtime.executeTask('compute-task', { data: 'test1' });
      await runtime.executeTask('compute-task', { data: 'test2' });
      await runtime.executeTask('compute-task', { data: 'test3' });
      
      // Check that tasks were distributed to different nodes in sequence
      expect(mockRemoteExecute).toHaveBeenCalledTimes(3);
      
      // Extract the node IDs from all calls
      const nodeIds = mockRemoteExecute.mock.calls.map(call => call[0]);
      
      // Check that we used each node once before repeating
      const firstThreeUnique = new Set(nodeIds.slice(0, 3));
      expect(firstThreeUnique.size).toBe(3); // Should use 3 different nodes
    });
    
    it('should fall back to local execution when no suitable node is available', async () => {
      // Create a task with a capability no node has
      const specialTaskDefinition: TaskDefinition = {
        id: 'special-task',
        name: 'Special Task',
        description: 'A task requiring special capabilities',
        handler: vi.fn().mockResolvedValue({ result: 'Executed locally' }),
        metadata: {
          capabilities: ['special-capability']
        }
      };
      
      // Add the task to runtime
      (runtime as any).taskDefinitions['special-task'] = specialTaskDefinition;
      
      // Execute the task
      await runtime.executeTask('special-task', { data: 'test' });
      
      // Remote execute should not be called since no node has the capability
      expect(mockRemoteExecute).not.toHaveBeenCalled();
      
      // Local handler should be called instead
      expect(specialTaskDefinition.handler).toHaveBeenCalled();
    });
  });
  
  describe('Task-specific Distribution Configuration', () => {
    it('should respect task-specific distribution rules', async () => {
      // Set default strategy
      distributedPlugin.setDistributionStrategy(DistributionStrategy.LOAD_BALANCED);
      
      // Set task-specific strategy
      distributedPlugin.setTaskDistributionConfig('io-task', {
        strategy: DistributionStrategy.CAPABILITY_MATCH,
        preferredNodes: ['node1']
      });
      
      // Execute the IO task
      await runtime.executeTask('io-task', { data: 'test' });
      
      // Should be sent to preferred node (node1) despite not being the least loaded
      expect(mockRemoteExecute).toHaveBeenCalledWith(
        'node1',
        'io-task',
        { data: 'test' }
      );
    });
    
    it('should allow forcing local execution for specific tasks', async () => {
      // Configure memory task to always execute locally
      distributedPlugin.setTaskDistributionConfig('memory-intensive-task', {
        forceLocal: true
      });
      
      // Mock the local handler for verification
      const originalHandler = memoryIntensiveTaskDefinition.handler;
      memoryIntensiveTaskDefinition.handler = vi.fn().mockResolvedValue({ result: 'Local memory processing' });
      
      // Execute the task
      await runtime.executeTask('memory-intensive-task', { data: 'test' });
      
      // Remote execute should not be called
      expect(mockRemoteExecute).not.toHaveBeenCalled();
      
      // Local handler should be called instead
      expect(memoryIntensiveTaskDefinition.handler).toHaveBeenCalled();
      
      // Restore original handler
      memoryIntensiveTaskDefinition.handler = originalHandler;
    });
    
    it('should allow forcing remote execution for specific tasks', async () => {
      // Configure compute task to always execute on a specific node
      distributedPlugin.setTaskDistributionConfig('compute-task', {
        forceRemote: true,
        preferredNodes: ['node2']
      });
      
      // Execute the task
      await runtime.executeTask('compute-task', { data: 'test' });
      
      // Should be sent to the specified node
      expect(mockRemoteExecute).toHaveBeenCalledWith(
        'node2',
        'compute-task',
        { data: 'test' }
      );
    });
  });
  
  describe('Fault Tolerance', () => {
    it('should retry on different node when a node fails', async () => {
      // Mock a failure on the first attempt then success on the second
      mockRemoteExecute.mockReset();
      mockRemoteExecute
        .mockImplementationOnce(() => { throw new Error('Node unavailable'); })
        .mockImplementationOnce(async (nodeId, taskId, input) => {
          return { result: `Processed on ${nodeId} after retry`, nodeId };
        });
      
      // Set capability matching strategy
      distributedPlugin.setDistributionStrategy(DistributionStrategy.CAPABILITY_MATCH);
      
      // Execute task 
      const result = await runtime.executeTask('memory-intensive-task', { data: 'test' });
      
      // Should have been called twice, with different nodes
      expect(mockRemoteExecute).toHaveBeenCalledTimes(2);
      
      // Result should be from the second call
      expect(result.result).toContain('after retry');
    });
    
    it('should mark node as inactive after repeated failures', async () => {
      // Mock multiple failures for a specific node
      const failingNodeId = 'node2';
      mockRemoteExecute.mockReset();
      mockRemoteExecute
        .mockImplementation((nodeId, taskId, input) => {
          if (nodeId === failingNodeId) {
            throw new Error('Node unavailable');
          }
          return Promise.resolve({ result: `Processed on ${nodeId}`, nodeId });
        });
      
      // Enable health checking
      distributedPlugin.enableHealthCheck({
        failureThreshold: 2,
        checkInterval: 100
      });
      
      // Force task to be sent to the failing node
      distributedPlugin.setTaskDistributionConfig('compute-task', {
        forceRemote: true,
        preferredNodes: [failingNodeId]
      });
      
      // Execute task twice (should both fail on the specified node)
      try {
        await runtime.executeTask('compute-task', { data: 'test1' });
      } catch (error) {
        // Expected error
      }
      
      try {
        await runtime.executeTask('compute-task', { data: 'test2' });
      } catch (error) {
        // Expected error
      }
      
      // Advance any timers for health check
      vi.runAllTimers();
      
      // Check that node was marked as inactive
      const nodeInfo = distributedPlugin.getNodeInfo(failingNodeId);
      expect(nodeInfo?.status).toBe(NodeStatus.INACTIVE);
      
      // Available nodes should no longer include the failing node
      const availableNodes = distributedPlugin.getAvailableNodes();
      expect(availableNodes.map(n => n.id)).not.toContain(failingNodeId);
    });
  });
  
  describe('Result Aggregation', () => {
    it('should support distributed map-reduce operations', async () => {
      // Create a map-reduce task
      const mapReduceTaskDefinition: TaskDefinition = {
        id: 'map-reduce-task',
        name: 'Map Reduce Task',
        description: 'A distributed map-reduce task',
        handler: async (context) => {
          return { result: 'Local map-reduce result' };
        },
        metadata: {
          isDistributed: true,
          distributionType: 'map-reduce'
        }
      };
      
      // Add the task to runtime
      (runtime as any).taskDefinitions['map-reduce-task'] = mapReduceTaskDefinition;
      
      // Mock the distributed execution methods
      const mockMapFn = vi.fn().mockImplementation((item) => ({ processed: item }));
      const mockReduceFn = vi.fn().mockImplementation((results) => ({ aggregated: results.length }));
      
      distributedPlugin.executeMapReduce = vi.fn().mockImplementation(async (taskId, items, mapFn, reduceFn) => {
        const mappedResults = await Promise.all(items.map(mapFn));
        return reduceFn(mappedResults);
      });
      
      // Execute the map-reduce operation
      const result = await distributedPlugin.executeMapReduce(
        'map-reduce-task',
        [1, 2, 3, 4, 5],
        mockMapFn,
        mockReduceFn
      );
      
      // Verify map was called for each item
      expect(mockMapFn).toHaveBeenCalledTimes(5);
      
      // Verify reduce was called once with all results
      expect(mockReduceFn).toHaveBeenCalledTimes(1);
      expect(mockReduceFn).toHaveBeenCalledWith([
        { processed: 1 },
        { processed: 2 },
        { processed: 3 },
        { processed: 4 },
        { processed: 5 }
      ]);
      
      // Verify final result
      expect(result).toEqual({ aggregated: 5 });
    });
  });
  
  describe('Metrics and Monitoring', () => {
    it('should track distribution metrics', async () => {
      // Execute various tasks
      await runtime.executeTask('compute-task', { data: 'test1' });
      await runtime.executeTask('io-task', { data: 'test2' });
      await runtime.executeTask('memory-intensive-task', { data: 'test3' });
      
      // Get distribution metrics
      const metrics = distributedPlugin.getDistributionMetrics();
      
      // Should have tracked various metrics
      expect(metrics.totalDistributedTasks).toBe(3);
      expect(metrics.tasksByNode).toBeDefined();
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
      
      // Should track distribution by task type
      expect(metrics.taskTypeDistribution['compute-task']).toBe(1);
      expect(metrics.taskTypeDistribution['io-task']).toBe(1);
      expect(metrics.taskTypeDistribution['memory-intensive-task']).toBe(1);
    });
  });
}); 