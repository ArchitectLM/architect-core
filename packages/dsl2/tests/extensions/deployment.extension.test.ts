import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the deployment extension module
vi.mock('../../src/extensions/deployment.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/deployment.extension.js');
  return {
    ...actual,
    setupDeploymentExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupDeploymentExtension, 
  DeploymentExtensionOptions 
} from '../../src/extensions/deployment.extension.js';

describe('Deployment Extension', () => {
  let dsl: DSL;
  let deploymentOptions: DeploymentExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    deploymentOptions = {
      defaultProvider: 'aws',
      defaultRegion: 'us-west-2',
      environments: ['dev', 'staging', 'production']
    };
    
    // Setup extension
    setupDeploymentExtension(dsl, deploymentOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Deployment Configuration', () => {
    it('should add deployment configuration to system definitions', () => {
      // Define a system component with deployment config
      const system = dsl.system('CloudSystem', {
        description: 'System with deployment configuration',
        version: '1.0.0',
        components: {
          schemas: [],
          commands: []
        },
        deployment: {
          regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
          scaling: {
            min: 2,
            max: 20,
            metrics: ['cpu', 'concurrent-requests']
          },
          failover: {
            strategy: 'active-passive',
            recoveryTime: '5m'
          }
        }
      });
      
      // Extension should process and validate the deployment configuration
      expect(system.deployment).toBeDefined();
      expect(system.deployment.regions).toContain('us-east-1');
      expect(system.deployment.scaling.min).toBe(2);
      expect(system.deployment.scaling.max).toBe(20);
      expect(system.deployment.failover.strategy).toBe('active-passive');
    });
    
    it('should support different deployment providers', () => {
      // Define a system with AWS deployment
      const awsSystem = dsl.system('AwsSystem', {
        description: 'System deployed on AWS',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        deployment: {
          provider: 'aws',
          regions: ['us-east-1', 'us-west-2'],
          services: {
            compute: 'lambda',
            database: 'dynamodb',
            messaging: 'sqs',
            storage: 's3',
            cdn: 'cloudfront'
          },
          vpc: {
            enabled: true,
            cidr: '10.0.0.0/16',
            subnets: ['10.0.1.0/24', '10.0.2.0/24']
          }
        }
      });
      
      expect(awsSystem.deployment.provider).toBe('aws');
      expect(awsSystem.deployment.services.compute).toBe('lambda');
      
      // Define a system with Azure deployment
      const azureSystem = dsl.system('AzureSystem', {
        description: 'System deployed on Azure',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        deployment: {
          provider: 'azure',
          regions: ['eastus', 'westeurope'],
          services: {
            compute: 'functions',
            database: 'cosmosdb',
            messaging: 'servicebus',
            storage: 'blob',
            cdn: 'cdn'
          }
        }
      });
      
      expect(azureSystem.deployment.provider).toBe('azure');
      expect(azureSystem.deployment.services.compute).toBe('functions');
    });
    
    it('should support containerized deployment configurations', () => {
      // Define a system with Kubernetes deployment
      const k8sSystem = dsl.system('K8sSystem', {
        description: 'System deployed on Kubernetes',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        deployment: {
          provider: 'kubernetes',
          containerization: {
            type: 'docker',
            baseImage: 'node:18-alpine',
            registry: 'ecr.amazonaws.com',
            resources: {
              cpu: {
                request: '100m',
                limit: '500m'
              },
              memory: {
                request: '256Mi',
                limit: '1Gi'
              }
            }
          },
          services: [
            {
              name: 'api',
              replicas: 3,
              ports: [{ port: 8080, targetPort: 3000 }],
              healthCheck: {
                path: '/health',
                initialDelay: 30,
                interval: 60
              }
            },
            {
              name: 'worker',
              replicas: 2,
              resources: {
                cpu: {
                  request: '200m',
                  limit: '1000m'
                },
                memory: {
                  request: '512Mi',
                  limit: '2Gi'
                }
              }
            }
          ]
        }
      });
      
      expect(k8sSystem.deployment.provider).toBe('kubernetes');
      expect(k8sSystem.deployment.containerization.type).toBe('docker');
      expect(k8sSystem.deployment.services).toHaveLength(2);
      expect(k8sSystem.deployment.services[0].name).toBe('api');
      expect(k8sSystem.deployment.services[0].replicas).toBe(3);
    });
  });

  describe('Infrastructure as Code Generation', () => {
    it('should generate infrastructure code for the system', () => {
      // Define a system with deployment config
      const system = dsl.system('CloudSystem', {
        description: 'System with deployment configuration',
        version: '1.0.0',
        components: {
          schemas: [],
          commands: []
        },
        deployment: {
          provider: 'aws',
          regions: ['us-east-1'],
          services: {
            compute: 'lambda',
            database: 'dynamodb',
            messaging: 'sqs'
          }
        }
      });
      
      // Mock IaC generation function
      const generateInfrastructureMock = vi.fn().mockReturnValue({
        files: {
          'main.tf': '# Terraform configuration',
          'variables.tf': '# Variables',
          'outputs.tf': '# Outputs'
        }
      });
      
      (dsl as any).deploymentExtension = {
        ...(dsl as any).deploymentExtension,
        generateInfrastructure: generateInfrastructureMock
      };
      
      // Generate infrastructure code
      const infraCode = (dsl as any).generateInfrastructureForSystem(system, 'terraform');
      
      // Verify infrastructure generation
      expect(generateInfrastructureMock).toHaveBeenCalledWith(
        system,
        'terraform'
      );
      expect(infraCode.files).toHaveProperty('main.tf');
      expect(infraCode.files).toHaveProperty('variables.tf');
    });
    
    it('should generate different infrastructure formats', () => {
      // Define a system
      const system = dsl.system('MultiDeploySystem', {
        description: 'System with multiple deployment options',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        deployment: {
          provider: 'aws',
          regions: ['us-east-1']
        }
      });
      
      // Mock IaC generation function for different formats
      const generateTerraformMock = vi.fn().mockReturnValue({
        files: { 'main.tf': '# Terraform config' }
      });
      
      const generateCloudFormationMock = vi.fn().mockReturnValue({
        files: { 'template.yaml': '# CloudFormation template' }
      });
      
      const generatePulumiMock = vi.fn().mockReturnValue({
        files: { 'index.ts': '// Pulumi program' }
      });
      
      (dsl as any).deploymentExtension = {
        ...(dsl as any).deploymentExtension,
        generateInfrastructure: vi.fn().mockImplementation((system, format) => {
          if (format === 'terraform') {
            return generateTerraformMock(system);
          } else if (format === 'cloudformation') {
            return generateCloudFormationMock(system);
          } else if (format === 'pulumi') {
            return generatePulumiMock(system);
          }
          return { files: {} };
        })
      };
      
      // Generate in different formats
      const terraformCode = (dsl as any).generateInfrastructureForSystem(system, 'terraform');
      const cloudFormationCode = (dsl as any).generateInfrastructureForSystem(system, 'cloudformation');
      const pulumiCode = (dsl as any).generateInfrastructureForSystem(system, 'pulumi');
      
      // Verify each format was generated
      expect(terraformCode.files).toHaveProperty('main.tf');
      expect(cloudFormationCode.files).toHaveProperty('template.yaml');
      expect(pulumiCode.files).toHaveProperty('index.ts');
    });
  });

  describe('Component-Specific Deployment Configuration', () => {
    it('should allow component-level deployment configuration', () => {
      // Define a component with deployment specifics
      const userServiceComponent = dsl.component('UserService', {
        type: ComponentType.COMMAND,
        description: 'User management service',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        deployment: {
          resources: {
            memory: '512MB',
            timeout: '30s'
          },
          scaling: {
            minInstances: 2,
            maxInstances: 10,
            concurrency: 5
          },
          environment: {
            variables: {
              LOG_LEVEL: 'info',
              USER_DB_TABLE: '${env.USER_TABLE_NAME}'
            }
          }
        }
      });
      
      // Extension should process component-level config
      expect((userServiceComponent as any).deployment).toBeDefined();
      expect((userServiceComponent as any).deployment.resources.memory).toBe('512MB');
      expect((userServiceComponent as any).deployment.scaling.minInstances).toBe(2);
      expect((userServiceComponent as any).deployment.environment.variables.LOG_LEVEL).toBe('info');
    });
    
    it('should merge system and component deployment configurations', () => {
      // Define a system with deployment config
      const system = dsl.system('MicroserviceSystem', {
        description: 'Microservice system',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        deployment: {
          provider: 'aws',
          regions: ['us-east-1'],
          defaultResourceConfig: {
            memory: '256MB',
            timeout: '15s'
          }
        }
      });
      
      // Define a component with deployment overrides
      const userServiceComponent = dsl.component('UserService', {
        type: ComponentType.COMMAND,
        description: 'User management service',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' },
        deployment: {
          resources: {
            memory: '1GB',
            timeout: '60s'
          }
        }
      });
      
      // Mock deployment configuration merge
      const mergeDeploymentConfigMock = vi.fn().mockReturnValue({
        provider: 'aws',
        regions: ['us-east-1'],
        resources: {
          memory: '1GB',  // Component override takes precedence
          timeout: '60s'  // Component override takes precedence
        }
      });
      
      (dsl as any).deploymentExtension = {
        ...(dsl as any).deploymentExtension,
        mergeDeploymentConfig: mergeDeploymentConfigMock
      };
      
      // Get effective deployment config for the component
      const effectiveConfig = (dsl as any).getEffectiveDeploymentConfig(system, userServiceComponent);
      
      // Verify merge was called with the right parameters
      expect(mergeDeploymentConfigMock).toHaveBeenCalledWith(
        system.deployment,
        (userServiceComponent as any).deployment
      );
      
      // Verify component overrides take precedence
      expect(effectiveConfig.resources.memory).toBe('1GB');
      expect(effectiveConfig.resources.timeout).toBe('60s');
    });
  });

  describe('Deployment Operations', () => {
    it('should add deployment capabilities to the DSL', () => {
      // The extension should add deployment methods to the DSL
      expect(typeof (dsl as any).deploySystem).toBe('function');
      expect(typeof (dsl as any).getDeploymentStatus).toBe('function');
      expect(typeof (dsl as any).updateDeployment).toBe('function');
      expect(typeof (dsl as any).deleteDeployment).toBe('function');
    });
    
    it('should deploy a system to the specified environment', async () => {
      // Define a system to deploy
      const system = dsl.system('DeployableSystem', {
        description: 'System to deploy',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        deployment: {
          provider: 'aws',
          regions: ['us-east-1']
        }
      });
      
      // Mock deployment function
      const deploySystemMock = vi.fn().mockResolvedValue({
        deploymentId: 'deploy-123',
        status: 'in_progress',
        environment: 'staging',
        timestamp: new Date().toISOString()
      });
      
      (dsl as any).deploymentExtension = {
        ...(dsl as any).deploymentExtension,
        deploySystem: deploySystemMock
      };
      
      // Deploy the system
      const deployment = await (dsl as any).deploySystem('DeployableSystem', {
        environment: 'staging',
        version: '1.0.0'
      });
      
      // Verify deployment was initiated
      expect(deploySystemMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'DeployableSystem' }),
        expect.objectContaining({
          environment: 'staging',
          version: '1.0.0'
        })
      );
      
      // Verify deployment details
      expect(deployment.deploymentId).toBe('deploy-123');
      expect(deployment.status).toBe('in_progress');
      expect(deployment.environment).toBe('staging');
    });
    
    it('should update an existing deployment', async () => {
      // Mock deployment update function
      const updateDeploymentMock = vi.fn().mockResolvedValue({
        deploymentId: 'deploy-123',
        status: 'updating',
        environment: 'production',
        timestamp: new Date().toISOString(),
        updatedResources: ['lambda-function', 'api-gateway']
      });
      
      (dsl as any).deploymentExtension = {
        ...(dsl as any).deploymentExtension,
        updateDeployment: updateDeploymentMock
      };
      
      // Update deployment
      const updatedDeployment = await (dsl as any).updateDeployment('DeployableSystem', {
        environment: 'production',
        version: '1.0.1'
      });
      
      // Verify update was initiated
      expect(updateDeploymentMock).toHaveBeenCalledWith(
        'DeployableSystem',
        expect.objectContaining({
          environment: 'production',
          version: '1.0.1'
        })
      );
      
      // Verify update details
      expect(updatedDeployment.status).toBe('updating');
      expect(updatedDeployment.updatedResources).toHaveLength(2);
    });
  });

  describe('Multi-Environment Support', () => {
    it('should maintain separate deployments for different environments', async () => {
      // Mock get deployment status function
      const getDeploymentStatusMock = vi.fn().mockImplementation((systemId, environment) => {
        if (environment === 'dev') {
          return Promise.resolve({
            status: 'deployed',
            version: '1.1.0-alpha',
            environment: 'dev',
            updatedAt: new Date().toISOString(),
            url: 'https://dev-api.example.com'
          });
        } else if (environment === 'production') {
          return Promise.resolve({
            status: 'deployed',
            version: '1.0.5',
            environment: 'production',
            updatedAt: new Date().toISOString(),
            url: 'https://api.example.com'
          });
        }
        return Promise.resolve(null);
      });
      
      (dsl as any).deploymentExtension = {
        ...(dsl as any).deploymentExtension,
        getDeploymentStatus: getDeploymentStatusMock
      };
      
      // Get status for different environments
      const devStatus = await (dsl as any).getDeploymentStatus('MultiEnvSystem', 'dev');
      const prodStatus = await (dsl as any).getDeploymentStatus('MultiEnvSystem', 'production');
      
      // Verify different environment statuses
      expect(devStatus.environment).toBe('dev');
      expect(devStatus.version).toBe('1.1.0-alpha');
      expect(devStatus.url).toBe('https://dev-api.example.com');
      
      expect(prodStatus.environment).toBe('production');
      expect(prodStatus.version).toBe('1.0.5');
      expect(prodStatus.url).toBe('https://api.example.com');
    });
    
    it('should support environment-specific configuration', () => {
      // Define a system with environment-specific config
      const system = dsl.system('EnvConfigSystem', {
        description: 'System with environment-specific config',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        deployment: {
          provider: 'aws',
          regions: ['us-east-1'],
          environments: {
            dev: {
              variables: {
                LOG_LEVEL: 'debug',
                API_URL: 'https://dev-api.example.com'
              },
              scaling: {
                min: 1,
                max: 2
              }
            },
            staging: {
              variables: {
                LOG_LEVEL: 'info',
                API_URL: 'https://staging-api.example.com'
              },
              scaling: {
                min: 2,
                max: 5
              }
            },
            production: {
              variables: {
                LOG_LEVEL: 'warn',
                API_URL: 'https://api.example.com'
              },
              scaling: {
                min: 3,
                max: 20
              },
              alerts: {
                enabled: true,
                notificationEmail: 'ops@example.com'
              }
            }
          }
        }
      });
      
      // Mock getting environment-specific configuration
      const getEnvConfigMock = vi.fn().mockImplementation((deployment, environment) => {
        return deployment.environments[environment];
      });
      
      (dsl as any).deploymentExtension = {
        ...(dsl as any).deploymentExtension,
        getEnvironmentConfig: getEnvConfigMock
      };
      
      // Get config for different environments
      const devConfig = (dsl as any).getEnvironmentConfig(system.deployment, 'dev');
      const stagingConfig = (dsl as any).getEnvironmentConfig(system.deployment, 'staging');
      const prodConfig = (dsl as any).getEnvironmentConfig(system.deployment, 'production');
      
      // Verify environment-specific configuration
      expect(devConfig.variables.LOG_LEVEL).toBe('debug');
      expect(devConfig.scaling.max).toBe(2);
      
      expect(stagingConfig.variables.API_URL).toBe('https://staging-api.example.com');
      expect(stagingConfig.scaling.min).toBe(2);
      
      expect(prodConfig.variables.LOG_LEVEL).toBe('warn');
      expect(prodConfig.scaling.min).toBe(3);
      expect(prodConfig.alerts.enabled).toBe(true);
    });
  });
}); 