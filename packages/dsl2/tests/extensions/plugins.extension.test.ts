import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the plugins extension module
vi.mock('../../src/extensions/plugins.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/plugins.extension.js');
  return {
    ...actual,
    setupPluginsExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupPluginsExtension, 
  PluginsExtensionOptions 
} from '../../src/extensions/plugins.extension.js';

describe('Plugins Extension', () => {
  let dsl: DSL;
  let pluginsOptions: PluginsExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    pluginsOptions = {
      pluginsDir: './plugins',
      autoRegister: true,
      strictMode: false
    };
    
    // Setup extension
    setupPluginsExtension(dsl, pluginsOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Plugin Registration', () => {
    it('should register a plugin with the DSL', () => {
      // Mock a plugin definition
      const paymentPlugin = {
        name: 'stripe-payment-plugin',
        version: '1.0.0',
        description: 'Stripe payment integration',
        provider: 'stripe',
        capabilities: ['payment-processing', 'subscription-management', 'invoice-generation'],
        initialize: vi.fn().mockImplementation((dsl, options) => {
          return {
            processPayment: vi.fn(),
            createSubscription: vi.fn(),
            generateInvoice: vi.fn()
          };
        })
      };
      
      // Register the plugin
      const registeredPlugin = (dsl as any).registerPlugin(paymentPlugin);
      
      // Verify plugin was registered
      expect(registeredPlugin).toBeDefined();
      expect(paymentPlugin.initialize).toHaveBeenCalledWith(dsl, undefined);
      expect((dsl as any).plugins['stripe-payment-plugin']).toBeDefined();
    });
    
    it('should register a plugin with configuration', () => {
      // Mock a plugin definition with config options
      const analyticsPlugin = {
        name: 'analytics-plugin',
        version: '1.0.0',
        description: 'Analytics tracking',
        configSchema: {
          type: 'object',
          properties: {
            trackingId: { type: 'string' },
            enabledEvents: { type: 'array', items: { type: 'string' } }
          },
          required: ['trackingId']
        },
        initialize: vi.fn().mockImplementation((dsl, config) => {
          return {
            trackEvent: vi.fn(),
            getAnalytics: vi.fn()
          };
        })
      };
      
      // Register the plugin with config
      const pluginConfig = {
        trackingId: 'UA-12345-6',
        enabledEvents: ['page_view', 'purchase', 'signup']
      };
      
      const registeredPlugin = (dsl as any).registerPlugin(analyticsPlugin, pluginConfig);
      
      // Verify plugin was registered with config
      expect(registeredPlugin).toBeDefined();
      expect(analyticsPlugin.initialize).toHaveBeenCalledWith(dsl, pluginConfig);
    });
    
    it('should validate plugin configuration against schema', () => {
      // Mock a plugin with config schema
      const emailPlugin = {
        name: 'email-plugin',
        version: '1.0.0',
        description: 'Email sending capability',
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string' },
            fromEmail: { type: 'string', format: 'email' },
            templates: {
              type: 'object',
              additionalProperties: {
                type: 'string'
              }
            }
          },
          required: ['apiKey', 'fromEmail']
        },
        initialize: vi.fn()
      };
      
      // Valid config
      const validConfig = {
        apiKey: 'key-123456',
        fromEmail: 'noreply@example.com',
        templates: {
          welcome: 'Welcome to our service!',
          reset_password: 'Reset your password'
        }
      };
      
      // Invalid config (missing required field)
      const invalidConfig = {
        apiKey: 'key-123456'
        // Missing fromEmail
      };
      
      // Register with valid config should succeed
      expect(() => {
        (dsl as any).registerPlugin(emailPlugin, validConfig);
      }).not.toThrow();
      
      // Register with invalid config should fail validation
      expect(() => {
        (dsl as any).registerPlugin(emailPlugin, invalidConfig);
      }).toThrow(/configuration validation failed/i);
    });
  });

  describe('Plugin Discovery and Auto-Registration', () => {
    it('should discover plugins in the plugins directory', () => {
      // Mock the plugin discovery function
      const discoverPluginsMock = vi.fn().mockReturnValue([
        {
          name: 'plugin1',
          version: '1.0.0',
          description: 'Plugin 1',
          initialize: vi.fn().mockReturnValue({})
        },
        {
          name: 'plugin2',
          version: '1.0.0',
          description: 'Plugin 2',
          initialize: vi.fn().mockReturnValue({})
        }
      ]);
      
      (dsl as any).pluginsExtension = {
        ...(dsl as any).pluginsExtension,
        discoverPlugins: discoverPluginsMock
      };
      
      // Discover plugins
      const plugins = (dsl as any).discoverPlugins();
      
      // Verify plugins were discovered
      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('plugin1');
      expect(plugins[1].name).toBe('plugin2');
    });
    
    it('should auto-register discovered plugins when enabled', () => {
      // Mock plugin discovery
      const discoveredPlugins = [
        {
          name: 'auto-plugin1',
          version: '1.0.0',
          description: 'Auto Plugin 1',
          initialize: vi.fn().mockReturnValue({ method1: vi.fn() })
        },
        {
          name: 'auto-plugin2',
          version: '1.0.0',
          description: 'Auto Plugin 2',
          initialize: vi.fn().mockReturnValue({ method2: vi.fn() })
        }
      ];
      
      const discoverPluginsMock = vi.fn().mockReturnValue(discoveredPlugins);
      const registerPluginMock = vi.fn().mockImplementation((plugin) => {
        return plugin.initialize(dsl);
      });
      
      (dsl as any).pluginsExtension = {
        ...(dsl as any).pluginsExtension,
        discoverPlugins: discoverPluginsMock,
        autoRegister: true
      };
      
      (dsl as any).registerPlugin = registerPluginMock;
      
      // Auto-register discovered plugins
      (dsl as any).autoRegisterPlugins();
      
      // Verify plugins were registered
      expect(discoverPluginsMock).toHaveBeenCalled();
      expect(registerPluginMock).toHaveBeenCalledTimes(2);
      expect(registerPluginMock).toHaveBeenCalledWith(discoveredPlugins[0], undefined);
      expect(registerPluginMock).toHaveBeenCalledWith(discoveredPlugins[1], undefined);
    });
  });

  describe('System Plugin Configuration', () => {
    it('should configure plugins from system definition', () => {
      // Define a system with plugin configurations
      const system = dsl.system('PluginSystem', {
        description: 'System using plugins',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        plugins: {
          'payment-plugin': {
            apiKey: '${env.PAYMENT_API_KEY}',
            webhookSecret: '${env.PAYMENT_WEBHOOK_SECRET}',
            sandbox: true
          },
          'storage-plugin': {
            bucket: 'app-files',
            region: 'us-west-2',
            publicAccess: false
          }
        }
      });
      
      // Mock plugin registration function
      const getPluginMock = vi.fn().mockImplementation((name) => {
        if (name === 'payment-plugin') {
          return {
            name: 'payment-plugin',
            instance: { processPayment: vi.fn() }
          };
        } else if (name === 'storage-plugin') {
          return {
            name: 'storage-plugin',
            instance: { uploadFile: vi.fn(), getFile: vi.fn() }
          };
        }
        return undefined;
      });
      
      const configurePluginMock = vi.fn();
      
      (dsl as any).getPlugin = getPluginMock;
      (dsl as any).configurePlugin = configurePluginMock;
      
      // Configure plugins from system
      (dsl as any).configurePluginsFromSystem(system);
      
      // Verify plugins were configured
      expect(configurePluginMock).toHaveBeenCalledTimes(2);
      expect(configurePluginMock).toHaveBeenCalledWith(
        'payment-plugin',
        expect.objectContaining({
          apiKey: '${env.PAYMENT_API_KEY}',
          sandbox: true
        })
      );
      
      expect(configurePluginMock).toHaveBeenCalledWith(
        'storage-plugin',
        expect.objectContaining({
          bucket: 'app-files',
          region: 'us-west-2'
        })
      );
    });
  });

  describe('Plugin Usage', () => {
    it('should expose plugin functions to DSL users', () => {
      // Mock a registered plugin with functions
      const paymentPlugin = {
        name: 'payment-plugin',
        instance: {
          processPayment: vi.fn().mockResolvedValue({
            id: 'payment-123',
            status: 'success',
            amount: 99.99
          }),
          refundPayment: vi.fn().mockResolvedValue({
            id: 'refund-123',
            status: 'success',
            amount: 99.99
          })
        }
      };
      
      // Register the plugin
      (dsl as any).plugins = {
        'payment-plugin': paymentPlugin
      };
      
      // Use the plugin
      const paymentResult = (dsl as any).callPluginMethod(
        'payment-plugin',
        'processPayment',
        {
          amount: 99.99,
          currency: 'USD',
          cardToken: 'tok_visa'
        }
      );
      
      // Verify plugin method was called
      expect(paymentPlugin.instance.processPayment).toHaveBeenCalledWith({
        amount: 99.99,
        currency: 'USD',
        cardToken: 'tok_visa'
      });
    });
    
    it('should integrate plugin capabilities into DSL components', async () => {
      // Define a plugin that extends component capabilities
      const validationPlugin = {
        name: 'validation-plugin',
        instance: {
          validateSchema: vi.fn().mockImplementation((schema, data) => {
            // Mock validation logic
            if (!data.email && schema.properties.email?.required) {
              return { valid: false, errors: ['Email is required'] };
            }
            if (data.email && !data.email.includes('@') && schema.properties.email?.format === 'email') {
              return { valid: false, errors: ['Invalid email format'] };
            }
            return { valid: true };
          })
        }
      };
      
      // Register the plugin
      (dsl as any).plugins = {
        'validation-plugin': validationPlugin
      };
      
      // Define a schema component
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email', required: true }
        }
      });
      
      // Extend the schema component with validation capabilities
      (dsl as any).extendComponentWithPlugin(userSchema, 'validation-plugin', {
        methods: {
          validate: (data: any) => {
            return (dsl as any).callPluginMethod(
              'validation-plugin',
              'validateSchema',
              userSchema,
              data
            );
          }
        }
      });
      
      // Use the extended component
      const validResult = await (userSchema as any).validate({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com'
      });
      
      const invalidResult = await (userSchema as any).validate({
        id: 'user-2',
        name: 'Jane Doe',
        email: 'invalid-email'
      });
      
      // Verify validation worked
      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Invalid email format');
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize plugins with the DSL instance', () => {
      // Mock a plugin with initialization
      const loggingPlugin = {
        name: 'logging-plugin',
        version: '1.0.0',
        description: 'Logging capabilities',
        initialize: vi.fn().mockImplementation((dsl, config) => {
          // Plugin would set up logging and return interface
          return {
            log: vi.fn(),
            getLogEntries: vi.fn()
          };
        })
      };
      
      // Register the plugin
      (dsl as any).registerPlugin(loggingPlugin, { level: 'info' });
      
      // Verify plugin was initialized with DSL instance
      expect(loggingPlugin.initialize).toHaveBeenCalledWith(
        dsl,
        expect.objectContaining({ level: 'info' })
      );
    });
    
    it('should support plugin cleanup during shutdown', async () => {
      // Mock a plugin with cleanup
      const dbPlugin = {
        name: 'database-plugin',
        version: '1.0.0',
        description: 'Database connection',
        initialize: vi.fn().mockImplementation((dsl, config) => {
          // Return interface with cleanup method
          return {
            query: vi.fn(),
            disconnect: vi.fn().mockResolvedValue(undefined)
          };
        })
      };
      
      // Register the plugin
      const registeredPlugin = (dsl as any).registerPlugin(dbPlugin);
      
      // Store the plugin
      (dsl as any).plugins = {
        'database-plugin': {
          name: 'database-plugin',
          instance: registeredPlugin
        }
      };
      
      // Mock cleanup method
      const cleanupPluginsMock = vi.fn().mockImplementation(async () => {
        // Call disconnect on each plugin that has it
        for (const pluginName in (dsl as any).plugins) {
          const plugin = (dsl as any).plugins[pluginName];
          if (typeof plugin.instance.disconnect === 'function') {
            await plugin.instance.disconnect();
          }
        }
      });
      
      (dsl as any).cleanupPlugins = cleanupPluginsMock;
      
      // Shutdown DSL and cleanup plugins
      await (dsl as any).shutdown();
      
      // Verify cleanup was performed
      expect(cleanupPluginsMock).toHaveBeenCalled();
      expect(registeredPlugin.disconnect).toHaveBeenCalled();
    });
  });

  describe('Plugin Dependencies', () => {
    it('should handle plugin dependencies correctly', () => {
      // Mock plugins with dependencies
      const basePlugin = {
        name: 'base-plugin',
        version: '1.0.0',
        description: 'Base plugin functionality',
        initialize: vi.fn().mockReturnValue({
          baseMethod: vi.fn()
        })
      };
      
      const dependentPlugin = {
        name: 'dependent-plugin',
        version: '1.0.0',
        description: 'Plugin with dependencies',
        dependencies: ['base-plugin'],
        initialize: vi.fn().mockImplementation((dsl, config) => {
          // This plugin depends on base-plugin
          const basePlugin = (dsl as any).getPlugin('base-plugin').instance;
          return {
            enhancedMethod: vi.fn().mockImplementation(() => {
              // Call the base plugin's method
              basePlugin.baseMethod();
              // Do additional work
              return 'enhanced result';
            })
          };
        })
      };
      
      // Register base plugin
      (dsl as any).registerPlugin(basePlugin);
      
      // Mock getPlugin to return the base plugin
      (dsl as any).getPlugin = vi.fn().mockImplementation((name) => {
        if (name === 'base-plugin') {
          return {
            name: 'base-plugin',
            instance: {
              baseMethod: vi.fn().mockReturnValue('base result')
            }
          };
        }
        return undefined;
      });
      
      // Register dependent plugin
      const registeredPlugin = (dsl as any).registerPlugin(dependentPlugin);
      
      // Call the enhanced method
      const result = registeredPlugin.enhancedMethod();
      
      // Verify dependency was resolved
      expect(dependentPlugin.initialize).toHaveBeenCalled();
      expect((dsl as any).getPlugin).toHaveBeenCalledWith('base-plugin');
      expect(result).toBe('enhanced result');
    });
    
    it('should throw an error for missing dependencies', () => {
      // Plugin with missing dependency
      const pluginWithMissingDep = {
        name: 'incomplete-plugin',
        version: '1.0.0',
        description: 'Plugin with missing dependency',
        dependencies: ['nonexistent-plugin'],
        initialize: vi.fn()
      };
      
      // Mock getPlugin to return undefined for the missing dependency
      (dsl as any).getPlugin = vi.fn().mockReturnValue(undefined);
      
      // Registering should fail due to missing dependency
      expect(() => {
        (dsl as any).registerPlugin(pluginWithMissingDep);
      }).toThrow(/missing required dependency/i);
      
      // Initialize should not have been called
      expect(pluginWithMissingDep.initialize).not.toHaveBeenCalled();
    });
  });
}); 