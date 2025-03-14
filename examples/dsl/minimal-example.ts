/**
 * Minimal DSL Example
 */

// Define a simple process
const simpleProcess = Process.create('simple-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addState('completed')
  .addTransition({ 
    from: 'initial', 
    to: 'processing', 
    on: 'START' 
  })
  .addTransition({ 
    from: 'processing', 
    to: 'completed', 
    on: 'COMPLETE' 
  })
  .build();

// Define a simple task
const simpleTask = Task.create('simple-task')
  .withDescription('A simple task')
  .withImplementation((input) => {
    console.log('Executing simple task');
    return { success: true };
  })
  .build();

// Define a simple system
const simpleSystem = ReactiveSystem.define('simple-system')
  .withName('Simple System')
  .withDescription('A simple reactive system')
  .addProcess(simpleProcess)
  .addTask(simpleTask)
  .build();

// Export the components
export {
  simpleProcess,
  simpleTask,
  simpleSystem
}; 