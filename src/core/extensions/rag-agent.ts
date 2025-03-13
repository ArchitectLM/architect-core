/**
 * RAG-Enhanced Agent Extension for ArchitectLM
 * 
 * This extension implements the ArchitectAgent interface with Retrieval-Augmented Generation
 * to provide AI-assisted development capabilities for generating and modifying system components.
 */

import { 
  ArchitectAgent, 
  ProcessDefinition, 
  TaskDefinition, 
  SystemConfig, 
  ProcessSpec, 
  TaskSpec, 
  SystemSpec, 
  SystemFeedback, 
  SystemFixes, 
  TestDefinition, 
  Extension,
  Runtime
} from '../types';

// Import LangChain components
// Note: We're using a simplified implementation for testing
// In a real implementation, you would use the actual LangChain components

// Define Document type
interface Document {
  pageContent: string;
  metadata: Record<string, any>;
}

// Define a simplified Chroma class for vector storage
class Chroma {
  private documents: Document[] = [];
  private embeddings: any;
  private collectionName: string;

  constructor(embeddings: any, options: { collectionName: string }) {
    this.embeddings = embeddings;
    this.collectionName = options.collectionName;
  }

  static async fromDocuments(documents: Document[], embeddings: any, options: { collectionName: string }): Promise<Chroma> {
    const chroma = new Chroma(embeddings, options);
    chroma.documents = documents;
    return chroma;
  }

  async similaritySearch(query: string, k: number): Promise<Document[]> {
    // In a real implementation, this would perform a similarity search
    // For now, just return the first k documents
    return this.documents.slice(0, k);
  }
}

// Define OpenAIEmbeddings class
class OpenAIEmbeddings {
  private apiKey: string;
  private modelName: string;

  constructor(options: { openAIApiKey?: string; modelName?: string }) {
    this.apiKey = options.openAIApiKey || '';
    this.modelName = options.modelName || 'text-embedding-ada-002';
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    // In a real implementation, this would call the OpenAI API
    // For now, just return dummy embeddings
    return texts.map(() => new Array(1536).fill(0.1));
  }

  async embedQuery(text: string): Promise<number[]> {
    // In a real implementation, this would call the OpenAI API
    // For now, just return dummy embeddings
    return new Array(1536).fill(0.1);
  }
}

// Define ChatOpenAI class
class ChatOpenAI {
  private apiKey: string;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: { openAIApiKey?: string; modelName?: string; temperature?: number; maxTokens?: number }) {
    this.apiKey = options.openAIApiKey || '';
    this.modelName = options.modelName || 'gpt-4';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 4000;
  }

  async invoke(messages: any[]): Promise<{ content: string }> {
    // In a real implementation, this would call the OpenAI API
    // For now, just return a dummy response
    return { content: JSON.stringify({ id: 'mock-response', name: 'Mock Response' }) };
  }
}

// Define message classes
class SystemMessage {
  role = 'system';
  content: string;

  constructor(content: string) {
    this.content = content;
  }
}

class HumanMessage {
  role = 'human';
  content: string;

  constructor(content: string) {
    this.content = content;
  }
}

// Define text splitter class
class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: { chunkSize: number; chunkOverlap: number }) {
    this.chunkSize = options.chunkSize;
    this.chunkOverlap = options.chunkOverlap;
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    // In a real implementation, this would split documents into chunks
    // For now, just return the original documents
    return documents;
  }
}

// Define directory loader class
class DirectoryLoader {
  private path: string;
  private loaders: Record<string, (path: string) => TextLoader>;

  constructor(path: string, loaders: Record<string, (path: string) => TextLoader>) {
    this.path = path;
    this.loaders = loaders;
  }

  async load(): Promise<Document[]> {
    // In a real implementation, this would load documents from a directory
    // For now, just return dummy documents
    return [
      {
        pageContent: 'const orderProcess = Process.create("order-process")\n  .withDescription("Handles order processing")\n  .withInitialState("created")\n  .addState("created")\n  .addState("processing")\n  .addState("completed")\n  .addState("cancelled")\n  .addTransition({\n    from: "created",\n    to: "processing",\n    on: "START_PROCESSING"\n  })',
        metadata: { source: 'examples/order-processing.ts' }
      },
      {
        pageContent: 'const processOrderTask = Task.create("process-order")\n  .withDescription("Processes an order")\n  .withImplementation(async (input, context) => {\n    // Process the order\n    context.emitEvent("COMPLETE", { orderId: input.orderId });\n    return { processed: true };\n  })',
        metadata: { source: 'examples/order-processing.ts' }
      }
    ];
  }
}

