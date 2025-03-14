// Using global defined functions
// No imports needed

const orderProcess = Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .addState('completed') // Added completed state
  .addTransition({ from: 'processing', to: 'completed', on: 'COMPLETE' }) // Added transition
  .addState('approving') // Added approving state
  .addTransition({ from: 'processing', to: 'approving', on: 'SUBMIT_FOR_APPROVAL' }) // Added transition
  .addTransition({ from: 'approving', to: 'completed', on: 'APPROVED' }) // Added transition
  .build();

export { orderProcess };