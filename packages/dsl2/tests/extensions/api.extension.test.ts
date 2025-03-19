import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the API extension module to test
vi.mock('../../src/extensions/api.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/api.extension.js');
  return {
    ...actual,
    setupApiExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupApiExtension, 
  ApiExtensionOptions,
  ApiMethod,
  ApiResponse,
  ApiRequest
} from '../../src/extensions/api.extension.js';

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
        version: '1.0.0',
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
        version: '1.0.0',
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
        version: '1.0.0',
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
        version: '1.0.0',
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
        security: ['bearerAuth']
      });

      // Verify the API component was defined correctly
      expect(createUserEndpoint.id).toBe('CreateUserEndpoint');
      expect(createUserEndpoint.type).toBe(ComponentType.API);
      expect((createUserEndpoint as any).path).toBe('/users');
      expect((createUserEndpoint as any).method).toBe(ApiMethod.POST);
    });
    
    it('should support path parameters and query parameters', () => {
      // Define an API with path and query parameters
      const getUserEndpoint = dsl.component('GetUserEndpoint', {
        type: ComponentType.API,
        description: 'Get user by ID',
        version: '1.0.0',
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
              type: 'string',
              description: 'Fields to include',
              required: false
            },
            version: {
              type: 'string',
              enum: ['v1', 'v2'],
              default: 'v1'
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
        command: { ref: 'GetUser' }
      });
      
      // Verify parameters are defined correctly
      expect((getUserEndpoint as any).path).toBe('/users/{userId}');
      expect((getUserEndpoint as any).request.params.userId).toBeDefined();
      expect((getUserEndpoint as any).request.query.include).toBeDefined();
      expect((getUserEndpoint as any).request.query.version.default).toBe('v1');
    });
  });

  describe('API Request Handling', () => {
    it('should handle incoming API requests and execute the associated command', async () => {
      // Mock command implementation
      const createUserMock = vi.fn().mockResolvedValue({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com'
      });
      
      // Define schema and command
      dsl.component('CreateUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Create user input',
        version: '1.0.0',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        }
      });
      
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      });
      
      const createUserCommand = dsl.component('CreateUser', {
        type: ComponentType.COMMAND,
        description: 'Create user command',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'UserSchema' }
      });
      
      dsl.implement('CreateUser', createUserMock);
      
      // Define an API endpoint
      const createUserEndpoint = dsl.component('CreateUserEndpoint', {
        type: ComponentType.API,
        description: 'Create user endpoint',
        version: '1.0.0',
        path: '/users',
        method: ApiMethod.POST,
        request: {
          body: { ref: 'CreateUserInput' }
        },
        responses: {
          '201': {
            description: 'User created',
            content: { ref: 'UserSchema' }
          }
        },
        command: { ref: 'CreateUser' }
      });
      
      // Create mock request
      const request: ApiRequest = {
        path: '/api/v1/users',
        method: ApiMethod.POST,
        body: {
          name: 'Test User',
          email: 'test@example.com'
        },
        headers: {
          'Content-Type': 'application/json'
        },
        params: {},
        query: {}
      };
      
      // Process the request
      const response = await (createUserEndpoint as any).handleRequest(request);
      
      // Verify command was executed and response is correct
      expect(createUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com'
        }),
        expect.any(Object)
      );
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com'
      });
    });
    
    it('should handle path parameters and query parameters', async () => {
      // Mock command implementation
      const getUserMock = vi.fn().mockResolvedValue({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        profile: { bio: 'Test bio' }
      });
      
      // Define schemas and command
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          profile: { 
            type: 'object',
            properties: {
              bio: { type: 'string' }
            }
          }
        }
      });
      
      const getUserCommand = dsl.component('GetUser', {
        type: ComponentType.COMMAND,
        description: 'Get user command',
        version: '1.0.0',
        input: { ref: 'GetUserInput' },
        output: { ref: 'UserSchema' }
      });
      
      dsl.implement('GetUser', getUserMock);
      
      // Define an API endpoint with path and query parameters
      const getUserEndpoint = dsl.component('GetUserEndpoint', {
        type: ComponentType.API,
        description: 'Get user endpoint',
        version: '1.0.0',
        path: '/users/{userId}',
        method: ApiMethod.GET,
        request: {
          params: {
            userId: { type: 'string' }
          },
          query: {
            fields: { type: 'string' }
          }
        },
        responses: {
          '200': {
            description: 'User found',
            content: { ref: 'UserSchema' }
          }
        },
        command: { ref: 'GetUser' }
      });
      
      // Create mock request
      const request: ApiRequest = {
        path: '/api/v1/users/user-123',
        method: ApiMethod.GET,
        headers: {},
        params: { userId: 'user-123' },
        query: { fields: 'name,email' },
        body: null
      };
      
      // Process the request
      const response = await (getUserEndpoint as any).handleRequest(request);
      
      // Verify command was executed with correct parameters
      expect(getUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          fields: 'name,email'
        }),
        expect.any(Object)
      );
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com'
      });
    });
  });

  describe('API Request Validation', () => {
    it('should validate request body against schema', async () => {
      // Define schema with validation
      dsl.component('CreateUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Create user input schema',
        version: '1.0.0',
        properties: {
          name: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 18 }
        },
        required: ['name', 'email']
      });
      
      // Define an API endpoint with validation
      const createUserEndpoint = dsl.component('CreateUserEndpoint', {
        type: ComponentType.API,
        description: 'Create user endpoint',
        version: '1.0.0',
        path: '/users',
        method: ApiMethod.POST,
        request: {
          body: { ref: 'CreateUserInput' }
        },
        responses: {
          '201': {
            description: 'User created',
            content: { ref: 'UserSchema' }
          },
          '400': {
            description: 'Invalid input',
            content: { ref: 'ErrorSchema' }
          }
        },
        command: { ref: 'CreateUser' }
      });
      
      // Test case 1: Valid input
      const validRequest: ApiRequest = {
        path: '/api/v1/users',
        method: ApiMethod.POST,
        headers: { 'Content-Type': 'application/json' },
        params: {},
        query: {},
        body: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25
        }
      };
      
      const validationResult = await (createUserEndpoint as any).validateRequest(validRequest);
      expect(validationResult.valid).toBe(true);
      
      // Test case 2: Invalid input (missing required field)
      const invalidRequest1: ApiRequest = {
        path: '/api/v1/users',
        method: ApiMethod.POST,
        headers: { 'Content-Type': 'application/json' },
        params: {},
        query: {},
        body: {
          name: 'Test User'
          // Missing required email
        }
      };
      
      const validationResult1 = await (createUserEndpoint as any).validateRequest(invalidRequest1);
      expect(validationResult1.valid).toBe(false);
      expect(validationResult1.errors).toContain('email');
      
      // Test case 3: Invalid input (validation constraints)
      const invalidRequest2: ApiRequest = {
        path: '/api/v1/users',
        method: ApiMethod.POST,
        headers: { 'Content-Type': 'application/json' },
        params: {},
        query: {},
        body: {
          name: 'AB', // Too short
          email: 'invalid-email', // Not a valid email
          age: 16 // Below minimum
        }
      };
      
      const validationResult2 = await (createUserEndpoint as any).validateRequest(invalidRequest2);
      expect(validationResult2.valid).toBe(false);
      expect(validationResult2.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('API Documentation', () => {
    it('should generate OpenAPI documentation from API components', async () => {
      // Define schemas
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      });
      
      dsl.component('CreateUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Create user input',
        version: '1.0.0',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['name', 'email']
      });
      
      dsl.component('ErrorSchema', {
        type: ComponentType.SCHEMA,
        description: 'Error response',
        version: '1.0.0',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' }
        }
      });
      
      // Define API endpoints
      dsl.component('CreateUserEndpoint', {
        type: ComponentType.API,
        description: 'Create a new user',
        version: '1.0.0',
        path: '/users',
        method: ApiMethod.POST,
        request: {
          body: { ref: 'CreateUserInput' }
        },
        responses: {
          '201': {
            description: 'User created',
            content: { ref: 'UserSchema' }
          },
          '400': {
            description: 'Invalid input',
            content: { ref: 'ErrorSchema' }
          }
        },
        command: { ref: 'CreateUser' },
        tags: ['users']
      });
      
      dsl.component('GetUserEndpoint', {
        type: ComponentType.API,
        description: 'Get user by ID',
        version: '1.0.0',
        path: '/users/{userId}',
        method: ApiMethod.GET,
        request: {
          params: {
            userId: { type: 'string' }
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
        command: { ref: 'GetUser' },
        tags: ['users']
      });
      
      // Generate API documentation
      const apiDocs = await (dsl as any).generateApiDocumentation();
      
      // Verify OpenAPI structure
      expect(apiDocs.openapi).toBeDefined();
      expect(apiDocs.info).toBeDefined();
      expect(apiDocs.paths).toBeDefined();
      
      // Verify paths
      expect(apiDocs.paths['/users']).toBeDefined();
      expect(apiDocs.paths['/users'].post).toBeDefined();
      expect(apiDocs.paths['/users/{userId}']).toBeDefined();
      expect(apiDocs.paths['/users/{userId}'].get).toBeDefined();
      
      // Verify components
      expect(apiDocs.components.schemas.UserSchema).toBeDefined();
      expect(apiDocs.components.schemas.CreateUserInput).toBeDefined();
      expect(apiDocs.components.schemas.ErrorSchema).toBeDefined();
    });
  });

  describe('API Authentication and Authorization', () => {
    it('should support authentication middleware', async () => {
      // Create mock auth middleware
      const authMiddleware = vi.fn((request, context) => {
        // Check authorization header
        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return {
            authenticated: false,
            error: 'Unauthorized'
          };
        }
        
        // Validate token (simplified)
        const token = authHeader.split(' ')[1];
        if (token === 'valid-token') {
          return {
            authenticated: true,
            user: {
              id: 'user-123',
              role: 'admin'
            }
          };
        }
        
        return {
          authenticated: false,
          error: 'Invalid token'
        };
      });
      
      // Register auth middleware
      (dsl as any).registerApiMiddleware('authentication', authMiddleware);
      
      // Define API endpoint with authentication
      const secureEndpoint = dsl.component('SecureEndpoint', {
        type: ComponentType.API,
        description: 'Secure endpoint',
        version: '1.0.0',
        path: '/secure',
        method: ApiMethod.GET,
        security: ['bearerAuth'],
        responses: {
          '200': {
            description: 'Success',
            content: { type: 'object' }
          },
          '401': {
            description: 'Unauthorized',
            content: { ref: 'ErrorSchema' }
          }
        },
        command: { ref: 'SecureCommand' }
      });
      
      // Mock request with valid token
      const validRequest: ApiRequest = {
        path: '/api/v1/secure',
        method: ApiMethod.GET,
        headers: {
          'authorization': 'Bearer valid-token'
        },
        params: {},
        query: {},
        body: null
      };
      
      // Mock request with invalid token
      const invalidRequest: ApiRequest = {
        path: '/api/v1/secure',
        method: ApiMethod.GET,
        headers: {
          'authorization': 'Bearer invalid-token'
        },
        params: {},
        query: {},
        body: null
      };
      
      // Process requests
      const validResult = await (secureEndpoint as any).authenticate(validRequest);
      const invalidResult = await (secureEndpoint as any).authenticate(invalidRequest);
      
      // Verify authentication results
      expect(validResult.authenticated).toBe(true);
      expect(validResult.user.id).toBe('user-123');
      
      expect(invalidResult.authenticated).toBe(false);
      expect(invalidResult.error).toBe('Invalid token');
    });
  });

  describe('System Integration', () => {
    it('should integrate APIs with system definitions', () => {
      // Define necessary components
      dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      });
      
      dsl.component('GetUsersEndpoint', {
        type: ComponentType.API,
        description: 'Get users endpoint',
        version: '1.0.0',
        path: '/users',
        method: ApiMethod.GET,
        responses: {
          '200': {
            description: 'Users list',
            content: { type: 'array', items: { ref: 'UserSchema' } }
          }
        },
        command: { ref: 'GetUsers' }
      });
      
      dsl.component('CreateUserEndpoint', {
        type: ComponentType.API,
        description: 'Create user endpoint',
        version: '1.0.0',
        path: '/users',
        method: ApiMethod.POST,
        request: {
          body: { ref: 'CreateUserInput' }
        },
        responses: {
          '201': {
            description: 'User created',
            content: { ref: 'UserSchema' }
          }
        },
        command: { ref: 'CreateUser' }
      });
      
      // Define a system that uses these API endpoints
      const userSystem = dsl.system('UserSystem', {
        description: 'User management system',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'UserSchema' }],
          apis: [
            { ref: 'GetUsersEndpoint' },
            { ref: 'CreateUserEndpoint' }
          ]
        }
      });
      
      // Verify the system can access API endpoints
      expect(typeof (userSystem as any).getApis).toBe('function');
      
      // Get APIs from the system
      const apis = (userSystem as any).getApis();
      expect(apis.length).toBe(2);
      
      // Verify we can generate documentation for the system
      expect(typeof (userSystem as any).generateApiDocumentation).toBe('function');
    });
  });
}); 