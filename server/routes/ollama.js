const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ollamaService = require('../services/ollamaService');
const portService = require('../services/portService');
const settingsService = require('../services/settingsService');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Get all Ollama instances
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    
    db.all('SELECT * FROM ollama_instances ORDER BY created_at DESC', async (err, rows) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Update container status for each instance
      const instances = await Promise.all(rows.map(async (instance) => {
        if (instance.container_id) {
          try {
            const containerStatus = await ollamaService.getContainerStatus(instance.container_id);
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
    console.error('Error fetching Ollama instances:', error);
    res.status(500).json({ error: 'Failed to fetch Ollama instances' });
  }
});

// Create new Ollama instance
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      apiKey, 
      requireAuth = true,
      hostname, 
      gpuSelection
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Get default settings and merge with provided values
    const defaults = await settingsService.getInstanceDefaults();
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
    
    const instanceId = uuidv4();
    const port = await portService.allocatePort(instanceId);
    
    const instanceConfig = {
      id: instanceId,
      name,
      port,
      apiKey: effectiveApiKey,
      requireAuth,
      gpuSelection: effectiveGPUSelection
    };
    
    // Create or get existing Ollama container
    const containerResult = await ollamaService.createOrGetOllamaContainer(instanceConfig);
    
    // Save to database
    const db = getDatabase();
    const config = JSON.stringify({
      apiKey: effectiveApiKey ? '***' : null,
      requireAuth,
      hostname: effectiveHostname,
      port,
      deviceInfo: containerResult.deviceInfo,
      gpuId: containerResult.gpuId,
      gpuSelection: effectiveGPUSelection
    });
    
    db.run(
      'INSERT INTO ollama_instances (id, name, port, container_id, status, config, api_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [instanceId, name, port, containerResult.containerId, 'running', config, effectiveApiKey],
      function(err) {
        db.close();
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to save Ollama instance' });
        }
        
        res.status(201).json({
          id: instanceId,
          name,
          port,
          containerId: containerResult.containerId,
          status: 'running',
          url: `http://${effectiveHostname}:${port}`,
          deviceInfo: containerResult.deviceInfo,
          gpuId: containerResult.gpuId,
          selectedGPU: containerResult.selectedGPU,
          requireAuth,
          apiKeyProvided: !!effectiveApiKey,
          usingDefaults: {
            apiKey: !apiKey && requireAuth,
            hostname: !hostname,
            gpuSelection: !gpuSelection
          },
          created: new Date().toISOString()
        });
      }
    );
  } catch (error) {
    console.error('Error creating Ollama instance:', error);
    res.status(500).json({ error: 'Failed to create Ollama instance: ' + error.message });
  }
});

// Get Ollama instance details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      // Get container status
      let containerStatus = null;
      if (instance.container_id) {
        try {
          containerStatus = await ollamaService.getContainerStatus(instance.container_id);
        } catch (error) {
          console.warn('Could not get container status:', error);
        }
      }
      
      // Get models for this instance
      db.all('SELECT * FROM ollama_models WHERE instance_id = ? ORDER BY name', [id], async (err, models) => {
        db.close();
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          ...instance,
          status: containerStatus?.status || instance.status,
          running: containerStatus?.running || false,
          startedAt: containerStatus?.startedAt,
          finishedAt: containerStatus?.finishedAt,
          models: models || []
        });
      });
    });
  } catch (error) {
    console.error('Error fetching Ollama instance:', error);
    res.status(500).json({ error: 'Failed to fetch Ollama instance' });
  }
});

// Start Ollama instance
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        await ollamaService.startContainer(instance.container_id);
        
        db.run('UPDATE ollama_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          ['running', id], function(err) {
            db.close();
            if (err) {
              return res.status(500).json({ error: 'Failed to update Ollama instance status' });
            }
            res.json({ status: 'running' });
          }
        );
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to start Ollama container: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error starting Ollama instance:', error);
    res.status(500).json({ error: 'Failed to start Ollama instance' });
  }
});

// Stop Ollama instance
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        await ollamaService.stopContainer(instance.container_id);
        
        db.run('UPDATE ollama_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          ['stopped', id], function(err) {
            db.close();
            if (err) {
              return res.status(500).json({ error: 'Failed to update Ollama instance status' });
            }
            res.json({ status: 'stopped' });
          }
        );
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to stop Ollama container: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error stopping Ollama instance:', error);
    res.status(500).json({ error: 'Failed to stop Ollama instance' });
  }
});

