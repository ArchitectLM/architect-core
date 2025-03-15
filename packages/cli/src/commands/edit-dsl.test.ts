import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { registerEditDSLCommand } from './edit-dsl';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('../core/extensions/rag-agent-editor', () => ({
  createRAGAgentEditor: vi.fn(() => ({
    editCode: vi.fn().mockResolvedValue('edited content'),
  })),
}));
vi.mock('../core/implementations/runtime', () => ({
  createRuntime: vi.fn(() => ({})),
}));

describe('Edit DSL Command', () => {
  let program: Command;
  let mockAction: vi.Mock;
  let consoleLogSpy: vi.SpyInstance;
  let consoleErrorSpy: vi.SpyInstance;
  let processExitSpy: vi.SpyInstance;

  beforeEach(() => {
    // Create a new Command instance for each test
    program = new Command();

    // Mock the action method
    mockAction = vi.fn();
    vi.spyOn(program, 'action').mockImplementation(function (this: Command, fn) {
      mockAction.mockImplementation(fn);
      return this;
    });

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`Process exited with code ${code}`);
    });

    // Reset fs mocks
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.writeFileSync).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register the edit-dsl command', () => {
    // Spy on program.command
    const commandSpy = vi.spyOn(program, 'command');
    const descriptionSpy = vi.spyOn(program, 'description').mockReturnThis();
    const argumentSpy = vi.spyOn(program, 'argument').mockReturnThis();
    const optionSpy = vi.spyOn(program, 'option').mockReturnThis();

    // Register the command
    registerEditDSLCommand(program);

    // Verify command registration
    expect(commandSpy).toHaveBeenCalledWith('edit-dsl');
    expect(descriptionSpy).toHaveBeenCalledWith('Edit DSL files with AI assistance');
    expect(argumentSpy).toHaveBeenCalledWith('<file>', 'Path to the DSL file to edit');
    expect(optionSpy).toHaveBeenCalledWith(
      '-i, --instruction <instruction>',
      'Instruction for editing the file'
    );
    expect(optionSpy).toHaveBeenCalledWith('-o, --output <o>', 'Output file path');
  });

  it('should edit a DSL file successfully', async () => {
    // Setup mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('original content');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});

    // Register the command
    registerEditDSLCommand(program);

    // Execute the command
    await mockAction('test.dsl', { instruction: 'Make it better', output: 'output.dsl' });

    // Verify file operations
    expect(fs.existsSync).toHaveBeenCalledWith('test.dsl');
    expect(fs.readFileSync).toHaveBeenCalledWith('test.dsl', 'utf-8');
    expect(fs.writeFileSync).toHaveBeenCalledWith('output.dsl', 'edited content', 'utf-8');

    // Verify console output
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Editing DSL file:'),
      'test.dsl'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Instruction:'),
      'Make it better'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('DSL file edited successfully!')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Output:'), 'output.dsl');
  });

  it('should use default instruction if not provided', async () => {
    // Setup mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('original content');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});

    // Register the command
    registerEditDSLCommand(program);

    // Execute the command without instruction
    await mockAction('test.dsl', {});

    // Verify console output with default instruction
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Instruction:'),
      'Improve this code'
    );
  });

  it('should use input file as output if output not specified', async () => {
    // Setup mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('original content');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});

    // Register the command
    registerEditDSLCommand(program);

    // Execute the command without output
    await mockAction('test.dsl', { instruction: 'Make it better' });

    // Verify file operations
    expect(fs.writeFileSync).toHaveBeenCalledWith('test.dsl', 'edited content', 'utf-8');
  });

  it('should throw an error if file does not exist', async () => {
    // Setup mocks
    vi.mocked(fs.existsSync).mockReturnValue(false);

    // Register the command
    registerEditDSLCommand(program);

    // Execute the command
    await expect(async () => {
      await mockAction('nonexistent.dsl', {});
    }).rejects.toThrow('Process exited with code 1');

    // Verify error handling
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error editing DSL file:'),
      expect.objectContaining({ message: 'File not found: nonexistent.dsl' })
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle errors during editing', async () => {
    // Setup mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('Read error');
    });

    // Register the command
    registerEditDSLCommand(program);

    // Execute the command
    await expect(async () => {
      await mockAction('test.dsl', {});
    }).rejects.toThrow('Process exited with code 1');

    // Verify error handling
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error editing DSL file:'),
      expect.objectContaining({ message: 'Read error' })
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
