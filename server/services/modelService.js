const axios = require('axios');

class ModelService {
  constructor() {
    this.baseURL = 'https://huggingface.co/api';
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Get model configuration from HuggingFace
   * @param {string} modelName - The model name (e.g., "mistralai/Mistral-7B-Instruct-v0.1")
   * @returns {Promise<Object>} Model configuration including context length
   */
  async getModelConfig(modelName) {
    try {
      // Fetch model info from HuggingFace API
      const response = await axios.get(`${this.baseURL}/models/${modelName}`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'vLLM-Manager/1.0'
        }
      });

      const modelInfo = response.data;
      
      // Try to fetch the config.json file
      let config = null;
      try {
        const configResponse = await axios.get(
          `https://huggingface.co/${modelName}/resolve/main/config.json`,
          {
            timeout: this.timeout,
            headers: {
              'User-Agent': 'vLLM-Manager/1.0'
            }
          }
        );
        config = configResponse.data;
      } catch (configError) {
        console.log(`Could not fetch config for ${modelName}:`, configError.message);
      }

      // Extract context length from various possible fields
      let maxContextLength = null;
      if (config) {
        maxContextLength = 
          config.max_position_embeddings ||
          config.max_sequence_length ||
          config.seq_length ||
          config.max_seq_len ||
          config.context_length ||
          config.sliding_window ||
          null;
      }

      // Extract model information
      const result = {
        name: modelName,
        displayName: modelInfo.id || modelName,
        description: modelInfo.description || '',
        tags: modelInfo.tags || [],
        pipeline_tag: modelInfo.pipeline_tag,
        library_name: modelInfo.library_name,
        license: modelInfo.license,
        maxContextLength,
        architecture: config?.architectures?.[0] || null,
        modelType: config?.model_type || null,
        torchDtype: config?.torch_dtype || null,
        vocabSize: config?.vocab_size || null,
        hiddenSize: config?.hidden_size || null,
        numLayers: config?.num_hidden_layers || null,
        numAttentionHeads: config?.num_attention_heads || null,
        intermediateSize: config?.intermediate_size || null,
        rmsNormEps: config?.rms_norm_eps || null,
        ropeTheta: config?.rope_theta || null,
        slidingWindow: config?.sliding_window || null,
        downloads: modelInfo.downloads || 0,
        likes: modelInfo.likes || 0,
        createdAt: modelInfo.createdAt,
        lastModified: modelInfo.lastModified,
        gated: modelInfo.gated || false,
        private: modelInfo.private || false
      };

      return result;
    } catch (error) {
      console.error(`Error fetching model config for ${modelName}:`, error.message);
      
      // Return basic info even if we can't fetch full config
      return {
        name: modelName,
        displayName: modelName,
        description: '',
        tags: [],
        maxContextLength: null,
        error: error.message
      };
    }
  }

  /**
   * Get recommended vLLM parameters for a model
   * @param {string} modelName - The model name
   * @returns {Promise<Object>} Recommended parameters
   */
  async getRecommendedParams(modelName) {
    try {
      const config = await this.getModelConfig(modelName);
      
      const recommendations = {
        maxModelLen: null,
        gpuMemoryUtilization: 0.85,
        maxNumSeqs: 256,
        trustRemoteCode: false
      };

      // Set context length recommendation
      if (config.maxContextLength) {
        // Use model's native context length, but cap it for memory efficiency
        if (config.maxContextLength <= 4096) {
          recommendations.maxModelLen = config.maxContextLength;
        } else if (config.maxContextLength <= 8192) {
          recommendations.maxModelLen = Math.min(config.maxContextLength, 8192);
        } else if (config.maxContextLength <= 16384) {
          recommendations.maxModelLen = Math.min(config.maxContextLength, 16384);
        } else {
          // For very long context models, suggest a reasonable default
          recommendations.maxModelLen = 16384;
          recommendations.note = `Model supports up to ${config.maxContextLength} tokens, but 16384 is recommended for memory efficiency`;
        }
      }

      // Adjust GPU memory utilization based on model size
      if (config.hiddenSize && config.numLayers) {
        const estimatedParams = (config.hiddenSize * config.numLayers * config.vocabSize) / 1000000;
        if (estimatedParams > 7000) { // 7B+ parameters
          recommendations.gpuMemoryUtilization = 0.85;
          recommendations.maxNumSeqs = 128; // Reduce concurrent sequences for larger models
        } else if (estimatedParams > 1000) { // 1B+ parameters
          recommendations.gpuMemoryUtilization = 0.9;
          recommendations.maxNumSeqs = 256;
        }
      }

      // Check if model needs trust_remote_code
      if (config.tags && config.tags.includes('custom_code')) {
        recommendations.trustRemoteCode = true;
      }

      return {
        modelConfig: config,
        recommendations
      };
    } catch (error) {
      console.error(`Error getting recommendations for ${modelName}:`, error.message);
      return {
        modelConfig: { name: modelName, error: error.message },
        recommendations: {
          maxModelLen: null,
          gpuMemoryUtilization: 0.85,
          maxNumSeqs: 256,
          trustRemoteCode: false
        }
      };
    }
  }

  /**
   * Search models with additional configuration info
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of models with config info
   */
  async searchModelsWithConfig(query, options = {}) {
    try {
      const searchUrl = `${this.baseURL}/models`;
      const params = {
        search: query,
        filter: options.filter || 'text-generation',
        sort: options.sort || 'downloads',
        direction: options.direction || -1,
        limit: options.limit || 20
      };

      const response = await axios.get(searchUrl, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'vLLM-Manager/1.0'
        }
      });

      // For search results, we'll just return basic info to avoid too many API calls
      // The detailed config will be fetched when user selects a specific model
      return response.data.map(model => ({
        id: model.id,
        name: model.id,
        displayName: model.id,
        description: model.description || '',
        tags: model.tags || [],
        pipeline_tag: model.pipeline_tag,
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        gated: model.gated || false,
        private: model.private || false
      }));
    } catch (error) {
      console.error('Error searching models with config:', error.message);
      throw error;
    }
  }
}

module.exports = new ModelService(); 