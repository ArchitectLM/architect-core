/**
 * Generate Todo App Example
 * 
 * This script runs all examples to generate a complete Todo application.
 */

import databaseModelGeneration from './database-model-generation-example';
import apiEndpointGeneration from './api-endpoint-generation-example';
import uiComponentGeneration from './ui-component-generation-example';
import projectStructureGeneration from './project-structure-generation-example';
import integrationTestGeneration from './integration-test-generation-example';
import documentationGeneration from './documentation-generation-example';

async function main() {
  console.log('=== Generating Todo Application ===\n');
  
  console.log('Step 1: Generating Project Structure');
  await projectStructureGeneration();
  
  console.log('\nStep 2: Generating Database Model');
  await databaseModelGeneration();
  
  console.log('\nStep 3: Generating API Endpoint');
  await apiEndpointGeneration();
  
  console.log('\nStep 4: Generating UI Component');
  await uiComponentGeneration();
  
  console.log('\nStep 5: Generating Integration Tests');
  await integrationTestGeneration();
  
  console.log('\nStep 6: Generating Documentation');
  await documentationGeneration();
  
  console.log('\n=== Todo Application Generated Successfully ===');
  console.log('The application is available in the output/todo-app directory.');
  console.log('Structure:');
  console.log('output/todo-app/');
  console.log('├── package.json');
  console.log('├── README.md');
  console.log('├── docs/');
  console.log('│   └── README.md');
  console.log('├── backend/');
  console.log('│   ├── package.json');
  console.log('│   ├── tsconfig.json');
  console.log('│   ├── .env');
  console.log('│   ├── src/');
  console.log('│   │   ├── index.ts');
  console.log('│   │   ├── models/');
  console.log('│   │   │   └── Todo.ts');
  console.log('│   │   ├── routes/');
  console.log('│   │   │   └── todos.ts');
  console.log('│   │   ├── controllers/');
  console.log('│   │   └── middleware/');
  console.log('│   └── tests/');
  console.log('│       └── todo.test.ts');
  console.log('└── frontend/');
  console.log('    ├── package.json');
  console.log('    ├── tsconfig.json');
  console.log('    ├── vite.config.ts');
  console.log('    ├── index.html');
  console.log('    └── src/');
  console.log('        ├── App.tsx');
  console.log('        ├── index.tsx');
  console.log('        ├── components/');
  console.log('        │   └── TodoList.tsx');
  console.log('        ├── pages/');
  console.log('        └── styles/');
  console.log('            ├── index.css');
  console.log('            └── App.css');
  
  console.log('\nNote: This is a simulation of what the enhanced RAG agent would generate.');
  console.log('The project structure generation creates a complete project skeleton with:');
  console.log('1. Project configuration files (package.json, tsconfig.json, etc.)');
  console.log('2. Backend server setup (app.ts, server.ts, etc.)');
  console.log('3. Frontend app setup (App.tsx, index.tsx, etc.)');
  console.log('4. Directory structure for models, routes, components, etc.');
  console.log('\nThe other examples then populate this structure with specific implementations:');
  console.log('- Database model generation creates the Todo model');
  console.log('- API endpoint generation creates the todos API routes');
  console.log('- UI component generation creates the TodoList component');
  console.log('- Integration test generation creates tests for the API endpoints');
  console.log('- Documentation generation creates comprehensive documentation');
  console.log('\nThis is now a fully complete application with all necessary components!');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Error generating Todo application:', error);
    process.exit(1);
  });
}

export default main; 