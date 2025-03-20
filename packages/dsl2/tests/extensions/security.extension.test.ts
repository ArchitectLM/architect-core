import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the security extension module
vi.mock('../../src/extensions/security.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/security.extension.js');
  return {
    ...actual,
    setupSecurityExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupSecurityExtension, 
  SecurityExtensionOptions 
} from '../../src/extensions/security.extension.js';

describe('Security Extension', () => {
  let dsl: DSL;
  let securityOptions: SecurityExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    securityOptions = {
      defaultAuthType: 'jwt',
      jwtConfig: {
        secret: 'test-secret',
        expiresIn: '1h'
      },
      rbacEnabled: true,
      dataProtection: {
        piiFieldEncryption: true,
        auditingEnabled: true
      }
    };
    
    // Setup extension
    setupSecurityExtension(dsl, securityOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Configuration', () => {
    it('should add security configuration to system definitions', () => {
      // Define a system component with security
      const system = dsl.system('SecureSystem', {
        description: 'System with comprehensive security',
        version: '1.0.0',
        components: {
          schemas: [],
          commands: []
        },
        security: {
          authentication: {
            providers: [
              { type: 'oauth2', provider: 'auth0' },
              { type: 'api-key', location: 'header' }
            ]
          },
          authorization: {
            model: 'RBAC',
            roles: ['admin', 'manager', 'user', 'guest'],
            permissions: [
              { resource: 'Order', operations: ['create', 'read', 'update'] },
              { resource: 'Customer', operations: ['read'] }
            ]
          },
          dataProtection: {
            pii: {
              fields: ['Customer.email', 'Customer.phone'],
              encryption: 'field-level'
            },
            audit: {
              operations: ['create', 'update', 'delete'],
              retention: '7y'
            }
          }
        }
      });
      
      // Extension should process and validate the security configuration
      expect(system.security).toBeDefined();
      expect(system.security.authentication.providers).toHaveLength(2);
      expect(system.security.authorization.roles).toContain('admin');
      expect(system.security.dataProtection.pii.fields).toContain('Customer.email');
    });
    
    it('should support different authentication providers', () => {
      // Define a system with JWT authentication
      const jwtSystem = dsl.system('JwtSystem', {
        description: 'System with JWT authentication',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        security: {
          authentication: {
            providers: [
              { 
                type: 'jwt', 
                secret: '${env.JWT_SECRET}',
                expiresIn: '1d',
                refreshable: true
              }
            ]
          }
        }
      });
      
      expect(jwtSystem.security.authentication.providers[0].type).toBe('jwt');
      expect(jwtSystem.security.authentication.providers[0].refreshable).toBe(true);
      
      // Define a system with OpenID Connect
      const oidcSystem = dsl.system('OidcSystem', {
        description: 'System with OIDC authentication',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        security: {
          authentication: {
            providers: [
              { 
                type: 'oidc', 
                issuer: 'https://accounts.google.com',
                clientId: '${env.OIDC_CLIENT_ID}',
                clientSecret: '${env.OIDC_CLIENT_SECRET}',
                scopes: ['openid', 'profile', 'email']
              }
            ]
          }
        }
      });
      
      expect(oidcSystem.security.authentication.providers[0].type).toBe('oidc');
      expect(oidcSystem.security.authentication.providers[0].scopes).toContain('email');
    });
  });

  describe('Authorization Models', () => {
    it('should support role-based access control (RBAC)', () => {
      // Define a system with RBAC
      const rbacSystem = dsl.system('RbacSystem', {
        description: 'System with RBAC',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        security: {
          authorization: {
            model: 'RBAC',
            roles: ['admin', 'editor', 'viewer'],
            permissions: [
              { resource: 'Article', operations: ['create', 'read', 'update', 'delete'], roles: ['admin'] },
              { resource: 'Article', operations: ['create', 'read', 'update'], roles: ['editor'] },
              { resource: 'Article', operations: ['read'], roles: ['viewer'] }
            ]
          }
        }
      });
      
      expect(rbacSystem.security.authorization.model).toBe('RBAC');
      expect(rbacSystem.security.authorization.roles).toContain('editor');
      expect(rbacSystem.security.authorization.permissions).toHaveLength(3);
    });
    
    it('should support attribute-based access control (ABAC)', () => {
      // Define a system with ABAC
      const abacSystem = dsl.system('AbacSystem', {
        description: 'System with ABAC',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        security: {
          authorization: {
            model: 'ABAC',
            policies: [
              { 
                name: 'DocumentAccessPolicy',
                resource: 'Document',
                effect: 'allow',
                condition: 'user.department == resource.department || user.role == "admin"'
              },
              {
                name: 'TimeRestrictedAccess',
                resource: 'SensitiveData',
                effect: 'allow',
                condition: 'time.hour >= 9 && time.hour <= 17 && time.dayOfWeek >= 1 && time.dayOfWeek <= 5'
              }
            ]
          }
        }
      });
      
      expect(abacSystem.security.authorization.model).toBe('ABAC');
      expect(abacSystem.security.authorization.policies).toHaveLength(2);
      expect(abacSystem.security.authorization.policies[0].name).toBe('DocumentAccessPolicy');
    });
  });

  describe('Authorization Enforcement', () => {
    it('should validate access based on user roles', async () => {
      // Define a user schema
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' } }
        }
      });
      
      // Define an order schema
      dsl.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          total: { type: 'number' }
        }
      });
      
      // Define a command with authorization
      const createOrderCommand = dsl.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create a new order',
        version: '1.0.0',
        input: { type: 'object' },
        output: { ref: 'Order' },
        security: {
          authentication: { required: true },
          authorization: { roles: ['admin', 'sales'] }
        }
      });
      
      // Define a command implementation
      const createOrderMock = vi.fn().mockResolvedValue({
        id: 'order-123',
        customerId: 'customer-123',
        total: 99.99
      });
      
      dsl.implement('CreateOrder', createOrderMock);
      
      // Execute command with admin role (should succeed)
      const adminContext = {
        user: {
          id: 'user-1',
          roles: ['admin']
        }
      };
      
      const result = await (createOrderCommand as any).execute({}, adminContext);
      expect(result.id).toBe('order-123');
      
      // Execute command with invalid role (should fail)
      const userContext = {
        user: {
          id: 'user-2',
          roles: ['user']
        }
      };
      
      await expect((createOrderCommand as any).execute({}, userContext))
        .rejects.toThrow(/unauthorized/i);
    });
    
    it('should support fine-grained attribute-based authorization', async () => {
      // Define a document schema
      dsl.component('Document', {
        type: ComponentType.SCHEMA,
        description: 'Document schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          departmentId: { type: 'string' },
          classification: { type: 'string', enum: ['public', 'internal', 'confidential', 'secret'] }
        }
      });
      
      // Define an ABAC-protected query
      const getDocumentQuery = dsl.component('GetDocument', {
        type: ComponentType.QUERY,
        description: 'Get document details',
        version: '1.0.0',
        input: { 
          type: 'object',
          properties: {
            documentId: { type: 'string' }
          }
        },
        output: { ref: 'Document' },
        security: {
          authentication: { required: true },
          authorization: { 
            policy: 'user.departmentId == resource.departmentId || user.clearanceLevel >= resource.classification'
          }
        }
      });
      
      // Mock implementation
      const getDocumentMock = vi.fn().mockImplementation((input, context) => {
        return {
          id: input.documentId,
          title: 'Test Document',
          content: 'Sensitive content',
          departmentId: 'dept-1',
          classification: 'confidential'
        };
      });
      
      dsl.implement('GetDocument', getDocumentMock);
      
      // Test with a user who has access (same department)
      const authorizedContext = {
        user: {
          id: 'user-1',
          departmentId: 'dept-1',
          clearanceLevel: 'internal'
        }
      };
      
      const result = await (getDocumentQuery as any).execute(
        { documentId: 'doc-123' }, 
        authorizedContext
      );
      
      expect(result.id).toBe('doc-123');
      
      // Test with a user who has sufficient clearance but different department
      const highClearanceContext = {
        user: {
          id: 'user-2',
          departmentId: 'dept-2',
          clearanceLevel: 'confidential'
        }
      };
      
      const result2 = await (getDocumentQuery as any).execute(
        { documentId: 'doc-123' }, 
        highClearanceContext
      );
      
      expect(result2.id).toBe('doc-123');
      
      // Test with unauthorized user
      const unauthorizedContext = {
        user: {
          id: 'user-3',
          departmentId: 'dept-2',
          clearanceLevel: 'internal'
        }
      };
      
      await expect((getDocumentQuery as any).execute(
        { documentId: 'doc-123' }, 
        unauthorizedContext
      )).rejects.toThrow(/unauthorized/i);
    });
  });

  describe('Data Protection', () => {
    it('should encrypt and decrypt sensitive PII fields', () => {
      // Define a customer schema with PII
      const customerSchema = dsl.component('Customer', {
        type: ComponentType.SCHEMA,
        description: 'Customer schema with PII',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email', pii: true },
          phone: { type: 'string', pii: true },
          address: { 
            type: 'object',
            properties: {
              street: { type: 'string', pii: true },
              city: { type: 'string' },
              zipCode: { type: 'string', pii: true }
            }
          }
        }
      });
      
      // Extension should add encryption/decryption capabilities
      expect(typeof (customerSchema as any).encryptPII).toBe('function');
      expect(typeof (customerSchema as any).decryptPII).toBe('function');
      
      // Test encryption
      const customer = {
        id: 'cust-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        address: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001'
        }
      };
      
      const encrypted = (customerSchema as any).encryptPII(customer);
      
      // Non-PII fields should remain unchanged
      expect(encrypted.id).toBe('cust-123');
      expect(encrypted.name).toBe('John Doe');
      expect(encrypted.address.city).toBe('New York');
      
      // PII fields should be encrypted
      expect(encrypted.email).not.toBe('john@example.com');
      expect(encrypted.phone).not.toBe('555-123-4567');
      expect(encrypted.address.street).not.toBe('123 Main St');
      expect(encrypted.address.zipCode).not.toBe('10001');
      
      // Test decryption
      const decrypted = (customerSchema as any).decryptPII(encrypted);
      expect(decrypted.email).toBe('john@example.com');
      expect(decrypted.phone).toBe('555-123-4567');
      expect(decrypted.address.street).toBe('123 Main St');
      expect(decrypted.address.zipCode).toBe('10001');
    });
    
    it('should generate audit logs for sensitive operations', async () => {
      // Define a command with auditing
      const createPaymentCommand = dsl.component('ProcessPayment', {
        type: ComponentType.COMMAND,
        description: 'Process a payment',
        version: '1.0.0',
        input: { 
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            amount: { type: 'number' },
            paymentMethod: { 
              type: 'object',
              properties: {
                type: { type: 'string' },
                cardNumber: { type: 'string', pii: true },
                expiryDate: { type: 'string' },
                cvv: { type: 'string', pii: true }
              }
            }
          }
        },
        output: { 
          type: 'object',
          properties: {
            transactionId: { type: 'string' },
            status: { type: 'string' }
          }
        },
        security: {
          audit: {
            enabled: true,
            level: 'detailed',
            maskFields: ['paymentMethod.cardNumber', 'paymentMethod.cvv']
          }
        }
      });
      
      // Mock implementation
      const processPaymentMock = vi.fn().mockResolvedValue({
        transactionId: 'txn-123',
        status: 'completed'
      });
      
      dsl.implement('ProcessPayment', processPaymentMock);
      
      // Mock audit log function
      const auditLogSpy = vi.fn();
      (dsl as any).securityExtension = {
        ...(dsl as any).securityExtension,
        auditLog: auditLogSpy
      };
      
      // Execute command
      const paymentInput = {
        orderId: 'order-123',
        amount: 99.99,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expiryDate: '12/25',
          cvv: '123'
        }
      };
      
      await (createPaymentCommand as any).execute(paymentInput, { user: { id: 'user-1' } });
      
      // Verify audit log was created
      expect(auditLogSpy).toHaveBeenCalled();
      
      // Verify sensitive fields were masked
      const auditLogEntry = auditLogSpy.mock.calls[0][0];
      expect(auditLogEntry.action).toBe('ProcessPayment');
      expect(auditLogEntry.userId).toBe('user-1');
      expect(auditLogEntry.data.paymentMethod.cardNumber).not.toBe('4111111111111111');
      expect(auditLogEntry.data.paymentMethod.cardNumber).toMatch(/^\*+\d{4}$/); // Should be masked except last 4
      expect(auditLogEntry.data.paymentMethod.cvv).not.toBe('123');
      expect(auditLogEntry.data.paymentMethod.cvv).toMatch(/^\*+$/); // Should be fully masked
    });
  });
}); 