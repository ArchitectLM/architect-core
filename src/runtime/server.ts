/**
 * Runtime HTTP API Server
 * 
 * This script starts the HTTP API server for the runtime.
 */

import { RuntimeHttpApi } from './http-api';

// Get port from environment variable or use default
const port = parseInt(process.env.PORT || '3000', 10);

// Create and start server
const server = new RuntimeHttpApi(port);

server.start()
  .then(() => {
    console.log(`Runtime HTTP API server started on port ${port}`);
    console.log('Available endpoints:');
    console.log('  GET  /status - Get runtime status');
    console.log('  POST /system - Load a system');
    console.log('  POST /task   - Execute a task');
    console.log('  POST /event  - Send an event');
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.stop()
    .then(() => {
      console.log('Server stopped');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error stopping server:', error);
      process.exit(1);
    });
}); 