
    /**
     * Todo System
     * 
     * Main entry point for the system
     */
    
    import { system } from './system';
    import { ProcessEngine } from './core/process-engine';
    
    // Create a process engine
    const processEngine = new ProcessEngine(system);
    
    // Export the process engine
    export { processEngine };
    
    // Export the system
    export { system };
  