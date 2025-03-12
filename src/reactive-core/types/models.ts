/**
 * Model Types
 * 
 * This module defines the model types used in the reactive system.
 * These types represent the domain models and are used across the system.
 */

/**
 * Todo item
 */
export interface Todo {
  /**
   * Todo ID
   */
  id: string;
  
  /**
   * Todo title
   */
  title: string;
  
  /**
   * Todo description
   */
  description?: string;
  
  /**
   * Due date
   */
  dueDate?: string;
  
  /**
   * Priority
   */
  priority?: 'low' | 'medium' | 'high';
  
  /**
   * Whether the todo is completed
   */
  completed: boolean;
  
  /**
   * Whether the todo is archived
   */
  archived: boolean;
  
  /**
   * Created date
   */
  createdAt: string;
  
  /**
   * Updated date
   */
  updatedAt: string;
}

/**
 * Todo repository
 */
export interface TodoRepository {
  /**
   * Find a todo by ID
   * @param id Todo ID
   * @returns The todo or undefined if not found
   */
  findById(id: string): Promise<Todo | undefined>;
  
  /**
   * Find all todos
   * @returns All todos
   */
  findAll(): Promise<Todo[]>;
  
  /**
   * Find todos by criteria
   * @param criteria Search criteria
   * @returns Matching todos
   */
  findBy(criteria: Partial<Todo>): Promise<Todo[]>;
  
  /**
   * Save a todo
   * @param todo Todo to save
   * @returns The saved todo
   */
  save(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo>;
  
  /**
   * Update a todo
   * @param id Todo ID
   * @param todo Todo data to update
   * @returns The updated todo
   */
  update(id: string, todo: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Todo>;
  
  /**
   * Delete a todo
   * @param id Todo ID
   * @returns Whether the todo was deleted
   */
  delete(id: string): Promise<boolean>;
}

/**
 * User
 */
export interface User {
  /**
   * User ID
   */
  id: string;
  
  /**
   * Username
   */
  username: string;
  
  /**
   * Email
   */
  email: string;
  
  /**
   * Display name
   */
  displayName?: string;
  
  /**
   * Created date
   */
  createdAt: string;
  
  /**
   * Updated date
   */
  updatedAt: string;
}

/**
 * User repository
 */
export interface UserRepository {
  /**
   * Find a user by ID
   * @param id User ID
   * @returns The user or undefined if not found
   */
  findById(id: string): Promise<User | undefined>;
  
  /**
   * Find a user by username
   * @param username Username
   * @returns The user or undefined if not found
   */
  findByUsername(username: string): Promise<User | undefined>;
  
  /**
   * Find a user by email
   * @param email Email
   * @returns The user or undefined if not found
   */
  findByEmail(email: string): Promise<User | undefined>;
  
  /**
   * Save a user
   * @param user User to save
   * @returns The saved user
   */
  save(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  
  /**
   * Update a user
   * @param id User ID
   * @param user User data to update
   * @returns The updated user
   */
  update(id: string, user: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User>;
  
  /**
   * Delete a user
   * @param id User ID
   * @returns Whether the user was deleted
   */
  delete(id: string): Promise<boolean>;
}