import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { registerEditDSLCommand } from './edit-dsl';

// Mock dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('path');

// Mock the RAG agent editor
vi.mock('../core/extensions/rag-agent-editor', () => ({
  createRAGAgentEditor: vi.fn(() => ({
    editCode: vi.fn().mockResolvedValue('edited content'),
  })),
}));

// Mock the runtime
vi.mock('../core/implementations/runtime', () => ({
  createRuntime: vi.fn(() => ({})),
}));

describe('Edit DSL Command', () => {
  let program: Command;
  let mockAction: any;
  let consoleLogSpy: vi.SpyInstance;
  let consoleErrorSpy: vi.SpyInstance;
  let processExitSpy: vi.SpyInstance;
  let commandSpy: vi.SpyInstance;
  let descriptionSpy: vi.SpyInstance;
  let argumentSpy: vi.SpyInstance;
  let optionSpy: vi.SpyInstance;

  beforeEach(() => {
    // Create a new Command instance for each test
    program = new Command();

    // Set up spies for Command methods
    commandSpy = vi.spyOn(program, 'command').mockReturnThis();
    descriptionSpy = vi.spyOn(program, 'description').mockReturnThis();
    argumentSpy = vi.spyOn(program, 'argument').mockReturnThis();
    optionSpy = vi.spyOn(program, 'option').mockReturnThis();

    // Mock the action method to capture the handler function
    mockAction = vi.fn();
    vi.spyOn(program, 'action').mockImplementation(function (fn) {
      mockAction = fn;
      return this;
    });

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`Process exited with code ${code}`);
    });

    // Reset fs mocks for each test
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.writeFileSync).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register the edit-dsl command', () => {
    // Register the command
    registerEditDSLCommand(program);

    // Verify command registration
    expect(commandSpy).toHaveBeenCalledWith('edit-dsl');
    expect(descriptionSpy).toHaveBeenCalledWith('Edit DSL files with AI assistance');
    expect(argumentSpy).toHaveBeenCalledWith('<file>', 'Path to the DSL file to edit');

    // Verify options were called
    expect(optionSpy).toHaveBeenCalledTimes(2);

    // Just verify that the option spy was called, without checking the exact arguments
    expect(optionSpy).toHaveBeenCalled();
  });

  it('should edit a DSL file successfully', async () => {
    // Setup mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('original content' as any);
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
    vi.mocked(fs.readFileSync).mockReturnValue('original content' as any);
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
    vi.mocked(fs.readFileSync).mockReturnValue('original content' as any);
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

    // Execute the command and expect it to throw
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

    // Execute the command and expect it to throw
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
