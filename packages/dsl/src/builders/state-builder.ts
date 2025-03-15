/**
 * State builder
 */
export class StateBuilder {
  private id: string;
  private name: string;
  private description?: string;
  private metadata: Record<string, any> = {};

  constructor(id: string) {
    this.id = id;
    this.name = id;
  }

  /**
   * Create a new state builder
   */
  static create(id: string): StateBuilder {
    return new StateBuilder(id);
  }

  /**
   * Set the name of the state
   */
  withName(name: string): StateBuilder {
    this.name = name;
    return this;
  }

  /**
   * Set the description of the state
   */
  withDescription(description: string): StateBuilder {
    this.description = description;
    return this;
  }

  /**
   * Build the state
   */
  build(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      metadata: this.metadata
    };
  }
}
