const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dockerService = require('../services/dockerService');
const portService = require('../services/portService');
const settingsService = require('../services/settingsService');
const orphanService = require('../services/orphanService');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Get all instances
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    
    db.all('SELECT * FROM instances ORDER BY created_at DESC', async (err, rows) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Update container status for each instance
      const instances = await Promise.all(rows.map(async (instance) => {
        if (instance.container_id) {
          try {
            const containerStatus = await dockerService.getContainerStatus(instance.container_id);
            return {
              ...instance,
              status: containerStatus.status,
              running: containerStatus.running,
              startedAt: containerStatus.startedAt,
              finishedAt: containerStatus.finishedAt
            };
          } catch (error) {
            return {
              ...instance,
              status: 'error',
              running: false
            };
          }
        }
        return instance;
      }));
      
      db.close();
      res.json(instances);
    });
  } catch (error) {
    console.error('Error fetching instances:', error);
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

// Check for orphaned containers
router.get('/orphans', async (req, res) => {
  try {
    const autoImport = req.query.autoImport === 'true';
    const results = await orphanService.checkAndImportOrphans(autoImport);
    res.json(results);
  } catch (error) {
    console.error('Error checking orphaned containers:', error);
    res.status(500).json({ error: 'Failed to check orphaned containers: ' + error.message });
  }
});

// Import specific orphaned containers
router.post('/orphans/import', async (req, res) => {
  try {
    const { containerIds } = req.body;
    
    if (!Array.isArray(containerIds)) {
      return res.status(400).json({ error: 'containerIds must be an array' });
    }
    
    // Get all orphaned containers
    const orphanedContainers = await orphanService.detectOrphanedContainers();
    
    // Filter to only requested containers
    const containersToImport = orphanedContainers.filter(container => 
      containerIds.includes(container.dockerId)
    );
    
    if (containersToImport.length === 0) {
      return res.status(404).json({ error: 'No matching orphaned containers found' });
    }
    
    const results = await orphanService.importOrphanedContainers(containersToImport);
    res.json(results);
  } catch (error) {
    console.error('Error importing orphaned containers:', error);
    res.status(500).json({ error: 'Failed to import orphaned containers: ' + error.message });
  }
});

// Get all instances with orphan detection
router.get('/with-orphan-check', async (req, res) => {
  try {
    // First, check for orphaned containers and auto-import them
    const orphanResults = await orphanService.checkAndImportOrphans(true);
    
    // Then get all instances
    const db = getDatabase();
    
    db.all('SELECT * FROM instances ORDER BY created_at DESC', async (err, rows) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Update container status for each instance
      const instances = await Promise.all(rows.map(async (instance) => {
        if (instance.container_id) {
          try {
            const containerStatus = await dockerService.getContainerStatus(instance.container_id);
            return {
              ...instance,
              status: containerStatus.status,
              running: containerStatus.running,
              startedAt: containerStatus.startedAt,
              finishedAt: containerStatus.finishedAt
            };
          } catch (error) {
            return {
              ...instance,
              status: 'error',
              running: false
            };
          }
        }
        return instance;
      }));
      
      db.close();
      res.json({
        instances,
        orphanInfo: orphanResults
      });
    });
  } catch (error) {
    console.error('Error fetching instances with orphan check:', error);
    res.status(500).json({ error: 'Failed to fetch instances with orphan check' });
  }
});

