const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/init');
const portService = require('./portService');

const docker = new Docker();

class OrphanService {
  constructor() {
    this.docker = docker;
  }

  /**
   * Detect orphaned vLLM containers that exist in Docker but not in database
   * @returns {Promise<Array>} Array of orphaned container info
   */
  async detectOrphanedContainers() {
    try {
      // Get all vLLM containers from Docker
      const dockerContainers = await this.docker.listContainers({ all: true });
      const vllmContainers = dockerContainers.filter(container => 
        container.Names.some(name => name.startsWith('/vllm-'))
      );

      // Get all containers tracked in database
      const db = getDatabase();
      const dbContainers = await new Promise((resolve, reject) => {
        db.all('SELECT container_id FROM instances WHERE container_id IS NOT NULL', (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.container_id));
        });
      });
      db.close();

      // Find orphaned containers
      const orphanedContainers = [];
      
      for (const container of vllmContainers) {
        // Check if container ID is not in database
        if (!dbContainers.includes(container.Id)) {
          // Parse container name to extract information
          const containerName = container.Names[0].substring(1); // Remove leading '/'
          const parsedInfo = this.parseContainerName(containerName);
          
          if (parsedInfo) {
            // Get container details
            const containerInfo = await this.docker.getContainer(container.Id).inspect();
            
            orphanedContainers.push({
              dockerId: container.Id,
              name: containerName,
              parsedName: parsedInfo.instanceName,
              uuid: parsedInfo.uuid,
              status: container.State,
              created: container.Created,
              ports: container.Ports,
              image: container.Image,
              command: containerInfo.Config.Cmd,
              env: containerInfo.Config.Env,
              hostConfig: containerInfo.HostConfig
            });
          }
        }
      }

