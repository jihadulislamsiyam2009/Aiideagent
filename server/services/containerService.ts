
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export interface ContainerConfig {
  id: string;
  name: string;
  projectId: string;
  baseImage: string;
  dockerfile?: string;
  buildArgs: Record<string, string>;
  environment: Record<string, string>;
  ports: PortMapping[];
  volumes: VolumeMount[];
  resources: ResourceLimits;
}

export interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol: 'tcp' | 'udp';
}

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readOnly: boolean;
}

export interface ResourceLimits {
  cpu: string;
  memory: string;
  gpus?: number;
}

export interface ContainerInstance {
  id: string;
  configId: string;
  status: 'created' | 'running' | 'stopped' | 'error';
  containerId: string;
  startTime?: Date;
  logs: string[];
  metrics: ContainerMetrics;
}

export interface ContainerMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkIO: { rx: number; tx: number };
  diskIO: { read: number; write: number };
}

export interface KubernetesDeployment {
  id: string;
  name: string;
  namespace: string;
  replicas: number;
  containerConfigs: ContainerConfig[];
  services: KubernetesService[];
  ingress?: KubernetesIngress;
  status: 'pending' | 'deploying' | 'running' | 'failed';
}

export interface KubernetesService {
  name: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  ports: { port: number; targetPort: number; protocol: string }[];
  selector: Record<string, string>;
}

export interface KubernetesIngress {
  name: string;
  hostname: string;
  paths: { path: string; serviceName: string; servicePort: number }[];
  tls?: { secretName: string; hosts: string[] };
}

export class ContainerService {
  private configs: Map<string, ContainerConfig> = new Map();
  private instances: Map<string, ContainerInstance> = new Map();
  private deployments: Map<string, KubernetesDeployment> = new Map();

  async createContainerConfig(config: Omit<ContainerConfig, 'id'>): Promise<string> {
    const configId = `container-${Date.now()}`;
    const containerConfig: ContainerConfig = { ...config, id: configId };
    
    this.configs.set(configId, containerConfig);
    
    // Generate Dockerfile if not provided
    if (!containerConfig.dockerfile) {
      await this.generateDockerfile(containerConfig);
    }
    
    return configId;
  }