// Create new instance
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      modelName, 
      apiKey, 
      requireAuth = true,  // New parameter
      hostname, 
      gpuSelection,
      // Advanced configuration options
      maxContextLength,
      gpuMemoryUtilization,
      maxNumSeqs,
      trustRemoteCode,
      quantization,
      tensorParallelSize
    } = req.body;
    
    if (!name || !modelName) {
      return res.status(400).json({ error: 'Name and model name are required' });
    }
    
    // Get default settings and merge with provided values
    const defaults = await settingsService.getInstanceDefaults();
    const effectiveHfToken = defaults.hfToken; // HuggingFace token for model access
    const effectiveHostname = hostname || defaults.hostname;
    const effectiveGPUSelection = gpuSelection || defaults.gpuSelection;
    
    // Handle API key - ensure OpenAI compatibility with sk- prefix
    let effectiveApiKey = null;
    if (requireAuth) {
      if (apiKey) {
        // If user provided a key, use it (add sk- prefix if not present)
        effectiveApiKey = apiKey.startsWith('sk-') ? apiKey : `sk-${apiKey}`;
      } else if (defaults.apiKey) {
        // Use default if available
        effectiveApiKey = defaults.apiKey.startsWith('sk-') ? defaults.apiKey : `sk-${defaults.apiKey}`;
      } else {
        // Generate a default key for local testing
        effectiveApiKey = `sk-localtest-${Date.now()}`;
      }
    }
    // If requireAuth is false, effectiveApiKey remains null
    
    const instanceId = uuidv4();
    const port = await portService.allocatePort(instanceId);
    
    const instanceConfig = {
      id: instanceId,
      name,
      modelName,
      port,
      apiKey: effectiveApiKey,
      requireAuth,
      hfToken: effectiveHfToken,
      gpuSelection: effectiveGPUSelection,
      // Pass through advanced configuration
      maxContextLength: maxContextLength || null,
      gpuMemoryUtilization: gpuMemoryUtilization || 0.85,
      maxNumSeqs: maxNumSeqs || 256,
      trustRemoteCode: trustRemoteCode || false,
      quantization: quantization || null,
      tensorParallelSize: tensorParallelSize || 1
    };
    
    // Create container
    const containerResult = await dockerService.createVLLMContainer(instanceConfig);
    
    // Save to database with advanced config
    const db = getDatabase();
    const config = JSON.stringify({
      modelName,
      apiKey: effectiveApiKey ? '***' : null,
      requireAuth,
      hfToken: effectiveHfToken ? '***' : null,
      hostname: effectiveHostname,
      port,
      deviceInfo: containerResult.deviceInfo,
      gpuId: containerResult.gpuId,
      gpuSelection: effectiveGPUSelection,
      // Store advanced configuration
      advancedConfig: {
        maxContextLength: maxContextLength || null,
        gpuMemoryUtilization: gpuMemoryUtilization || 0.85,
        maxNumSeqs: maxNumSeqs || 256,
        trustRemoteCode: trustRemoteCode || false,
        quantization: quantization || null,
        tensorParallelSize: tensorParallelSize || 1
      }
    });
    
    db.run(
      'INSERT INTO instances (id, name, model_name, port, container_id, status, config, api_key, gpu_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [instanceId, name, modelName, port, containerResult.containerId, 'running', config, effectiveApiKey, containerResult.gpuId],
      function(err) {
        db.close();
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to save instance' });
        }
        
        res.status(201).json({
          id: instanceId,
          name,
          modelName,
          port,
          containerId: containerResult.containerId,
          status: 'running',
          url: `http://${effectiveHostname}:${port}`,
          deviceInfo: containerResult.deviceInfo,
          gpuId: containerResult.gpuId,
          selectedGPU: containerResult.selectedGPU,
          requireAuth,
          apiKeyProvided: !!effectiveApiKey,
          advancedConfig: {
            maxContextLength: maxContextLength || null,
            gpuMemoryUtilization: gpuMemoryUtilization || 0.85,
            maxNumSeqs: maxNumSeqs || 256,
            trustRemoteCode: trustRemoteCode || false,
            quantization: quantization || null,
            tensorParallelSize: tensorParallelSize || 1
          },
          usingDefaults: {
            apiKey: !apiKey && requireAuth,
            hfToken: !effectiveHfToken,
            hostname: !hostname,
            gpuSelection: !gpuSelection
          },
          created: new Date().toISOString()
        });
      }
    );
  } catch (error) {
    console.error('Error creating instance:', error);
    res.status(500).json({ error: 'Failed to create instance: ' + error.message });
  }
});

// Stop instance
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      try {
        await dockerService.stopContainer(instance.container_id);
        
        db.run('UPDATE instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          ['stopped', id], function(err) {
            db.close();
            if (err) {
              return res.status(500).json({ error: 'Failed to update instance status' });
            }
            res.json({ status: 'stopped' });
          }
        );
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to stop container: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error stopping instance:', error);
    res.status(500).json({ error: 'Failed to stop instance' });
  }
});

// Start instance
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      try {
        await dockerService.startContainer(instance.container_id);
        
        db.run('UPDATE instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          ['running', id], function(err) {
            db.close();
            if (err) {
              return res.status(500).json({ error: 'Failed to update instance status' });
            }
            res.json({ status: 'running' });
          }
        );
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to start container: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error starting instance:', error);
    res.status(500).json({ error: 'Failed to start instance' });
  }
});

// Restart instance
router.post('/:id/restart', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      try {
        await dockerService.restartContainer(instance.container_id);
        
        db.run('UPDATE instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          ['running', id], function(err) {
            db.close();
            if (err) {
              return res.status(500).json({ error: 'Failed to update instance status' });
            }
            res.json({ status: 'running' });
          }
        );
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to restart container: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error restarting instance:', error);
    res.status(500).json({ error: 'Failed to restart instance' });
  }
});

