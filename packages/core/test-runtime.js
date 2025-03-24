// Simple script to test our runtime implementation
const { createRuntime } = require('./dist/implementations/factory');

async function testRuntime() {
  console.log('Creating runtime...');
  const runtime = createRuntime();
  
  console.log('Runtime created successfully:', runtime);
  console.log('Runtime ID:', runtime.id);
  
  try {
    console.log('Getting runtime health...');
    const health = await runtime.getHealth();
    console.log('Runtime health:', health);
  } catch (error) {
    console.error('Error getting health:', error);
  }
  
  console.log('Test completed');
}

testRuntime().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
}); 