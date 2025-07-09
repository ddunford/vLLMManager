const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getDatabase } = require('../database/init');
const gpuService = require('./gpuService');

const docker = new Docker();

class OllamaService {
  constructor() {
    this.docker = docker;
  }

  /**
   * Create or get existing Ollama container
   */
  async createOrGetOllamaContainer(instanceConfig) {
    const { 
      id, 
      name, 
      port, 
      apiKey, 
      requireAuth = true,
      gpuSelection 
    } = instanceConfig;
    
    try {
      const containerName = `ollama-${name}-${id}`;
      
      // Check if Ollama container already exists
      const existingContainers = await this.docker.listContainers({ all: true });
      const existingOllama = existingContainers.find(container => 
        container.Names.some(name => name.startsWith('/ollama-'))
      );

      if (existingOllama) {
        console.log('Ollama container already exists, using existing one');
        const container = this.docker.getContainer(existingOllama.Id);
        const info = await container.inspect();
        
        return {
          containerId: existingOllama.Id,
          containerName: existingOllama.Names[0].substring(1),
          status: info.State.Running ? 'running' : 'stopped',
          deviceInfo: 'Ollama GPU mode',
          gpuId: 'auto',
          selectedGPU: { id: 'auto', name: 'Auto-selected' }
        };
      }

      // Select optimal GPU based on preference
      const selectedGPU = await gpuService.selectOptimalGPU(gpuSelection || 'auto');
      
      // Get device configuration for selected GPU
      const deviceConfig = gpuService.getDeviceConfigForGPU(selectedGPU);
      console.log(`Creating Ollama container with: ${deviceConfig.deviceInfo}`);

      // Base container configuration
      const containerConfig = {
        Image: 'ollama/ollama:latest',
        name: containerName,
        ExposedPorts: {
          '11434/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '11434/tcp': [{ HostPort: port.toString() }]
          },
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          // Merge device-specific host configuration
          ...deviceConfig.hostConfig,
          // Add persistent volume for models
          Binds: [
            `${process.cwd()}/ollama-models:/root/.ollama`
          ]
        },
        NetworkingConfig: {
          EndpointsConfig: {
            'vllm_vllm-network': {}
          }
        },
        Env: [
          // Add device-specific environment variables
          ...deviceConfig.environment
        ],
        Cmd: [],
        AttachStdout: true,
        AttachStderr: true
      };

      console.log('Creating Ollama container with config:', JSON.stringify(containerConfig.HostConfig, null, 2));
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
      console.error('Error creating Ollama container:', error);
      throw error;
    }
  }

  /**
   * Get Ollama container status
   */
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
      console.error('Error getting Ollama container status:', error);
      throw error;
    }
  }

  /**
   * Start Ollama container
   */
  async startContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      return { status: 'running' };
    } catch (error) {
      console.error('Error starting Ollama container:', error);
      throw error;
    }
  }

  /**
   * Stop Ollama container
   */
  async stopContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      return { status: 'stopped' };
    } catch (error) {
      console.error('Error stopping Ollama container:', error);
      throw error;
    }
  }

  /**
   * Restart Ollama container
   */
  async restartContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart();
      return { status: 'running' };
    } catch (error) {
      console.error('Error restarting Ollama container:', error);
      throw error;
    }
  }

  /**
   * Remove Ollama container
   */
  async removeContainer(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force: true });
      return { status: 'removed' };
    } catch (error) {
      if (error.statusCode === 404) {
        console.warn(`Ollama container ${containerId} not found, but proceeding with cleanup.`);
        return { status: 'already_removed' };
      }
      console.error('Error removing Ollama container:', error);
      throw error;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId, tail = 100) {
    try {
      const container = this.docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: tail
      });
      return logs.toString('utf8');
    } catch (error) {
      console.error('Error getting Ollama container logs:', error);
      throw error;
    }
  }

  /**
   * List all Ollama containers
   */
  async listAllContainers() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.filter(container => 
        container.Names.some(name => name.startsWith('/ollama-'))
      );
    } catch (error) {
      console.error('Error listing Ollama containers:', error);
      throw error;
    }
  }

  /**
   * Get models from Ollama instance
   */
  async getModels(port) {
    try {
      const response = await axios.get(`http://localhost:${port}/api/tags`, {
        timeout: 10000
      });
      return response.data.models || [];
    } catch (error) {
      console.error('Error getting models from Ollama:', error);
      throw error;
    }
  }

  /**
   * Pull model to Ollama instance with real-time progress updates.
   * @param {number} port - The port of the Ollama instance.
   * @param {string} modelName - The name of the model to pull.
   * @param {function} onProgress - Callback to handle progress updates.
   */
  async pullModelStream(port, modelName, onProgress) {
    const stream = await axios.post(
      `http://localhost:${port}/api/pull`,
      { name: modelName, stream: true },
      { responseType: 'stream' }
    );

    let finalStatus = null;

    stream.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.length > 0);
      for (const line of lines) {
        try {
          const progress = JSON.parse(line);
          onProgress(progress);
          if (progress.status === 'success') {
            finalStatus = progress;
          }
        } catch (e) {
          console.warn('Could not parse Ollama progress line:', line);
        }
      }
    });

    return new Promise((resolve, reject) => {
      stream.data.on('end', () => {
        if (finalStatus) {
          console.log(`Successfully pulled model ${modelName}`);
          resolve(finalStatus);
        } else {
          console.error(`Stream for ${modelName} ended without success status.`);
          reject(new Error('Pull stream ended without a success status.'));
        }
      });

      stream.data.on('error', (err) => {
        console.error(`Error pulling model ${modelName}:`, err);
        reject(err);
      });
    });
  }

  /**
   * Delete model from Ollama instance
   */
  async deleteModel(port, modelName) {
    try {
      const response = await axios.delete(`http://localhost:${port}/api/delete`, {
        data: { name: modelName },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting model from Ollama:', error);
      throw error;
    }
  }

  /**
   * Get model info from Ollama instance
   */
  async getModelInfo(port, modelName) {
    try {
      const response = await axios.post(`http://localhost:${port}/api/show`, {
        name: modelName
      }, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error getting model info from Ollama:', error);
      throw error;
    }
  }

  /**
   * Check if Ollama instance is healthy
   */
  async checkHealth(port) {
    try {
      const response = await axios.get(`http://localhost:${port}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new OllamaService(); 