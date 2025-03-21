/**
 * API extension for the DSL
 * 
 * Adds API capabilities to the DSL to define API endpoints and integrate with command components.
 */
import { DSL, DSLExtension } from '../core/dsl.js';
import { ComponentType, ActorContext } from '../models/component.js';

/**
 * HTTP Methods supported by the API extension
 */
export enum ApiMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD'
}

/**
 * API parameter source types
 */
export enum ApiParameterSource {
  PATH = 'path',
  QUERY = 'query',
  HEADER = 'header',
  COOKIE = 'cookie'
}

/**
 * Security scheme types
 */
export enum SecuritySchemeType {
  API_KEY = 'apiKey',
  HTTP = 'http',
  OAUTH2 = 'oauth2',
  OPENID_CONNECT = 'openIdConnect'
}

/**
 * API extension options
 */
export interface ApiExtensionOptions {
  /**
   * Base path for API endpoints
   */
  basePath?: string;
  
  /**
   * Whether to enable automatic request validation
   */
  enableValidation?: boolean;
  
  /**
   * Whether to enable automatic documentation generation
   */
  enableDocumentation?: boolean;
  
  /**
   * CORS configuration
   */
  cors?: {
    enabled: boolean;
    origins?: string[];
    methods?: ApiMethod[];
    headers?: string[];
    credentials?: boolean;
  };
  
  /**
   * Security schemes
   */
  securitySchemes?: Record<string, SecurityScheme>;
}

/**
 * Security scheme definition
 */
export interface SecurityScheme {
  type: SecuritySchemeType;
  description?: string;
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: any; // OAuth2 flows
}

/**
 * OpenAPI path item object interface
 */
interface OpenApiPathItem {
  tags: string[];
  summary: string;
  operationId: string;
  parameters: any[];
  responses: any;
  security: any[];
  requestBody?: any;
}

/**
 * API Extension Implementation
 */
export class ApiExtension implements DSLExtension {
  id = 'api';
  private dsl: DSL | null = null;
  private options: ApiExtensionOptions = {};
  private middleware: Map<string, Function> = new Map();
  
  init(dsl: DSL, options: ApiExtensionOptions = {}): void {
    this.dsl = dsl;
    
    // Default options
    const defaultOptions: ApiExtensionOptions = {
      basePath: '/api',
      enableValidation: true,
      enableDocumentation: true,
      cors: {
        enabled: false
      }
    };
    
    // Merge options
    this.options = { ...defaultOptions, ...options };
    
    // Register API component type if not already available
    // This would be done by modifying the ComponentType enum in a real implementation
    // For now, we'll just add it to our local reference
    (ComponentType as any).API = 'api';
    
    // Register API components
    const apiComponents = dsl.getComponentsByType((ComponentType as any).API);
    
    // Enhance each API component
    apiComponents.forEach(component => {
      this.enhanceApiComponent(component.id);
    });
    
    // Add extension methods to the DSL itself
    this.extendDsl(dsl);
    
    console.log('API extension initialized with options:', this.options);
  }

  cleanup(): void {
    this.dsl = null;
    this.middleware.clear();
    console.log('API extension cleaned up');
  }
  
  /**
   * Enhance DSL with API-specific methods
   */
  private extendDsl(dsl: DSL): void {
    // Add API-specific methods to the DSL
    if (!(dsl as any).enhanceComponent) {
      (dsl as any).enhanceComponent = (componentId: string, methods: Record<string, any>) => {
        const component = dsl.getComponent(componentId);
        if (component) {
          Object.assign(component, methods);
        }
      };
    }
    
    // Add OpenAPI generation method
    (dsl as any).generateOpenApi = (options?: { title?: string; version?: string; description?: string }) => {
      return this.generateOpenApiSpec(options);
    };
    
    // Add middleware registration method
    (dsl as any).registerApiMiddleware = (name: string, handler: Function) => {
      this.middleware.set(name, handler);
    };
    
    // Add route building method
    (dsl as any).buildApiRoutes = () => {
      return this.buildRoutes();
    };
  }
  
