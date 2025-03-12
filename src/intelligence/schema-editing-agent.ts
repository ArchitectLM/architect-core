/**
 * Schema Editing Agent
 * 
 * This module provides an agent for editing reactive system schemas using LLM.
 * It allows for natural language instructions to modify system components and
 * validates the changes to ensure schema integrity.
 */

import type { ReactiveSystem } from '../schema/types';
import { validateSystemWithResult } from '../schema/validation';
import type { LLMService } from '../services/llm-service';

/**
 * Configuration options for the Schema Editing Agent
 */
export interface SchemaEditingAgentConfig {
  /**
   * The LLM model to use for schema editing
   * @default 'gpt-4'
   */
  model?: string;
  
  /**
   * Temperature setting for the LLM
   * @default 0.2
   */
  temperature?: number;
  
  /**
   * Whether to validate changes against the schema
   * @default true
   */
  validateChanges?: boolean;
  
  /**
   * Whether to provide explanations for changes
   * @default true
   */
  provideExplanations?: boolean;
  
  /**
   * Whether to suggest additional changes
   * @default true
   */
  suggestAdditionalChanges?: boolean;
}

/**
 * Request for a schema change
 */
export interface SchemaChangeRequest {
  /**
   * Natural language instruction for the change
   */
  instruction: string;
  
  /**
   * Type of entity to modify
   */
  entityType: 'system' | 'process' | 'task' | 'boundedContext';
  
  /**
   * ID of the entity to modify
   */
  entityId: string;
  
  /**
   * Current state of the system
   */
  currentSystem: ReactiveSystem;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Whether validation succeeded
   */
  success: boolean;
  
  /**
   * List of validation errors
   */
  errors: Array<{
    /**
     * Path to the error
     */
    path: string;
    
    /**
     * Error message
     */
    message: string;
  }>;
}

/**
 * Result of a schema change operation
 */
export interface SchemaChangeResult {
  /**
   * Whether the change was successful
   */
  success: boolean;
  
  /**
   * Updated system after the change
   */
  updatedSystem: ReactiveSystem;
  
  /**
   * Description of the changes made
   */
  changeDescription: string;
  
  /**
   * Validation issues, if any
   */
  validationIssues?: ValidationResult;
  
  /**
   * Suggested additional changes
   */
  suggestedChanges?: string[];
}

/**
 * Agent for editing reactive system schemas using LLM
 */
export class SchemaEditingAgent {
  private config: Required<SchemaEditingAgentConfig>;
  private llmService: LLMService;
  
  /**
   * Creates a new schema editing agent
   * @param config Configuration options
   * @param llmService LLM service to use
   */
  constructor(config: SchemaEditingAgentConfig = {}, llmService: LLMService) {
    this.config = {
      model: config.model ?? 'gpt-4',
      temperature: config.temperature ?? 0.2,
      validateChanges: config.validateChanges ?? true,
      provideExplanations: config.provideExplanations ?? true,
      suggestAdditionalChanges: config.suggestAdditionalChanges ?? true
    };
    
    this.llmService = llmService;
  }
  
