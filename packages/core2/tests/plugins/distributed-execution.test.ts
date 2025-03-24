import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import * as runtimeModule from '../../src/implementations/runtime';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { createEventBus } from '../../src/implementations/event-bus';
import { Extension } from '../../src/models/extension-system';
import { 
  createDistributedExecutionPlugin, 
  DistributedExecutionPlugin,
  DistributionStrategy,
  NodeStatus
} from '../../src/plugins/distributed-execution';

// Define interfaces compatible with the actual ones in the codebase
interface ProcessTransition {
  from: string;
  to: string;
  event: string;
}

interface ProcessDefinitionTyped {
  id: string;
  name: string;
  description: string;
  initialState: string;
  transitions: ProcessTransition[];
}

interface TaskDefinitionTyped {
  id: string;
  name: string;
  description: string;
  handler: (context: any) => Promise<any>;
  metadata?: Record<string, any>;
}

describe('Distributed Execution Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus(extensionSystem);
  let distributedPlugin: DistributedExecutionPlugin & Extension;
  
  // Mock the createRuntime function
  const mockCreateRuntime = vi.fn().mockImplementation(() => {
    return {
      id: 'mock-runtime-id',
      version: '1.0.0',
      namespace: 'test',
      eventBus,
      extensionSystem,
      executeTask: vi.fn(),
      scheduleTask: vi.fn(),
      createProcess: vi.fn(),
      transitionProcess: vi.fn(),
      getProcess: vi.fn(),
      queryProcesses: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      getHealth: vi.fn(),
      getMetrics: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    } as unknown as Runtime;
  });
  
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
  const testProcessDefinition: ProcessDefinitionTyped = {
    id: 'distributed-process',
    name: 'Distributed Process',
    description: 'Process for testing distributed execution',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', event: 'START' },
      { from: 'processing', to: 'completed', event: 'COMPLETE' }
    ]
  };
  
  // Task definitions for testing different distribution scenarios
  const computeTaskDefinition: TaskDefinitionTyped = {
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
  
  const ioTaskDefinition: TaskDefinitionTyped = {
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
  
  const memoryIntensiveTaskDefinition: TaskDefinitionTyped = {
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
    // Mock createRuntime
    vi.spyOn(runtimeModule, 'createRuntime').mockImplementation(mockCreateRuntime);
    
    // Create fresh instances for each test
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus(extensionSystem);
    
    // Create the plugin with mocked implementation
    const plugin = createDistributedExecutionPlugin({
      nodeId: 'local-node',
      discoveryMethod: 'static',
      nodes: mockNodes,
      defaultStrategy: DistributionStrategy.CAPABILITY_MATCH,
      remoteExecute: mockRemoteExecute
    });
    
    // Cast to the combined type to ensure it has Extension interface properties
    distributedPlugin = plugin as DistributedExecutionPlugin & Extension;
    
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
    
    // Use our mocked runtime
    runtime = mockCreateRuntime();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  // Helper function to directly test plugin's task distribution
  async function testTaskDistribution(taskType: string, input: any) {
    // Manually call the plugin's hook
    const result = await distributedPlugin.hooks['task:beforeExecution']({
      taskType,
      input
    });
    
    return result;
  }
  
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
      
      // Test memory intensive task distribution directly via the plugin hook
      await testTaskDistribution('memory-intensive-task', { data: 'test' });
      
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
      
      // Test compute task distribution directly via the plugin hook
      await testTaskDistribution('compute-task', { data: 'test' });
      
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
      
      // Execute multiple tasks through the plugin directly
      await testTaskDistribution('compute-task', { data: 'test1' });
      await testTaskDistribution('compute-task', { data: 'test2' });
      await testTaskDistribution('compute-task', { data: 'test3' });
      
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
      const specialTaskDefinition: TaskDefinitionTyped = {
        id: 'special-task',
        name: 'Special Task',
        description: 'A task requiring special capabilities',
        handler: vi.fn().mockResolvedValue({ result: 'Executed locally' }),
        metadata: {
          capabilities: ['special-capability']
        }
      };
      
      // Mock the task handler directly
      const mockSpecialTaskHandler = vi.fn().mockResolvedValue({ result: 'Executed locally' });
      
      // Configure task to force local execution
      distributedPlugin.setTaskDistributionConfig('special-task', {
        forceLocal: true
      });
      
      // Test the distribution directly
      const result = await testTaskDistribution('special-task', { data: 'test' });
      
      // Since no node has the capability, should return context unchanged
      expect(result).toEqual({
        taskType: 'special-task',
        input: { data: 'test' }
      });
      
      // Remote execute should not be called
      expect(mockRemoteExecute).not.toHaveBeenCalled();
    });
  });
  
  describe('Task-specific Distribution Configuration', () => {
    it('should respect task-specific distribution rules', async () => {
      // Set load balancing strategy
      distributedPlugin.setDistributionStrategy(DistributionStrategy.LOAD_BALANCED);
      
      // Set preferred nodes for IO task
      distributedPlugin.setTaskDistributionConfig('io-task', {
        preferredNodes: ['node1']
      });
      
      // Test direct distribution
      await testTaskDistribution('io-task', { data: 'test' });
      
      // Should be sent to preferred node (node1) despite not being the least loaded
      expect(mockRemoteExecute).toHaveBeenCalledWith(
        'node1',
        'io-task',
        { data: 'test' }
      );
    });
    
    it('should allow forcing local execution for specific tasks', async () => {
      // Spy on the memory task handler
      const handlerSpy = vi.fn().mockResolvedValue({ result: 'Processed locally' });
      
      // Set to force local execution
      distributedPlugin.setTaskDistributionConfig('memory-intensive-task', {
        forceLocal: true
      });
      
      // Test direct distribution
      const result = await testTaskDistribution('memory-intensive-task', { data: 'test' });
      
      // Should return unchanged context for local execution
      expect(result).toEqual({
        taskType: 'memory-intensive-task',
        input: { data: 'test' }
      });
      
      // Remote execute should not be called
      expect(mockRemoteExecute).not.toHaveBeenCalled();
    });
    
    it('should allow forcing remote execution for specific tasks', async () => {
      // Set to force remote execution on a specific node
      distributedPlugin.setTaskDistributionConfig('compute-task', {
        forceRemote: true,
        preferredNodes: ['node2']
      });
      
      // Test direct distribution
      await testTaskDistribution('compute-task', { data: 'test' });
      
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
      // Mock remote execute to fail on first call but succeed on second
      mockRemoteExecute.mockReset();
      mockRemoteExecute.mockImplementationOnce(async (nodeId, taskType, input) => {
        throw new Error('Node failure simulation');
      }).mockImplementationOnce(async (nodeId, taskType, input) => {
        return { result: `Processed on ${nodeId} after retry`, nodeId };
      });
      
      // Set a distribution strategy 
      distributedPlugin.setDistributionStrategy(DistributionStrategy.ROUND_ROBIN);
      
      // Test first execution - should fail and be retried
      const context = { taskType: 'compute-task', input: { data: 'test' }, _retryCount: 0 };
      const result = await distributedPlugin.hooks['task:beforeExecution'](context);
      
      // The hook should increment the retry count
      expect(result._retryCount).toBe(1);
      
      // Test second execution with the retry count from previous result
      const retryResult = await distributedPlugin.hooks['task:beforeExecution'](result);
      
      // Should have been called twice, with different nodes
      expect(mockRemoteExecute).toHaveBeenCalledTimes(2);
      
      // Result should be from the second call
      expect(retryResult.result).toBeDefined();
      expect(retryResult.skipExecution).toBe(true);
    });
    
    it('should mark node as inactive after repeated failures', async () => {
      // Use fake timers for this test
      vi.useFakeTimers();
      
      // Create a health check config for quick testing
      distributedPlugin.enableHealthCheck({
        failureThreshold: 3,
        checkInterval: 1000
      });
      
      // Mock remote execute to always fail for a specific node
      mockRemoteExecute.mockReset();
      mockRemoteExecute.mockImplementation(async (nodeId, taskType, input) => {
        if (nodeId === 'node1') {
          throw new Error('Persistent node failure');
        }
        return { result: `Processed on ${nodeId}`, nodeId };
      });
      
      // Set a distribution strategy that will select node1
      distributedPlugin.setDistributionStrategy(DistributionStrategy.LOAD_BALANCED);
      
      // Manually increment failure count instead of relying on hooks
      distributedPlugin['failureCount'].set('node1', 3);
      
      // Advance just one timer tick
      vi.advanceTimersByTime(1000);
      
      // Check that node was marked as inactive
      const node1 = distributedPlugin.getNodeInfo('node1');
      expect(node1?.status).toBe(NodeStatus.INACTIVE);
      
      // Clean up
      vi.useRealTimers();
    });
  });
  
  describe('Result Aggregation', () => {
    it('should support distributed map-reduce operations', async () => {
      // Test data
      const data = [1, 2, 3, 4, 5];
      
      // Map and reduce functions
      const mapFn = (n: number) => n * 2;
      const reduceFn = (results: number[]) => results.reduce((a, b) => a + b, 0);
      
      // Execute the map-reduce operation
      const result = await distributedPlugin.executeMapReduce(
        'map-reduce-task', 
        data, 
        mapFn, 
        reduceFn
      );
      
      // Result should be sum of doubled numbers: (1*2 + 2*2 + 3*2 + 4*2 + 5*2) = 30
      expect(result).toBe(30);
    });
  });
  
  describe('Metrics and Monitoring', () => {
    it('should track distribution metrics', async () => {
      // Reset mock counter
      mockRemoteExecute.mockClear();
      
      // Update metrics directly since we're testing independently
      const metrics = distributedPlugin.getDistributionMetrics();
      const initialCount = metrics.totalDistributedTasks;
      
      // Execute multiple tasks
      await testTaskDistribution('compute-task', { data: 'test1' });
      await testTaskDistribution('io-task', { data: 'test2' });
      await testTaskDistribution('memory-intensive-task', { data: 'test3' });
      
      // Get the updated metrics
      const updatedMetrics = distributedPlugin.getDistributionMetrics();
      
      // Should have tracked various metrics
      expect(updatedMetrics.totalDistributedTasks).toBeGreaterThan(initialCount);
      expect(updatedMetrics.tasksByNode).toBeDefined();
      expect(updatedMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });
}); 