  /**
   * Enhances an API component with functionality
   */
  private enhanceApiComponent(apiId: string): void {
    if (!this.dsl) return;
    
    const api = this.dsl.getComponent(apiId);
    if (!api || api.type !== (ComponentType as any).API) return;
    
    const enhancedMethods = {
      // Generate handler method
      generateHandler: () => {
        return async (req: any, res: any) => {
          try {
            // Extract parameters from request
            const params = req.params || {};
            const query = req.query || {};
            const body = req.body;
            const headers = req.headers || {};
            
            // Get command reference
            const commandRef = (api as any).command?.ref;
            if (!commandRef) {
              throw new Error('No command reference defined for API endpoint');
            }
            
            // Get command implementation
            const commandImpl = this.dsl?.getImplementation(commandRef);
            if (!commandImpl) {
              throw new Error(`Command implementation not found for ${commandRef}`);
            }
            
            // Build command input from request
            const input = {
              ...params,
              ...query,
              ...(body || {})
            };
            
            // Create context with request info and flow method
            const context: ActorContext = {
              headers,
              method: req.method,
              path: req.path,
              user: req.user,
              flow: () => {
                // Simple flow builder implementation
                const builder = {
                  sendToActor: (actorId: string, message: any) => builder,
                  then: (callback: (result: any) => any) => builder,
                  catch: (errorHandler: (error: Error) => any) => builder,
                  finally: (callback: () => void) => builder,
                  execute: async () => Promise.resolve()
                };
                return builder;
              }
            };
            
            // Execute command
            const result = await commandImpl.execute(input, context);
            
            // Get success response status
            const successStatus = Object.keys((api as any).responses || {})
              .find(status => status.startsWith('2')) || '200';
            
            // Send response
            res.status(parseInt(successStatus)).json(result);
          } catch (error: any) {
            // Handle error
            console.error('API error:', error);
            res.status(500).json({ 
              error: 'Internal server error',
              message: error.message
            });
          }
        };
      },
      
      // Validate request method
      validateRequest: (req: any) => {
        // In a real implementation, this would validate the request against the schema
        return { valid: true, errors: [] };
      },
      
      // Generate OpenAPI specification for this endpoint
      generateOpenApiSpec: () => {
        const path = (api as any).path;
        const method = ((api as any).method || 'get').toLowerCase();
        
        if (!path) return {};
        
        const pathItem: OpenApiPathItem = {
          tags: (api as any).tags || [],
          summary: api.description,
          operationId: api.id,
          parameters: this.buildOpenApiParameters(api),
          responses: this.buildOpenApiResponses(api),
          security: this.buildOpenApiSecurity(api)
        };
        
        // Add request body if applicable
        const requestBody = this.buildOpenApiRequestBody(api);
        if (requestBody) {
          pathItem.requestBody = requestBody;
        }
        
        return {
          [path]: {
            [method]: pathItem
          }
        };
      }
    };
    
    // Enhance the component with these methods
    (this.dsl as any).enhanceComponent(apiId, enhancedMethods);
  }
  
  /**
   * Build OpenAPI parameters from API component definition
   */
  private buildOpenApiParameters(api: any): any[] {
    const parameters: any[] = [];
    
    // Path parameters
    if (api.request?.params) {
      for (const [name, schema] of Object.entries(api.request.params)) {
        parameters.push({
          name,
          in: 'path',
          required: true,
          description: (schema as any).description || '',
          schema: this.convertToOpenApiSchema(schema as any)
        });
      }
    }
    
    // Query parameters
    if (api.request?.query) {
      for (const [name, schema] of Object.entries(api.request.query)) {
        parameters.push({
          name,
          in: 'query',
          required: (schema as any).required || false,
          description: (schema as any).description || '',
          schema: this.convertToOpenApiSchema(schema as any)
        });
      }
    }
    
    // Header parameters
    if (api.request?.headers) {
      for (const [name, schema] of Object.entries(api.request.headers)) {
        parameters.push({
          name,
          in: 'header',
          required: (schema as any).required || false,
          description: (schema as any).description || '',
          schema: this.convertToOpenApiSchema(schema as any)
        });
      }
    }
    
    return parameters;
  }
  
  /**
   * Build OpenAPI responses from API component definition
   */
  private buildOpenApiResponses(api: any): any {
    const responses: Record<string, any> = {};
    
    if (!api.responses) return responses;
    
    for (const [status, response] of Object.entries(api.responses)) {
      responses[status] = {
        description: (response as any).description || '',
        content: {}
      };
      
      if ((response as any).content) {
        // Handle schema reference or inline schema
        let schema: any;
        
        if ((response as any).content.ref) {
          schema = { $ref: `#/components/schemas/${(response as any).content.ref}` };
        } else {
          schema = this.convertToOpenApiSchema((response as any).content);
        }
        
        responses[status].content = {
          'application/json': { schema }
        };
      }
    }
    
    return responses;
  }
  
  /**
   * Build OpenAPI request body from API component definition
   */
  private buildOpenApiRequestBody(api: any): any {
    if (!api.request?.body) return null;
    
    const requestBody: any = {
      required: true,
      content: {
        'application/json': {
          schema: {}
        }
      }
    };
    
    // Handle schema reference or inline schema
    if (api.request.body.ref) {
      requestBody.content['application/json'].schema = { 
        $ref: `#/components/schemas/${api.request.body.ref}` 
      };
    } else {
      requestBody.content['application/json'].schema = 
        this.convertToOpenApiSchema(api.request.body);
    }
    
    return requestBody;
  }
  
