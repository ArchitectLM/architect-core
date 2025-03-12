/**
 * DSL Integration Module
 * 
 * This module provides integration with the DSL for loading, validating,
 * migrating, and saving systems. It also provides utilities for converting
 * between DSL and runtime formats.
 */

import { 
  loadSystemFromFile, 
  validateDslSystem, 
  migrateDslSystem, 
  saveSystemToFile 
} from '../../cli/dsl-adapter';
import { ValidationResult } from '../../cli/schema-validator';
import { ReactiveSystem, Task, Flow as DslFlow } from '../../schema/types';
import { Flow, FlowStep, FlowStepType, CodeGenerationOptions, CodeGenerationResult } from '../types';
import { CodeGenerator } from './code-generation';

/**
 * Loads a system from a DSL file
 * 
 * @param filePath The path to the DSL file
 * @returns The loaded system
 */
export async function loadSystemFromDsl(filePath: string): Promise<ReactiveSystem> {
  return loadSystemFromFile(filePath);
}

/**
 * Validates a system using DSL validation
 * 
 * @param system The system to validate
 * @returns The validation result
 */
export function validateSystem(system: ReactiveSystem): ValidationResult {
  const validationResult = validateDslSystem(system);
  
  return validationResult;
}

/**
 * Migrates a system to a new version
 * 
 * @param system The system to migrate
 * @param targetVersion The target version
 * @param transformerCode Optional transformer code
 * @returns The migrated system
 */
export function migrateSystem(
  system: ReactiveSystem,
  targetVersion: string,
  transformerCode?: string
): ReactiveSystem {
  return migrateDslSystem(system, targetVersion, transformerCode);
}

/**
 * Saves a system to a DSL file
 * 
 * @param system The system to save
 * @param outputPath The output path
 */
export async function saveSystemToDsl(
  system: ReactiveSystem,
  outputPath: string
): Promise<void> {
  await saveSystemToFile(system, outputPath);
}

/**
 * Converts a flow to DSL format
 * 
 * @param flow The flow to convert
 * @returns The DSL flow
 */
export function convertFlowToDsl(flow: Flow): DslFlow {
  // Create a DSL flow from a runtime flow
  const dslFlow: DslFlow = {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    trigger: `flow_${flow.id}_trigger`,
    steps: []
  };
  
  // Convert steps
  for (const step of flow.steps) {
    switch (step.type) {
      case FlowStepType.TASK:
        dslFlow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: 'task',
          taskId: step.taskId
        });
        break;
      case FlowStepType.CONDITION:
        dslFlow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: 'decision',
          condition: 'condition_expression',
          branches: [
            {
              id: `${step.id}_then`,
              name: 'Then',
              steps: step.thenSteps?.map(s => s.id) || []
            },
            {
              id: `${step.id}_else`,
              name: 'Else',
              steps: step.elseSteps?.map(s => s.id) || []
            }
          ]
        });
        break;
      case FlowStepType.PARALLEL:
        dslFlow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: 'parallel',
          branches: step.parallelSteps?.map(s => ({
            id: `${step.id}_${s.id}`,
            name: s.name || s.id,
            steps: [s.id]
          })) || []
        });
        break;
      case FlowStepType.WAIT:
        dslFlow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: 'wait',
          waitTime: step.waitTime || 0
        });
        break;
    }
  }
  
  return dslFlow;
}

/**
 * Converts a DSL flow to runtime format
 * 
 * @param dslFlow The DSL flow to convert
 * @returns The runtime flow
 */
export function convertDslToFlow(dslFlow: DslFlow): Flow {
  // Create a runtime flow from a DSL flow
  const flow: Flow = {
    id: dslFlow.id,
    name: dslFlow.name,
    description: dslFlow.description,
    steps: []
  };
  
  // Create a map of step IDs to steps
  const stepMap: Record<string, any> = {};
  for (const step of dslFlow.steps) {
    stepMap[step.id] = step;
  }
  
  // Convert steps
  for (const step of dslFlow.steps) {
    switch (step.type) {
      case 'task':
        flow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: FlowStepType.TASK,
          taskId: step.taskId
        });
        break;
      case 'decision':
        const thenSteps: FlowStep[] = [];
        const elseSteps: FlowStep[] = [];
        
        // Get then steps
        if (step.branches && step.branches.length > 0) {
          const thenBranch = step.branches[0];
          for (const stepId of thenBranch.steps) {
            const thenStep = stepMap[stepId];
            if (thenStep) {
              thenSteps.push(convertDslStepToFlowStep(thenStep, stepMap));
            }
          }
          
          // Get else steps
          if (step.branches.length > 1) {
            const elseBranch = step.branches[1];
            for (const stepId of elseBranch.steps) {
              const elseStep = stepMap[stepId];
              if (elseStep) {
                elseSteps.push(convertDslStepToFlowStep(elseStep, stepMap));
              }
            }
          }
        }
        
        flow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: FlowStepType.CONDITION,
          condition: () => true, // Default condition
          thenSteps,
          elseSteps
        });
        break;
      case 'parallel':
        const parallelSteps: FlowStep[] = [];
        
        // Get parallel steps
        if (step.branches) {
          for (const branch of step.branches) {
            for (const stepId of branch.steps) {
              const parallelStep = stepMap[stepId];
              if (parallelStep) {
                parallelSteps.push(convertDslStepToFlowStep(parallelStep, stepMap));
              }
            }
          }
        }
        
        flow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: FlowStepType.PARALLEL,
          parallelSteps
        });
        break;
      case 'wait':
        flow.steps.push({
          id: step.id,
          name: step.name,
          description: step.description,
          type: FlowStepType.WAIT,
          waitTime: step.waitTime || 0
        });
        break;
    }
  }
  
  return flow;
}