// Restart Ollama instance
router.post('/:id/restart', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        await ollamaService.restartContainer(instance.container_id);
        
        db.run('UPDATE ollama_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          ['running', id], function(err) {
            db.close();
            if (err) {
              return res.status(500).json({ error: 'Failed to update Ollama instance status' });
            }
            res.json({ status: 'running' });
          }
        );
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to restart Ollama container: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error restarting Ollama instance:', error);
    res.status(500).json({ error: 'Failed to restart Ollama instance' });
  }
});

// Remove Ollama instance
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        // Remove container
        if (instance.container_id) {
          await ollamaService.removeContainer(instance.container_id);
        }
        
        // Release port
        await portService.releasePort(instance.port);
        
        // Remove from database
        db.run('DELETE FROM ollama_instances WHERE id = ?', [id], function(err) {
          db.close();
          if (err) {
            return res.status(500).json({ error: 'Failed to remove Ollama instance from database' });
          }
          res.json({ status: 'removed' });
        });
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to remove Ollama instance: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error removing Ollama instance:', error);
    res.status(500).json({ error: 'Failed to remove Ollama instance' });
  }
});

// Get Ollama instance logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { tail = 100 } = req.query;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      db.close();
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        const logs = await ollamaService.getContainerLogs(instance.container_id, parseInt(tail));
        res.json({ logs });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get logs: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error getting Ollama instance logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Get models from Ollama instance
router.get('/:id/models', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      db.close();
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        const models = await ollamaService.getModels(instance.port);
        res.json({ models });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get models: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error getting Ollama models:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

// Pull model to Ollama instance
router.post('/:id/models', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelName } = req.body;
    
    if (!modelName) {
      return res.status(400).json({ error: 'Model name is required' });
    }
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        // Add model to database with downloading status
        const modelId = uuidv4();
        db.run(
          'INSERT INTO ollama_models (id, instance_id, name, status) VALUES (?, ?, ?, ?)',
          [modelId, id, modelName, 'downloading'],
          async function(err) {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Failed to save model to database' });
            }
            
            try {
              // Pull model from Ollama
              const result = await ollamaService.pullModel(instance.port, modelName);
              
              // Update model status in database
              db.run(
                'UPDATE ollama_models SET status = ?, size = ?, modified_at = ?, digest = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['ready', result.size, result.modified_at, result.digest, modelId],
                function(err) {
                  db.close();
                  if (err) {
                    console.error('Error updating model status:', err);
                  }
                  res.json({ 
                    message: 'Model pulled successfully',
                    model: {
                      id: modelId,
                      name: modelName,
                      status: 'ready',
                      size: result.size,
                      modified_at: result.modified_at,
                      digest: result.digest
                    }
                  });
                }
              );
            } catch (error) {
              // Update model status to failed
              db.run(
                'UPDATE ollama_models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['failed', modelId],
                function(err) {
                  db.close();
                  if (err) {
                    console.error('Error updating model status:', err);
                  }
                  res.status(500).json({ error: 'Failed to pull model: ' + error.message });
                }
              );
            }
          }
        );
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to pull model: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error pulling Ollama model:', error);
    res.status(500).json({ error: 'Failed to pull model' });
  }
});

// Delete model from Ollama instance
router.delete('/:id/models/:modelName', async (req, res) => {
  try {
    const { id, modelName } = req.params;
    
    const db = getDatabase();
    db.get('SELECT * FROM ollama_instances WHERE id = ?', [id], async (err, instance) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!instance) {
        db.close();
        return res.status(404).json({ error: 'Ollama instance not found' });
      }
      
      try {
        // Delete model from Ollama
        await ollamaService.deleteModel(instance.port, modelName);
        
        // Remove model from database
        db.run('DELETE FROM ollama_models WHERE instance_id = ? AND name = ?', [id, modelName], function(err) {
          db.close();
          if (err) {
            return res.status(500).json({ error: 'Failed to remove model from database' });
          }
          res.json({ message: 'Model deleted successfully' });
        });
      } catch (error) {
        db.close();
        res.status(500).json({ error: 'Failed to delete model: ' + error.message });
      }
    });
  } catch (error) {
    console.error('Error deleting Ollama model:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

module.exports = router; 