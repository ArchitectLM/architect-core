/**
 * Todo System DSL Example
 * 
 * This example demonstrates how to:
 * 1. Create a Todo system using the Hybrid DSL
 * 2. Serialize the system to JSON (for database storage, HTTP transfer, etc.)
 * 3. Deserialize the system from JSON
 * 4. Validate the system
 */

import { 
  SystemBuilder, 
  ProcessBuilder,
  TaskBuilder,
  migrateSchema,
  validateStateTransitions,
  EnhancedValidationResult
} from '../src/dsl';

// Step 1: Create a Todo system using the builder pattern
function createTodoSystem() {
  return SystemBuilder.create('todo-system')
    .withName('Todo System')
    .withDescription('A simple todo management system')
    .withVersion('1.0.0')
    // Add bounded context
    .withBoundedContext('todos', 'Todo Management')
    // Add stateful process for managing todos
    .withStatefulProcess('manage-todos', 'todos', {
      name: 'Manage Todos',
      states: ['active', 'completed', 'archived'],
      transitions: [
        { from: 'active', to: 'completed', on: 'complete' },
        { from: 'completed', to: 'active', on: 'reactivate' },
        { from: 'active', to: 'archived', on: 'archive' },
        { from: 'completed', to: 'archived', on: 'archive' },
        { from: 'archived', to: 'active', on: 'restore' }
      ]
    })
    // Add stateless process for managing lists
    .withProcess('manage-lists', 'todos', 'Manage Todo Lists')
    // Add tasks
    .withTask('validate-todo', task => ({
      ...task,
      label: 'Validate Todo',
      type: 'operation',
      description: 'Validates todo data',
      input: ['title', 'description', 'dueDate'],
      output: ['isValid', 'errors']
    }))
    .withTask('save-todo', task => ({
      ...task,
      label: 'Save Todo',
      type: 'operation',
      description: 'Saves todo to database',
      input: ['todo'],
      output: ['savedTodo']
    }))
    .withTask('update-todo', task => ({
      ...task,
      label: 'Update Todo',
      type: 'operation',
      description: 'Updates existing todo',
      input: ['todoId', 'updates'],
      output: ['updatedTodo']
    }))
    .withTask('delete-todo', task => ({
      ...task,
      label: 'Delete Todo',
      type: 'operation',
      description: 'Deletes a todo',
      input: ['todoId'],
      output: ['success']
    }))
    .withTask('validate-list', task => ({
      ...task,
      label: 'Validate List',
      type: 'operation',
      description: 'Validates todo list data',
      input: ['name'],
      output: ['isValid', 'errors']
    }))
    .withTask('save-list', task => ({
      ...task,
      label: 'Save List',
      type: 'operation',
      description: 'Saves todo list to database',
      input: ['list'],
      output: ['savedList']
    }))
    .withTask('update-list', task => ({
      ...task,
      label: 'Update List',
      type: 'operation',
      description: 'Updates existing todo list',
      input: ['listId', 'updates'],
      output: ['updatedList']
    }))
    .withTask('delete-list', task => ({
      ...task,
      label: 'Delete List',
      type: 'operation',
      description: 'Deletes a todo list',
      input: ['listId'],
      output: ['success']
    }))
    // Add tasks to processes
    .withProcessTask('manage-todos', 'validate-todo')
    .withProcessTask('manage-todos', 'save-todo')
    .withProcessTask('manage-todos', 'update-todo')
    .withProcessTask('manage-todos', 'delete-todo')
    .withProcessTask('manage-lists', 'validate-list')
    .withProcessTask('manage-lists', 'save-list')
    .withProcessTask('manage-lists', 'update-list')
    .withProcessTask('manage-lists', 'delete-list')
    .build();
}