// Define text loader class
class TextLoader {
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  async load(): Promise<Document[]> {
    // In a real implementation, this would load text from a file
    // For now, just return dummy documents
    return [
      {
        pageContent: '// Mock file content',
        metadata: { source: this.path }
      }
    ];
  }
}

// Import Node.js modules
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration for the RAG Agent extension
 */
export interface RAGAgentConfig {
  /**
   * The LLM provider to use
   */
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  
  /**
   * The model to use
   */
  model: string;
  
  /**
   * API key for the provider
   */
  apiKey?: string;
  
  /**
   * Base URL for the API
   */
  baseUrl?: string;
  
  /**
   * Temperature for generation (0-1)
   */
  temperature?: number;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;
  
  /**
   * System prompt to use for generation
   */
  systemPrompt?: string;
  
  /**
   * Path to the codebase to index
   */
  codebasePath?: string;
  
  /**
   * Whether to use in-memory vector store (for testing)
   */
  useInMemoryVectorStore?: boolean;
  
  /**
   * Custom prompt templates
   */
  promptTemplates?: {
    process?: string;
    task?: string;
    system?: string;
    test?: string;
    feedback?: string;
    documentation?: string;
  };
}

/**
 * Default configuration for the RAG Agent extension
 */
const DEFAULT_CONFIG: RAGAgentConfig = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4000,
  codebasePath: './src',
  useInMemoryVectorStore: false,
  systemPrompt: `You are an expert software architect specializing in reactive systems and event-driven architecture. 
Your task is to help design and implement components for the ArchitectLM framework.`
};

/**
 * RAG-Enhanced Agent Extension implementation
 */
export class RAGAgentExtension implements Extension, ArchitectAgent {
  name = 'rag-agent';
  private config: RAGAgentConfig;
  private runtime?: Runtime;
  private vectorStore?: Chroma;
  private embeddings: OpenAIEmbeddings;
  private llm: ChatOpenAI;
  
