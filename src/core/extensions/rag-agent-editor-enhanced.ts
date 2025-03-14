/**
 * Enhanced RAG Agent Editor Extension
 * 
 * This extension adds advanced features to the base RAG agent editor:
 * - Interactive mode with inquirer prompts
 * - Visual diffs for changes
 * - Undo functionality
 * - Multiple edit iterations
 * - Creating new files
 * - Schema validation
 */

import { RAGAgentEditorExtension, EditPlan, EditDSLOptions } from './rag-agent-editor';
import { RAGAgentConfig } from './rag-agent';
import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import * as diff from 'diff';
import { z } from 'zod';

// Simple message classes for LLM communication
class SystemMessage {
  constructor(public content: string) {}
}

class HumanMessage {
  constructor(public content: string) {}
}

/**
 * Enhanced RAG Agent Editor Extension
 * 
 * Extends the base RAG agent editor with advanced features.
 */
export class EnhancedRAGAgentEditorExtension extends RAGAgentEditorExtension {
  name = 'enhanced-rag-agent-editor';
  private editHistory: Array<{
    userRequest: string;
    changes: EditPlan['changes'];
  }> = [];
  
  /**
   * Create a new enhanced RAG agent editor extension
   * @param config The configuration for the RAG agent
   */
  constructor(config: Partial<RAGAgentConfig> = {}) {
    super(config);
  }
  
  /**
   * Edit DSL files based on user request with enhanced features
   * @param options The options for editing DSL files
   * @returns A summary of the changes made
   */
  async editDSL(options: EditDSLOptions): Promise<string> {
    const { interactive = true } = options;
    
    // If interactive mode is enabled, start an edit session
    if (interactive) {
      return this.startEditSession(options);
    }
    
    // Otherwise, use the base implementation
    return super.editDSL(options);
  }
  
  /**
   * Start an interactive edit session
   * @param options The options for editing DSL files
   * @returns A summary of the changes made
   */
  private async startEditSession(options: EditDSLOptions): Promise<string> {
    const { dslDirectory, userRequest, debug = this.getDebugMode() } = options;
    
    if (debug) {
      console.log(`[EnhancedRAGAgentEditor] Starting interactive edit session`);
    }
    
    // Initialize edit history
    this.editHistory = [];
    
    // Discover DSL files to save history before first edit
    const files = await this.discoverDSLFiles(dslDirectory);
    const fileContents = await this.readDSLFiles(files);
    
    // Create an initial edit plan to save history
    const initialEditPlan: EditPlan = {
      changes: Object.entries(fileContents).map(([filePath, content]) => ({
        filePath,
        newContent: content,
        isNewFile: false
      }))
    };
    
    // Save file history before making any changes
    await this.saveFileHistory(initialEditPlan);
    
    // First edit
    let summary = await super.editDSL({
      ...options,
      interactive: true
    });
    
    // Capture the changes from the first edit
    const firstEditFiles = await this.discoverDSLFiles(dslDirectory);
    const firstEditContents = await this.readDSLFiles(firstEditFiles);
    
    // Add to edit history
    this.editHistory.push({
      userRequest,
      changes: Object.entries(firstEditContents).map(([filePath, content]) => ({
        filePath,
        newContent: content,
        isNewFile: !Object.keys(fileContents).includes(filePath)
      }))
    });
    
    // Continue editing until the user chooses to exit
    let continueEditing = true;
    
    while (continueEditing) {
      const nextAction = await this.promptForNextAction();
      
      if (nextAction.action === 'exit') {
        continueEditing = false;
      } else if (nextAction.action === 'edit') {
        // Save file history before making changes
        const currentFiles = await this.discoverDSLFiles(dslDirectory);
        const currentContents = await this.readDSLFiles(currentFiles);
        
        const currentEditPlan: EditPlan = {
          changes: Object.entries(currentContents).map(([filePath, content]) => ({
            filePath,
            newContent: content,
            isNewFile: false
          }))
        };
        
        await this.saveFileHistory(currentEditPlan);
        
        // Perform the next edit with context from previous edits
        const nextSummary = await this.editWithContext({
          dslDirectory,
          userRequest: nextAction.prompt || '',
          debug
        });
        
        summary += `\n${nextSummary}`;
        
        // Capture the changes from this edit
        const newFiles = await this.discoverDSLFiles(dslDirectory);
        const newContents = await this.readDSLFiles(newFiles);
        
        // Add to edit history
        this.editHistory.push({
          userRequest: nextAction.prompt || '',
          changes: Object.entries(newContents).map(([filePath, content]) => ({
            filePath,
            newContent: content,
            isNewFile: !Object.keys(currentContents).includes(filePath)
          }))
        });
      } else if (nextAction.action === 'undo') {
        await this.undoLastEdit(dslDirectory);
        
        // Remove the last edit from history
        if (this.editHistory.length > 0) {
          this.editHistory.pop();
        }
        
        summary += '\nUndid last edit';
      }
    }
    
    return summary;
  }
  
