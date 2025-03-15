/**
 * Process builder
 */
export class ProcessBuilder {
  private id: string;
  private name: string;
  private description?: string;
  private initialState: string;
  private states: string[] = [];
  private transitions: any[] = [];
  private metadata: Record<string, any> = {};

  constructor(id: string) {
    this.id = id;
    this.name = id;
    this.initialState = 'initial';
  }

  /**
   * Create a new process builder
   */
  static create(id: string): ProcessBuilder {
    return new ProcessBuilder(id);
  }

  /**
   * Set the name of the process
   */
  withName(name: string): ProcessBuilder {
    this.name = name;
    return this;
  }

  /**
   * Set the description of the process
   */
  withDescription(description: string): ProcessBuilder {
    this.description = description;
    return this;
  }

  /**
   * Set the initial state of the process
   */
  withInitialState(state: string): ProcessBuilder {
    this.initialState = state;
    return this;
  }

  /**
   * Add a state to the process
   */
  addState(state: string): ProcessBuilder {
    if (!this.states.includes(state)) {
      this.states.push(state);
    }
    return this;
  }

  /**
   * Add a transition to the process
   */
  addTransition(transition: any): ProcessBuilder {
    this.transitions.push(transition);
    return this;
  }

  /**
   * Add a simple transition to the process
   */
  addSimpleTransition(from: string, to: string, on: string): ProcessBuilder {
    return this.addTransition({ from, to, on });
  }

  /**
   * Build the process
   */
  build(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      initialState: this.initialState,
      states: this.states,
      transitions: this.transitions,
      metadata: this.metadata
    };
  }
}