      return orphanedContainers;
    } catch (error) {
      console.error('Error detecting orphaned containers:', error);
      throw error;
    }
  }

  /**
   * Parse container name to extract instance information
   * Expected format: vllm-{instanceName}-{uuid}
   * @param {string} containerName 
   * @returns {Object|null} Parsed information or null if invalid format
   */
  parseContainerName(containerName) {
    // Match pattern: vllm-{instanceName}-{uuid}
    const match = containerName.match(/^vllm-(.+)-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/);
    
    if (match) {
      return {
        instanceName: match[1],
        uuid: match[2]
      };
    }
    
    return null;
  }

  /**
   * Extract model name from container command or environment
   * @param {Object} containerInfo - Container inspection data
   * @returns {string} Model name or 'unknown'
   */
  extractModelName(containerInfo) {
    // Try to find model name in command arguments
    if (containerInfo.command && Array.isArray(containerInfo.command)) {
      const modelIndex = containerInfo.command.findIndex(arg => arg === '--model');
      if (modelIndex !== -1 && modelIndex + 1 < containerInfo.command.length) {
        return containerInfo.command[modelIndex + 1];
      }
    }
    
    // Try to find in environment variables
    if (containerInfo.env) {
      const modelEnv = containerInfo.env.find(env => env.startsWith('MODEL_NAME='));
      if (modelEnv) {
        return modelEnv.split('=')[1];
      }
    }
    
    return 'unknown';
  }

  /**
   * Extract port from container configuration
   * @param {Object} containerInfo - Container inspection data
   * @returns {number} Port number or null
   */
  extractPort(containerInfo) {
    if (containerInfo.ports && containerInfo.ports.length > 0) {
      const port = containerInfo.ports.find(p => p.PrivatePort === 8000);
      return port ? port.PublicPort : null;
    }
    
    // Try to extract from HostConfig
    if (containerInfo.hostConfig && containerInfo.hostConfig.PortBindings) {
      const portBinding = containerInfo.hostConfig.PortBindings['8000/tcp'];
      if (portBinding && portBinding.length > 0) {
        return parseInt(portBinding[0].HostPort);
      }
    }
    
    return null;
  }

  /**
   * Extract GPU ID from container configuration
   * @param {Object} containerInfo - Container inspection data
   * @returns {string} GPU ID or 'unknown'
   */
  extractGpuId(containerInfo) {
    // Check for GPU device requests
    if (containerInfo.hostConfig && containerInfo.hostConfig.DeviceRequests) {
      const gpuRequest = containerInfo.hostConfig.DeviceRequests.find(req => 
        req.Driver === 'nvidia' && req.DeviceIDs && req.DeviceIDs.length > 0
      );
      if (gpuRequest) {
        return gpuRequest.DeviceIDs[0];
      }
    }
    
    // Check environment variables for GPU info
    if (containerInfo.env) {
      const gpuEnv = containerInfo.env.find(env => env.startsWith('NVIDIA_VISIBLE_DEVICES='));
      if (gpuEnv) {
        const gpuValue = gpuEnv.split('=')[1];
        return gpuValue === 'all' ? 'auto' : gpuValue;
      }
    }
    
    return 'unknown';
  }

  /**
   * Clean up stale port allocations where the instance no longer exists
   * @returns {Promise<Array>} Array of cleaned up ports
   */
  async cleanupStalePortAllocations() {
    const db = getDatabase();
    const cleanedPorts = [];
    
    try {
      // Get all allocated ports
      const allocatedPorts = await new Promise((resolve, reject) => {
        db.all('SELECT port, instance_id FROM allocated_ports', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Get all existing instance IDs
      const existingInstances = await new Promise((resolve, reject) => {
        db.all('SELECT id FROM instances', (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.id));
        });
      });
      
      // Find stale allocations
      const staleAllocations = allocatedPorts.filter(allocation => 
        !existingInstances.includes(allocation.instance_id)
      );
      
      // Clean up stale allocations
      for (const allocation of staleAllocations) {
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM allocated_ports WHERE port = ? AND instance_id = ?', 
            [allocation.port, allocation.instance_id], 
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        cleanedPorts.push({
          port: allocation.port,
          staleInstanceId: allocation.instance_id
        });
        
        console.log(`Cleaned up stale port allocation: port ${allocation.port} from deleted instance ${allocation.instance_id}`);
      }
      
      return cleanedPorts;
    } finally {
      db.close();
    }
  }

  /**
   * Import orphaned containers back into the database
   * @param {Array} orphanedContainers - Array of orphaned container info
   * @returns {Promise<Object>} Import results
   */
  async importOrphanedContainers(orphanedContainers) {
    const results = {
      imported: [],
      failed: [],
      skipped: [],
      portsCleaned: []
    };

    // First, clean up stale port allocations
    const cleanedPorts = await this.cleanupStalePortAllocations();
    results.portsCleaned = cleanedPorts;

    const db = getDatabase();

    for (const container of orphanedContainers) {
      try {
        // Extract container details
        const modelName = this.extractModelName(container);
        const port = this.extractPort(container);
        const gpuId = this.extractGpuId(container);
        
        // Skip if we can't determine essential information
        if (!port) {
          results.skipped.push({
            container: container.name,
            reason: 'Could not determine port'
          });
          continue;
        }

        // Check if port is still allocated after cleanup
        const existingPort = await new Promise((resolve, reject) => {
          db.get('SELECT instance_id FROM allocated_ports WHERE port = ?', [port], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (existingPort) {
          results.skipped.push({
            container: container.name,
            reason: `Port ${port} still allocated to instance ${existingPort.instance_id}`
          });
          continue;
        }

        // Get current container status
        const dockerContainer = this.docker.getContainer(container.dockerId);
        const containerStatus = await dockerContainer.inspect();
        const status = containerStatus.State.Running ? 'running' : 'stopped';

        // Create config object
        const config = JSON.stringify({
          modelName,
          port,
          gpuId,
          imported: true,
          originalContainer: container.name,
          importedAt: new Date().toISOString()
        });

        // Insert into database
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO instances (id, name, model_name, port, container_id, status, config, gpu_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              container.uuid,
              container.parsedName,
              modelName,
              port,
              container.dockerId,
              status,
              config,
              gpuId,
              new Date(container.created * 1000).toISOString()
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Allocate port in port service
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO allocated_ports (port, instance_id) VALUES (?, ?)',
            [port, container.uuid],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        results.imported.push({
          id: container.uuid,
          name: container.parsedName,
          modelName,
          port,
          status,
          containerName: container.name
        });

        console.log(`Imported orphaned container: ${container.name} -> ${container.parsedName}`);

      } catch (error) {
        console.error(`Failed to import container ${container.name}:`, error);
        results.failed.push({
          container: container.name,
          error: error.message
        });
      }
    }

    db.close();
    return results;
  }

  /**
   * Check for orphaned containers and optionally import them
   * @param {boolean} autoImport - Whether to automatically import orphaned containers
   * @returns {Promise<Object>} Detection and import results
   */
  async checkAndImportOrphans(autoImport = false) {
    try {
      const orphanedContainers = await this.detectOrphanedContainers();
      
      if (orphanedContainers.length === 0) {
        return {
          orphansDetected: 0,
          imported: null,
          message: 'No orphaned containers found'
        };
      }

      console.log(`Found ${orphanedContainers.length} orphaned containers:`, 
        orphanedContainers.map(c => c.name));

      let importResults = null;
      if (autoImport) {
        importResults = await this.importOrphanedContainers(orphanedContainers);
      }

      return {
        orphansDetected: orphanedContainers.length,
        orphans: orphanedContainers.map(c => ({
          dockerId: c.dockerId,
          name: c.name,
          parsedName: c.parsedName,
          uuid: c.uuid,
          status: c.status,
          ports: c.ports
        })),
        imported: importResults,
        message: autoImport 
          ? `Found and processed ${orphanedContainers.length} orphaned containers`
          : `Found ${orphanedContainers.length} orphaned containers (use autoImport=true to import them)`
      };
    } catch (error) {
      console.error('Error in checkAndImportOrphans:', error);
      throw error;
    }
  }
}

module.exports = new OrphanService(); 