  /**
   * Edit DSL files with context from previous edits
   * @param options The options for editing DSL files
   * @returns A summary of the changes made
   */
  private async editWithContext(options: EditDSLOptions): Promise<string> {
    const { dslDirectory, userRequest, debug = this.getDebugMode() } = options;
    
    // Discover DSL files
    const files = await this.discoverDSLFiles(dslDirectory);
    
    // Read DSL files
    const fileContents = await this.readDSLFiles(files);
    
    // Generate edit plan with context from previous edits
    const context = {
      files: fileContents,
      userRequest,
      editHistory: this.editHistory
    };
    
    const editPlan = await this.generateEditPlanWithContext(context);
    
    if (debug) {
      console.log(`[EnhancedRAGAgentEditor] Generated edit plan with ${editPlan.changes.length} changes`);
    }
    
    // Prompt for confirmation
    const confirmation = await this.enhancedPromptForConfirmation(editPlan);
    
    if (!confirmation) {
      return 'Edit cancelled by user';
    }
    
    // Apply changes
    await this.applyChanges(editPlan);
    
    // Generate summary using the parent class's method
    const summary = this.createSummary(editPlan);
    
    if (debug) {
      console.log(`[EnhancedRAGAgentEditor] Edit complete: ${summary}`);
    }
    
    return summary;
  }
  
  /**
   * Generate an edit plan with context from previous edits
   * @param context The context containing files, user request, and edit history
   * @returns An edit plan with changes to apply
   */
  private async generateEditPlanWithContext(context: {
    files: Record<string, string>;
    userRequest: string;
    editHistory: Array<{
      userRequest: string;
      changes: EditPlan['changes'];
    }>;
  }): Promise<EditPlan> {
    // Create a prompt for the LLM that includes edit history
    const prompt = this.createEditPromptWithContext(context);
    
    // Send the prompt to the LLM
    const response = await (this as any).llm.invoke([
      new SystemMessage(prompt),
      new HumanMessage(context.userRequest)
    ]);
    
    // Parse the response to extract the edit plan
    const editPlan = (this as any).parseEditPlanResponse(response.content, context.files);
    
    // Validate the edit plan against schemas
    await this.validateEditPlan(editPlan);
    
    return editPlan;
  }
  
