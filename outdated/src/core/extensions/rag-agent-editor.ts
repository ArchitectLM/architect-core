/**
 * RAG-Enhanced Agent Editor Extension
 * 
 * This extension enhances the RAG agent with editing capabilities for DSL files.
 */

import { Extension } from './interfaces';
import { Runtime } from '../models/runtime-types';
import { RAGAgentConfig } from './rag-agent';
import { extractCodeFromResponse } from './rag-agent-ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import * as diff from 'diff';

// Simple message classes for LLM communication
class SystemMessage {
  constructor(public content: string) {}
}

class HumanMessage {
  constructor(public content: string) {}
}

// Define ChatOpenAI class for LLM interaction
class ChatOpenAI {
  private apiKey: string;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;
  private debug: boolean;
  private baseUrl: string;
  private provider: string;

  constructor(options: { 
    openAIApiKey?: string; 
    modelName?: string; 
    temperature?: number; 
    maxTokens?: number; 
    debug?: boolean; 
    baseUrl?: string;
    provider?: string;
  }) {
    this.apiKey = options.openAIApiKey || '';
    this.modelName = options.modelName || 'gpt-4';
    this.temperature = options.temperature !== undefined ? options.temperature : 0.7;
    this.maxTokens = options.maxTokens || 4000;
    this.debug = options.debug || false;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1/chat/completions';
    this.provider = options.provider || 'openai';
  }

  async invoke(messages: any[]): Promise<{ content: string }> {
    try {
      if (this.debug) {
        console.log(`Making API call to ${this.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'} with model: ${this.modelName}`);
        console.log(`API Key (first 5 chars): ${this.apiKey.substring(0, 5)}...`);
        console.log(`Number of messages: ${messages.length}`);
      }
      
      // Set the correct endpoint
      let url = this.baseUrl;
      if (this.provider === 'openrouter') {
        // Make sure the URL ends with /chat/completions for OpenRouter
        if (!url.endsWith('/chat/completions')) {
          url = `${url}/chat/completions`;
        }
      } else {
        url = 'https://api.openai.com/v1/chat/completions';
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };
      
      // Add OpenRouter specific headers
      if (this.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://architectlm.com';
        headers['X-Title'] = 'ArchitectLM DSL Editor';
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.modelName,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          messages
        })
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = await response.text();
        }
        
        throw new Error(`API error: ${response.status} ${JSON.stringify(errorData)}`);
      }
      
      const result = await response.json();
      
      // Handle different response structures based on provider
      if (this.provider === 'openrouter') {
        if (result.choices && result.choices.length > 0 && result.choices[0].message) {
          return { content: result.choices[0].message.content };
        } else {
          return { content: JSON.stringify(result) };
        }
      } else {
        return { content: result.choices[0].message.content };
      }
    } catch (error) {
      console.error(`Error calling API:`, error);
      throw error;
    }
  }
}

/**
 * Options for editing DSL files
 */
export interface EditDSLOptions {
  /**
   * The directory containing DSL files
   */
  dslDirectory: string;
  
  /**
   * The user's request for editing the DSL
   */
  userRequest: string;
  
  /**
   * Whether to run in interactive mode (prompt for confirmation)
   */
  interactive?: boolean;
  
  /**
   * Whether to enable debug mode
   */
  debug?: boolean;
}

/**
 * Edit plan for DSL files
 */
export interface EditPlan {
  /**
   * Changes to apply to files
   */
  changes: Array<{
    /**
     * The path to the file to edit
     */
    filePath: string;
    
    /**
     * The new content for the file
     */
    newContent: string;

    /**
     * Whether this is a new file to be created
     */
    isNewFile?: boolean;
  }>;
}

/**
 * RAG-Enhanced Agent Editor Extension
 * 
 * This extension enhances the RAG agent with editing capabilities for DSL files.
 */
export class RAGAgentEditorExtension implements Extension {
  name = 'rag-agent-editor';
  private config: RAGAgentConfig;
  private runtime?: Runtime;
  private llm: ChatOpenAI;
  
