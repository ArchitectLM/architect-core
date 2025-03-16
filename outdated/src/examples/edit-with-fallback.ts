/**
 * Edit With Fallback Example
 * 
 * This example demonstrates how to use the schema editing agent with a fallback
 * mechanism when the agent doesn't make changes.
 */

import fs from 'fs';
import path from 'path';
import { loadSystemFromFile, saveSystemToFile, validateDslSystem } from '../cli/dsl-adapter';
import { ValidationIssue } from '../cli/schema-validator';
import { applySchemaEdit } from '../cli/schema-editor';
import { generateTests } from '../cli/test-generator';
import { generateCode } from '../cli/code-generator';
import { ReactiveSystemRuntime } from '../runtime-core/lib/runtime';
import { CodeGenerator } from '../runtime-core/lib/code-generation';

async function editWithFallback() {
  try {
    console.log('Loading system from file...');
    const systemPath = path.resolve('examples/todo-system.json');
    const system = await loadSystemFromFile(systemPath);

    console.log('Validating original system...');
    const validationResult = validateDslSystem(system);
    if (!validationResult.success) {
      console.error('Original system has validation errors:');
      validationResult.issues?.forEach((issue: ValidationIssue) => {
        console.error(`- ${issue.message}`);
      });
      process.exit(1);
    }

    console.log('Applying schema edits based on prompt...');
    const prompt = "Add a task called mark-important with input fields todoId and priority, and output field success";
    const editResult = await applySchemaEdit({ 'todo-system.json': system }, prompt, 'default');

    // Check if the agent made any changes
    let modifiedSystem = editResult.modifiedSchema['todo-system.json'];
    const originalTaskCount = Object.keys(system.tasks || {}).length;
    const modifiedTaskCount = Object.keys(modifiedSystem.tasks || {}).length;

    // If no changes were made, apply fallback changes
    if (originalTaskCount === modifiedTaskCount) {
      console.log('No changes detected from the agent. Applying fallback changes...');
      
      // Create the mark-important task manually
      const markImportantTask = {
        id: 'mark-important',
        name: 'Mark Todo as Important',
        type: 'operation',
        description: 'Marks a todo as important with a priority level',
        input: [
          {
            name: 'todoId',
            type: 'string',
            required: true
          },
          {
            name: 'priority',
            type: 'string',
            required: true
          }
        ],
        output: [
          {
            name: 'success',
            type: 'boolean'
          }
        ]
      };

      // Add the task to the system
      modifiedSystem.tasks = {
        ...modifiedSystem.tasks,
        'mark-important': markImportantTask
      };

      // Add the task to the manage-todos process
      if (modifiedSystem.processes && modifiedSystem.processes['manage-todos']) {
        const manageTodosProcess = modifiedSystem.processes['manage-todos'];
        manageTodosProcess.tasks = [...(manageTodosProcess.tasks || []), 'mark-important'];
      }
    }

    console.log('Validating modified system...');
    const modifiedValidationResult = validateDslSystem(modifiedSystem);
    if (!modifiedValidationResult.success) {
      console.error('Modified system has validation errors:');
      modifiedValidationResult.issues?.forEach((issue: ValidationIssue) => {
        console.error(`- ${issue.message}`);
      });
      process.exit(1);
    }

    // Save the modified system
    console.log('Saving modified system...');
    const outputDir = path.resolve('output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'todo-system-with-fallback.json');
    await saveSystemToFile(modifiedSystem, outputPath);
    console.log(`Saved ${outputPath}`);

    // Generate tests
    console.log('Generating tests...');
    const testsDir = path.join(outputDir, 'tests-with-fallback');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const testResult = await generateTests({ 'todo-system.json': modifiedSystem });
    
    for (const [filename, content] of Object.entries(testResult.tests)) {
      const testOutputPath = path.join(testsDir, filename);
      
      // Create subdirectories if needed
      const dirPath = path.dirname(testOutputPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(testOutputPath, content);
      console.log(`Saved test ${testOutputPath}`);
    }

    // Generate code
    console.log('Generating implementation code...');
    const codeDir = path.join(outputDir, 'src-with-fallback');
    if (!fs.existsSync(codeDir)) {
      fs.mkdirSync(codeDir, { recursive: true });
    }

    const codeResult = await generateCode({ 'todo-system.json': modifiedSystem });
    
    for (const [filename, content] of Object.entries(codeResult.code)) {
      const codeOutputPath = path.join(codeDir, filename);
      
      // Create subdirectories if needed
      const dirPath = path.dirname(codeOutputPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(codeOutputPath, content);
      console.log(`Saved code ${codeOutputPath}`);
    }

    // Demonstrate using the runtime core with the modified system
    console.log('Creating runtime with the modified system...');
    const runtime = new ReactiveSystemRuntime(modifiedSystem);

    // Register a mock implementation for the mark-important task
    runtime.registerTaskImplementation('mark-important', async (input) => {
      console.log(`Executing mark-important task with input: ${JSON.stringify(input)}`);
      return {
        success: true,
        priority: input.priority
      };
    });

    // Execute the mark-important task
    console.log('Executing mark-important task...');
    const result = await runtime.executeTask('mark-important', {
      todoId: '123',
      priority: 'high'
    });

    console.log('Task execution result:', result);

    // Demonstrate code generation using the CodeGenerator
    console.log('Generating code for mark-important task using CodeGenerator...');
    const codeGenerator = new CodeGenerator();
    const taskCodeResult = await codeGenerator.generateTaskCode(
      modifiedSystem.tasks['mark-important'],
      modifiedSystem,
      {
        language: 'typescript',
        includeComments: true,
        includeTests: true,
        includeErrorHandling: true
      }
    );

    console.log('Generated code:');
    console.log(taskCodeResult.code);

    if (taskCodeResult.tests) {
      console.log('Generated tests:');
      console.log(taskCodeResult.tests);
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example
editWithFallback().catch(console.error); 