// Update instance
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      modelName, 
      apiKey, 
      requireAuth,
      hostname, 
      gpuSelection,
      // Advanced configuration options
      maxContextLength,
      gpuMemoryUtilization,
      maxNumSeqs,
      trustRemoteCode,
      quantization,
      tensorParallelSize
    } = req.body;
    
    if (!name || !modelName) {
      return res.status(400).json({ error: 'Name and model name are required' });
    }
    
    const db = getDatabase();
    db.get('SELECT * FROM instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      try {
        // Get default settings and merge with provided values
        const defaults = await settingsService.getInstanceDefaults();
        const effectiveHfToken = defaults.hfToken;
        const effectiveHostname = hostname || defaults.hostname;
        const effectiveGPUSelection = gpuSelection || defaults.gpuSelection;
        
        // Handle API key - ensure OpenAI compatibility with sk- prefix
        let effectiveApiKey = null;
        if (requireAuth) {
          if (apiKey) {
            effectiveApiKey = apiKey.startsWith('sk-') ? apiKey : `sk-${apiKey}`;
          } else if (defaults.apiKey) {
            effectiveApiKey = defaults.apiKey.startsWith('sk-') ? defaults.apiKey : `sk-${defaults.apiKey}`;
          } else {
            effectiveApiKey = `sk-localtest-${Date.now()}`;
          }
        }
        
        // Stop and remove existing container
        if (instance.container_id) {
          try {
            await dockerService.stopContainer(instance.container_id);
            await dockerService.removeContainer(instance.container_id);
          } catch (error) {
            console.warn('Error stopping/removing old container:', error);
          }
        }
        
        // Create new instance configuration
        const instanceConfig = {
          id: instance.id,
          name,
          modelName,
          port: instance.port, // Keep the same port
          apiKey: effectiveApiKey,
          requireAuth,
          hfToken: effectiveHfToken,
          gpuSelection: effectiveGPUSelection,
          // Pass through advanced configuration
          maxContextLength: maxContextLength || null,
          gpuMemoryUtilization: gpuMemoryUtilization || 0.85,
          maxNumSeqs: maxNumSeqs || 256,
          trustRemoteCode: trustRemoteCode || false,
          quantization: quantization || null,
          tensorParallelSize: tensorParallelSize || 1
        };
        
        // Create new container
        const containerResult = await dockerService.createVLLMContainer(instanceConfig);
        
        // Update database with new configuration
        const config = JSON.stringify({
          modelName,
          apiKey: effectiveApiKey ? '***' : null,
          requireAuth,
          hfToken: effectiveHfToken ? '***' : null,
          hostname: effectiveHostname,
          port: instance.port,
          deviceInfo: containerResult.deviceInfo,
          gpuId: containerResult.gpuId,
          gpuSelection: effectiveGPUSelection,
          // Store advanced configuration
          advancedConfig: {
            maxContextLength: maxContextLength || null,
            gpuMemoryUtilization: gpuMemoryUtilization || 0.85,
            maxNumSeqs: maxNumSeqs || 256,
            trustRemoteCode: trustRemoteCode || false,
            quantization: quantization || null,
            tensorParallelSize: tensorParallelSize || 1
          }
        });
        
        db.run(
          'UPDATE instances SET name = ?, model_name = ?, container_id = ?, status = ?, config = ?, api_key = ?, gpu_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name, modelName, containerResult.containerId, 'running', config, effectiveApiKey, containerResult.gpuId, id],
          function(err) {
            db.close();
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update instance' });
            }
            
            res.json({
              id: instance.id,
              name,
              modelName,
              port: instance.port,
              containerId: containerResult.containerId,
              status: 'running',
              url: `http://${effectiveHostname}:${instance.port}`,
              deviceInfo: containerResult.deviceInfo,
              gpuId: containerResult.gpuId,
              selectedGPU: containerResult.selectedGPU,
              requireAuth,
              apiKeyProvided: !!effectiveApiKey,
              advancedConfig: {
                maxContextLength: maxContextLength || null,
                gpuMemoryUtilization: gpuMemoryUtilization || 0.85,
                maxNumSeqs: maxNumSeqs || 256,
                trustRemoteCode: trustRemoteCode || false,
                quantization: quantization || null,
                tensorParallelSize: tensorParallelSize || 1
              },
              usingDefaults: {
                apiKey: !apiKey && requireAuth,
                hfToken: !effectiveHfToken,
                hostname: !hostname,
                gpuSelection: !gpuSelection
              },
              updated: new Date().toISOString()
            });
          }
        );
      } catch (error) {
        db.close();
        console.error('Error updating instance:', error);
        res.status(500).json({ error: 'Failed to update instance: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error updating instance:', error);
    res.status(500).json({ error: 'Failed to update instance' });
  }
});

// Remove instance
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      try {
        // Remove container
        if (instance.container_id) {
          await dockerService.removeContainer(instance.container_id);
        }
        
        // Release port
        await portService.releasePort(instance.port);
        
        // Remove from database
        db.run('DELETE FROM instances WHERE id = ?', [id], function(err) {
          db.close();
          if (err) {
            return res.status(500).json({ error: 'Failed to remove instance from database' });
          }
          res.json({ status: 'removed' });
        });
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to remove instance: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error removing instance:', error);
    res.status(500).json({ error: 'Failed to remove instance' });
  }
});

// Get container logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { tail = 100 } = req.query;
    
    const db = getDatabase();
    db.get('SELECT container_id FROM instances WHERE id = ?', [id], async (err, instance) => {
      db.close();
      
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      try {
        const logs = await dockerService.getContainerLogs(instance.container_id, { tail: parseInt(tail) });
        res.json({ logs });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get logs: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

module.exports = router; 