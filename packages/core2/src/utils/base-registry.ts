import { DomainError, Result, tryExecute } from './error-utils';

/**
 * Base registry class that implements common functionality for all registry types
 * @template T The type of items stored in the registry
 * @template K The type of keys used to identify items (defaults to string)
 */
export abstract class BaseRegistry<T, K = string> {
  /** Map of items stored in the registry */
  protected items = new Map<K, T>();
  
  /**
   * Register an item in the registry
   * @param key Unique identifier for the item
   * @param item The item to register
   * @returns Result indicating success or failure
   */
  protected registerItem(key: K, item: T): Result<void> {
    return tryExecute(() => {
      if (this.items.has(key)) {
        throw new DomainError(`Item with key '${String(key)}' already exists`);
      }
      
      this.items.set(key, item);
    });
  }
  
  /**
   * Unregister an item from the registry
   * @param key Unique identifier for the item to unregister
   * @returns Result indicating success or failure
   */
  protected unregisterItem(key: K): Result<void> {
    return tryExecute(() => {
      if (!this.items.has(key)) {
        throw new DomainError(`Item with key '${String(key)}' not found`);
      }
      
      this.items.delete(key);
    });
  }
  
  /**
   * Get an item from the registry
   * @param key Unique identifier for the item to retrieve
   * @returns Result containing the item or an error
   */
  protected getItem(key: K): Result<T> {
    return tryExecute(() => {
      const item = this.items.get(key);
      
      if (!item) {
        throw new DomainError(`Item with key '${String(key)}' not found`);
      }
      
      return item;
    });
  }
  
  /**
   * Check if an item exists in the registry
   * @param key Unique identifier for the item to check
   * @returns True if the item exists, false otherwise
   */
  protected hasItem(key: K): boolean {
    return this.items.has(key);
  }
  
  /**
   * Get all items in the registry
   * @returns Array of all items
   */
  protected getAllItems(): T[] {
    return Array.from(this.items.values());
  }
  
  /**
   * Get all keys in the registry
   * @returns Array of all keys
   */
  protected getAllKeys(): K[] {
    return Array.from(this.items.keys());
  }
  
  /**
   * Filter items based on a predicate
   * @param predicate Function that determines whether an item should be included
   * @returns Array of items that match the predicate
   */
  protected filterItems(predicate: (item: T) => boolean): T[] {
    return this.getAllItems().filter(predicate);
  }
  
  /**
   * Get the number of items in the registry
   */
  public get count(): number {
    return this.items.size;
  }
  
  /**
   * Clear all items from the registry
   * Primarily used for testing
   */
  public clear(): void {
    this.items.clear();
  }
} 