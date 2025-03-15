/**
 * Basic tests for Enhanced RAG Agent Editor Extension
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedRAGAgentEditorExtension } from '../../../src/core/extensions/rag-agent-editor-enhanced';
import { RAGAgentEditorExtension } from '../../../src/core/extensions/rag-agent-editor';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('inquirer');
vi.mock('diff');

describe('EnhancedRAGAgentEditorExtension', () => {
  let editor: EnhancedRAGAgentEditorExtension;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create editor instance
    editor = new EnhancedRAGAgentEditorExtension({
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-api-key',
      debug: true
    });
    
    // Mock the LLM
    (editor as any).llm = {
      invoke: vi.fn().mockResolvedValue({
        content: 'mock response'
      })
    };
  });
  
  it('should be instantiated correctly', () => {
    expect(editor).toBeInstanceOf(EnhancedRAGAgentEditorExtension);
    expect(editor.name).toBe('enhanced-rag-agent-editor');
  });
  
  it('should extend RAGAgentEditorExtension', () => {
    expect(editor).toBeInstanceOf(RAGAgentEditorExtension);
  });
  
  it('should have the editDSL method', () => {
    expect(typeof editor.editDSL).toBe('function');
  });
  
  it('should have the applyChanges method', () => {
    expect(typeof editor.applyChanges).toBe('function');
  });
  
  it('should have the generateEditPlan method', () => {
    expect(typeof editor.generateEditPlan).toBe('function');
  });
  
  it('should have the enhancedPromptForConfirmation method', () => {
    expect(typeof (editor as any).enhancedPromptForConfirmation).toBe('function');
  });
  
  it('should have the enhancedGenerateVisualDiff method', () => {
    expect(typeof (editor as any).enhancedGenerateVisualDiff).toBe('function');
  });
  
  it('should have the startEditSession method', () => {
    expect(typeof (editor as any).startEditSession).toBe('function');
  });
  
  it('should have the editWithContext method', () => {
    expect(typeof (editor as any).editWithContext).toBe('function');
  });
  
  it('should have the generateEditPlanWithContext method', () => {
    expect(typeof (editor as any).generateEditPlanWithContext).toBe('function');
  });
  
  it('should have the createEditPromptWithContext method', () => {
    expect(typeof (editor as any).createEditPromptWithContext).toBe('function');
  });
  
  it('should have the validateEditPlan method', () => {
    expect(typeof (editor as any).validateEditPlan).toBe('function');
  });
  
  it('should have the promptForNextAction method', () => {
    expect(typeof (editor as any).promptForNextAction).toBe('function');
  });
  
  it('should have the saveFileHistory method', () => {
    expect(typeof (editor as any).saveFileHistory).toBe('function');
  });
  
  it('should have the undoLastEdit method', () => {
    expect(typeof (editor as any).undoLastEdit).toBe('function');
  });
  
  it('should have the validateDSLFile method', () => {
    expect(typeof (editor as any).validateDSLFile).toBe('function');
  });
  
  it('should have the validateWithSchema method', () => {
    expect(typeof (editor as any).validateWithSchema).toBe('function');
  });
  
  it('should have the getProcessSchema method', () => {
    expect(typeof (editor as any).getProcessSchema).toBe('function');
  });
  
  it('should have the getTaskSchema method', () => {
    expect(typeof (editor as any).getTaskSchema).toBe('function');
  });
  
  it('should have the getSystemSchema method', () => {
    expect(typeof (editor as any).getSystemSchema).toBe('function');
  });
  
  it('should have the createSummary method', () => {
    expect(typeof (editor as any).createSummary).toBe('function');
  });
}); 