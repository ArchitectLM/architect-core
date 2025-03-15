/**
 * UI Component Generation Example
 * 
 * This example demonstrates how to use the enhanced RAG agent to generate
 * a UI component for a Todo application.
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
  async generateUIComponent(componentSpec: any): Promise<any> {
    console.log('Preparing prompt for the LLM...');
    const prompt = `
      Generate a UI component named ${componentSpec.name} with the following props:
      ${componentSpec.props.map((prop: any) => 
        `- ${prop.name}: ${prop.type}${prop.required ? ' (required)' : ''}`
      ).join('\n')}
      
      The component should be implemented using ${componentSpec.framework}.
      ${componentSpec.styling ? `Use ${componentSpec.styling} for styling.` : ''}
      
      Include proper TypeScript types, error handling, and comments.
    `;
    
    console.log('Calling LLM to generate UI component code...');
    // In a real implementation, this would call the LLM
    // For this example, we'll just return a hardcoded response
    
    return {
      name: componentSpec.name,
      description: componentSpec.description,
      props: componentSpec.props.map((prop: any) => ({
        name: prop.name,
        type: prop.type,
        required: prop.required || false
      })),
      code: `
import React from 'react';

// Define the Todo type
interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Define the props for the ${componentSpec.name} component
interface ${componentSpec.name}Props {
  ${componentSpec.props.map((prop: any) => 
    `${prop.name}: ${prop.type};${prop.required ? ' // Required' : ''}`
  ).join('\n  ')}
}

/**
 * ${componentSpec.description}
 */
const ${componentSpec.name}: React.FC<${componentSpec.name}Props> = ({ 
  ${componentSpec.props.map((prop: any) => prop.name).join(', ')} 
}) => {
  // Handle empty todos array
  if (todos.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">No todos found. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <ul className="divide-y divide-gray-200">
        {todos.map((todo) => (
          <li key={todo.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggle(todo.id)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="ml-3">
                <p className={\`\${todo.completed ? 'line-through text-gray-400' : 'text-gray-900'} font-medium\`}>
                  {todo.title}
                </p>
                {todo.description && (
                  <p className="text-sm text-gray-500">{todo.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  Created: {new Date(todo.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => onDelete(todo.id)}
              className="ml-2 bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ${componentSpec.name};
      `.trim()
    };
  }

  // This would be one of the new methods we're proposing to add
  async generateUIComponentFile(componentDefinition: any, outputPath: string): Promise<string> {
    console.log('Ensuring directory exists...');
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    
    console.log('Writing code to file...');
    fs.writeFileSync(outputPath, componentDefinition.code);
    
    return outputPath;
  }
}

// Mock createRAGAgent function
function createMockRAGAgent(config: Partial<RAGAgentConfig> = {}): MockRAGAgentExtension {
  return new MockRAGAgentExtension(config);
}

// This is a conceptual example of how the UI component generation would work
async function main() {
  console.log('Starting UI Component Generation Example...');
  
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
  
  console.log('\n--- Generating UI Component ---');
  
  // Define the UI component specification
  const todoListSpec = {
    name: 'TodoList',
    description: 'A list of todo items with toggle and delete functionality',
    props: [
      { name: 'todos', type: 'Todo[]', required: true },
      { name: 'onToggle', type: '(id: string) => void', required: true },
      { name: 'onDelete', type: '(id: string) => void', required: true }
    ],
    framework: 'react',
    styling: 'tailwind'
  };
  
  try {
    // Generate the UI component
    const componentDefinition = await ragAgent.generateUIComponent(todoListSpec);
    console.log('\nGenerated UI component definition:');
    console.log(`Name: ${componentDefinition.name}`);
    console.log(`Description: ${componentDefinition.description}`);
    console.log('Props:');
    componentDefinition.props.forEach((prop: any) => {
      console.log(`  - ${prop.name}: ${prop.type}${prop.required ? ' (required)' : ''}`);
    });
    
    // Generate the UI component file
    const componentPath = await ragAgent.generateUIComponentFile(
      componentDefinition, 
      path.join(outputDir, 'frontend/src/components/TodoList.tsx')
    );
    console.log(`\nUI component generated at: ${componentPath}`);
    
    // Display the generated code
    console.log('\nGenerated code:');
    console.log('```typescript');
    console.log(componentDefinition.code);
    console.log('```');
  } catch (error) {
    console.error('Error generating UI component:', error);
  }
  
  console.log('\n--- Example Complete ---');
  console.log('Note: This is a simulation. The actual implementation would be part of the RAGAgentExtension class.');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error in UI component generation example:', error);
    process.exit(1);
  });
}

export default main; 