  /**
   * Create a new RAG agent editor extension
   * @param config The configuration for the RAG agent
   */
  constructor(config: Partial<RAGAgentConfig> = {}) {
    this.config = {
      provider: config.provider || 'openai',
      model: config.model || 'gpt-4',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: config.baseUrl,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4000,
      systemPrompt: config.systemPrompt || this.getDefaultSystemPrompt(),
      codebasePath: config.codebasePath,
      useInMemoryVectorStore: config.useInMemoryVectorStore || false,
      debug: config.debug || false,
      promptTemplates: config.promptTemplates || {}
    };
    
    // Initialize the LLM
    this.llm = new ChatOpenAI({
      openAIApiKey: this.config.apiKey,
      modelName: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      debug: this.config.debug,
      baseUrl: this.config.baseUrl,
      provider: this.config.provider
    });
  }
  
  /**
   * Get the debug mode setting
   * @returns The debug mode setting
   */
  protected getDebugMode(): boolean {
    return this.config.debug || false;
  }
  
  /**
   * Initialize the extension
   * @param runtime The runtime to initialize with
   */
  async initialize(runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    
    if (this.config.debug) {
      console.log(`[RAGAgentEditor] Initialized with model: ${this.config.model}`);
    }
  }
  
  /**
   * Get the default system prompt for the editor
   * @returns The default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are an expert in modifying ArchitectLM DSL files.
Your task is to understand existing DSL code and make requested changes.
Analyze the files carefully before suggesting modifications.

When editing DSL files:
1. Preserve the existing structure and style
2. Only make the changes requested by the user
3. Return the complete file content with your changes
4. Explain your changes clearly

The DSL uses a fluent API with methods like:
- Process.create() or ReactiveSystem.Process.create()
- Task.create() or ReactiveSystem.Task.create()
- System.create() or ReactiveSystem.System.create()
- withDescription(), withInitialState(), addState(), addTransition(), etc.

Be precise and careful with your edits.`;
  }
  
  /**
   * Edit DSL files based on user request
   * @param options The options for editing DSL files
   * @returns A summary of the changes made
   */
  async editDSL(options: EditDSLOptions): Promise<string> {
    const { dslDirectory, userRequest, interactive = true, debug = this.config.debug } = options;
    
    if (debug) {
      console.log(`[RAGAgentEditor] Starting DSL edit in directory: ${dslDirectory}`);
      console.log(`[RAGAgentEditor] User request: ${userRequest}`);
    }
    
    // Discover DSL files
    const files = await this.discoverDSLFiles(dslDirectory);
    
    if (debug) {
      console.log(`[RAGAgentEditor] Found ${files.length} DSL files`);
    }
    
    // Read DSL files
    const fileContents = await this.readDSLFiles(files);
    
    // Generate edit plan
    const context = {
      files: fileContents,
      userRequest
    };
    
    const editPlan = await this.generateEditPlan(context);
    
    if (debug) {
      console.log(`[RAGAgentEditor] Generated edit plan with ${editPlan.changes.length} changes`);
    }
    
    // If interactive, prompt for confirmation
    if (interactive) {
      const confirmation = await this.promptForConfirmation(editPlan);
      
      if (!confirmation) {
        return 'Edit cancelled by user';
      }
    }
    
    // Apply changes
    await this.applyChanges(editPlan);
    
    // Generate summary
    const summary = this.generateSummary(editPlan);
    
    if (debug) {
      console.log(`[RAGAgentEditor] Edit complete: ${summary}`);
    }
    
    return summary;
  }
  
  /**
   * Discover DSL files in the specified directory
   * @param directory The directory to search
   * @returns An array of file paths
   */
  async discoverDSLFiles(directory: string): Promise<string[]> {
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(directory);
    
    // Filter for TypeScript files
    const tsFiles = files.filter(file => file.endsWith('.ts'));
    
    // Create full paths
    const filePaths = tsFiles.map(file => path.join(directory, file));
    
    return filePaths;
  }
  
