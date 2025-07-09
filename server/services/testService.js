const axios = require('axios');
const { getDatabase } = require('../database/init');

class TestService {
  constructor() {
    this.timeout = 60000; // 60 second timeout for model responses
  }

  async getRunningInstances() {
    try {
      const db = getDatabase();
      
      return new Promise((resolve, reject) => {
        db.all(
          'SELECT id, name, model_name, port, status, gpu_id FROM instances WHERE status = ?',
          ['running'],
          (err, rows) => {
            db.close();
            if (err) {
              reject(err);
              return;
            }
            resolve(rows);
          }
        );
      });
    } catch (error) {
      console.error('Error getting running instances:', error);
      throw error;
    }
  }

  async getInstanceInfo(instanceId) {
    try {
      const db = getDatabase();
      
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT id, name, model_name, port, status, gpu_id, api_key FROM instances WHERE id = ? AND status = ?',
          [instanceId, 'running'],
          (err, row) => {
            db.close();
            if (err) {
              reject(err);
              return;
            }
            resolve(row);
          }
        );
      });
    } catch (error) {
      console.error('Error getting instance info:', error);
      throw error;
    }
  }

  async testInstanceHealth(instanceId) {
    try {
      const instance = await this.getInstanceInfo(instanceId);
      if (!instance) {
        throw new Error('Instance not found or not running');
      }

      const baseUrl = `http://${process.env.DEFAULT_HOSTNAME || 'localhost'}:${instance.port}`;
      
      // Test basic health endpoint
      const healthResponse = await axios.get(`${baseUrl}/health`, {
        timeout: 5000
      });

      // Try to get model info
      let modelInfo = null;
      try {
        const modelResponse = await axios.get(`${baseUrl}/v1/models`, {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${instance.api_key || 'localkey'}`
          }
        });
        modelInfo = modelResponse.data;
      } catch (modelError) {
        console.log('Model info endpoint not available:', modelError.message);
      }

      return {
        healthy: true,
        status: healthResponse.status,
        instance: {
          id: instance.id,
          name: instance.name,
          model: instance.model_name,
          port: instance.port,
          gpu: instance.gpu_id
        },
        modelInfo: modelInfo,
        url: baseUrl
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        instance: null
      };
    }
  }

  async chatCompletion(instanceId, messages, options = {}) {
    try {
      const instance = await this.getInstanceInfo(instanceId);
      if (!instance) {
        throw new Error('Instance not found or not running');
      }

      const baseUrl = `http://${process.env.DEFAULT_HOSTNAME || 'localhost'}:${instance.port}`;
      
      const requestData = {
        model: instance.model_name,
        messages: messages,
        max_tokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        stream: options.stream || false
      };

      console.log(`Sending chat request to ${baseUrl}/v1/chat/completions`);
      
      const response = await axios.post(`${baseUrl}/v1/chat/completions`, requestData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instance.api_key || 'localkey'}`
        }
      });

      return {
        success: true,
        response: response.data,
        instance: {
          id: instance.id,
          name: instance.name,
          model: instance.model_name
        }
      };
    } catch (error) {
      console.error('Chat completion error:', error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      };
    }
  }

  async imageGeneration(instanceId, prompt, options = {}) {
    try {
      const instance = await this.getInstanceInfo(instanceId);
      if (!instance) {
        throw new Error('Instance not found or not running');
      }

      const baseUrl = `http://${process.env.DEFAULT_HOSTNAME || 'localhost'}:${instance.port}`;
      
      const requestData = {
        model: instance.model_name,
        prompt: prompt,
        n: options.n || 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        response_format: options.responseFormat || 'url'
      };

      console.log(`Sending image generation request to ${baseUrl}/v1/images/generations`);
      
      const response = await axios.post(`${baseUrl}/v1/images/generations`, requestData, {
        timeout: this.timeout * 2, // Image generation can take longer
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instance.api_key || 'localkey'}`
        }
      });

      return {
        success: true,
        response: response.data,
        instance: {
          id: instance.id,
          name: instance.name,
          model: instance.model_name
        }
      };
    } catch (error) {
      console.error('Image generation error:', error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      };
    }
  }

  async textCompletion(instanceId, prompt, options = {}) {
    try {
      const instance = await this.getInstanceInfo(instanceId);
      if (!instance) {
        throw new Error('Instance not found or not running');
      }

      const baseUrl = `http://${process.env.DEFAULT_HOSTNAME || 'localhost'}:${instance.port}`;
      
      const requestData = {
        model: instance.model_name,
        prompt: prompt,
        max_tokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        stop: options.stop || null
      };

      console.log(`Sending completion request to ${baseUrl}/v1/completions`);
      
      const response = await axios.post(`${baseUrl}/v1/completions`, requestData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instance.api_key || 'localkey'}`
        }
      });

      return {
        success: true,
        response: response.data,
        instance: {
          id: instance.id,
          name: instance.name,
          model: instance.model_name
        }
      };
    } catch (error) {
      console.error('Text completion error:', error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      };
    }
  }

  async getEmbeddings(instanceId, input, options = {}) {
    try {
      const instance = await this.getInstanceInfo(instanceId);
      if (!instance) {
        throw new Error('Instance not found or not running');
      }

      const baseUrl = `http://${process.env.DEFAULT_HOSTNAME || 'localhost'}:${instance.port}`;
      
      const requestData = {
        model: instance.model_name,
        input: input,
        encoding_format: options.format || 'float'
      };

      console.log(`Sending embeddings request to ${baseUrl}/v1/embeddings`);
      
      const response = await axios.post(`${baseUrl}/v1/embeddings`, requestData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instance.api_key || 'localkey'}`
        }
      });

      return {
        success: true,
        response: response.data,
        instance: {
          id: instance.id,
          name: instance.name,
          model: instance.model_name
        }
      };
    } catch (error) {
      console.error('Embeddings error:', error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      };
    }
  }

  async detectCapabilities(instanceId) {
    try {
      const healthCheck = await this.testInstanceHealth(instanceId);
      if (!healthCheck.healthy) {
        return {
          available: false,
          error: healthCheck.error
        };
      }

      const capabilities = {
        chatCompletion: false,
        textCompletion: false,
        embeddings: false,
        vision: false,
        imageGeneration: false
      };

      const instance = await this.getInstanceInfo(instanceId);
      const baseUrl = `http://${process.env.DEFAULT_HOSTNAME || 'localhost'}:${instance.port}`;

      // Test chat completions
      try {
        await axios.post(`${baseUrl}/v1/chat/completions`, {
          model: instance.model_name,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }, {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${instance.api_key || 'localkey'}`
          }
        });
        capabilities.chatCompletion = true;
      } catch (error) {
        console.log('Chat completion not supported');
      }

      // Test text completions
      try {
        await axios.post(`${baseUrl}/v1/completions`, {
          model: instance.model_name,
          prompt: 'test',
          max_tokens: 1
        }, {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${instance.api_key || 'localkey'}`
          }
        });
        capabilities.textCompletion = true;
      } catch (error) {
        console.log('Text completion not supported');
      }

      // Test embeddings
      try {
        await axios.post(`${baseUrl}/v1/embeddings`, {
          model: instance.model_name,
          input: 'test'
        }, {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${instance.api_key || 'localkey'}`
          }
        });
        capabilities.embeddings = true;
      } catch (error) {
        console.log('Embeddings not supported');
      }

      // Detect vision capabilities based on model name
      const modelName = instance.model_name.toLowerCase();
      if (modelName.includes('vision') || modelName.includes('clip') || 
          modelName.includes('llava') || modelName.includes('blip')) {
        capabilities.vision = true;
      }

      // Detect image generation capabilities
      if (modelName.includes('dalle') || modelName.includes('stable-diffusion') || 
          modelName.includes('sdxl') || modelName.includes('flux')) {
        capabilities.imageGeneration = true;
      }

      return {
        available: true,
        capabilities: capabilities,
        modelName: instance.model_name,
        instance: healthCheck.instance
      };
    } catch (error) {
      console.error('Error detecting capabilities:', error);
      return {
        available: false,
        error: error.message
      };
    }
  }

  async getTestPresets() {
    return {
      chatPresets: [
        {
          id: 'general-chat',
          name: 'General Conversation',
          messages: [
            { role: 'user', content: 'Hello! Can you tell me about yourself?' }
          ],
          options: { temperature: 0.7, maxTokens: 150 }
        },
        {
          id: 'creative-writing',
          name: 'Creative Writing',
          messages: [
            { role: 'user', content: 'Write a short story about a robot learning to paint.' }
          ],
          options: { temperature: 0.9, maxTokens: 300 }
        },
        {
          id: 'code-help',
          name: 'Code Assistance',
          messages: [
            { role: 'user', content: 'Can you help me write a Python function to calculate fibonacci numbers?' }
          ],
          options: { temperature: 0.3, maxTokens: 200 }
        },
        {
          id: 'analysis',
          name: 'Text Analysis',
          messages: [
            { role: 'user', content: 'Analyze the following text and summarize its main points: "Machine learning is transforming industries by automating complex tasks and providing insights from data."' }
          ],
          options: { temperature: 0.5, maxTokens: 150 }
        },
        {
          id: 'vision-test',
          name: 'Vision Test',
          messages: [
            { role: 'user', content: 'What do you see in this image?' }
          ],
          options: { temperature: 0.7, maxTokens: 200 }
        }
      ],
      completionPresets: [
        {
          id: 'story-completion',
          name: 'Story Completion',
          prompt: 'Once upon a time, in a land far away, there lived a',
          options: { temperature: 0.8, maxTokens: 200 }
        },
        {
          id: 'technical-writing',
          name: 'Technical Explanation',
          prompt: 'Artificial Intelligence is',
          options: { temperature: 0.4, maxTokens: 150 }
        },
        {
          id: 'creative-prompt',
          name: 'Creative Writing',
          prompt: 'The last person on Earth sat alone in a room. There was a knock on the door.',
          options: { temperature: 0.9, maxTokens: 250 }
        }
      ],
      imagePresets: [
        {
          id: 'landscape',
          name: 'Landscape',
          prompt: 'A beautiful mountain landscape at sunset with a lake in the foreground',
          options: { size: '1024x1024', quality: 'standard', n: 1 }
        },
        {
          id: 'portrait',
          name: 'Portrait',
          prompt: 'A professional headshot of a smiling person in business attire',
          options: { size: '1024x1024', quality: 'standard', n: 1 }
        },
        {
          id: 'abstract',
          name: 'Abstract Art',
          prompt: 'Abstract digital art with vibrant colors and geometric shapes',
          options: { size: '1024x1024', quality: 'standard', n: 1 }
        },
        {
          id: 'sci-fi',
          name: 'Sci-Fi Scene',
          prompt: 'Futuristic city skyline with flying cars and neon lights',
          options: { size: '1024x1024', quality: 'standard', n: 1 }
        }
      ]
    };
  }
}

module.exports = new TestService(); 