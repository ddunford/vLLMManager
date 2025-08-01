import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// Container API
export const containerApi = {
  getAll: () => api.get('/containers'),
  getAllWithOrphanCheck: () => api.get('/containers/with-orphan-check'),
  checkOrphans: (autoImport = false) => api.get(`/containers/orphans?autoImport=${autoImport}`),
  importOrphans: (containerIds) => api.post('/containers/orphans/import', { containerIds }),
  create: (data) => api.post('/containers', data),
  update: (id, data) => api.put(`/containers/${id}`, data),
  start: (id) => api.post(`/containers/${id}/start`),
  stop: (id) => api.post(`/containers/${id}/stop`),
  restart: (id) => api.post(`/containers/${id}/restart`),
  remove: (id) => api.delete(`/containers/${id}`),
  getLogs: (id, tail = 100) => api.get(`/containers/${id}/logs?tail=${tail}`),
};

// Ollama API
export const ollamaApi = {
  getAll: () => api.get('/ollama'),
  get: (id) => api.get(`/ollama/${id}`),
  create: (data) => api.post('/ollama', data),
  start: (id) => api.post(`/ollama/${id}/start`),
  stop: (id) => api.post(`/ollama/${id}/stop`),
  restart: (id) => api.post(`/ollama/${id}/restart`),
  remove: (id) => api.delete(`/ollama/${id}`),
  getLogs: (id, tail = 100) => api.get(`/ollama/${id}/logs?tail=${tail}`),
  getModels: (id) => api.get(`/ollama/${id}/models`),
  pullModel: (id, modelName) => `/api/ollama/${id}/models/pull?modelName=${encodeURIComponent(modelName)}`,
  deleteModel: (id, modelName) => api.delete(`/ollama/${id}/models/${modelName}`),
};

// Models API
export const modelApi = {
  search: (query, options = {}) => api.get('/models/search', { 
    params: { 
      query, 
      limit: options.limit || 20,
      filter: options.filter || 'text-generation'
    } 
  }),
  getPopular: (limit = 50) => api.get('/models/popular', { params: { limit } }),
  getDetails: (modelId) => api.get(`/models/${encodeURIComponent(modelId)}`),
  getConfig: (modelId) => api.get(`/models/${encodeURIComponent(modelId)}/config`),
  validate: (modelId, apiKey) => api.post('/models/validate', { modelId, apiKey }),
};

// Settings API
export const settingsApi = {
  getAll: () => api.get('/settings'),
  get: (key) => api.get(`/settings/${key}`),
  update: (key, value) => api.put(`/settings/${key}`, { value }),
  updateMultiple: (settings) => api.put('/settings', settings),
  getInstanceDefaults: () => api.get('/settings/defaults/instance'),
  reset: () => api.post('/settings/reset'),
  exportBackup: () => api.get('/settings/export/backup'),
  importRestore: (settings) => api.post('/settings/import/restore', { settings }),
};

// GPU API
export const gpuApi = {
  getInfo: () => api.get('/system/gpu'),
  getAvailable: () => api.get('/system/gpu/available'),
  getStats: () => api.get('/system/gpu/stats'),
  refreshInfo: () => api.post('/system/refresh-gpu'),
  getDeviceConfig: (gpuId) => api.get(`/system/device-config/${gpuId || ''}`),
};

// Health API
export const healthApi = {
  check: () => api.get('/health'),
};

// Test API functions
export const testApi = {
  // Get all running instances
  getInstances: () => api.get('/test/instances'),
  
  // Test instance health
  testHealth: (instanceId) => api.get(`/test/instances/${instanceId}/health`),
  
  // Get instance capabilities
  getCapabilities: (instanceId) => api.get(`/test/instances/${instanceId}/capabilities`),
  
  // Chat completion
  chat: (instanceId, data) => api.post(`/test/instances/${instanceId}/chat`, data),
  
  // Text completion
  completion: (instanceId, data) => api.post(`/test/instances/${instanceId}/completion`, data),
  
  // Embeddings
  embeddings: (instanceId, data) => api.post(`/test/instances/${instanceId}/embeddings`, data),
  
  // Image generation
  imageGeneration: (instanceId, data) => api.post(`/test/instances/${instanceId}/images`, data),
  
  // Get test presets
  getPresets: () => api.get('/test/presets'),
  
  // Quick test
  quickTest: (instanceId) => api.post(`/test/instances/${instanceId}/quick-test`),
  
  // Batch test
  batchTest: (data) => api.post('/test/batch-test', data)
};

export default api; 