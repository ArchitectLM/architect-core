/**
 * Builder pattern implementation for creating DSL configurations
 */
import {
  DSLConfig,
  Metadata,
  Schema,
  Function,
  Command,
  Pipeline,
  ExtensionPoint,
  Extension,
} from "./models.js";

/**
 * Builder for creating DSL configurations
 */
export class DSLConfigBuilder {
  private config: Partial<DSLConfig> = {
    meta: {},
    schemas: {},
    functions: {},
    commands: {},
    pipelines: {},
    extensionPoints: {},
    extensions: {},
  };

  /**
   * Set metadata for the DSL configuration
   */
  withMeta(meta: Metadata): DSLConfigBuilder {
    this.config.meta = meta;
    return this;
  }

  /**
   * Add a schema to the DSL configuration
   */
  withSchema(name: string, schema: Schema): DSLConfigBuilder {
    if (!this.config.schemas) {
      this.config.schemas = {};
    }
    this.config.schemas[name] = schema;
    return this;
  }

  /**
   * Add a function to the DSL configuration
   */
  withFunction(name: string, func: Function): DSLConfigBuilder {
    if (!this.config.functions) {
      this.config.functions = {};
    }
    this.config.functions[name] = func;
    return this;
  }

  /**
   * Add a command to the DSL configuration
   */
  withCommand(name: string, command: Command): DSLConfigBuilder {
    if (!this.config.commands) {
      this.config.commands = {};
    }
    this.config.commands[name] = command;
    return this;
  }

  /**
   * Add a pipeline to the DSL configuration
   */
  withPipeline(name: string, pipeline: Pipeline): DSLConfigBuilder {
    if (!this.config.pipelines) {
      this.config.pipelines = {};
    }
    this.config.pipelines[name] = pipeline;
    return this;
  }

  /**
   * Add an extension point to the DSL configuration
   */
  withExtensionPoint(
    name: string,
    extensionPoint: ExtensionPoint,
  ): DSLConfigBuilder {
    if (!this.config.extensionPoints) {
      this.config.extensionPoints = {};
    }
    this.config.extensionPoints[name] = extensionPoint;
    return this;
  }

  /**
   * Add an extension to the DSL configuration
   */
  withExtension(name: string, extension: Extension): DSLConfigBuilder {
    if (!this.config.extensions) {
      this.config.extensions = {};
    }
    this.config.extensions[name] = extension;
    return this;
  }

  /**
   * Build the DSL configuration
   */
  build(): DSLConfig {
    // Check if all required sections are defined
    if (
      !this.config.meta ||
      !this.config.schemas ||
      !this.config.functions ||
      !this.config.commands ||
      !this.config.pipelines ||
      !this.config.extensionPoints
    ) {
      throw new Error(
        "DSL configuration is incomplete. All required sections must be defined.",
      );
    }

    // Check if any required section is empty
    if (Object.keys(this.config.schemas).length === 0) {
      throw new Error(
        "DSL configuration is incomplete: schemas section is empty",
      );
    }

    if (Object.keys(this.config.functions).length === 0) {
      throw new Error(
        "DSL configuration is incomplete: functions section is empty",
      );
    }

    if (Object.keys(this.config.commands).length === 0) {
      throw new Error(
        "DSL configuration is incomplete: commands section is empty",
      );
    }

    if (Object.keys(this.config.pipelines).length === 0) {
      throw new Error(
        "DSL configuration is incomplete: pipelines section is empty",
      );
    }

    if (Object.keys(this.config.extensionPoints).length === 0) {
      throw new Error(
        "DSL configuration is incomplete: extensionPoints section is empty",
      );
    }

    return this.config as DSLConfig;
  }
}

/**
 * Create a new DSL configuration builder
 */
export function createDSLConfig(): DSLConfigBuilder {
  return new DSLConfigBuilder();
}

/**
 * Helper function to create a schema
 */
export function createSchema(schema: Schema): Schema {
  return schema;
}

/**
 * Helper function to create a function
 */
export function createFunction(
  meta: Metadata,
  implementation: (...args: any[]) => any,
): Function {
  return {
    meta,
    implementation,
  };
}

/**
 * Helper function to create a command
 */
export function createCommand(
  meta: Metadata,
  input: string,
  output: string,
  implementation: (...args: any[]) => any,
): Command {
  return {
    meta,
    input,
    output,
    implementation,
  };
}

/**
 * Helper function to create a pipeline
 */
export function createPipeline(
  input: string,
  output: string,
  steps: Pipeline["steps"],
): Pipeline {
  return {
    input,
    output,
    steps,
  };
}

/**
 * Helper function to create an extension point
 */
export function createExtensionPoint(
  description: string,
  parameters: string[],
): ExtensionPoint {
  return {
    description,
    parameters,
  };
}

/**
 * Helper function to create an extension
 */
export function createExtension(
  meta: Metadata,
  hooks: Record<string, (...args: any[]) => any>,
): Extension {
  const extensionHooks: Record<
    string,
    { implementation: (...args: any[]) => any }
  > = {};

  for (const [key, implementation] of Object.entries(hooks)) {
    extensionHooks[key] = { implementation };
  }

  return {
    meta,
    hooks: extensionHooks as any,
  };
}