  constructor(config: Partial<RAGAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize OpenAI embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey,
      modelName: 'text-embedding-ada-002'
    });
    
    // Initialize LLM
    this.llm = new ChatOpenAI({
      openAIApiKey: this.config.apiKey,
      modelName: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    });
  }
  
  /**
   * Initialize the extension with the runtime
   */
  async initialize(runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    
    // Register this extension as a service
    runtime.registerService('rag-agent', this);
    
    // Index the codebase
    await this.indexCodebase();
    
    console.log(`RAG Agent extension initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
  }
  
  /**
   * Index the codebase for retrieval
   */
  private async indexCodebase(): Promise<void> {
    try {
      console.log(`Indexing codebase at: ${this.config.codebasePath}`);
      
      // Load documents from the codebase
      const loader = new DirectoryLoader(
        this.config.codebasePath || './src',
        {
          '.ts': (path) => new TextLoader(path),
          '.tsx': (path) => new TextLoader(path),
          '.js': (path) => new TextLoader(path),
          '.jsx': (path) => new TextLoader(path),
          '.md': (path) => new TextLoader(path)
        }
      );
      
      const docs = await loader.load();
      console.log(`Loaded ${docs.length} documents from codebase`);
      
      // Split documents into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
      });
      
      const splitDocs = await textSplitter.splitDocuments(docs);
      console.log(`Split into ${splitDocs.length} chunks`);
      
      // Create vector store
      this.vectorStore = await Chroma.fromDocuments(
        splitDocs,
        this.embeddings,
        {
          collectionName: 'architectlm-codebase'
        }
      );
      
      console.log('Codebase indexed successfully');
    } catch (error: unknown) {
      console.error('Error indexing codebase:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to index codebase: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a process definition from a specification
   */
  async generateProcess(spec: ProcessSpec): Promise<ProcessDefinition> {
    console.log(`Generating process: ${spec.name}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(spec, 'process');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(spec, 'process', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const processDefinition = JSON.parse(response.content);
      return processDefinition;
    } catch (error: unknown) {
      console.error('Failed to parse process definition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate process definition: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a task definition from a specification
   */
  async generateTask(spec: TaskSpec): Promise<TaskDefinition> {
    console.log(`Generating task: ${spec.name}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(spec, 'task');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(spec, 'task', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const taskDefinition = JSON.parse(response.content);
      return taskDefinition;
    } catch (error: unknown) {
      console.error('Failed to parse task definition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate task definition: ${errorMessage}`);
    }
  }
  
  /**
   * Generate a system configuration from a specification
   */
  async generateSystem(spec: SystemSpec): Promise<SystemConfig> {
    console.log(`Generating system: ${spec.name}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(spec, 'system');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(spec, 'system', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const systemConfig = JSON.parse(response.content);
      return systemConfig;
    } catch (error: unknown) {
      console.error('Failed to parse system configuration:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate system configuration: ${errorMessage}`);
    }
  }
  
  /**
   * Analyze feedback and suggest fixes
   */
  async analyzeFeedback(feedback: SystemFeedback): Promise<SystemFixes> {
    console.log('Analyzing system feedback');
    
    // Create enhanced prompt with feedback
    const enhancedPrompt = this.createFeedbackPrompt(feedback);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const fixes = JSON.parse(response.content);
      return fixes;
    } catch (error: unknown) {
      console.error('Failed to parse system fixes:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze feedback: ${errorMessage}`);
    }
  }
  
  /**
   * Generate tests for a component
   */
  async generateTests(component: ProcessDefinition | TaskDefinition): Promise<TestDefinition[]> {
    console.log(`Generating tests for: ${component.id}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(component, 'test');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(component, 'test', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    try {
      // Parse the response as JSON
      const tests = JSON.parse(response.content);
      return tests;
    } catch (error: unknown) {
      console.error('Failed to parse test definitions:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate tests: ${errorMessage}`);
    }
  }
  
  /**
   * Generate documentation for a component
   */
  async generateDocs(component: any): Promise<string> {
    console.log(`Generating documentation for: ${component.id || 'component'}`);
    
    // Retrieve relevant examples
    const relevantExamples = await this.retrieveRelevantExamples(component, 'documentation');
    
    // Create enhanced prompt with examples
    const enhancedPrompt = await this.createEnhancedPrompt(component, 'documentation', relevantExamples);
    
    // Generate with enhanced prompt
    const response = await this.llm.invoke([
      new SystemMessage(this.config.systemPrompt || ''),
      new HumanMessage(enhancedPrompt)
    ]);
    
    return response.content;
  }
  
  /**
   * Retrieve relevant examples from the codebase
   */
  async retrieveRelevantExamples(spec: any, type: string): Promise<Document[]> {
    if (!this.vectorStore) {
      console.warn('Vector store not initialized, skipping retrieval');
      return [];
    }
    
    try {
      // Create a search query based on the spec and type
      const query = this.createSearchQuery(spec, type);
      
      // Retrieve relevant documents
      const documents = await this.vectorStore.similaritySearch(query, 3);
      
      return documents;
    } catch (error: unknown) {
      console.error('Error retrieving examples:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to retrieve examples: ${errorMessage}`);
      return [];
    }
  }
  
  /**
   * Create a search query based on the spec and type
   */
  private createSearchQuery(spec: any, type: string): string {
    let query = '';
    
    switch (type) {
      case 'process':
        query = `Process definition for ${spec.name}: ${spec.description || ''}`;
        if (spec.states) {
          query += ` States: ${spec.states.join(', ')}`;
        }
        if (spec.events) {
          query += ` Events: ${spec.events.join(', ')}`;
        }
        break;
        
      case 'task':
        query = `Task implementation for ${spec.name}: ${spec.description || ''}`;
        if (spec.input) {
          query += ` Input: ${JSON.stringify(spec.input)}`;
        }
        if (spec.output) {
          query += ` Output: ${JSON.stringify(spec.output)}`;
        }
        break;
        
      case 'system':
        query = `System configuration for ${spec.name}: ${spec.description || ''}`;
        break;
        
      case 'test':
        query = `Tests for ${spec.id}: ${spec.description || ''}`;
        break;
        
      case 'documentation':
        query = `Documentation for ${spec.id}: ${spec.description || ''}`;
        break;
        
      default:
        query = `${type} for ${JSON.stringify(spec)}`;
    }
    
    return query;
  }
  
  /**
   * Create an enhanced prompt with examples
   */
  async createEnhancedPrompt(spec: any, type: string, examples: Document[] = []): Promise<string> {
    let basePrompt = '';
    
    // Get the base prompt template based on the type
    switch (type) {
      case 'process':
        basePrompt = this.createProcessPrompt(spec);
        break;
        
      case 'task':
        basePrompt = this.createTaskPrompt(spec);
        break;
        
      case 'system':
        basePrompt = this.createSystemPrompt(spec);
        break;
        
      case 'test':
        basePrompt = this.createTestPrompt(spec);
        break;
        
      case 'documentation':
        basePrompt = this.createDocumentationPrompt(spec);
        break;
        
      default:
        basePrompt = `Generate a ${type} for: ${JSON.stringify(spec, null, 2)}`;
    }
    
    // If no examples, return the base prompt
    if (examples.length === 0) {
      return basePrompt;
    }
    
    // Add examples to the prompt
    let examplesText = '\n\nHere are some relevant examples from the codebase:\n\n';
    
    examples.forEach((example, index) => {
      examplesText += `Example ${index + 1} (from ${example.metadata.source}):\n\`\`\`typescript\n${example.pageContent}\n\`\`\`\n\n`;
    });
    
    // Add guidance on how to use the examples
    examplesText += `
Please use these examples as a reference for the coding style, patterns, and best practices used in the codebase.
Your generated code should follow similar patterns while implementing the specific requirements.

Now, please generate the ${type} according to the specification above.
Return ONLY the JSON object representing the ${type === 'process' ? 'ProcessDefinition' : type === 'task' ? 'TaskDefinition' : type === 'system' ? 'SystemConfig' : 'TestDefinition'}.
`;
    
    return basePrompt + examplesText;
  }
  
  /**
   * Create a prompt for generating a process
   */
  private createProcessPrompt(spec: ProcessSpec): string {
    const template = this.config.promptTemplates?.process || `
You are designing a process for a reactive system using the ArchitectLM framework.

Process Specification:
- Name: {{name}}
- Description: {{description}}
{{#if domainConcepts}}
- Domain Concepts: {{domainConcepts}}
{{/if}}
{{#if businessRules}}
- Business Rules: {{businessRules}}
{{/if}}
{{#if states}}
- States: {{states}}
{{/if}}
{{#if events}}
- Events: {{events}}
{{/if}}

Create a complete ProcessDefinition object that implements this specification.
The ProcessDefinition should include:
1. A unique ID
2. States with descriptions and optional onEnter/onExit handlers
3. Transitions between states with event triggers
4. Guards and actions for transitions where appropriate
5. A context schema using Zod for validation

Return ONLY the JSON object representing the ProcessDefinition.
`;

    // Simple template replacement
    return template
      .replace('{{name}}', spec.name)
      .replace('{{description}}', spec.description || '')
      .replace('{{#if domainConcepts}}', spec.domainConcepts ? '' : '<!--')
      .replace('{{/if}}', spec.domainConcepts ? '' : '-->')
      .replace('{{domainConcepts}}', spec.domainConcepts?.join(', ') || '')
      .replace('{{#if businessRules}}', spec.businessRules ? '' : '<!--')
      .replace('{{/if}}', spec.businessRules ? '' : '-->')
      .replace('{{businessRules}}', spec.businessRules?.join(', ') || '')
      .replace('{{#if states}}', spec.states ? '' : '<!--')
      .replace('{{/if}}', spec.states ? '' : '-->')
      .replace('{{states}}', spec.states?.join(', ') || '')
      .replace('{{#if events}}', spec.events ? '' : '<!--')
      .replace('{{/if}}', spec.events ? '' : '-->')
      .replace('{{events}}', spec.events?.join(', ') || '');
  }
  
  /**
   * Create a prompt for generating a task
   */
  private createTaskPrompt(spec: TaskSpec): string {
    const template = this.config.promptTemplates?.task || `
You are designing a task for a reactive system using the ArchitectLM framework.

Task Specification:
- Name: {{name}}
- Description: {{description}}
{{#if input}}
- Input: {{input}}
{{/if}}
{{#if output}}
- Output: {{output}}
{{/if}}
{{#if dependencies}}
- Dependencies: {{dependencies}}
{{/if}}

Create a complete TaskDefinition object that implements this specification.
The TaskDefinition should include:
1. A unique ID
2. An implementation function that performs the task
3. Input and output schemas using Zod for validation
4. Error handling
5. Appropriate timeout and retry configuration

Return ONLY the JSON object representing the TaskDefinition.
`;

    // Simple template replacement
    return template
      .replace('{{name}}', spec.name)
      .replace('{{description}}', spec.description || '')
      .replace('{{#if input}}', spec.input ? '' : '<!--')
      .replace('{{/if}}', spec.input ? '' : '-->')
      .replace('{{input}}', spec.input ? JSON.stringify(spec.input) : '')
      .replace('{{#if output}}', spec.output ? '' : '<!--')
      .replace('{{/if}}', spec.output ? '' : '-->')
      .replace('{{output}}', spec.output ? JSON.stringify(spec.output) : '')
      .replace('{{#if dependencies}}', spec.dependencies ? '' : '<!--')
      .replace('{{/if}}', spec.dependencies ? '' : '-->')
      .replace('{{dependencies}}', spec.dependencies?.join(', ') || '');
  }
  
  /**
   * Create a prompt for generating a system
   */
  private createSystemPrompt(spec: SystemSpec): string {
    const template = this.config.promptTemplates?.system || `
You are designing a reactive system using the ArchitectLM framework.

System Specification:
- Name: {{name}}
- Description: {{description}}
- Processes: {{processes}}
- Tasks: {{tasks}}

Create a complete SystemConfig object that implements this specification.
The SystemConfig should include:
1. A unique ID
2. Process definitions for each process
3. Task definitions for each task
4. Appropriate extensions and observability configuration

Return ONLY the JSON object representing the SystemConfig.
`;

    // Simple template replacement
    return template
      .replace('{{name}}', spec.name)
      .replace('{{description}}', spec.description || '')
      .replace('{{processes}}', JSON.stringify(spec.processes || []))
      .replace('{{tasks}}', JSON.stringify(spec.tasks || []));
  }
  
  /**
   * Create a prompt for analyzing feedback
   */
  private createFeedbackPrompt(feedback: SystemFeedback): string {
    const template = this.config.promptTemplates?.feedback || `
You are analyzing feedback for a reactive system built with the ArchitectLM framework.

System Feedback:
- Validation Results: {{validation}}
- Test Results: {{tests}}
- Static Analysis Results: {{staticAnalysis}}

Analyze this feedback and suggest fixes for the system components.
Your response should include:
1. Updated component definitions
2. An explanation of the changes made

Return ONLY the JSON object representing the SystemFixes.
`;

    // Simple template replacement
    return template
      .replace('{{validation}}', JSON.stringify(feedback.validation || {}))
      .replace('{{tests}}', JSON.stringify(feedback.tests || {}))
      .replace('{{staticAnalysis}}', JSON.stringify(feedback.staticAnalysis || {}));
  }
  
  /**
   * Create a prompt for generating tests
   */
  private createTestPrompt(component: ProcessDefinition | TaskDefinition): string {
    const template = this.config.promptTemplates?.test || `
You are creating tests for a component in the ArchitectLM framework.

Component:
{{component}}

Create a set of test definitions that thoroughly test this component.
The tests should include:
1. Happy path scenarios
2. Edge cases
3. Error handling

Return ONLY the JSON array of TestDefinition objects.
`;

    // Simple template replacement
    return template
      .replace('{{component}}', JSON.stringify(component, null, 2));
  }
  
  /**
   * Create a prompt for generating documentation
   */
  private createDocumentationPrompt(component: any): string {
    const template = this.config.promptTemplates?.documentation || `
You are creating documentation for a component in the ArchitectLM framework.

Component:
{{component}}

Create comprehensive markdown documentation for this component.
The documentation should include:
1. Overview
2. Usage examples
3. API reference
4. Best practices

Return ONLY the markdown documentation.
`;

    // Simple template replacement
    return template
      .replace('{{component}}', JSON.stringify(component, null, 2));
  }
}

/**
 * Create a RAG-enhanced agent extension
 */
export function createRAGAgent(config: Partial<RAGAgentConfig> = {}): RAGAgentExtension {
  return new RAGAgentExtension(config);
} 