const express = require('express');
const axios = require('axios');
const settingsService = require('../services/settingsService');
const modelService = require('../services/modelService');

const router = express.Router();

// Test route to verify routing works
router.get('/test', (req, res) => {
  console.log('=== TEST ROUTE HIT ===');
  res.json({ message: 'Test route working', timestamp: new Date().toISOString() });
});

// Get model configuration and recommended parameters
router.get('/:modelId/config', async (req, res) => {
  try {
    const { modelId } = req.params;
    const decodedModelId = decodeURIComponent(modelId);
    
    console.log('Getting configuration for model:', decodedModelId);
    
    const result = await modelService.getRecommendedParams(decodedModelId);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting model configuration:', error);
    res.status(500).json({
      error: 'Failed to get model configuration',
      details: error.message,
      modelConfig: { name: req.params.modelId, error: error.message },
      recommendations: {
        maxModelLen: null,
        gpuMemoryUtilization: 0.85,
        maxNumSeqs: 256,
        trustRemoteCode: false
      }
    });
  }
});

// Helper function to get HuggingFace headers with authentication
async function getHfHeaders() {
  const headers = {
    'User-Agent': 'vLLM-Manager/1.0.0'
  };
  
  try {
    const hfToken = await settingsService.getSetting('default_hf_token', '');
    if (hfToken && hfToken.trim() !== '') {
      headers['Authorization'] = `Bearer ${hfToken}`;
    }
  } catch (error) {
    console.warn('Could not retrieve HF token from settings:', error.message);
  }
  
  return headers;
}

// Search HuggingFace models
router.get('/search', async (req, res) => {
  try {
    const { query, limit = 20, filter = 'text-generation' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const searchUrl = 'https://huggingface.co/api/models';
    const params = {
      search: query,
      limit: parseInt(limit),
      filter: filter,
      sort: 'downloads',
      direction: -1
    };
    
    const headers = await getHfHeaders();
    console.log('Search: Making request to:', searchUrl, 'with params:', params);
    const response = await axios.get(searchUrl, {
      params,
      headers
    });
    console.log('Search: Response received, status:', response.status);
    
    // Process and format the results
    const models = response.data.map(model => ({
      id: model.id,
      name: model.id,
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      tags: model.tags || [],
      pipeline_tag: model.pipeline_tag,
      library_name: model.library_name,
      created_at: model.created_at,
      updated_at: model.updated_at,
      private: model.private || false,
      gated: model.gated || false,
      description: model.description || '',
      author: model.author || model.id.split('/')[0]
    }));
    
    res.json({
      models,
      total: models.length,
      query,
      filter
    });
  } catch (error) {
    console.error('Error searching models:', error);
    res.status(500).json({ 
      error: 'Failed to search models',
      details: error.response?.data || error.message 
    });
  }
});

// Get popular models (most downloaded)
router.get('/popular', async (req, res) => {
  console.log('=== Popular models endpoint hit ===');
  try {
    const { limit = 50 } = req.query;
    console.log('Request query params:', req.query);
    
    // Use the correct HuggingFace API endpoint - just /api/models with query params
    const apiUrl = 'https://huggingface.co/api/models';
    const params = {
      limit: parseInt(limit),
      filter: 'text-generation',
      sort: 'downloads',
      direction: -1
    };
    
    console.log('Making request to:', apiUrl);
    console.log('With params:', params);
    
    const headers = await getHfHeaders();
    console.log('Using headers:', { ...headers, Authorization: headers.Authorization ? '[REDACTED]' : 'none' });
    
    const response = await axios.get(apiUrl, {
      params,
      headers
    });
    
    console.log('Response received, status:', response.status);
    console.log('Data length:', response.data?.length || 0);
    
    const models = response.data.map(model => ({
      id: model.id,
      name: model.id,
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      tags: model.tags || [],
      pipeline_tag: model.pipeline_tag,
      library_name: model.library_name,
      created_at: model.created_at,
      updated_at: model.updated_at,
      private: model.private || false,
      gated: model.gated || false,
      description: model.description || '',
      author: model.author || model.id.split('/')[0]
    }));
    
    res.json({
      models,
      total: models.length
    });
  } catch (error) {
    console.error('=== Error in popular models endpoint ===');
    console.error('Error getting popular models:', error.message);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      params: error.config?.params
    });
    
    if (error.response?.status === 404) {
      res.status(404).json({ 
        error: 'Model not found',
        details: error.response?.data || error.message 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to get popular models',
        details: error.response?.data || error.message 
      });
    }
  }
});

// Get model details
router.get('/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const decodedModelId = decodeURIComponent(modelId);
    
    const modelUrl = `https://huggingface.co/api/models/${decodedModelId}`;
    
    const headers = await getHfHeaders();
    const response = await axios.get(modelUrl, {
      headers
    });
    
    const model = response.data;
    
    res.json({
      id: model.id,
      name: model.id,
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      tags: model.tags || [],
      pipeline_tag: model.pipeline_tag,
      library_name: model.library_name,
      created_at: model.created_at,
      updated_at: model.updated_at,
      private: model.private || false,
      gated: model.gated || false,
      description: model.description || '',
      author: model.author || model.id.split('/')[0],
      card_data: model.card_data || {},
      config: model.config || {},
      siblings: model.siblings || []
    });
  } catch (error) {
    console.error('Error getting model details:', error);
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Model not found' });
    } else {
      res.status(500).json({ 
        error: 'Failed to get model details',
        details: error.response?.data || error.message 
      });
    }
  }
});

// Validate model accessibility (useful for checking if API key is needed)
router.post('/validate', async (req, res) => {
  try {
    const { modelId, apiKey } = req.body;
    
    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' });
    }
    
    const decodedModelId = decodeURIComponent(modelId);
    const modelUrl = `https://huggingface.co/api/models/${decodedModelId}`;
    
    const headers = await getHfHeaders();
    
    // Override with provided API key if specified
    if (apiKey && apiKey.trim() !== '') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    try {
      const response = await axios.get(modelUrl, { headers });
      const model = response.data;
      
      res.json({
        valid: true,
        accessible: true,
        gated: model.gated || false,
        private: model.private || false,
        requiresAuth: false,
        model: {
          id: model.id,
          name: model.id,
          downloads: model.downloads || 0,
          likes: model.likes || 0,
          tags: model.tags || [],
          pipeline_tag: model.pipeline_tag,
          library_name: model.library_name
        }
      });
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        res.json({
          valid: true,
          accessible: false,
          requiresAuth: true,
          gated: true,
          private: false,
          error: 'Authentication required'
        });
      } else if (error.response?.status === 404) {
        res.json({
          valid: false,
          accessible: false,
          requiresAuth: false,
          gated: false,
          private: false,
          error: 'Model not found'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error validating model:', error);
    res.status(500).json({ 
      error: 'Failed to validate model',
      details: error.response?.data || error.message 
    });
  }
});

module.exports = router; 