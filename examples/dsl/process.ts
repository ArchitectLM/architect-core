const process = ReactiveSystem.Process.create('test-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addTransition({ from: 'initial', to: 'processing', on: 'START' })
  .build();