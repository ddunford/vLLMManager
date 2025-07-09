const { exec } = require('child_process');
const { promisify } = require('util');
const { getDatabase } = require('../database/init');

const execAsync = promisify(exec);

class GPUService {
  constructor() {
    this.gpuInfo = null;
    this.initialized = false;
  }

  async initializeGPUDetection() {
    if (this.initialized) {
      return this.gpuInfo;
    }

    try {
      this.gpuInfo = await this.detectGPUs();
      this.initialized = true;
      console.log('GPU Detection Result:', this.gpuInfo);
      return this.gpuInfo;
    } catch (error) {
      console.log('GPU detection failed, falling back to CPU mode:', error.message);
      this.gpuInfo = { hasGPU: false, type: 'cpu', gpus: [], dockerSupport: false };
      this.initialized = true;
      return this.gpuInfo;
    }
  }

  async detectGPUs() {
    try {
      // Try to get detailed GPU information using nvidia-smi
      const gpuDetails = await this.getNvidiaGPUDetails();
      
      if (gpuDetails.length > 0) {
        console.log(`Detected ${gpuDetails.length} NVIDIA GPU(s)`);
        return {
          hasGPU: true,
          type: 'nvidia',
          gpus: gpuDetails,
          dockerSupport: true
        };
      }

      // Fallback to basic Docker detection
      const Docker = require('dockerode');
      const docker = new Docker();
      const info = await docker.info();
      
      if (info.Runtimes && (info.Runtimes.nvidia || Object.keys(info.Runtimes).some(r => r.includes('nvidia')))) {
        console.log('NVIDIA runtime detected in Docker (basic detection)');
        return {
          hasGPU: true,
          type: 'nvidia',
          gpus: [{ 
            id: 'auto',
            name: 'NVIDIA GPU(s) - Auto Select',
            memoryTotal: 'Unknown',
            memoryUsed: 'Unknown',
            memoryFree: 'Unknown',
            utilization: 'Unknown',
            temperature: 'Unknown',
            available: true
          }],
          dockerSupport: true
        };
      }

      console.log('No GPU support detected, using CPU mode');
      return { hasGPU: false, type: 'cpu', gpus: [], dockerSupport: false };
    } catch (error) {
      console.log('GPU detection error:', error.message);
      return { hasGPU: false, type: 'cpu', gpus: [], dockerSupport: false };
    }
  }

  async getNvidiaGPUDetails() {
    try {
      // Use nvidia-smi to get detailed GPU information
      const { stdout } = await execAsync('nvidia-smi --query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu --format=csv,noheader,nounits');
      
      const gpus = stdout.trim().split('\n').map(line => {
        const parts = line.split(',').map(part => part.trim());
        return {
          id: parts[0],
          name: parts[1],
          memoryTotal: parseInt(parts[2]),
          memoryUsed: parseInt(parts[3]),
          memoryFree: parseInt(parts[4]),
          utilization: parseInt(parts[5]),
          temperature: parseInt(parts[6]),
          available: true
        };
      });

      return gpus;
    } catch (error) {
      console.log('nvidia-smi not available or failed:', error.message);
      return [];
    }
  }

  async getGPUInfo() {
    if (!this.initialized) {
      await this.initializeGPUDetection();
    }
    return this.gpuInfo;
  }

  async refreshGPUInfo() {
    this.initialized = false;
    return await this.initializeGPUDetection();
  }

  async getAvailableGPUs() {
    const info = await this.getGPUInfo();
    if (!info.hasGPU) {
      return [];
    }

    // Get current GPU usage from database
    const gpuUsage = await this.getGPUUsage();
    
    // Mark GPUs as available/unavailable based on usage
    return info.gpus.map(gpu => ({
      ...gpu,
      inUse: gpuUsage[gpu.id] ? gpuUsage[gpu.id].instances : 0,
      available: !gpuUsage[gpu.id] || gpuUsage[gpu.id].instances === 0
    }));
  }

  async getGPUUsage() {
    try {
      const db = getDatabase();
      const vllmUsagePromise = new Promise((resolve, reject) => {
        db.all(
          'SELECT gpu_id, COUNT(*) as instances FROM instances WHERE status = ? AND gpu_id IS NOT NULL GROUP BY gpu_id',
          ['running'],
          (err, rows) => {
            if (err) return reject(err);
            const usage = {};
            rows.forEach(row => {
              usage[row.gpu_id] = { instances: row.instances };
            });
            resolve(usage);
          }
        );
      });

      const ollamaUsagePromise = new Promise((resolve, reject) => {
        db.all(
          'SELECT config, COUNT(*) as instances FROM ollama_instances WHERE status = ? GROUP BY config',
          ['running'],
          (err, rows) => {
            if (err) return reject(err);
            const usage = {};
            rows.forEach(row => {
              try {
                const config = JSON.parse(row.config);
                const gpuId = config.gpuId || 'auto'; // Default to auto if not specified
                if (!usage[gpuId]) {
                  usage[gpuId] = { instances: 0 };
                }
                usage[gpuId].instances += row.instances;
              } catch (e) {
                console.warn('Could not parse Ollama config for GPU usage:', e);
              }
            });
            resolve(usage);
          }
        );
      });

      const [vllmUsage, ollamaUsage] = await Promise.all([vllmUsagePromise, ollamaUsagePromise]);

      // Merge the usage data
      const combinedUsage = { ...vllmUsage };
      for (const gpuId in ollamaUsage) {
        if (combinedUsage[gpuId]) {
          combinedUsage[gpuId].instances += ollamaUsage[gpuId].instances;
        } else {
          combinedUsage[gpuId] = ollamaUsage[gpuId];
        }
      }
      
      db.close();
      return combinedUsage;
    } catch (error) {
      console.error('Error getting GPU usage:', error);
      return {};
    }
  }

