import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

// Mock the tenancy extension module
vi.mock('../../../src/extensions/tenancy.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/tenancy.extension.js');
  return {
    ...actual,
    setupTenancyExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupTenancyExtension, 
  TenancyExtensionOptions,
  TenancyIsolationModel,
  TenantIdentificationSource
} from '../../../src/extensions/tenancy.extension.js';

describe('Tenancy Extension', () => {
  let dsl: DSL;
  let tenancyOptions: TenancyExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    tenancyOptions = {
      model: 'multi-tenant',
      isolation: {
        data: 'schema-based',
        compute: 'shared-instance',
        storage: 'shared-database'
      },
      tenantIdentification: {
        source: 'header',
        headerName: 'X-Tenant-ID'
      }
    };
    
    // Setup extension
    setupTenancyExtension(dsl, tenancyOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tenancy Configuration', () => {
    it('should add tenancy configuration to system definitions', () => {
      // Define a system component with tenancy
      const system = dsl.system('EcommerceSystem', {
        description: 'E-commerce system with multi-tenancy',
        version: '1.0.0',
        components: {
          schemas: [],
          commands: []
        },
        tenancy: {
          model: 'multi-tenant',
          isolation: {
            data: 'schema-based',
            compute: 'shared-instance',
            storage: 'shared-database'
          },
          tenantIdentification: {
            source: 'header',
            headerName: 'X-Tenant-ID'
          }
        }
      });
      
      // Extension should process and validate the tenancy configuration
      expect(system.tenancy).toBeDefined();
      expect(system.tenancy.model).toBe('multi-tenant');
      expect(system.tenancy.isolation.data).toBe('schema-based');
      expect(system.tenancy.tenantIdentification.source).toBe('header');
      expect(system.tenancy.tenantIdentification.headerName).toBe('X-Tenant-ID');
    });
    
    it('should support different tenancy isolation models', () => {
      // Define a system with database-based isolation
      const databaseIsolatedSystem = dsl.system('DatabaseIsolatedSystem', {
        description: 'System with database isolation',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        tenancy: {
          model: 'multi-tenant',
          isolation: {
            data: 'database-based',
            compute: 'shared-instance',
            storage: 'dedicated-database'
          },
          tenantIdentification: {
            source: 'header',
            headerName: 'X-Tenant-ID'
          }
        }
      });
      
      expect(databaseIsolatedSystem.tenancy.isolation.data).toBe('database-based');
      expect(databaseIsolatedSystem.tenancy.isolation.storage).toBe('dedicated-database');
      
      // Define a system with row-based isolation
      const rowBasedSystem = dsl.system('RowBasedSystem', {
        description: 'System with row-based isolation',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        tenancy: {
          model: 'multi-tenant',
          isolation: {
            data: 'row-based',
            compute: 'shared-instance',
            storage: 'shared-database'
          },
          tenantIdentification: {
            source: 'header',
            headerName: 'X-Tenant-ID'
          }
        }
      });
      
      expect(rowBasedSystem.tenancy.isolation.data).toBe('row-based');
    });
    
    it('should support different tenant identification methods', () => {
      // Define a system with JWT-based identification
      const jwtSystem = dsl.system('JwtSystem', {
        description: 'System with JWT-based tenant identification',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        tenancy: {
          model: 'multi-tenant',
          isolation: {
            data: 'schema-based',
            compute: 'shared-instance',
            storage: 'shared-database'
          },
          tenantIdentification: {
            source: 'jwt',
            jwtClaim: 'tenant_id'
          }
        }
      });
      
      expect(jwtSystem.tenancy.tenantIdentification.source).toBe('jwt');
      expect(jwtSystem.tenancy.tenantIdentification.jwtClaim).toBe('tenant_id');
      
      // Define a system with subdomain-based identification
      const subdomainSystem = dsl.system('SubdomainSystem', {
        description: 'System with subdomain-based tenant identification',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        tenancy: {
          model: 'multi-tenant',
          isolation: {
            data: 'schema-based',
            compute: 'shared-instance',
            storage: 'shared-database'
          },
          tenantIdentification: {
            source: 'subdomain',
            domainPattern: '{tenant}.example.com'
          }
        }
      });
      
      expect(subdomainSystem.tenancy.tenantIdentification.source).toBe('subdomain');
      expect(subdomainSystem.tenancy.tenantIdentification.domainPattern).toBe('{tenant}.example.com');
    });
  });

  describe('Tenant Context', () => {
    it('should add tenant information to execution context', async () => {
      // Define a command component
      const createOrderCommand = dsl.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create a new order',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' }
      });
      
      // Mock implementation that captures the context
      let capturedContext: any = null;
      const mockImplementation = vi.fn().mockImplementation((input, context) => {
        capturedContext = context;
        return { id: 'order-123', status: 'created' };
      });
      
      dsl.implement('CreateOrder', mockImplementation);
      
      // Set up tenant context
      const tenantContext = {
        tenantId: 'tenant-123',
        tenantName: 'Acme Corp'
      };
      
      // Execute with tenant context
      await (createOrderCommand as any).execute({}, { tenant: tenantContext });
      
      // Verify tenant info was passed to implementation
      expect(mockImplementation).toHaveBeenCalled();
      expect(capturedContext.tenant).toBeDefined();
      expect(capturedContext.tenant.tenantId).toBe('tenant-123');
      expect(capturedContext.tenant.tenantName).toBe('Acme Corp');
    });
    
    it('should enforce tenant isolation in data access', async () => {
      // Define a schema with tenant isolation
      const orderSchema = dsl.component('OrderSchema', {
        type: ComponentType.SCHEMA,
        description: 'Order schema with tenant isolation',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          customerName: { type: 'string' },
          total: { type: 'number' }
        },
        required: ['id', 'tenantId']
      });
      
      // Define a query that should respect tenant isolation
      const getOrdersQuery = dsl.component('GetOrders', {
        type: ComponentType.QUERY,
        description: 'Get orders with tenant isolation',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'array' }
      });
      
      // Mock implementation that should enforce isolation
      const mockQueryImplementation = vi.fn().mockImplementation((input, context) => {
        // Implementation should automatically filter by tenant
        const tenantId = context.tenant?.tenantId;
        return [
          { id: 'order-1', tenantId, customerName: 'Customer 1', total: 100 },
          { id: 'order-2', tenantId, customerName: 'Customer 2', total: 200 }
        ];
      });
      
      dsl.implement('GetOrders', mockQueryImplementation);
      
      // Execute with tenant context
      const result = await (getOrdersQuery as any).execute({}, { 
        tenant: { tenantId: 'tenant-123' } 
      });
      
      // Verify tenant isolation was respected
      expect(mockQueryImplementation).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].tenantId).toBe('tenant-123');
      expect(result[1].tenantId).toBe('tenant-123');
    });
  });

  describe('Tenant Management', () => {
    it('should provide methods for tenant lifecycle management', () => {
      // The extension should add tenant management capabilities to the DSL
      expect(typeof (dsl as any).createTenant).toBe('function');
      expect(typeof (dsl as any).getTenant).toBe('function');
      expect(typeof (dsl as any).updateTenant).toBe('function');
      expect(typeof (dsl as any).deleteTenant).toBe('function');
      expect(typeof (dsl as any).listTenants).toBe('function');
      
      // Test creating a tenant
      const newTenant = (dsl as any).createTenant({
        id: 'tenant-new',
        name: 'New Tenant',
        subdomain: 'new-tenant',
        settings: {
          theme: 'light',
          features: ['analytics', 'reporting']
        }
      });
      
      expect(newTenant.id).toBe('tenant-new');
      expect(newTenant.name).toBe('New Tenant');
      
      // Test retrieving a tenant
      const retrievedTenant = (dsl as any).getTenant('tenant-new');
      expect(retrievedTenant).toEqual(newTenant);
      
      // Test listing tenants
      const tenants = (dsl as any).listTenants();
      expect(tenants).toContainEqual(newTenant);
    });
    
    it('should support tenant provisioning and setup', async () => {
      // The extension should add provisioning capabilities
      expect(typeof (dsl as any).provisionTenant).toBe('function');
      
      // Test tenant provisioning which should set up resources for a tenant
      const provisioningResult = await (dsl as any).provisionTenant('tenant-123', {
        createDatabase: true,
        setupStorage: true,
        initializeData: true
      });
      
      expect(provisioningResult.success).toBe(true);
      expect(provisioningResult.resources).toBeDefined();
      expect(provisioningResult.resources.database).toBeDefined();
      expect(provisioningResult.resources.storage).toBeDefined();
    });
  });
}); 