  /**
   * Create a prompt for editing DSL files with context from previous edits
   * @param context The context containing files, user request, and edit history
   * @returns A prompt for the LLM
   */
  private createEditPromptWithContext(context: {
    files: Record<string, string>;
    userRequest: string;
    editHistory: Array<{
      userRequest: string;
      changes: EditPlan['changes'];
    }>;
  }): string {
    // Get the base prompt
    let prompt = (this as any).config.systemPrompt || (this as any).getDefaultSystemPrompt();
    
    // Add file contents to the prompt
    prompt += '\n\nHere are the DSL files to edit:\n\n';
    
    for (const [filePath, content] of Object.entries(context.files)) {
      const fileName = path.basename(filePath);
      prompt += `File: ${fileName}\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
    }
    
    // Add edit history for context
    if (context.editHistory.length > 0) {
      prompt += '\n\nPrevious edits in this session:\n\n';
      
      for (const edit of context.editHistory) {
        prompt += `Request: "${edit.userRequest}"\n`;
      }
    }
    
    // Add instructions
    prompt += `\nPlease edit the DSL files according to this request: "${context.userRequest}"\n`;
    prompt += 'For each file you modify, provide the complete new content.\n';
    prompt += 'Explain your changes clearly.\n';
    
    return prompt;
  }
  
  /**
   * Validate an edit plan against schemas
   * @param editPlan The edit plan to validate
   */
  private async validateEditPlan(editPlan: EditPlan): Promise<void> {
    for (const change of editPlan.changes) {
      const validationResult = await this.validateDSLFile(change.filePath, change.newContent);
      
      if (!validationResult.valid) {
        console.warn(`[EnhancedRAGAgentEditor] Validation warnings for ${change.filePath}:`);
        console.warn(validationResult.errors?.join('\n'));
      }
    }
  }
  
  /**
   * Prompt for the next action
   * @returns The next action to take
   */
  private async promptForNextAction(): Promise<{
    action: 'edit' | 'undo' | 'exit';
    prompt?: string;
  }> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do next?',
        choices: [
          { name: 'Make another edit', value: 'edit' },
          { name: 'Undo last edit', value: 'undo' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);
    
    if (action === 'edit') {
      const { prompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'prompt',
          message: 'What would you like to edit?'
        }
      ]);
      
      return { action, prompt };
    }
    
    return { action };
  }
  
  /**
   * Save file history before making changes
   * @param editPlan The edit plan to save history for
   */
  private async saveFileHistory(editPlan: EditPlan): Promise<void> {
    const historyDir = path.join(process.cwd(), '.history');
    
    // Create history directory if it doesn't exist
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    
    // Save each file's current content
    for (const change of editPlan.changes) {
      if (!change.isNewFile && fs.existsSync(change.filePath)) {
        const content = fs.readFileSync(change.filePath, 'utf-8');
        const timestamp = Date.now();
        const historyFilePath = path.join(
          historyDir,
          `${path.basename(change.filePath)}.${timestamp}.bak`
        );
        
        fs.writeFileSync(historyFilePath, content, 'utf-8');
        
        if (this.getDebugMode()) {
          console.log(`[EnhancedRAGAgentEditor] Saved history for ${change.filePath} to ${historyFilePath}`);
        }
      }
    }
  }
  
  /**
   * Undo the last edit
   * @param directory The directory containing the files
   */
  private async undoLastEdit(directory: string): Promise<void> {
    const historyDir = path.join(process.cwd(), '.history');
    
    if (!fs.existsSync(historyDir)) {
      console.log('No history found');
      return;
    }
    
    // Get all history files
    const historyFiles = fs.readdirSync(historyDir);
    
    if (historyFiles.length === 0) {
      console.log('No history found');
      return;
    }
    
    // Group by original file name
    const fileGroups: Record<string, { path: string; timestamp: number }[]> = {};
    
    for (const historyFile of historyFiles) {
      const match = historyFile.match(/(.+)\.(\d+)\.bak$/);
      
      if (match) {
        const [, fileName, timestamp] = match;
        
        if (!fileGroups[fileName]) {
          fileGroups[fileName] = [];
        }
        
        fileGroups[fileName].push({
          path: path.join(historyDir, historyFile),
          timestamp: parseInt(timestamp, 10)
        });
      }
    }
    
    // Sort each group by timestamp (descending)
    for (const fileName in fileGroups) {
      fileGroups[fileName].sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Prompt for which files to restore
    const choices = Object.keys(fileGroups).map(fileName => ({
      name: fileName,
      value: fileName
    }));
    
    const { filesToRestore } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'filesToRestore',
        message: 'Select files to restore:',
        choices
      }
    ]);
    
    if (filesToRestore.length === 0) {
      console.log('No files selected for restore');
      return;
    }
    
    // Restore each selected file
    for (const fileName of filesToRestore) {
      const latestHistory = fileGroups[fileName][0];
      
      if (latestHistory) {
        const content = fs.readFileSync(latestHistory.path, 'utf-8');
        const filePath = path.join(directory, fileName);
        
        fs.writeFileSync(filePath, content, 'utf-8');
        
        // Remove the history file
        fs.unlinkSync(latestHistory.path);
        
        console.log(`Restored ${fileName} from history`);
      }
    }
  }
  
  /**
   * Prompt the user for confirmation with visual diffs
   * @param editPlan The edit plan to confirm
   * @returns True if the user confirms the changes
   */
  private async enhancedPromptForConfirmation(editPlan: EditPlan): Promise<boolean> {
    // Generate visual diffs for each change
    const changes = await Promise.all(
      editPlan.changes.map(async (change) => {
        const filePath = change.filePath;
        const newContent = change.newContent;
        let oldContent = '';
        let visualDiff = '';
        
        if (!change.isNewFile && fs.existsSync(filePath)) {
          oldContent = fs.readFileSync(filePath, 'utf-8');
          visualDiff = await this.enhancedGenerateVisualDiff(oldContent, newContent);
        } else {
          visualDiff = `New file: ${filePath}\n\n${newContent}`;
        }
        
        return {
          ...change,
          visualDiff
        };
      })
    );
    
    // Prompt for file selection
    const fileChoices = changes.map((change) => ({
      name: `${change.isNewFile ? '[NEW] ' : ''}${change.filePath}`,
      value: change.filePath,
      checked: true
    }));
    
    const { selectedFiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedFiles',
        message: 'Select files to edit:',
        choices: fileChoices
      }
    ]);
    
    if (selectedFiles.length === 0) {
      console.log('No files selected. Edit cancelled.');
      return false;
    }
    
    // Show diffs for selected files and confirm
    for (const change of changes) {
      if (selectedFiles.includes(change.filePath)) {
        console.log(`\n${change.isNewFile ? '[NEW] ' : ''}File: ${change.filePath}`);
        console.log(change.visualDiff);
        
        // Show validation results if available
        const validationResult = await this.validateDSLFile(change.filePath, change.newContent);
        if (!validationResult.valid) {
          console.warn('Validation warnings:');
          console.warn(validationResult.errors?.join('\n'));
        }
      }
    }
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to apply these changes?',
        default: true
      }
    ]);
    
    return confirm;
  }
  
  /**
   * Generate a visual diff between old and new content
   * @param oldContent The old content
   * @param newContent The new content
   * @returns A visual diff
   */
  private async enhancedGenerateVisualDiff(oldContent: string, newContent: string): Promise<string> {
    const diffResult = diff.diffLines(oldContent, newContent);
    let visualDiff = '';
    
    for (const part of diffResult) {
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';
      const lines = part.value.split('\n').filter((line: string) => line.length > 0);
      
      for (const line of lines) {
        visualDiff += `${prefix} ${line}\n`;
      }
    }
    
    return visualDiff;
  }
  
  /**
   * Validate a DSL file against a schema
   * @param filePath The path to the file
   * @param content The content of the file
   * @returns Validation result
   */
  private async validateDSLFile(filePath: string, content: string): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    try {
      // Extract the type of DSL file (process, task, system)
      const fileName = path.basename(filePath);
      let schema: z.ZodType<any>;
      
      if (fileName.includes('process')) {
        schema = this.getProcessSchema();
      } else if (fileName.includes('task')) {
        schema = this.getTaskSchema();
      } else if (fileName.includes('system')) {
        schema = this.getSystemSchema();
      } else {
        // Default schema
        schema = z.any();
      }
      
      // Validate with schema
      this.validateWithSchema(content, schema);
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [(error as Error).message]
      };
    }
  }
  
  /**
   * Validate content with a schema
   * @param content The content to validate
   * @param schema The schema to validate against
   */
  private validateWithSchema(content: string, schema: z.ZodType<any>): void {
    // This is a placeholder for actual validation logic
    // In a real implementation, we would parse the TypeScript code
    // and validate the resulting object against the schema
    
    // For now, we'll just check if the content contains required keywords
    if (schema === this.getProcessSchema()) {
      if (!content.includes('state(') || !content.includes('transitionTo(')) {
        throw new Error('Process must have states and transitions');
      }
    } else if (schema === this.getTaskSchema()) {
      if (!content.includes('implementation(')) {
        throw new Error('Task must have an implementation');
      }
    } else if (schema === this.getSystemSchema()) {
      if (!content.includes('withProcess(') && !content.includes('withTask(')) {
        throw new Error('System must have processes or tasks');
      }
    }
  }
  
  /**
   * Get the schema for process DSL files
   * @returns The process schema
   */
  private getProcessSchema(): z.ZodType<any> {
    return z.object({
      name: z.string(),
      description: z.string().optional(),
      initialState: z.string(),
      states: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        transitions: z.array(z.object({
          on: z.string(),
          to: z.string()
        })).optional(),
        isFinal: z.boolean().optional()
      }))
    });
  }
  
  /**
   * Get the schema for task DSL files
   * @returns The task schema
   */
  private getTaskSchema(): z.ZodType<any> {
    return z.object({
      name: z.string(),
      description: z.string().optional(),
      implementation: z.function().optional()
    });
  }
  
  /**
   * Get the schema for system DSL files
   * @returns The system schema
   */
  private getSystemSchema(): z.ZodType<any> {
    return z.object({
      name: z.string(),
      description: z.string().optional(),
      processes: z.array(z.string()).optional(),
      tasks: z.array(z.string()).optional()
    });
  }
  
  /**
   * Create a summary of the changes made
   * @param editPlan The edit plan that was applied
   * @returns A summary of the changes
   */
  private createSummary(editPlan: EditPlan): string {
    const fileCount = editPlan.changes.length;
    
    if (fileCount === 0) {
      return 'No changes were made.';
    }
    
    const fileNames = editPlan.changes.map(change => path.basename(change.filePath));
    
    return `Updated ${fileCount} file(s): ${fileNames.join(', ')}`;
  }
}

/**
 * Create an enhanced RAG agent editor
 * @param config The configuration for the RAG agent
 * @returns A new enhanced RAG agent editor extension
 */
export function createEnhancedRAGAgentEditor(config: Partial<RAGAgentConfig> = {}): EnhancedRAGAgentEditorExtension {
  return new EnhancedRAGAgentEditorExtension(config);
} 