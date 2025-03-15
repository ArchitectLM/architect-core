/**
 * Test Implementation Generation
 * 
 * This script tests the enhanced implementation generation capabilities of the RAG agent.
 */

import { System } from '../src';
import { createRAGAgent, RAGAgentConfig } from '../src/core/extensions/rag-agent';
import { 
  DatabaseSchemaSpec, 
  APIEndpointSpec, 
  UIComponentSpec
} from '../src/core/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log('Starting Implementation Generation Test...');
  
  // Get API key and remove any quotes
  const apiKey = process.env.OPENAI_API_KEY?.replace(/^["'](.*)["']$/, '$1') || '';
  
  // Initialize the RAG agent with configuration
  const config: Partial<RAGAgentConfig> = {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.2-1b-instruct:free',
    apiKey: apiKey,
    baseUrl: 'https://openrouter.ai/api/v1',
    temperature: 0.7,
    codebasePath: './src',
    useInMemoryVectorStore: true,
    debug: true
  };
  
  if (!config.apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }
  
  console.log(`Using API key: ${config.apiKey.substring(0, 5)}...${config.apiKey.substring(config.apiKey.length - 4)}`);
  console.log(`Using model: ${config.model}`);
  
  // Create the RAG agent
  const ragAgent = createRAGAgent(config);
  
  // Create a simple system
  const systemConfig = System.create('test-system')
    .withName('Test System')
    .withDescription('A system for testing implementation generation')
    .build();
  
  // Skip runtime initialization to avoid type errors
  // We don't actually need the runtime for the implementation generation features
  // await ragAgent.initialize(runtime);
  
  // Create output directory
  const outputDir = path.join(__dirname, '../output/test-implementation');
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  } catch (error) {
    console.error('Error creating output directory:', error);
  }
  
  // Test database schema generation
  console.log('\n--- Testing Database Schema Generation ---');
  try {
    const userSchemaSpec: DatabaseSchemaSpec = {
      name: 'User',
      description: 'A user account',
      fields: [
        { name: 'username', type: 'string', required: true, unique: true },
        { name: 'email', type: 'string', required: true, unique: true },
        { name: 'password', type: 'string', required: true },
        { name: 'firstName', type: 'string', required: false },
        { name: 'lastName', type: 'string', required: false },
        { name: 'isActive', type: 'boolean', default: 'true' },
        { name: 'role', type: 'string', default: '"user"' }
      ],
      timestamps: true,
      indexes: [
        { fields: ['email'], unique: true },
        { fields: ['username'], unique: true }
      ]
    };
    
    console.log('Generating database schema...');
    const modelDefinition = await ragAgent.generateDatabaseSchema(userSchemaSpec);
    
    console.log('Generating database model file...');
    const modelPath = await ragAgent.generateDatabaseModelFile(
      modelDefinition, 
      path.join(outputDir, 'models/User.ts')
    );
    
    console.log(`Database model generated at: ${modelPath}`);
    console.log('Database schema generation test passed');
  } catch (error) {
    console.error('Database schema generation test failed:', error);
  }
  
  // Test API endpoint generation
  console.log('\n--- Testing API Endpoint Generation ---');
  try {
    const userEndpointSpec: APIEndpointSpec = {
      name: 'users',
      description: 'API endpoints for managing user accounts',
      model: 'User',
      operations: ['list', 'read', 'create', 'update', 'delete'],
      authentication: true,
      validation: true
    };
    
    console.log('Generating API endpoint...');
    const endpointDefinition = await ragAgent.generateAPIEndpoint(userEndpointSpec);
    
    console.log('Generating API endpoint file...');
    const endpointPath = await ragAgent.generateAPIEndpointFile(
      endpointDefinition, 
      path.join(outputDir, 'routes/users.ts')
    );
    
    console.log(`API endpoint generated at: ${endpointPath}`);
    console.log('API endpoint generation test passed');
  } catch (error) {
    console.error('API endpoint generation test failed:', error);
  }
  
  // Test UI component generation
  console.log('\n--- Testing UI Component Generation ---');
  try {
    const userListSpec: UIComponentSpec = {
      name: 'UserList',
      description: 'A list of user accounts with filtering and pagination',
      props: [
        { name: 'users', type: 'User[]', required: true },
        { name: 'onEdit', type: '(id: string) => void', required: true },
        { name: 'onDelete', type: '(id: string) => void', required: true },
        { name: 'onPageChange', type: '(page: number) => void', required: false },
        { name: 'currentPage', type: 'number', required: false, default: '1' },
        { name: 'totalPages', type: 'number', required: false, default: '1' },
        { name: 'onFilterChange', type: '(filter: string) => void', required: false },
        { name: 'onSortChange', type: '(sortBy: string, sortOrder: "asc" | "desc") => void', required: false }
      ],
      framework: 'react',
      styling: 'tailwind'
    };
    
    console.log('Generating UI component...');
    const componentDefinition = await ragAgent.generateUIComponent(userListSpec);
    
    console.log('Generating UI component file...');
    const componentPath = await ragAgent.generateUIComponentFile(
      componentDefinition, 
      path.join(outputDir, 'components/UserList.tsx')
    );
    
    console.log(`UI component generated at: ${componentPath}`);
    console.log('UI component generation test passed');
  } catch (error) {
    console.error('UI component generation test failed:', error);
  }
  
  console.log('\n--- Implementation Generation Test Complete ---');
  console.log('Output directory:', outputDir);
}

// Run the test
if (require.main === module) {
  main().catch(error => {
    console.error('Error in implementation generation test:', error);
    process.exit(1);
  });
}

export default main; 