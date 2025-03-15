/**
 * Process template
 */

// Import the Process class from the DSL
import { Process } from '..';

/**
 * Order process template
 * 
 * This is an example of a process definition using the DSL.
 */

// Define the order process
const orderProcess = Process.create('order-process')
  .withDescription('Handles order processing')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('cancelled')
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING',
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE',
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .build();

export default orderProcess;
