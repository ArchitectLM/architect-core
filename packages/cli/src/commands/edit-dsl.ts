/**
 * Edit DSL command
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import { createRAGAgentEditor } from '../core/extensions/rag-agent-editor';
import { createRuntime } from '../core/implementations/runtime';

/**
 * Register edit DSL command
 */
export function registerEditDSLCommand(program: Command): void {
  program
    .command('edit-dsl')
    .description('Edit DSL files with AI assistance')
    .argument('<file>', 'Path to the DSL file to edit')
    .option('-i, --instruction <instruction>', 'Instruction for editing the file')
    .option('-o, --output <output>', 'Output file path')
    .action(async (file: string, options: { instruction?: string; output?: string }) => {
      try {
        await editDSL(file, options.instruction, options.output);
      } catch (error) {
        console.error(chalk.red('Error editing DSL file:'), error);
        process.exit(1);
      }
    });
}

/**
 * Edit DSL file
 */
async function editDSL(
  filePath: string,
  instruction: string = 'Improve this code',
  outputPath?: string
): Promise<void> {
  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');

  console.log(chalk.blue('Editing DSL file:'), filePath);
  console.log(chalk.blue('Instruction:'), instruction);

  // Create editor
  const editor = createRAGAgentEditor({
    temperature: 0.7,
    maxTokens: 2048,
  });

  // Create runtime
  const runtime = createRuntime();

  // Edit code
  const editedContent = await editor.editCode(content, instruction);

  // Write output
  const targetPath = outputPath || filePath;
  fs.writeFileSync(targetPath, editedContent, 'utf-8');

  console.log(chalk.green('DSL file edited successfully!'));
  console.log(chalk.blue('Output:'), targetPath);
}
