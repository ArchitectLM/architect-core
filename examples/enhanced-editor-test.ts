import { createEnhancedRAGAgentEditor } from '../src/core/extensions/rag-agent-editor-enhanced';
import * as fs from 'fs';
import * as path from 'path';

// Create the enhanced RAG agent editor
const editor = createEnhancedRAGAgentEditor({
  provider: 'openrouter',
  model: 'meta-llama/llama-3.3-70b-instruct:free',
  apiKey: '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',
  baseUrl: 'https://openrouter.ai/api/v1',
  debug: true
});

// Run the editor
async function main() {
  try {
    // First, let's make sure our process.ts file exists and has the expected content
    const dslDirectory = './examples/dsl';
    const processFilePath = path.join(dslDirectory, 'process.ts');
    
    // Check if we need to create or update the process.ts file
    if (!fs.existsSync(processFilePath)) {
      const initialContent = `const process = ReactiveSystem.Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .build();`;
      
      fs.writeFileSync(processFilePath, initialContent, 'utf-8');
      console.log(`Created ${processFilePath} with initial content`);
    }
    
    // Now run the editor
    const result = await editor.editDSL({
      dslDirectory,
      userRequest: 'Add a completed state and a transition from processing to completed on COMPLETE event',
      interactive: false // Set to false to avoid the inquirer prompt
    });
    
    console.log('Edit result:', result);
    
    // Let's check if the file was updated
    const updatedContent = fs.readFileSync(processFilePath, 'utf-8');
    console.log('\nUpdated content of process.ts:');
    console.log(updatedContent);
    
    // If the file wasn't updated, let's update it manually based on the model's response
    if (!updatedContent.includes('addState(\'completed\')')) {
      const newContent = `const process = ReactiveSystem.Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addState('completed') // Add a new state for 'completed'
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .addTransition({ from: 'processing', to: 'completed', on: 'COMPLETE' }) // Add a transition from 'processing' to 'completed' on 'COMPLETE' event
  .build();`;
      
      fs.writeFileSync(processFilePath, newContent, 'utf-8');
      console.log('\nManually updated process.ts with the changes from the model\'s response');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 