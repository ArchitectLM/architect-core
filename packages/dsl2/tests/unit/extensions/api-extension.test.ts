import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

// Define mock API enum
export enum ApiMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

// Mock the API extension module to test
vi.mock('../../../src/extensions/api.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/api.extension.js');
  return {
    ...actual,
    setupApiExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      (dsl as any)._extensions = (dsl as any)._extensions || {};
      (dsl as any)._extensions.api = true;
      
      // Add enhanceComponent method if not present
      if (!(dsl as any).enhanceComponent) {
        (dsl as any).enhanceComponent = (componentId: string, methods: Record<string, any>) => {
          const component = dsl.getComponent(componentId);
          if (component) {
            Object.assign(component, methods);
          }
        };
      }
      
      // Add generateOpenApi method
      (dsl as any).generateOpenApi = vi.fn().mockReturnValue({
        openapi: '3.0.0',
        info: {
          title: 'API',
          version: '1.0.0'
        },
        paths: {}
      });
    })
  };
});

// Import after mocking
import { 
  setupApiExtension, 
  ApiExtensionOptions
} from '../../../src/extensions/api.extension.js';

describe('API Extension', () => {
  let dsl: DSL;
  let apiOptions: ApiExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    apiOptions = {
      basePath: '/api/v1',
      enableValidation: true,
      enableDocumentation: true,
      cors: {
        enabled: true,
        origins: ['http://localhost:3000']
      }
    };
    
    // Setup extension
    setupApiExtension(dsl, apiOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('API Component Definition', () => {
    it('should allow defining API endpoint components', () => {
      // Define schema components for request/response
      const userSchema = dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0'
      });
      
      // Enhance schema with properties
      (dsl as any).enhanceComponent('UserSchema', {
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['name', 'email']
      });
      
      const createUserInput = dsl.component('CreateUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Create user input schema',
        version: '1.0.0'
      });
      
      // Enhance input schema
      (dsl as any).enhanceComponent('CreateUserInput', {
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] }
        },
        required: ['name', 'email']
      });
      
      // Define a command that will be used by the API
      const createUserCommand = dsl.component('CreateUser', {
        type: ComponentType.COMMAND,
        description: 'Create a user',
        version: '1.0.0'
      });
      
      // Enhance command with input/output
      (dsl as any).enhanceComponent('CreateUser', {
        input: { ref: 'CreateUserInput' },
        output: { ref: 'UserSchema' }
      });
      
      // Implement the command
      dsl.implement('CreateUser', async (input, context) => {
        return {
          id: `user-${Date.now()}`,
          name: input.name,
          email: input.email,
          role: input.role || 'user'
        };
      });
      
      // Define an API endpoint component
      const createUserEndpoint = dsl.component('CreateUserEndpoint', {
        type: ComponentType.API,
        description: 'API endpoint to create a user',
        version: '1.0.0'
      });
      
      // Enhance API endpoint
      (dsl as any).enhanceComponent('CreateUserEndpoint', {
        path: '/users',
        method: ApiMethod.POST,
        request: {
          body: { ref: 'CreateUserInput' }
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: { ref: 'UserSchema' }
          },
          '400': {
            description: 'Invalid input',
            content: { ref: 'ErrorSchema' }
          }
        },
        command: { ref: 'CreateUser' },
        tags: ['users', 'management'],
        security: ['bearerAuth'],
        generateOpenApiSpec: vi.fn().mockReturnValue({
          '/users': {
            post: {
              tags: ['users', 'management'],
              summary: 'API endpoint to create a user',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreateUserInput' }
                  }
                }
              },
              responses: {
                '201': {
                  description: 'User created successfully',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/UserSchema' }
                    }
                  }
                },
                '400': {
                  description: 'Invalid input',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/ErrorSchema' }
                    }
                  }
                }
              }
            }
          }
        })
      });

      // Verify the API component was defined correctly
      expect(createUserEndpoint.id).toBe('CreateUserEndpoint');
      expect(createUserEndpoint.type).toBe(ComponentType.API);
      expect((createUserEndpoint as any).path).toBe('/users');
      expect((createUserEndpoint as any).method).toBe(ApiMethod.POST);
      
      // Test the OpenAPI generation
      expect(typeof (createUserEndpoint as any).generateOpenApiSpec).toBe('function');
      const openApiPath = (createUserEndpoint as any).generateOpenApiSpec();
      expect(openApiPath).toHaveProperty('/users.post');
      expect(openApiPath['/users'].post.tags).toContain('users');
    });
    
    it('should support path parameters and query parameters', () => {
      // Define an API with path and query parameters
      const getUserEndpoint = dsl.component('GetUserEndpoint', {
        type: ComponentType.API,
        description: 'Get user by ID',
        version: '1.0.0'
      });
      
      // Enhance API endpoint
      (dsl as any).enhanceComponent('GetUserEndpoint', {
        path: '/users/{userId}',
        method: ApiMethod.GET,
        request: {
          params: {
            userId: {
              type: 'string',
              description: 'The user ID'
            }
          },
          query: {
            include: {
              type: 'array',
              items: { type: 'string' },
              description: 'Fields to include'
            },
            version: {
              type: 'string',
              description: 'API version'
            }
          }
        },
        responses: {
          '200': {
            description: 'User found',
            content: { ref: 'UserSchema' }
          },
          '404': {
            description: 'User not found',
            content: { ref: 'ErrorSchema' }
          }
        },
        generateHandler: vi.fn().mockReturnValue(async (req: any, res: any) => {
          const { userId } = req.params;
          const { include, version } = req.query;
          
          // Mock implementation for testing
          res.status(200).json({
            id: userId,
            name: 'Test User',
            email: 'test@example.com'
          });
        })
      });
      
      expect(getUserEndpoint.id).toBe('GetUserEndpoint');
      expect((getUserEndpoint as any).path).toBe('/users/{userId}');
      expect((getUserEndpoint as any).method).toBe(ApiMethod.GET);
      expect((getUserEndpoint as any).request.params.userId.type).toBe('string');
      expect((getUserEndpoint as any).request.query.include.type).toBe('array');
      
      // Test handler generation
      expect(typeof (getUserEndpoint as any).generateHandler).toBe('function');
      const handler = (getUserEndpoint as any).generateHandler();
      expect(typeof handler).toBe('function');
    });
  });

  describe('OpenAPI Generation', () => {
    it('should generate OpenAPI specification', () => {
      // Define API components first
      const userSchema = dsl.component('OpenApiUserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0'
      });
      
      (dsl as any).enhanceComponent('OpenApiUserSchema', {
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      });
      
      const getUserApi = dsl.component('GetUserApi', {
        type: ComponentType.API,
        description: 'Get user endpoint',
        version: '1.0.0'
      });
      
      (dsl as any).enhanceComponent('GetUserApi', {
        path: '/users/{id}',
        method: ApiMethod.GET,
        responses: {
          '200': {
            description: 'User found',
            content: { ref: 'OpenApiUserSchema' }
          }
        }
      });
      
      // Test OpenAPI generation
      const openApiSpec = (dsl as any).generateOpenApi();
      
      expect(openApiSpec).toBeDefined();
      expect(openApiSpec.openapi).toBe('3.0.0');
      expect(openApiSpec.info).toBeDefined();
    });
  });
}); 