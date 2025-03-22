import { Extension } from '../models/extension';
import { ProcessDefinition, ProcessInstance } from '../models/index';
import { EventBus } from '../models/event';

interface ProcessCheckpoint {
  id: string;
  processId: string;
  state: string;
  data: any;
  version: string;
  timestamp: number;
}

export class ProcessRecoveryPlugin implements Extension {
  name = 'process-recovery';
  description = 'Handles process versioning, checkpointing, and recovery';

  private checkpoints: Map<string, ProcessCheckpoint> = new Map();
  private processVersions: Map<string, Map<string, ProcessDefinition>> = new Map();

  constructor(private eventBus: EventBus) {}

  getExtension(): Extension {
    return {
      name: this.name,
      description: this.description,
      hooks: this.hooks
    };
  }

  initialize(): void {
    // No initialization needed
  }

  hooks = {
    'process:beforeCheckpoint': async (context: any) => {
      const { process, checkpointId } = context;
      
      // Create checkpoint
      const checkpoint: ProcessCheckpoint = {
        id: checkpointId,
        processId: process.id,
        state: process.state,
        data: { ...process.data },
        version: process.version || '1.0',
        timestamp: Date.now()
      };

      this.checkpoints.set(checkpointId, checkpoint);

      // Emit checkpoint event
      this.eventBus.publish('process:checkpointed', {
        processId: process.id,
        checkpointId,
        state: process.state,
        version: process.version
      }, {
        metadata: {
          source: 'process-recovery',
          version: process.version
        }
      });

      return {
        ...context,
        checkpoint
      };
    },

    'process:beforeRestore': async (context: any) => {
      const { processId, checkpointId } = context;
      
      const checkpoint = this.checkpoints.get(checkpointId);
      if (!checkpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }

      if (checkpoint.processId !== processId) {
        throw new Error(`Checkpoint ${checkpointId} does not belong to process ${processId}`);
      }

      const restored: ProcessInstance = {
        id: processId,
        type: checkpoint.processId,
        state: checkpoint.state,
        data: { ...checkpoint.data },
        version: checkpoint.version,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recovery: {
          checkpointId,
          lastSavedAt: checkpoint.timestamp
        }
      };

      // Emit restore event
      this.eventBus.publish('process:restored', {
        processId,
        checkpointId,
        state: checkpoint.state,
        version: checkpoint.version
      }, {
        metadata: {
          source: 'process-recovery',
          version: checkpoint.version
        }
      });

      return {
        ...context,
        restored
      };
    }
  };

  registerProcessVersion(definition: ProcessDefinition): void {
    if (!this.processVersions.has(definition.id)) {
      this.processVersions.set(definition.id, new Map());
    }
    this.processVersions.get(definition.id)!.set(definition.version || '1.0', definition);
  }

  getProcessDefinition(processId: string, version?: string): ProcessDefinition | undefined {
    const versions = this.processVersions.get(processId);
    if (!versions) {
      return undefined;
    }

    if (version) {
      return versions.get(version);
    }

    // Return the latest version if none specified
    const sortedVersions = Array.from(versions.keys()).sort((a, b) => {
      const [majorA, minorA] = a.split('.').map(Number);
      const [majorB, minorB] = b.split('.').map(Number);
      return majorB - majorA || minorB - minorA;
    });

    return versions.get(sortedVersions[0] || '1.0');
  }

  getCheckpoint(checkpointId: string): ProcessCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  getProcessCheckpoints(processId: string): ProcessCheckpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(cp => cp.processId === processId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Utility methods for testing and debugging
  getRegisteredProcessIds(): string[] {
    return Array.from(this.processVersions.keys());
  }

  getProcessVersions(processId: string): string[] {
    const versions = this.processVersions.get(processId);
    return versions ? Array.from(versions.keys()) : [];
  }

  clear(): void {
    this.checkpoints.clear();
    this.processVersions.clear();
  }
}

export function createProcessRecoveryPlugin(eventBus: EventBus): ProcessRecoveryPlugin {
  return new ProcessRecoveryPlugin(eventBus);
} 