const express = require('express');
const testService = require('../services/testService');

const router = express.Router();

// Test service health endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'test-service',
    timestamp: new Date().toISOString() 
  });
});

// Get all running instances available for testing
router.get('/instances', async (req, res) => {
  try {
    const instances = await testService.getRunningInstances();
    res.json(instances);
  } catch (error) {
    console.error('Error getting test instances:', error);
    res.status(500).json({ error: 'Failed to get running instances' });
  }
});

// Test instance health and get basic info
router.get('/instances/:id/health', async (req, res) => {
  try {
    const { id } = req.params;
    const healthCheck = await testService.testInstanceHealth(id);
    res.json(healthCheck);
  } catch (error) {
    console.error('Error testing instance health:', error);
    res.status(500).json({ error: 'Failed to test instance health' });
  }
});

// Detect instance capabilities
router.get('/instances/:id/capabilities', async (req, res) => {
  try {
    const { id } = req.params;
    const capabilities = await testService.detectCapabilities(id);
    res.json(capabilities);
  } catch (error) {
    console.error('Error detecting capabilities:', error);
    res.status(500).json({ error: 'Failed to detect capabilities' });
  }
});

// Chat completion endpoint
router.post('/instances/:id/chat', async (req, res) => {
  try {
    const { id } = req.params;
    const { messages, options = {}, instanceType, modelName } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    
    if (instanceType === 'ollama' && !modelName) {
      return res.status(400).json({ error: 'Ollama model name is required' });
    }

    const result = await testService.chatCompletion(id, instanceType, modelName, messages, options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.statusCode || 500).json(result);
    }
  } catch (error) {
    console.error('Error in chat completion:', error);
    res.status(500).json({ error: 'Failed to process chat completion' });
  }
});

// Text completion endpoint
router.post('/instances/:id/completion', async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await testService.textCompletion(id, prompt, options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.statusCode || 500).json(result);
    }
  } catch (error) {
    console.error('Error in text completion:', error);
    res.status(500).json({ error: 'Failed to process text completion' });
  }
});

// Embeddings endpoint
router.post('/instances/:id/embeddings', async (req, res) => {
  try {
    const { id } = req.params;
    const { input, options = {} } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const result = await testService.getEmbeddings(id, input, options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.statusCode || 500).json(result);
    }
  } catch (error) {
    console.error('Error getting embeddings:', error);
    res.status(500).json({ error: 'Failed to get embeddings' });
  }
});

// Image generation endpoint
router.post('/instances/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await testService.imageGeneration(id, prompt, options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.statusCode || 500).json(result);
    }
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// Get test presets
router.get('/presets', async (req, res) => {
  try {
    const presets = await testService.getTestPresets();
    res.json(presets);
  } catch (error) {
    console.error('Error getting test presets:', error);
    res.status(500).json({ error: 'Failed to get test presets' });
  }
});

// Batch test multiple instances
router.post('/batch-test', async (req, res) => {
  try {
    const { instanceIds, testType = 'health' } = req.body;

    if (!instanceIds || !Array.isArray(instanceIds)) {
      return res.status(400).json({ error: 'Instance IDs array is required' });
    }

    const results = [];

    for (const instanceId of instanceIds) {
      try {
        let result;
        
        switch (testType) {
          case 'health':
            result = await testService.testInstanceHealth(instanceId);
            break;
          case 'capabilities':
            result = await testService.detectCapabilities(instanceId);
            break;
          default:
            result = { error: 'Unknown test type' };
        }

        results.push({
          instanceId,
          result
        });
      } catch (error) {
        results.push({
          instanceId,
          result: { error: error.message }
        });
      }
    }

    res.json({
      testType,
      results,
      summary: {
        total: instanceIds.length,
        successful: results.filter(r => !r.result.error).length,
        failed: results.filter(r => r.result.error).length
      }
    });
  } catch (error) {
    console.error('Error in batch test:', error);
    res.status(500).json({ error: 'Failed to perform batch test' });
  }
});

// Quick test endpoint - performs a simple test on an instance
router.post('/instances/:id/quick-test', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check health
    const healthCheck = await testService.testInstanceHealth(id);
    if (!healthCheck.healthy) {
      return res.json({
        success: false,
        error: 'Instance is not healthy',
        details: healthCheck
      });
    }

    // Try a simple chat completion
    const testMessages = [
      { role: 'user', content: 'Say "Hello, I am working correctly!" if you can read this.' }
    ];

    const chatResult = await testService.chatCompletion(id, testMessages, {
      maxTokens: 50,
      temperature: 0.7
    });

    if (chatResult.success) {
      res.json({
        success: true,
        message: 'Instance is working correctly',
        response: chatResult.response.choices[0]?.message?.content || 'No response content',
        instance: chatResult.instance,
        health: healthCheck
      });
    } else {
      res.json({
        success: false,
        error: 'Chat test failed',
        details: chatResult,
        health: healthCheck
      });
    }
  } catch (error) {
    console.error('Error in quick test:', error);
    res.status(500).json({ error: 'Failed to perform quick test' });
  }
});

module.exports = router; 