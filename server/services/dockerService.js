const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const { promisify } = require('util');
const { getDatabase } = require('../database/init');
const gpuService = require('./gpuService');

const execAsync = promisify(exec);
const docker = new Docker();

class DockerService {
  constructor() {
    this.docker = docker;
    this.initializeServices();
  }

  async initializeServices() {
    try {
      // Initialize GPU service
      await gpuService.initializeGPUDetection();
      console.log('Docker service initialized with GPU support');
    } catch (error) {
      console.log('Docker service initialization error:', error.message);
    }
  }

  async getGPUInfo() {
    return await gpuService.getGPUInfo();
  }

  async refreshGPUInfo() {
    return await gpuService.refreshGPUInfo();
  }

  async getAvailableGPUs() {
    return await gpuService.getAvailableGPUs();
  }

  async getGPUStatistics() {
    return await gpuService.getGPUStatistics();
  }

  async createVLLMContainer(instanceConfig) {
    const { 
      id, 
      name, 
      modelName, 
      port, 
      apiKey, 
      gpuSelection, 
      hfToken,
      // Advanced configuration options
      maxContextLength,
      gpuMemoryUtilization = 0.85,
      maxNumSeqs = 256,
      trustRemoteCode = false,
      quantization,
      tensorParallelSize = 1
    } = instanceConfig;
    
    try {
      const containerName = `vllm-${name}-${id}`;
      
      // Select optimal GPU based on preference
      const selectedGPU = await gpuService.selectOptimalGPU(gpuSelection || 'auto');
      
      // Get device configuration for selected GPU
      const deviceConfig = gpuService.getDeviceConfigForGPU(selectedGPU);
      console.log(`Creating container with: ${deviceConfig.deviceInfo}`);
      console.log('DeviceConfig.hostConfig:', JSON.stringify(deviceConfig.hostConfig, null, 2));
      // Security: Don't log sensitive tokens/keys
      console.log('HF Token provided:', hfToken ? 'Yes' : 'No');
      console.log('API Key provided:', apiKey ? 'Yes' : 'No');
      console.log('Advanced config:', {
        maxContextLength,
        gpuMemoryUtilization,
        maxNumSeqs,
        trustRemoteCode,
        quantization,
        tensorParallelSize
      });
      
      // Build command array
      const command = [
        '--model', modelName,
        '--api-key', apiKey || 'localkey',
        '--port', '8000',
        '--host', '0.0.0.0',
        // Memory optimization parameters
        '--gpu-memory-utilization', gpuMemoryUtilization.toString(),
        '--max-num-seqs', maxNumSeqs.toString()
      ];

      // Add context length if specified
      if (maxContextLength && maxContextLength > 0) {
        command.push('--max-model-len', maxContextLength.toString());
      }

      // Add trust remote code if enabled
      if (trustRemoteCode) {
        command.push('--trust-remote-code');
      }

      // Add quantization if specified
      if (quantization && quantization !== '') {
        command.push('--quantization', quantization);
      }

      // Add tensor parallel size for multi-GPU setups
      if (selectedGPU && deviceConfig.gpuId === 'auto') {
        const gpuInfo = await gpuService.getGPUInfo();
        if (gpuInfo.gpus && gpuInfo.gpus.length > 1) {
          const parallelSize = Math.min(tensorParallelSize, gpuInfo.gpus.length);
          command.push('--tensor-parallel-size', parallelSize.toString());
        }
      } else if (tensorParallelSize > 1) {
        command.push('--tensor-parallel-size', tensorParallelSize.toString());
      }

      console.log('Final vLLM command:', command);

      // Base container configuration
      const containerConfig = {
        Image: 'vllm/vllm-openai:latest',
        name: containerName,
        ExposedPorts: {
          '8000/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '8000/tcp': [{ HostPort: port.toString() }]
          },
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          // Merge device-specific host configuration
          ...deviceConfig.hostConfig
        },
        NetworkingConfig: {
          EndpointsConfig: {
            'vllm_vllm-network': {}
          }
        },
        Env: [
          'HF_HUB_ENABLE_HF_TRANSFER=1',
          // Add device-specific environment variables
          ...deviceConfig.environment,
          // Add HuggingFace token for model access (separate from vLLM API key)
          ...(hfToken && hfToken !== '' ? [`HF_TOKEN=${hfToken}`] : [])
        ],
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true
      };

      console.log('Final containerConfig.HostConfig:', JSON.stringify(containerConfig.HostConfig, null, 2));
      console.log('Final containerConfig.Env:', JSON.stringify(containerConfig.Env, null, 2));
      const container = await this.docker.createContainer(containerConfig);
      
      // Start the container
      await container.start();
      
      // Track GPU usage
      await gpuService.trackGPUUsage(id, deviceConfig.gpuId);
      
      return {
        containerId: container.id,
        containerName,
        status: 'running',
        deviceInfo: deviceConfig.deviceInfo,
        gpuId: deviceConfig.gpuId,
        selectedGPU: selectedGPU
      };
    } catch (error) {
      console.error('Error creating vLLM container:', error);
      throw error;
    }
  }

  async stopContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      return { status: 'stopped' };
    } catch (error) {
      console.error('Error stopping container:', error);
      throw error;
    }
  }

  async startContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      return { status: 'running' };
    } catch (error) {
      console.error('Error starting container:', error);
      throw error;
    }
  }

  async restartContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart();
      return { status: 'running' };
    } catch (error) {
      console.error('Error restarting container:', error);
      throw error;
    }
  }

  async removeContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force: true });
      return { status: 'removed' };
    } catch (error) {
      console.error('Error removing container:', error);
      throw error;
    }
  }

  async getContainerLogs(containerId, options = {}) {
    try {
      const container = this.docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: options.tail || 100,
        ...options
      });
      
      return logs.toString();
    } catch (error) {
      console.error('Error getting container logs:', error);
      throw error;
    }
  }

  async getContainerStatus(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      
      return {
        status: info.State.Status,
        running: info.State.Running,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt
      };
    } catch (error) {
      console.error('Error getting container status:', error);
      throw error;
    }
  }

  async listAllContainers() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.filter(container => 
        container.Names.some(name => name.startsWith('/vllm-'))
      );
    } catch (error) {
      console.error('Error listing containers:', error);
      throw error;
    }
  }
}

module.exports = new DockerService(); 