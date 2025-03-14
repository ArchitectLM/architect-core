const process = ReactiveSystem.Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addState('completed') // Add a new state for 'completed'
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .addTransition({ from: 'processing', to: 'completed', on: 'COMPLETE' }) // Add a transition from 'processing' to 'completed' on 'COMPLETE' event
  .build();