  async selectOptimalGPU(preferredGPU = 'auto') {
    const gpuInfo = await this.getGPUInfo();
    
    if (!gpuInfo.hasGPU || preferredGPU === 'cpu') {
      return null;
    }

    // If user specified a particular GPU, use it
    if (preferredGPU !== 'auto') {
      const selectedGPU = gpuInfo.gpus.find(gpu => gpu.id === preferredGPU);
      if (selectedGPU) {
        return selectedGPU;
      }
    }

    // Auto-select GPU with load balancing
    const availableGPUs = await this.getAvailableGPUs();
    
    if (availableGPUs.length === 0) {
      return null;
    }

    // Sort by usage (ascending) and memory free (descending) for load balancing
    availableGPUs.sort((a, b) => {
      if (a.inUse !== b.inUse) {
        return a.inUse - b.inUse;
      }
      // If usage is the same, prefer GPU with more free memory
      if (a.memoryFree !== 'Unknown' && b.memoryFree !== 'Unknown') {
        return b.memoryFree - a.memoryFree;
      }
      return 0;
    });

    return availableGPUs[0];
  }

  getDeviceConfigForGPU(selectedGPU) {
    const gpuInfo = this.gpuInfo;
    
    if (!gpuInfo || !gpuInfo.hasGPU || !selectedGPU) {
      return {
        hostConfig: {},
        environment: ['VLLM_LOGGING_LEVEL=INFO'],
        deviceInfo: 'CPU-only mode',
        gpuId: null
      };
    }

    if (gpuInfo.type === 'nvidia') {
      // Configure GPU device requests for NVIDIA
      let deviceRequests;
      let visibleDevices;
      
      if (selectedGPU.id === 'auto') {
        // Use all available GPUs
        deviceRequests = [{
          Driver: 'nvidia',
          Count: -1,
          Capabilities: [['gpu']]
        }];
        visibleDevices = 'all';
      } else {
        // Use specific GPU
        deviceRequests = [{
          Driver: 'nvidia',
          DeviceIDs: [selectedGPU.id],
          Capabilities: [['gpu']]
        }];
        visibleDevices = selectedGPU.id;
      }

      return {
        hostConfig: {
          Runtime: 'nvidia',
          DeviceRequests: deviceRequests,
          IpcMode: 'host',
          ShmSize: 1073741824 // 1GB shared memory
        },
        environment: [
          `NVIDIA_VISIBLE_DEVICES=${visibleDevices}`,
          'NVIDIA_DRIVER_CAPABILITIES=compute,utility',
          'VLLM_LOGGING_LEVEL=INFO'
        ],
        deviceInfo: selectedGPU.id === 'auto' 
          ? `NVIDIA GPU mode (Auto-select)` 
          : `NVIDIA GPU mode (GPU ${selectedGPU.id}: ${selectedGPU.name})`,
        gpuId: selectedGPU.id
      };
    }

    return {
      hostConfig: {},
      environment: ['VLLM_LOGGING_LEVEL=INFO'],
      deviceInfo: 'CPU-only mode (GPU detected but not supported)',
      gpuId: null
    };
  }

  async trackGPUUsage(instanceId, gpuId) {
    if (!gpuId) return;

    try {
      const db = getDatabase();
      
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE instances SET gpu_id = ? WHERE id = ?',
          [gpuId, instanceId],
          function(err) {
            db.close();
            if (err) {
              reject(err);
              return;
            }
            resolve();
          }
        );
      });
    } catch (error) {
      console.error('Error tracking GPU usage:', error);
    }
  }

  async getGPUStatistics() {
    const gpuInfo = await this.getGPUInfo();
    const usage = await this.getGPUUsage();
    
    if (!gpuInfo.hasGPU) {
      return {
        totalGPUs: 0,
        availableGPUs: 0,
        gpuDetails: [],
        cpuMode: true
      };
    }

    const gpuDetails = gpuInfo.gpus.map(gpu => ({
      ...gpu,
      instanceCount: usage[gpu.id] ? usage[gpu.id].instances : 0,
      status: usage[gpu.id] && usage[gpu.id].instances > 0 ? 'busy' : 'available'
    }));

    return {
      totalGPUs: gpuInfo.gpus.length,
      availableGPUs: gpuDetails.filter(gpu => gpu.status === 'available').length,
      gpuDetails,
      cpuMode: false
    };
  }
}

module.exports = new GPUService(); 