  /**
   * Applies a schema change based on a natural language instruction
   * @param request Schema change request
   * @returns Result of the schema change
   */
  async applySchemaChange(request: SchemaChangeRequest): Promise<SchemaChangeResult> {
    try {
      // Build the prompt for the LLM
      const prompt = this.buildModificationPrompt(request);
      
      // Generate the modified system using the LLM
      const response = await this.llmService.generateResponse(prompt, {
        model: this.config.model,
        temperature: this.config.temperature,
        responseFormat: { type: 'json_object' }
      });
      
      // Parse the response to get the updated system
      let updatedSystem: ReactiveSystem;
      try {
        if (typeof response.content === 'string') {
          updatedSystem = JSON.parse(response.content);
        } else {
          updatedSystem = response.content;
        }
      } catch (error) {
        return {
          success: false,
          updatedSystem: request.currentSystem,
          changeDescription: `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          validationIssues: {
            success: false,
            errors: [{ path: '', message: 'Invalid LLM response format' }]
          }
        };
      }
      
      // Validate the updated system if required
      let validationIssues: ValidationResult | undefined;
      if (this.config.validateChanges) {
        validationIssues = validateSystemWithResult(updatedSystem);
      }
      
      // Generate suggested additional changes if required
      let suggestedChanges: string[] | undefined;
      if (this.config.suggestAdditionalChanges) {
        suggestedChanges = await this.generateSuggestedChanges(
          request.currentSystem,
          updatedSystem,
          request.instruction
        );
      }
      
      // Generate a description of the changes
      const changeDescription = await this.generateChangeDescription(
        request.currentSystem,
        updatedSystem,
        request.instruction
      );
      
      return {
        success: !validationIssues || validationIssues.success,
        updatedSystem,
        changeDescription,
        validationIssues,
        suggestedChanges
      };
    } catch (error) {
      return {
        success: false,
        updatedSystem: request.currentSystem,
        changeDescription: `Error applying schema change: ${error instanceof Error ? error.message : 'Unknown error'}`,
        validationIssues: {
          success: false,
          errors: [{ path: '', message: 'Error processing schema change' }]
        }
      };
    }
  }
  
  /**
   * Explains the differences between two system versions
   * @param originalSystem Original system
   * @param updatedSystem Updated system
   * @returns Markdown-formatted explanation of the changes
   */
  async explainSchemaChange(originalSystem: ReactiveSystem, updatedSystem: ReactiveSystem): Promise<string> {
    if (!this.config.provideExplanations) {
      return 'No explanation provided';
    }
    
    const prompt = this.buildExplanationPrompt(originalSystem, updatedSystem);
    
    const response = await this.llmService.generateResponse(prompt, {
      model: this.config.model,
      temperature: this.config.temperature
    });
    
    return response.content as string;
  }
  
  /**
   * Builds a prompt for modifying the system
   * @param request Schema change request
   * @returns Prompt for the LLM
   * @private
   */
  private buildModificationPrompt(request: SchemaChangeRequest): string {
    return `
# Schema Modification Task

## Current System
\`\`\`json
${JSON.stringify(request.currentSystem, null, 2)}
\`\`\`

## Modification Request
- Entity Type: ${request.entityType}
- Entity ID: ${request.entityId}
- Instruction: ${request.instruction}

## Task
Please modify the system according to the instruction. Return the complete modified system as a valid JSON object.

Important guidelines:
1. Preserve all existing IDs and references
2. Ensure the modified system adheres to the schema
3. Only make changes related to the instruction
4. Return the complete system, not just the modified entity

Return only the JSON of the modified system without any additional text or explanation.
`;
  }
  
  /**
   * Builds a prompt for explaining changes
   * @param originalSystem Original system
   * @param updatedSystem Updated system
   * @returns Prompt for the LLM
   * @private
   */
  private buildExplanationPrompt(originalSystem: ReactiveSystem, updatedSystem: ReactiveSystem): string {
    return `
# Schema Change Explanation Task

## Original System
\`\`\`json
${JSON.stringify(originalSystem, null, 2)}
\`\`\`

## Updated System
\`\`\`json
${JSON.stringify(updatedSystem, null, 2)}
\`\`\`

## Task
Please explain the differences between the original and updated system in a clear, concise manner.
Format your response as Markdown with appropriate sections and bullet points.
Focus on what was added, removed, or modified, and explain the implications of these changes.

Return only the explanation without any additional text.
`;
  }
  
  /**
   * Generates suggested additional changes
   * @param originalSystem Original system
   * @param updatedSystem Updated system
   * @param instruction Original instruction
   * @returns Array of suggested changes
   * @private
   */
  private async generateSuggestedChanges(
    originalSystem: ReactiveSystem,
    updatedSystem: ReactiveSystem,
    instruction: string
  ): Promise<string[]> {
    const prompt = `
# Suggest Additional Changes

## Original System
\`\`\`json
${JSON.stringify(originalSystem, null, 2)}
\`\`\`

## Updated System (After Applying "${instruction}")
\`\`\`json
${JSON.stringify(updatedSystem, null, 2)}
\`\`\`

## Task
Based on the changes made, suggest 3-5 additional changes that would improve the system's design, consistency, or functionality.
Return the suggestions as a JSON array of strings, with each string being a clear, actionable suggestion.

Example response format:
["Add validation for the new field", "Update related components", "Add documentation"]
`;
    
    const response = await this.llmService.generateResponse(prompt, {
      model: this.config.model,
      temperature: this.config.temperature,
      responseFormat: { type: 'json_object' }
    });
    
    try {
      if (typeof response.content === 'string') {
        return JSON.parse(response.content);
      } else {
        return response.content;
      }
    } catch (error) {
      return ['Error generating suggestions'];
    }
  }
  
  /**
   * Generates a description of the changes made
   * @param originalSystem Original system
   * @param updatedSystem Updated system
   * @param instruction Original instruction
   * @returns Description of the changes
   * @private
   */
  private async generateChangeDescription(
    originalSystem: ReactiveSystem,
    updatedSystem: ReactiveSystem,
    instruction: string
  ): Promise<string> {
    const prompt = `
# Generate Change Description

## Original Instruction
"${instruction}"

## Task
Generate a concise one-paragraph description of the changes made to the system based on the instruction above.
Focus on what was changed and why, without technical details.

Return only the description without any additional text.
`;
    
    const response = await this.llmService.generateResponse(prompt, {
      model: this.config.model,
      temperature: this.config.temperature
    });
    
    return response.content as string;
  }
} 