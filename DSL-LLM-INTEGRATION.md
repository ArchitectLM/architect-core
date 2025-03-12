# Hybrid DSL Integration with LLM Agents

This document describes how the Hybrid DSL has been integrated with the LLM (Large Language Model) agents in the system.

## Overview

The Hybrid DSL (Domain-Specific Language) provides a structured way to define reactive systems using TypeScript. By integrating the DSL with LLM agents, we enable natural language-based manipulation of system schemas, making it easier for users to create and modify systems without having to write code directly.

## Components

### 1. Schema Editing Agent

The Schema Editing Agent (`SchemaEditingAgent`) is responsible for applying changes to system schemas based on natural language instructions. It uses the DSL's `SystemBuilder` to create and modify systems.

Key features:
- Natural language processing to understand user instructions
- System validation using the DSL's validation functions
- Error handling and reporting
- Explanation of changes made to the system

### 2. DSL Adapter for CLI

The DSL Adapter (`dsl-adapter.ts`) provides integration between the Hybrid DSL and the CLI, allowing for:
- Converting between DSL and JSON representations
- Validating systems created with the DSL
- Migrating systems to new versions
- Saving and loading systems from files

## Implementation Details

### Schema Editing Agent

The Schema Editing Agent uses the `SystemBuilder` from the DSL to create and modify systems. It supports various operations:

1. **Adding Tasks**:
   ```typescript
   builder.withTask(taskId, task => ({
     ...task,
     name: taskName,
     type: 'operation',
     description: description,
     input: [],
     output: []
   }));
   ```

2. **Adding Processes**:
   ```typescript
   // For stateful processes
   builder.withStatefulProcess(processId, contextId, {
     name: processName,
     states: ['initial', 'processing', 'completed'],
     transitions: [
       { from: 'initial', to: 'processing', on: 'start' },
       { from: 'processing', to: 'completed', on: 'complete' }
     ]
   });
   
   // For stateless processes
   builder.withProcess(processId, contextId, processName);
   ```

3. **Adding Fields to Tasks**:
   ```typescript
   // Add a status field to a task
   modifiedSchema.tasks[taskId].status = 'pending';
   modifiedSchema.tasks[taskId].statusValues = ['pending', 'in-progress', 'completed'];
   ```

### DSL Adapter for CLI

The DSL Adapter provides functions for working with the DSL in the CLI:

1. **Converting DSL to JSON**:
   ```typescript
   const jsonContent = await convertDslToJson(dslFilePath);
   ```

2. **Loading Systems from Files**:
   ```typescript
   const system = await loadSystemFromFile(filePath);
   ```

3. **Validating Systems**:
   ```typescript
   const validationResult = validateDslSystem(system);
   ```

4. **Migrating Systems**:
   ```typescript
   const migratedSystem = migrateDslSystem(system, targetVersion, transformerCode);
   ```

5. **Saving Systems to Files**:
   ```typescript
   await saveSystemToFile(system, outputPath);
   ```

## Testing

The integration is thoroughly tested with unit tests:

1. **Schema Editing Agent Tests**:
   - Testing natural language-based schema changes
   - Validating error handling
   - Testing explanation generation

2. **DSL Adapter Tests**:
   - Testing file operations
   - Testing schema validation
   - Testing schema migration

## Usage Examples

### Using the Schema Editing Agent

```typescript
const schemaEditor = new SchemaEditingAgent();

// Apply a schema change based on natural language
const result = await schemaEditor.applySchemaChange({
  instruction: 'Add a field called status to task task-test',
  entityType: 'task',
  entityId: 'task-test',
  currentSystem: system
});

if (result.success) {
  console.log('Change applied successfully!');
  console.log(result.changeDescription);
} else {
  console.error('Failed to apply change:');
  console.error(result.validationIssues);
}
```

### Using the DSL Adapter

```typescript
// Convert a DSL file to JSON
const jsonContent = await convertDslToJson('system.ts');

// Load a system from a file
const system = await loadSystemFromFile('system.json');

// Validate a system
const validationResult = validateDslSystem(system);

// Migrate a system to a new version
const migratedSystem = migrateDslSystem(system, '2.0.0');

// Save a system to a file
await saveSystemToFile(system, 'updated-system.json');
```

## Future Improvements

1. **Enhanced Natural Language Understanding**:
   - Improve the ability to understand complex instructions
   - Support for more operations like removing entities, modifying relationships, etc.

2. **Integration with More LLM Models**:
   - Support for different LLM models with varying capabilities
   - Model-specific optimizations

3. **Interactive Schema Editing**:
   - Conversational interface for schema editing
   - Suggestions and recommendations based on system analysis

4. **Schema Visualization**:
   - Generate visual representations of systems
   - Interactive diagrams for system exploration and editing

5. **Code Generation**:
   - Generate implementation code based on system definitions
   - Test case generation based on system behavior 