import { createRuntime } from './implementations/factory';
import { Runtime } from './models/runtime';

/**
 * Simple test to verify our implementation changes work properly
 */
async function testRuntime() {
  console.log('Creating runtime...');
  const runtime: Runtime = createRuntime();
  
  console.log('Runtime created successfully');
  
  try {
    // Test creating and executing a simple task
    const result = await runtime.executeTask('test-task', { value: 'test' });
    console.log('Task execution result:', result);
    
    // Test event subscription
    const subscription = runtime.subscribe('test-event', async (event) => {
      console.log('Received event:', event);
    });
    
    // Test event publishing
    runtime.publish('test-event', { message: 'This is a test' });
    
    // Wait a moment to allow event to process
    await new Promise(resolve => setTimeout(resolve, 100));
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  console.log('Test completed');
}

// Run the test
testRuntime().catch(err => {
  console.error('Test failed:', err);
}); 