// Step 2: Serialize the system to JSON
function serializeSystem() {
  const todoSystem = createTodoSystem();
  
  // Simple serialization
  const serialized = JSON.stringify(todoSystem, null, 2);
  
  // For database storage, you might want to compress it
  const compressedSerialized = JSON.stringify(todoSystem);
  
  console.log('System serialized successfully!');
  console.log(`Full size: ${serialized.length} bytes`);
  console.log(`Compressed size: ${compressedSerialized.length} bytes`);
  
  return serialized;
}

// Step 3: Deserialize the system from JSON
function deserializeSystem(serialized: string) {
  try {
    // Parse the JSON string
    const parsedSystem = JSON.parse(serialized);
    
    // Rebuild using the SystemBuilder to ensure proper structure
    const rebuiltSystem = SystemBuilder.create(parsedSystem.id)
      .transform(() => parsedSystem)
      .build();
    
    console.log('System deserialized successfully!');
    return rebuiltSystem;
  } catch (error) {
    console.error('Error deserializing system:', error);
    throw error;
  }
}

// Step 4: Validate the deserialized system
function validateSystem(system: any): EnhancedValidationResult {
  try {
    // Use the SystemBuilder to validate
    const builder = SystemBuilder.create(system.id)
      .transform(() => system);
    
    const validationResult = builder.validate();
    
    if (validationResult.success) {
      console.log('System validation successful!');
    } else {
      console.error('System validation failed:');
      validationResult.issues.forEach(issue => {
        console.error(`- ${issue.path}: ${issue.message} (${issue.severity})`);
      });
    }
    
    return validationResult;
  } catch (error) {
    console.error('Error validating system:', error);
    throw error;
  }
}

// Step 5: Migrate the system to a new version
function migrateToNewVersion(system: any, newVersion: string) {
  // Define a migration transformation
  const migration = (system: any) => ({
    ...system,
    // Add a new metadata field
    metadata: {
      ...system.metadata,
      migrated: true,
      migrationDate: new Date().toISOString()
    },
    // Update the processes to include a new field
    processes: Object.entries(system.processes || {}).reduce((acc, [id, process]: [string, any]) => ({
      ...acc,
      [id]: {
        ...process,
        metadata: {
          ...process.metadata,
          migrated: true,
          originalType: process.type
        }
      }
    }), {})
  });
  
  // Migrate the system
  const migratedSystem = migrateSchema(system, newVersion, migration);
  
  console.log(`System migrated to version ${newVersion} successfully!`);
  return migratedSystem;
}

// Example usage for CLI or HTTP API integration
function main() {
  try {
    // Create and serialize the system
    console.log('Creating and serializing Todo system...');
    const serialized = serializeSystem();
    
    // Save to a file (simulating database storage)
    console.log('Saving serialized system to file...');
    // In a real application, you would save to a database or file
    // fs.writeFileSync('todo-system.json', serialized);
    
    // Deserialize the system (simulating loading from database)
    console.log('\nDeserializing system from JSON...');
    const deserializedSystem = deserializeSystem(serialized);
    
    // Validate the deserialized system
    console.log('\nValidating deserialized system...');
    const validationResult = validateSystem(deserializedSystem);
    
    // Migrate to a new version
    if (validationResult.success) {
      console.log('\nMigrating system to version 2.0.0...');
      const migratedSystem = migrateToNewVersion(deserializedSystem, '2.0.0');
      
      // Validate the migrated system
      console.log('\nValidating migrated system...');
      validateSystem(migratedSystem);
      
      // Serialize the migrated system
      console.log('\nSerializing migrated system...');
      const migratedSerialized = JSON.stringify(migratedSystem, null, 2);
      console.log(`Migrated system size: ${migratedSerialized.length} bytes`);
      
      // In a real application, you would save the migrated system
      // fs.writeFileSync('todo-system-v2.json', migratedSerialized);
    }
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the example
main();

// Export functions for use in CLI or HTTP API
export {
  createTodoSystem,
  serializeSystem,
  deserializeSystem,
  validateSystem,
  migrateToNewVersion
}; 