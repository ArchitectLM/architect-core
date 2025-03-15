/**
 * Commands
 */

import { Command } from 'commander';
import { registerEditDSLCommand } from './edit-dsl';

/**
 * Register all commands
 */
export function registerCommands(program: Command): void {
  registerEditDSLCommand(program);
}
