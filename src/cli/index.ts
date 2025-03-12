#!/usr/bin/env node
/**
 * ArchitectLM CLI
 * 
 * Command-line interface for the ArchitectLM framework that enables
 * schema editing, validation, test generation, and code generation.
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { loadSchemaFiles } from './schema-loader';
import { validateSchema } from './schema-validator';
import { applySchemaEdit } from './schema-editor';
import { generateTests } from './test-generator';
import { generateCode } from './code-generator';
import { ValidationResult } from '../schema/validation';

// Create the command-line program
const program = new Command();

program
  .name('architectlm')
  .description('CLI for the ArchitectLM framework')
  .version('0.1.0');

// Edit schema command
program
  .command('edit')
  .description('Edit a schema using natural language prompts')
  .requiredOption('-d, --domain <path>', 'Path to domain schema files (directory or single file)')
  .requiredOption('-p, --prompt <text>', 'Natural language prompt describing the changes to make')
  .option('-t, --template <path>', 'Path to prompt template file', 'default')
  .option('-o, --output <path>', 'Output directory for modified schema', './output')
  .option('--generate-tests', 'Generate tests for the modified schema', false)
  .option('--generate-code', 'Generate implementation code for the modified schema', false)
  .action(async (options) => {
    try {
      console.log('Loading schema files...');
      const schemaFiles = await loadSchemaFiles(options.domain);
      
      console.log('Validating original schema...');
      const validationResult = validateSchema(schemaFiles);
      if (!validationResult.success) {
        console.error('Original schema has validation errors:');
        validationResult.issues.forEach(issue => {
          console.error(`- ${issue.path}: ${issue.message} (${issue.severity})`);
        });
        process.exit(1);
      }
      
      console.log('Applying schema edits based on prompt...');
      const editResult = await applySchemaEdit(schemaFiles, options.prompt, options.template);
      
      console.log('Validating modified schema...');
      const modifiedValidationResult = validateSchema(editResult.modifiedSchema);
      if (!modifiedValidationResult.success) {
        console.error('Modified schema has validation errors:');
        modifiedValidationResult.issues.forEach(issue => {
          console.error(`- ${issue.path}: ${issue.message} (${issue.severity})`);
        });
        
        console.log('Explanation of changes:');
        console.log(editResult.explanation);
        
        console.log('Would you like to save the modified schema anyway? (y/n)');
        // In a real implementation, we would prompt the user here
        // For now, we'll just exit
        process.exit(1);
      }
      
      // Save the modified schema
      console.log('Saving modified schema...');
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }
      
      for (const [filename, content] of Object.entries(editResult.modifiedSchema)) {
        const outputPath = path.join(options.output, path.basename(filename));
        fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));
        console.log(`Saved ${outputPath}`);
      }
      
      console.log('Explanation of changes:');
      console.log(editResult.explanation);
      
      // Generate tests if requested
      if (options.generateTests) {
        console.log('Generating tests...');
        const testResult = await generateTests(editResult.modifiedSchema);
        
        // Save the generated tests
        const testsDir = path.join(options.output, 'tests');
        if (!fs.existsSync(testsDir)) {
          fs.mkdirSync(testsDir, { recursive: true });
        }
        
        for (const [filename, content] of Object.entries(testResult.tests)) {
          const outputPath = path.join(testsDir, filename);
          fs.writeFileSync(outputPath, content);
          console.log(`Saved test ${outputPath}`);
        }
      }
      
      // Generate code if requested
      if (options.generateCode) {
        console.log('Generating implementation code...');
        const codeResult = await generateCode(editResult.modifiedSchema);
        
        // Save the generated code
        const codeDir = path.join(options.output, 'src');
        if (!fs.existsSync(codeDir)) {
          fs.mkdirSync(codeDir, { recursive: true });
        }
        
        for (const [filename, content] of Object.entries(codeResult.code)) {
          const outputPath = path.join(codeDir, filename);
          
          // Create subdirectories if needed
          const dirPath = path.dirname(outputPath);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
          
          fs.writeFileSync(outputPath, content);
          console.log(`Saved code ${outputPath}`);
        }
      }
      
      console.log('Done!');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Validate schema command
program
  .command('validate')
  .description('Validate a schema without editing')
  .requiredOption('-d, --domain <path>', 'Path to domain schema files (directory or single file)')
  .action(async (options) => {
    try {
      console.log('Loading schema files...');
      const schemaFiles = await loadSchemaFiles(options.domain);
      
      console.log('Validating schema...');
      const validationResult = validateSchema(schemaFiles);
      
      if (validationResult.success) {
        console.log('Schema is valid!');
      } else {
        console.error('Schema has validation errors:');
        validationResult.issues.forEach(issue => {
          console.error(`- ${issue.path}: ${issue.message} (${issue.severity})`);
        });
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Generate tests command
program
  .command('generate-tests')
  .description('Generate tests for a schema')
  .requiredOption('-d, --domain <path>', 'Path to domain schema files (directory or single file)')
  .requiredOption('-o, --output <path>', 'Output directory for generated tests')
  .action(async (options) => {
    try {
      console.log('Loading schema files...');
      const schemaFiles = await loadSchemaFiles(options.domain);
      
      console.log('Validating schema...');
      const validationResult = validateSchema(schemaFiles);
      if (!validationResult.success) {
        console.error('Schema has validation errors:');
        validationResult.issues.forEach(issue => {
          console.error(`- ${issue.path}: ${issue.message} (${issue.severity})`);
        });
        process.exit(1);
      }
      
      console.log('Generating tests...');
      const testResult = await generateTests(schemaFiles);
      
      // Save the generated tests
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }
      
      for (const [filename, content] of Object.entries(testResult.tests)) {
        const outputPath = path.join(options.output, filename);
        
        // Create subdirectories if needed
        const dirPath = path.dirname(outputPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, content);
        console.log(`Saved test ${outputPath}`);
      }
      
      console.log('Done!');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Generate code command
program
  .command('generate-code')
  .description('Generate implementation code for a schema')
  .requiredOption('-d, --domain <path>', 'Path to domain schema files (directory or single file)')
  .requiredOption('-o, --output <path>', 'Output directory for generated code')
  .action(async (options) => {
    try {
      console.log('Loading schema files...');
      const schemaFiles = await loadSchemaFiles(options.domain);
      
      console.log('Validating schema...');
      const validationResult = validateSchema(schemaFiles);
      if (!validationResult.success) {
        console.error('Schema has validation errors:');
        validationResult.issues.forEach(issue => {
          console.error(`- ${issue.path}: ${issue.message} (${issue.severity})`);
        });
        process.exit(1);
      }
      
      console.log('Generating implementation code...');
      const codeResult = await generateCode(schemaFiles);
      
      // Save the generated code
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }
      
      for (const [filename, content] of Object.entries(codeResult.code)) {
        const outputPath = path.join(options.output, filename);
        
        // Create subdirectories if needed
        const dirPath = path.dirname(outputPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, content);
        console.log(`Saved code ${outputPath}`);
      }
      
      console.log('Done!');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Parse command-line arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 