  /**
   * Build OpenAPI security from API component definition
   */
  private buildOpenApiSecurity(api: any): any[] {
    if (!api.security || !api.security.length) return [];
    
    return api.security.map((securityName: string) => ({ [securityName]: [] }));
  }
  
  /**
   * Convert internal schema to OpenAPI schema
   */
  private convertToOpenApiSchema(schema: any): any {
    // For reference schemas, return a reference
    if (schema.ref) {
      return { $ref: `#/components/schemas/${schema.ref}` };
    }
    
    // For basic schemas, convert type
    const result: any = {
      type: schema.type
    };
    
    // Add format if present
    if (schema.format) {
      result.format = schema.format;
    }
    
    // Add enum if present
    if (schema.enum) {
      result.enum = schema.enum;
    }
    
    // Add description if present
    if (schema.description) {
      result.description = schema.description;
    }
    
    // Handle arrays
    if (schema.type === 'array' && schema.items) {
      result.items = this.convertToOpenApiSchema(schema.items);
    }
    
    // Handle objects
    if (schema.type === 'object' && schema.properties) {
      result.properties = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        result.properties[key] = this.convertToOpenApiSchema(prop as any);
      }
      
      if (schema.required) {
        result.required = schema.required;
      }
    }
    
    return result;
  }
  
  /**
   * Generate full OpenAPI specification
   */
  private generateOpenApiSpec(options?: { title?: string; version?: string; description?: string }): any {
    if (!this.dsl) return {};
    
    // Create base OpenAPI document
    const spec: any = {
      openapi: '3.0.0',
      info: {
        title: options?.title || 'API Documentation',
        version: options?.version || '1.0.0',
        description: options?.description || 'API documentation generated by DSL'
      },
      paths: {},
      components: {
        schemas: {},
        securitySchemes: this.options.securitySchemes || {}
      }
    };
    
    // Add server info
    spec.servers = [
      {
        url: this.options.basePath || '/api',
        description: 'API server'
      }
    ];
    
    // Get all API components
    const apiComponents = this.dsl.getComponentsByType((ComponentType as any).API);
    
    // Add paths from each API component
    apiComponents.forEach(api => {
      if (typeof (api as any).generateOpenApiSpec === 'function') {
        const pathSpec = (api as any).generateOpenApiSpec();
        
        // Merge paths
        for (const [path, methods] of Object.entries(pathSpec)) {
          if (!spec.paths[path]) {
            spec.paths[path] = {};
          }
          
          Object.assign(spec.paths[path], methods);
        }
      }
    });
    
    // Add schemas from schema components
    const schemaComponents = this.dsl.getComponentsByType(ComponentType.SCHEMA);
    schemaComponents.forEach(schema => {
      if (typeof (schema as any).getJsonSchema === 'function') {
        spec.components.schemas[schema.id] = (schema as any).getJsonSchema();
      }
    });
    
    return spec;
  }
  
  /**
   * Build API routes for server integration
   */
  private buildRoutes(): any[] {
    if (!this.dsl) return [];
    
    const routes: any[] = [];
    
    // Get all API components
    const apiComponents = this.dsl.getComponentsByType((ComponentType as any).API);
    
    // Create route configuration for each API
    apiComponents.forEach(api => {
      const path = (api as any).path;
      const method = (api as any).method || ApiMethod.GET;
      
      if (!path) return;
      
      const handler = typeof (api as any).generateHandler === 'function'
        ? (api as any).generateHandler()
        : async (req: any, res: any) => {
            res.status(501).json({ error: 'Not implemented' });
          };
      
      routes.push({
        path: `${this.options.basePath}${path}`,
        method,
        handler,
        middleware: this.getMiddleware(api),
        metadata: {
          id: api.id,
          description: api.description,
          security: (api as any).security,
          validation: this.options.enableValidation,
          cors: this.options.cors
        }
      });
    });
    
    return routes;
  }
  
  /**
   * Get middleware for an API component
   */
  private getMiddleware(api: any): Function[] {
    const middleware: Function[] = [];
    
    // Add authentication middleware if security is defined
    if (api.security && api.security.length > 0) {
      const authMiddleware = this.middleware.get('authentication');
      if (authMiddleware) {
        middleware.push(authMiddleware);
      }
    }
    
    // Add validation middleware if enabled
    if (this.options.enableValidation) {
      middleware.push((req: any, res: any, next: Function) => {
        if (typeof (api as any).validateRequest === 'function') {
          const validation = (api as any).validateRequest(req);
          if (!validation.valid) {
            return res.status(400).json({
              error: 'Validation error',
              details: validation.errors
            });
          }
        }
        next();
      });
    }
    
    return middleware;
  }
}

/**
 * Setup function for the API extension
 */
export function setupApiExtension(dsl: DSL, options: ApiExtensionOptions = {}): void {
  const extension = new ApiExtension();
  dsl.registerExtension(extension, options);
} 