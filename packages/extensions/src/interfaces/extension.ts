/**
 * Extension interface
 * Base interface for all extensions
 */
export interface Extension {
  /**
   * Name of the extension
   */
  name: string;
  
  /**
   * Initialize the extension with the runtime
   */
  initialize(runtime: any): Promise<void>;
}