/**
 * Converts a DSL step to a flow step
 * 
 * @param dslStep The DSL step to convert
 * @param stepMap A map of step IDs to steps
 * @returns The flow step
 */
function convertDslStepToFlowStep(dslStep: any, stepMap: Record<string, any>): FlowStep {
  switch (dslStep.type) {
    case 'task':
      return {
        id: dslStep.id,
        name: dslStep.name,
        description: dslStep.description,
        type: FlowStepType.TASK,
        taskId: dslStep.taskId
      };
    case 'decision':
      const thenSteps: FlowStep[] = [];
      const elseSteps: FlowStep[] = [];
      
      // Get then steps
      if (dslStep.branches && dslStep.branches.length > 0) {
        const thenBranch = dslStep.branches[0];
        for (const stepId of thenBranch.steps) {
          const thenStep = stepMap[stepId];
          if (thenStep) {
            thenSteps.push(convertDslStepToFlowStep(thenStep, stepMap));
          }
        }
        
        // Get else steps
        if (dslStep.branches.length > 1) {
          const elseBranch = dslStep.branches[1];
          for (const stepId of elseBranch.steps) {
            const elseStep = stepMap[stepId];
            if (elseStep) {
              elseSteps.push(convertDslStepToFlowStep(elseStep, stepMap));
            }
          }
        }
      }
      
      return {
        id: dslStep.id,
        name: dslStep.name,
        description: dslStep.description,
        type: FlowStepType.CONDITION,
        condition: () => true, // Default condition
        thenSteps,
        elseSteps
      };
    case 'parallel':
      const parallelSteps: FlowStep[] = [];
      
      // Get parallel steps
      if (dslStep.branches) {
        for (const branch of dslStep.branches) {
          for (const stepId of branch.steps) {
            const parallelStep = stepMap[stepId];
            if (parallelStep) {
              parallelSteps.push(convertDslStepToFlowStep(parallelStep, stepMap));
            }
          }
        }
      }
      
      return {
        id: dslStep.id,
        name: dslStep.name,
        description: dslStep.description,
        type: FlowStepType.PARALLEL,
        parallelSteps
      };
    case 'wait':
      return {
        id: dslStep.id,
        name: dslStep.name,
        description: dslStep.description,
        type: FlowStepType.WAIT,
        waitTime: dslStep.waitTime || 0
      };
    default:
      return {
        id: dslStep.id,
        name: dslStep.name,
        description: dslStep.description,
        type: FlowStepType.TASK,
        taskId: 'unknown'
      };
  }
}

/**
 * Generates code for a task
 * 
 * @param taskId The task ID
 * @param system The system
 * @param options Code generation options
 * @returns The generated code
 */
export async function generateTaskCode(
  taskId: string,
  system: ReactiveSystem,
  options: CodeGenerationOptions
): Promise<CodeGenerationResult> {
  if (!system.tasks || !system.tasks[taskId]) {
    throw new Error(`Task ${taskId} does not exist in the system`);
  }
  
  const task = system.tasks[taskId];
  const codeGenerator = new CodeGenerator();
  
  return codeGenerator.generateTaskCode(task, system, options);
}

/**
 * Generates code for a flow
 * 
 * @param flowId The flow ID
 * @param system The system
 * @param options Code generation options
 * @returns The generated code
 */
export async function generateFlowCode(
  flowId: string,
  system: ReactiveSystem,
  options: CodeGenerationOptions
): Promise<CodeGenerationResult> {
  if (!system.flows || !system.flows[flowId]) {
    throw new Error(`Flow ${flowId} does not exist in the system`);
  }
  
  const flow = system.flows[flowId];
  const codeGenerator = new CodeGenerator();
  
  return codeGenerator.generateFlowCode(flow, system, options);
} 