  private async generateDockerfile(config: ContainerConfig): Promise<void> {
    const projectPath = path.join(process.cwd(), 'projects', config.projectId);
    
    let dockerfile = '';
    
    // Detect project type and generate appropriate Dockerfile
    const packageJsonExists = await fs.access(path.join(projectPath, 'package.json')).then(() => true).catch(() => false);
    const requirementsTxtExists = await fs.access(path.join(projectPath, 'requirements.txt')).then(() => true).catch(() => false);
    
    if (packageJsonExists) {
      dockerfile = this.generateNodeDockerfile(config);
    } else if (requirementsTxtExists) {
      dockerfile = this.generatePythonDockerfile(config);
    } else {
      dockerfile = this.generateGenericDockerfile(config);
    }
    
    await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);
    config.dockerfile = 'Dockerfile';
  }

  private generateNodeDockerfile(config: ContainerConfig): string {
    return `
FROM ${config.baseImage || 'node:18-alpine'}

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Set environment variables
${Object.entries(config.environment).map(([key, value]) => `ENV ${key}=${value}`).join('\n')}

# Build arguments
${Object.entries(config.buildArgs).map(([key, value]) => `ARG ${key}=${value}`).join('\n')}

# Expose ports
${config.ports.map(port => `EXPOSE ${port.containerPort}`).join('\n')}

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${config.ports[0]?.containerPort || 3000}/health || exit 1

# Start the application
CMD ["npm", "start"]
`;
  }

  private generatePythonDockerfile(config: ContainerConfig): string {
    return `
FROM ${config.baseImage || 'python:3.11-slim'}

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
${Object.entries(config.environment).map(([key, value]) => `ENV ${key}=${value}`).join('\n')}

# Build arguments
${Object.entries(config.buildArgs).map(([key, value]) => `ARG ${key}=${value}`).join('\n')}

# Expose ports
${config.ports.map(port => `EXPOSE ${port.containerPort}`).join('\n')}

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${config.ports[0]?.containerPort || 5000}/health || exit 1

# Start the application
CMD ["python", "app.py"]
`;
  }

  private generateGenericDockerfile(config: ContainerConfig): string {
    return `
FROM ${config.baseImage}

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Set environment variables
${Object.entries(config.environment).map(([key, value]) => `ENV ${key}=${value}`).join('\n')}

# Build arguments
${Object.entries(config.buildArgs).map(([key, value]) => `ARG ${key}=${value}`).join('\n')}

# Expose ports
${config.ports.map(port => `EXPOSE ${port.containerPort}`).join('\n')}

# Start the application
CMD ["./start.sh"]
`;
  }

  async buildContainer(configId: string): Promise<string> {
    const config = this.configs.get(configId);
    if (!config) throw new Error('Container configuration not found');

    const projectPath = path.join(process.cwd(), 'projects', config.projectId);
    const imageName = `${config.name}:${Date.now()}`;

    return new Promise((resolve, reject) => {
      const buildArgs = Object.entries(config.buildArgs).flatMap(([key, value]) => ['--build-arg', `${key}=${value}`]);
      
      const buildProcess = spawn('docker', [
        'build',
        '-t', imageName,
        '-f', config.dockerfile || 'Dockerfile',
        ...buildArgs,
        '.'
      ], {
        cwd: projectPath,
        stdio: 'pipe'
      });

      let output = '';

      buildProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Build output:', data.toString());
      });

      buildProcess.stderr.on('data', (data) => {
        output += data.toString();
        console.error('Build error:', data.toString());
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve(imageName);
        } else {
          reject(new Error(`Docker build failed with code ${code}\n${output}`));
        }
      });
    });
  }

  async runContainer(configId: string, imageName: string): Promise<string> {
    const config = this.configs.get(configId);
    if (!config) throw new Error('Container configuration not found');

    const instanceId = `instance-${Date.now()}`;
    const containerName = `${config.name}-${instanceId}`;

    // Build docker run command
    const runArgs: string[] = [
      'run',
      '-d', // detached mode
      '--name', containerName
    ];

    // Add port mappings
    config.ports.forEach(port => {
      runArgs.push('-p', `${port.hostPort}:${port.containerPort}/${port.protocol}`);
    });

    // Add volume mounts
    config.volumes.forEach(volume => {
      runArgs.push('-v', `${volume.hostPath}:${volume.containerPath}${volume.readOnly ? ':ro' : ''}`);
    });

    // Add environment variables
    Object.entries(config.environment).forEach(([key, value]) => {
      runArgs.push('-e', `${key}=${value}`);
    });

    // Add resource limits
    if (config.resources.cpu) {
      runArgs.push('--cpus', config.resources.cpu);
    }
    if (config.resources.memory) {
      runArgs.push('--memory', config.resources.memory);
    }
    if (config.resources.gpus) {
      runArgs.push('--gpus', config.resources.gpus.toString());
    }

    // Add image name
    runArgs.push(imageName);

    return new Promise((resolve, reject) => {
      const runProcess = spawn('docker', runArgs, { stdio: 'pipe' });

      let containerId = '';

      runProcess.stdout.on('data', (data) => {
        containerId += data.toString().trim();
      });

      runProcess.on('close', (code) => {
        if (code === 0 && containerId) {
          // Create instance record
          const instance: ContainerInstance = {
            id: instanceId,
            configId,
            status: 'running',
            containerId: containerId.trim(),
            startTime: new Date(),
            logs: [],
            metrics: {
              cpuUsage: 0,
              memoryUsage: 0,
              networkIO: { rx: 0, tx: 0 },
              diskIO: { read: 0, write: 0 }
            }
          };

          this.instances.set(instanceId, instance);
          
          // Start monitoring
          this.startContainerMonitoring(instance);
          
          resolve(instanceId);
        } else {
          reject(new Error(`Failed to run container with code ${code}`));
        }
      });
    });
  }

  private startContainerMonitoring(instance: ContainerInstance): void {
    // Monitor container logs
    const logsProcess = spawn('docker', ['logs', '-f', instance.containerId], { stdio: 'pipe' });
    
    logsProcess.stdout.on('data', (data) => {
      instance.logs.push(`STDOUT: ${data.toString()}`);
    });

    logsProcess.stderr.on('data', (data) => {
      instance.logs.push(`STDERR: ${data.toString()}`);
    });

    // Monitor container stats
    const statsInterval = setInterval(async () => {
      try {
        const stats = await this.getContainerStats(instance.containerId);
        instance.metrics = stats;
      } catch (error) {
        console.error('Error getting container stats:', error);
        instance.status = 'error';
        clearInterval(statsInterval);
      }
    }, 5000);

    // Stop monitoring when container stops
    logsProcess.on('close', () => {
      clearInterval(statsInterval);
      instance.status = 'stopped';
    });
  }

  private async getContainerStats(containerId: string): Promise<ContainerMetrics> {
    return new Promise((resolve, reject) => {
      const statsProcess = spawn('docker', ['stats', '--no-stream', '--format', 'json', containerId], { stdio: 'pipe' });

      let output = '';

      statsProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      statsProcess.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const stats = JSON.parse(output);
            
            resolve({
              cpuUsage: parseFloat(stats.CPUPerc?.replace('%', '') || '0'),
              memoryUsage: parseFloat(stats.MemPerc?.replace('%', '') || '0'),
              networkIO: {
                rx: this.parseBytes(stats.NetIO?.split('/')[0] || '0B'),
                tx: this.parseBytes(stats.NetIO?.split('/')[1] || '0B')
              },
              diskIO: {
                read: this.parseBytes(stats.BlockIO?.split('/')[0] || '0B'),
                write: this.parseBytes(stats.BlockIO?.split('/')[1] || '0B')
              }
            });
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error('Failed to get container stats'));
        }
      });
    });
  }

  private parseBytes(str: string): number {
    const match = str.match(/^([\d.]+)(\w+)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || 1);
  }

  async stopContainer(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error('Container instance not found');

    return new Promise((resolve, reject) => {
      const stopProcess = spawn('docker', ['stop', instance.containerId], { stdio: 'pipe' });

      stopProcess.on('close', (code) => {
        if (code === 0) {
          instance.status = 'stopped';
          resolve();
        } else {
          reject(new Error(`Failed to stop container with code ${code}`));
        }
      });
    });
  }

  // Kubernetes orchestration methods

  async createKubernetesDeployment(deployment: Omit<KubernetesDeployment, 'id' | 'status'>): Promise<string> {
    const deploymentId = `k8s-${Date.now()}`;
    const k8sDeployment: KubernetesDeployment = {
      ...deployment,
      id: deploymentId,
      status: 'pending'
    };

    this.deployments.set(deploymentId, k8sDeployment);

    try {
      // Generate Kubernetes manifests
      await this.generateKubernetesManifests(k8sDeployment);
      
      // Apply manifests
      await this.applyKubernetesManifests(k8sDeployment);
      
      k8sDeployment.status = 'running';
    } catch (error) {
      k8sDeployment.status = 'failed';
      throw error;
    }

    return deploymentId;
  }

  private async generateKubernetesManifests(deployment: KubernetesDeployment): Promise<void> {
    const manifestsDir = path.join(process.cwd(), 'k8s-manifests', deployment.id);
    await fs.mkdir(manifestsDir, { recursive: true });

    // Generate Deployment manifest
    const deploymentManifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deployment.name,
        namespace: deployment.namespace || 'default'
      },
      spec: {
        replicas: deployment.replicas,
        selector: {
          matchLabels: {
            app: deployment.name
          }
        },
        template: {
          metadata: {
            labels: {
              app: deployment.name
            }
          },
          spec: {
            containers: deployment.containerConfigs.map(config => ({
              name: config.name,
              image: `${config.name}:latest`,
              ports: config.ports.map(port => ({
                containerPort: port.containerPort
              })),
              env: Object.entries(config.environment).map(([name, value]) => ({
                name,
                value
              })),
              resources: {
                limits: {
                  cpu: config.resources.cpu,
                  memory: config.resources.memory
                },
                requests: {
                  cpu: config.resources.cpu,
                  memory: config.resources.memory
                }
              },
              volumeMounts: config.volumes.map(volume => ({
                name: `volume-${volume.containerPath.replace('/', '-')}`,
                mountPath: volume.containerPath,
                readOnly: volume.readOnly
              }))
            })),
            volumes: deployment.containerConfigs.flatMap(config =>
              config.volumes.map(volume => ({
                name: `volume-${volume.containerPath.replace('/', '-')}`,
                hostPath: {
                  path: volume.hostPath
                }
              }))
            )
          }
        }
      }
    };

    await fs.writeFile(
      path.join(manifestsDir, 'deployment.yaml'),
      yaml.dump(deploymentManifest)
    );

    // Generate Service manifests
    for (const service of deployment.services) {
      const serviceManifest = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: service.name,
          namespace: deployment.namespace || 'default'
        },
        spec: {
          type: service.type,
          selector: service.selector,
          ports: service.ports.map(port => ({
            port: port.port,
            targetPort: port.targetPort,
            protocol: port.protocol.toUpperCase()
          }))
        }
      };

      await fs.writeFile(
        path.join(manifestsDir, `service-${service.name}.yaml`),
        yaml.dump(serviceManifest)
      );
    }

    // Generate Ingress manifest if provided
    if (deployment.ingress) {
      const ingressManifest = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: deployment.ingress.name,
          namespace: deployment.namespace || 'default'
        },
        spec: {
          rules: [{
            host: deployment.ingress.hostname,
            http: {
              paths: deployment.ingress.paths.map(path => ({
                path: path.path,
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: path.serviceName,
                    port: {
                      number: path.servicePort
                    }
                  }
                }
              }))
            }
          }],
          tls: deployment.ingress.tls ? [{
            secretName: deployment.ingress.tls.secretName,
            hosts: deployment.ingress.tls.hosts
          }] : undefined
        }
      };

      await fs.writeFile(
        path.join(manifestsDir, 'ingress.yaml'),
        yaml.dump(ingressManifest)
      );
    }
  }

  private async applyKubernetesManifests(deployment: KubernetesDeployment): Promise<void> {
    const manifestsDir = path.join(process.cwd(), 'k8s-manifests', deployment.id);

    return new Promise((resolve, reject) => {
      const applyProcess = spawn('kubectl', ['apply', '-f', manifestsDir], { stdio: 'pipe' });

      let output = '';

      applyProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      applyProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      applyProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to apply Kubernetes manifests: ${output}`));
        }
      });
    });
  }

  getContainerInstance(instanceId: string): ContainerInstance | undefined {
    return this.instances.get(instanceId);
  }

  getAllContainerInstances(): ContainerInstance[] {
    return Array.from(this.instances.values());
  }

  getKubernetesDeployment(deploymentId: string): KubernetesDeployment | undefined {
    return this.deployments.get(deploymentId);
  }

  getAllKubernetesDeployments(): KubernetesDeployment[] {
    return Array.from(this.deployments.values());
  }
}

export const containerService = new ContainerService();