  /**
   * Read the contents of DSL files
   * @param filePaths An array of file paths
   * @returns A record of file paths to contents
   */
  async readDSLFiles(filePaths: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    
    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        contents[filePath] = content;
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
      }
    }
    
    return contents;
  }
  
  /**
   * Generate an edit plan based on user request
   * @param context The context containing files and user request
   * @returns An edit plan with changes to apply
   */
  async generateEditPlan(context: {
    files: Record<string, string>;
    userRequest: string;
  }): Promise<EditPlan> {
    // Create a prompt for the LLM
    const prompt = this.createEditPrompt(context);
    
    // Send the prompt to the LLM
    const response = await this.llm.invoke([
      new SystemMessage(prompt),
      new HumanMessage(context.userRequest)
    ]);
    
    // Parse the response to extract the edit plan
    const editPlan = this.parseEditPlanResponse(response.content, context.files);
    
    return editPlan;
  }
  
  /**
   * Create a prompt for editing DSL files
   * @param context The context containing files and user request
   * @returns A prompt for the LLM
   */
  private createEditPrompt(context: {
    files: Record<string, string>;
    userRequest: string;
  }): string {
    let prompt = this.config.systemPrompt || this.getDefaultSystemPrompt();
    
    // Add file contents to the prompt
    prompt += '\n\nHere are the DSL files to edit:\n\n';
    
    for (const [filePath, content] of Object.entries(context.files)) {
      const fileName = path.basename(filePath);
      prompt += `File: ${fileName}\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
    }
    
    // Add instructions
    prompt += `Please edit the DSL files according to this request: "${context.userRequest}"\n`;
    prompt += 'For each file you modify, provide the complete new content.\n';
    prompt += 'Explain your changes clearly.\n';
    
    return prompt;
  }
  
  /**
   * Parse the LLM response to extract the edit plan
   * @param response The LLM response
   * @param originalFiles The original file contents
   * @returns An edit plan with changes to apply
   */
  private parseEditPlanResponse(response: string, originalFiles: Record<string, string>): EditPlan {
    const editPlan: EditPlan = {
      changes: []
    };
    
    // Extract code blocks from the response
    const codeBlockRegex = /```(?:typescript)?\s*(?:File: ([^\n]+))?\s*\n([\s\S]*?)```/g;
    let match;
    
    // Track which files have been processed
    const processedFiles = new Set<string>();
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      let fileName = match[1]?.trim();
      const code = match[2]?.trim();
      
      if (!code) continue;
      
      // If no filename is specified, try to match with original files
      if (!fileName) {
        // Try to find a matching file based on content similarity
        for (const [filePath, content] of Object.entries(originalFiles)) {
          if (!processedFiles.has(filePath) && this.isSimilarContent(code, content)) {
            fileName = path.basename(filePath);
            break;
          }
        }
      }
      
      // If we still don't have a filename, skip this code block
      if (!fileName) continue;
      
      // Find the full file path
      let filePath = '';
      let isNewFile = false;
      
      for (const path of Object.keys(originalFiles)) {
        if (path.endsWith(fileName)) {
          filePath = path;
          break;
        }
      }
      
      // If we can't find the file path, it might be a new file
      if (!filePath) {
        // Check if the filename includes a directory path
        if (fileName.includes('/')) {
          filePath = path.join(Object.keys(originalFiles)[0].split('/').slice(0, -1).join('/'), fileName);
        } else {
          // Use the directory of the first file as the base directory
          const baseDir = path.dirname(Object.keys(originalFiles)[0]);
          filePath = path.join(baseDir, fileName);
        }
        isNewFile = true;
      }
      
      // Add the change to the edit plan
      editPlan.changes.push({
        filePath,
        newContent: code,
        isNewFile
      });
      
      // Mark this file as processed
      processedFiles.add(filePath);
    }
    
    // If no code blocks were found, try to extract code using the ts-morph helper
    if (editPlan.changes.length === 0) {
      for (const [filePath, content] of Object.entries(originalFiles)) {
        const extractedCode = extractCodeFromResponse(response, 'typescript', this.config.debug);
        
        if (extractedCode && this.isSimilarContent(extractedCode, content)) {
          editPlan.changes.push({
            filePath,
            newContent: extractedCode,
            isNewFile: false
          });
          break;
        }
      }
    }
    
    return editPlan;
  }
  
  /**
   * Check if two code snippets are similar
   * @param code1 The first code snippet
   * @param code2 The second code snippet
   * @returns True if the code snippets are similar
   */
  private isSimilarContent(code1: string, code2: string): boolean {
    // Simple similarity check: look for common function/variable names
    const nameRegex = /(?:const|let|var|function)\s+(\w+)/g;
    const names1 = new Set<string>();
    const names2 = new Set<string>();
    
    let match;
    while ((match = nameRegex.exec(code1)) !== null) {
      names1.add(match[1]);
    }
    
    while ((match = nameRegex.exec(code2)) !== null) {
      names2.add(match[1]);
    }
    
    // Count common names
    let commonCount = 0;
    for (const name of names1) {
      if (names2.has(name)) {
        commonCount++;
      }
    }
    
    // If there are at least 2 common names, consider them similar
    return commonCount >= 2;
  }
  
  /**
   * Prompt the user for confirmation
   * @param editPlan The edit plan to confirm
   * @returns True if the user confirms the changes
   */
  private async promptForConfirmation(editPlan: EditPlan): Promise<boolean> {
    return this.promptForConfirmationWithInquirer(editPlan);
  }
  
  /**
   * Prompt the user for confirmation using inquirer
   * @param editPlan The edit plan to confirm
   * @returns True if the user confirms the changes
   */
  private async promptForConfirmationWithInquirer(editPlan: EditPlan): Promise<boolean> {
    // Generate visual diffs for each change
    const changes = await Promise.all(
      editPlan.changes.map(async (change) => {
        const filePath = change.filePath;
        const newContent = change.newContent;
        let oldContent = '';
        let visualDiff = '';
        
        if (!change.isNewFile && fs.existsSync(filePath)) {
          oldContent = fs.readFileSync(filePath, 'utf-8');
          visualDiff = await this.generateVisualDiff(oldContent, newContent);
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
  private async generateVisualDiff(oldContent: string, newContent: string): Promise<string> {
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
   * Apply changes to files
   * @param editPlan The edit plan to apply
   */
  async applyChanges(editPlan: EditPlan): Promise<void> {
    for (const change of editPlan.changes) {
      try {
        // Create directory if it doesn't exist (for new files)
        if (change.isNewFile) {
          const dirPath = path.dirname(change.filePath);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            
            if (this.config.debug) {
              console.log(`[RAGAgentEditor] Created directory: ${dirPath}`);
            }
          }
        }
        
        fs.writeFileSync(change.filePath, change.newContent, 'utf-8');
        
        if (this.config.debug) {
          const action = change.isNewFile ? 'Created' : 'Updated';
          console.log(`[RAGAgentEditor] ${action} file: ${change.filePath}`);
        }
      } catch (error) {
        console.error(`Error writing file ${change.filePath}:`, error);
      }
    }
  }
  
  /**
   * Generate a summary of the changes made
   * @param editPlan The edit plan that was applied
   * @returns A summary of the changes
   */
  private generateSummary(editPlan: EditPlan): string {
    const fileCount = editPlan.changes.length;
    
    if (fileCount === 0) {
      return 'No changes were made.';
    }
    
    const fileNames = editPlan.changes.map(change => path.basename(change.filePath));
    
    return `Updated ${fileCount} file(s): ${fileNames.join(', ')}`;
  }
}

/**
 * Create a RAG agent editor
 * @param config The configuration for the RAG agent
 * @returns A new RAG agent editor extension
 */
export function createRAGAgentEditor(config: Partial<RAGAgentConfig> = {}): RAGAgentEditorExtension {
  return new RAGAgentEditorExtension(config);
}