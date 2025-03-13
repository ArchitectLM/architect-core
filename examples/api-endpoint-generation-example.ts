/**
 * API Endpoint Generation Example
 * 
 * This example demonstrates how to use the enhanced RAG agent to generate
 * an API endpoint for a Todo application.
 */

import { System, createRuntime } from '../src';
import * as fs from 'fs';
import * as path from 'path';

// Mock RAGAgentConfig interface
interface RAGAgentConfig {
  provider: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  codebasePath?: string;
  useInMemoryVectorStore?: boolean;
}

// Mock RAGAgentExtension class
class MockRAGAgentExtension {
  private config: RAGAgentConfig;
  private runtime: any;

  constructor(config: Partial<RAGAgentConfig> = {}) {
    // Default configuration
    const defaultConfig: RAGAgentConfig = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
      codebasePath: './src',
      useInMemoryVectorStore: false,
      apiKey: process.env.OPENAI_API_KEY || '',
    };
    
    this.config = { ...defaultConfig, ...config };
  }

  async initialize(runtime: any): Promise<void> {
    this.runtime = runtime;
    console.log(`Mock RAG Agent initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
  }

  // This would be one of the new methods we're proposing to add
  async generateAPIEndpoint(endpointSpec: any): Promise<any> {
    console.log('Preparing prompt for the LLM...');
    const prompt = `
      Generate a REST API endpoint for ${endpointSpec.name} with the following operations:
      ${endpointSpec.operations.join(', ')}
      
      The endpoint should interact with the ${endpointSpec.model} model.
      ${endpointSpec.authentication ? 'Include authentication middleware.' : 'No authentication is required.'}
      
      Implement using Express and TypeScript.
      Include proper error handling, validation, and status codes.
    `;
    
    console.log('Calling LLM to generate API endpoint code...');
    // In a real implementation, this would call the LLM
    // For this example, we'll just return a hardcoded response
    
    // Parse operations from the endpoint spec
    const operations = endpointSpec.operations.map((name: string) => {
      let method = 'get';
      if (name.startsWith('create')) method = 'post';
      if (name.startsWith('update')) method = 'put';
      if (name.startsWith('delete')) method = 'delete';
      
      return {
        name,
        method,
        path: name === 'list' ? '/' : name === 'read' ? '/:id' : `/${name.toLowerCase()}`,
        handler: `${name}${endpointSpec.model}`
      };
    });
    
    return {
      name: endpointSpec.name,
      description: endpointSpec.description,
      model: endpointSpec.model,
      operations,
      code: `
import express, { Request, Response } from 'express';
import { ${endpointSpec.model} } from '../models/${endpointSpec.model}';

const router = express.Router();

/**
 * @route   GET /api/${endpointSpec.name.toLowerCase()}
 * @desc    Get all ${endpointSpec.name}
 * @access  Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await ${endpointSpec.model}.find();
    res.json(items);
  } catch (error) {
    console.error('Error fetching ${endpointSpec.name}:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/${endpointSpec.name.toLowerCase()}/:id
 * @desc    Get ${endpointSpec.model} by ID
 * @access  Public
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await ${endpointSpec.model}.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: '${endpointSpec.model} not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching ${endpointSpec.model}:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/${endpointSpec.name.toLowerCase()}
 * @desc    Create a new ${endpointSpec.model}
 * @access  Public
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const newItem = new ${endpointSpec.model}(req.body);
    const savedItem = await newItem.save();
    
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error creating ${endpointSpec.model}:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/${endpointSpec.name.toLowerCase()}/:id
 * @desc    Update ${endpointSpec.model} by ID
 * @access  Public
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updatedItem = await ${endpointSpec.model}.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      return res.status(404).json({ message: '${endpointSpec.model} not found' });
    }
    
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating ${endpointSpec.model}:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/${endpointSpec.name.toLowerCase()}/:id
 * @desc    Delete ${endpointSpec.model} by ID
 * @access  Public
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deletedItem = await ${endpointSpec.model}.findByIdAndDelete(req.params.id);
    
    if (!deletedItem) {
      return res.status(404).json({ message: '${endpointSpec.model} not found' });
    }
    
    res.json({ message: '${endpointSpec.model} removed' });
  } catch (error) {
    console.error('Error deleting ${endpointSpec.model}:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
      `.trim()
    };
  }

  // This would be one of the new methods we're proposing to add
  async generateAPIEndpointFile(endpointDefinition: any, outputPath: string): Promise<string> {
    console.log('Ensuring directory exists...');
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    
    console.log('Writing code to file...');
    fs.writeFileSync(outputPath, endpointDefinition.code);
    
    return outputPath;
  }
}

// Mock createRAGAgent function
function createMockRAGAgent(config: Partial<RAGAgentConfig> = {}): MockRAGAgentExtension {
  return new MockRAGAgentExtension(config);
}

// This is a conceptual example of how the API endpoint generation would work
async function main() {
  console.log('Starting API Endpoint Generation Example...');
  
  // Initialize the RAG agent with configuration
  const config: Partial<RAGAgentConfig> = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY || '',
    temperature: 0.7,
    codebasePath: './src',
    useInMemoryVectorStore: true
  };
  
  // Create the mock RAG agent
  const ragAgent = createMockRAGAgent(config);
  
  // Create a simple system
  const systemConfig = System.create('todo-system')
    .withName('Todo System')
    .withDescription('A system for managing todo items')
    .build();
  
  // Initialize the runtime and the agent
  const runtime = createRuntime(systemConfig);
  await ragAgent.initialize(runtime);
  
  // Create output directory
  const outputDir = path.join(__dirname, '../output/todo-app');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('\n--- Generating API Endpoint ---');
  
  // Define the API endpoint specification
  const todoEndpointSpec = {
    name: 'todos',
    description: 'CRUD operations for todo items',
    model: 'Todo',
    operations: ['list', 'read', 'create', 'update', 'delete'],
    authentication: false
  };
  
  try {
    // Generate the API endpoint
    const endpointDefinition = await ragAgent.generateAPIEndpoint(todoEndpointSpec);
    console.log('\nGenerated API endpoint definition:');
    console.log(`Name: ${endpointDefinition.name}`);
    console.log(`Description: ${endpointDefinition.description}`);
    console.log(`Model: ${endpointDefinition.model}`);
    console.log('Operations:');
    endpointDefinition.operations.forEach((operation: any) => {
      console.log(`  - ${operation.name}: ${operation.method.toUpperCase()} ${operation.path}`);
    });
    
    // Generate the API endpoint file
    const endpointPath = await ragAgent.generateAPIEndpointFile(
      endpointDefinition, 
      path.join(outputDir, 'backend/routes/todos.ts')
    );
    console.log(`\nAPI endpoint generated at: ${endpointPath}`);
    
    // Display the generated code
    console.log('\nGenerated code:');
    console.log('```typescript');
    console.log(endpointDefinition.code);
    console.log('```');
  } catch (error) {
    console.error('Error generating API endpoint:', error);
  }
  
  console.log('\n--- Example Complete ---');
  console.log('Note: This is a simulation. The actual implementation would be part of the RAGAgentExtension class.');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error in API endpoint generation example:', error);
    process.exit(1);
  });
}

export default main; 