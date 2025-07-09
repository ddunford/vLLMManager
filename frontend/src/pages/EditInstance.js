import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Server, 
  Key, 
  Search, 
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Plus,
  RefreshCw,
  Globe,
  Settings,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  HardDrive,
  Cpu,
  Save,
  ArrowLeft
} from 'lucide-react';
import { containerApi, modelApi, settingsApi, gpuApi } from '../services/api';
import toast from 'react-hot-toast';

const EditInstance = () => {
  const { id } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    modelName: '',
    apiKey: '',  // vLLM API key
    requireAuth: true,  // New field for authentication toggle
    hfApiKey: '',  // HuggingFace API key (separate)
    hostname: '',
    gpuSelection: '',
    // Advanced vLLM options
    maxContextLength: '',
    gpuMemoryUtilization: 0.85,
    maxNumSeqs: 256,
    trustRemoteCode: false,
    quantization: '',
    tensorParallelSize: 1
  });
  const [updating, setUpdating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loadingModelConfig, setLoadingModelConfig] = useState(false);
  const [modelValidation, setModelValidation] = useState(null);
  const [modelConfig, setModelConfig] = useState(null);
  const [recommendedParams, setRecommendedParams] = useState(null);
  const [errors, setErrors] = useState({});
  const [defaults, setDefaults] = useState(null);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [availableGPUs, setAvailableGPUs] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingInstance, setLoadingInstance] = useState(true);
  
  const navigate = useNavigate();

  // Load instance data
  const loadInstance = async () => {
    try {
      setLoadingInstance(true);
      const response = await containerApi.getAll();
      const instance = response.data.find(inst => inst.id === id);
      
      if (!instance) {
        toast.error('Instance not found');
        navigate('/');
        return;
      }

      // Parse config to get advanced settings
      let config = {};
      let advancedConfig = {};
      try {
        config = JSON.parse(instance.config || '{}');
        advancedConfig = config.advancedConfig || {};
      } catch (e) {
        console.warn('Could not parse instance config:', e);
      }

      // Populate form with existing instance data
      setFormData({
        name: instance.name || '',
        modelName: instance.model_name || '',
        apiKey: instance.api_key ? '***' : '',  // Don't show actual key for security
        requireAuth: config.requireAuth !== false,  // Default to true if not specified
        hfApiKey: config.hfToken ? '***' : '',  // Don't show actual token for security
        hostname: config.hostname || 'localhost',
        gpuSelection: config.gpuSelection || 'auto',
        // Advanced vLLM options
        maxContextLength: advancedConfig.maxContextLength || '',
        gpuMemoryUtilization: advancedConfig.gpuMemoryUtilization || 0.85,
        maxNumSeqs: advancedConfig.maxNumSeqs || 256,
        trustRemoteCode: advancedConfig.trustRemoteCode || false,
        quantization: advancedConfig.quantization || '',
        tensorParallelSize: advancedConfig.tensorParallelSize || 1
      });

      // Load model configuration
      if (instance.model_name) {
        await getModelConfiguration(instance.model_name);
      }
    } catch (error) {
      console.error('Error loading instance:', error);
      toast.error('Failed to load instance data');
      navigate('/');
    } finally {
      setLoadingInstance(false);
    }
  };

  // Load default settings
  const loadDefaults = async () => {
    try {
      setLoadingDefaults(true);
      const response = await settingsApi.getInstanceDefaults();
      setDefaults(response.data);
    } catch (error) {
      console.error('Error loading defaults:', error);
    } finally {
      setLoadingDefaults(false);
    }
  };

  // Load GPU information
  const loadGPUInfo = async () => {
    try {
      const [gpuResponse, availableResponse] = await Promise.all([
        gpuApi.getInfo(),
        gpuApi.getAvailable()
      ]);
      setGpuInfo(gpuResponse.data);
      setAvailableGPUs(availableResponse.data);
    } catch (error) {
      console.error('Error loading GPU info:', error);
      // GPU info is optional, so don't show error toast
    }
  };

  // Get model configuration and recommendations
  const getModelConfiguration = async (modelName) => {
    if (!modelName.trim()) return;
    
    try {
      setLoadingModelConfig(true);
      const response = await modelApi.getConfig(modelName);
      
      if (response.data.modelConfig) {
        setModelConfig(response.data.modelConfig);
        setRecommendedParams(response.data.recommendations);
        
        // Only auto-fill if values are empty (don't override user's existing settings)
        setFormData(prev => ({
          ...prev,
          maxContextLength: prev.maxContextLength || response.data.recommendations.maxModelLen || '',
          gpuMemoryUtilization: prev.gpuMemoryUtilization || response.data.recommendations.gpuMemoryUtilization || 0.85,
          maxNumSeqs: prev.maxNumSeqs || response.data.recommendations.maxNumSeqs || 256,
          trustRemoteCode: prev.trustRemoteCode || response.data.recommendations.trustRemoteCode || false
        }));
      }
    } catch (error) {
      console.error('Error loading model config:', error);
      // Don't show error toast for edit mode
    } finally {
      setLoadingModelConfig(false);
    }
  };

  useEffect(() => {
    loadInstance();
    loadDefaults();
    loadGPUInfo();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateModel = async () => {
    if (!formData.modelName.trim()) {
      toast.error('Please enter a model name');
      return;
    }

    try {
      setValidating(true);
      setModelValidation(null);
      
      const response = await modelApi.validate(formData.modelName, formData.hfApiKey);
      setModelValidation(response.data);
      
      if (response.data.valid && response.data.accessible) {
        toast.success('Model is valid and accessible');
        // Load full configuration after validation
        await getModelConfiguration(formData.modelName);
      } else if (response.data.valid && !response.data.accessible) {
        toast.warning('Model requires authentication');
      } else {
        toast.error('Model not found');
      }
    } catch (error) {
      console.error('Error validating model:', error);
      toast.error('Failed to validate model');
      setModelValidation(null);
    } finally {
      setValidating(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Instance name is required';
    }
    
    if (!formData.modelName.trim()) {
      newErrors.modelName = 'Model name is required';
    }
    
    if (modelValidation?.requiresAuth && !formData.hfApiKey?.trim()) {
      newErrors.hfApiKey = 'HuggingFace API key is required for this model';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setUpdating(true);
      
      // Prepare advanced configuration
      const advancedConfig = showAdvanced ? {
        maxContextLength: formData.maxContextLength || null,
        gpuMemoryUtilization: formData.gpuMemoryUtilization,
        maxNumSeqs: formData.maxNumSeqs,
        trustRemoteCode: formData.trustRemoteCode,
        quantization: formData.quantization || null,
        tensorParallelSize: formData.tensorParallelSize
      } : {};
      
      const response = await containerApi.update(id, {
        name: formData.name,
        modelName: formData.modelName,
        apiKey: formData.apiKey === '***' ? null : formData.apiKey,  // Don't send placeholder
        requireAuth: formData.requireAuth,
        hostname: formData.hostname || null,
        gpuSelection: formData.gpuSelection || null,
        ...advancedConfig
      });
      
      toast.success(`Instance "${formData.name}" updated successfully`);
      navigate(`/instance/${id}`);
    } catch (error) {
      console.error('Error updating instance:', error);
      toast.error(error.response?.data?.error || 'Failed to update instance');
    } finally {
      setUpdating(false);
    }
  };

  const generateInstanceName = () => {
    if (formData.modelName) {
      const modelPart = formData.modelName.split('/').pop() || formData.modelName;
      const cleanName = modelPart.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const timestamp = Date.now().toString().slice(-4);
      const name = `${cleanName}-${timestamp}`;
      
      setFormData(prev => ({
        ...prev,
        name: name
      }));
    }
  };

  const estimateMemoryUsage = () => {
    if (!modelConfig || !gpuInfo) return null;
    
    const modelSize = modelConfig.modelSize || 0;
    const gpuMemory = gpuInfo.totalMemory || 0;
    const utilization = formData.gpuMemoryUtilization || 0.85;
    
    if (modelSize && gpuMemory) {
      const availableMemory = gpuMemory * utilization;
      const memoryUsage = (modelSize / availableMemory) * 100;
      return Math.min(memoryUsage, 100);
    }
    
    return null;
  };

  if (loadingInstance || loadingDefaults) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const memoryUsage = estimateMemoryUsage();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/instance/${id}`)}
          className="btn btn-ghost btn-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Instance
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Instance</h1>
        <p className="text-gray-600">Update your vLLM instance configuration</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Configuration */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Server className="w-5 h-5 mr-2" />
            Basic Configuration
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Instance Name */}
            <div>
              <label className="label">
                <span className="label-text">Instance Name</span>
                <button
                  type="button"
                  onClick={generateInstanceName}
                  className="btn btn-ghost btn-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
                placeholder="my-instance"
              />
              {errors.name && <p className="text-error text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Model Name */}
            <div>
              <label className="label">
                <span className="label-text">Model Name</span>
                <button
                  type="button"
                  onClick={validateModel}
                  disabled={validating || !formData.modelName.trim()}
                  className="btn btn-ghost btn-xs"
                >
                  {validating ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                </button>
              </label>
              <input
                type="text"
                name="modelName"
                value={formData.modelName}
                onChange={handleInputChange}
                className={`input input-bordered w-full ${errors.modelName ? 'input-error' : ''}`}
                placeholder="microsoft/DialoGPT-medium"
              />
              {errors.modelName && <p className="text-error text-sm mt-1">{errors.modelName}</p>}
            </div>
          </div>

          {/* Model Validation Status */}
          {modelValidation && (
            <div className="mt-4 p-3 rounded-lg border">
              <div className="flex items-center">
                {modelValidation.valid ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                )}
                <span className="font-medium">
                  {modelValidation.valid ? 'Model is valid' : 'Model not found'}
                </span>
              </div>
              {modelValidation.accessible !== undefined && (
                <p className="text-sm text-gray-600 mt-1">
                  {modelValidation.accessible ? 'Model is accessible' : 'Model requires authentication'}
                </p>
              )}
            </div>
          )}

          {/* Model Configuration Info */}
          {modelConfig && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Model Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Architecture:</span>
                  <p className="font-medium">{modelConfig.architecture || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-blue-700">Context Length:</span>
                  <p className="font-medium">{modelConfig.maxModelLen?.toLocaleString() || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-blue-700">Model Size:</span>
                  <p className="font-medium">{modelConfig.modelSize ? `${(modelConfig.modelSize / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-blue-700">Memory Usage:</span>
                  <p className="font-medium">
                    {memoryUsage ? `${memoryUsage.toFixed(1)}%` : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Authentication Configuration */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Authentication
          </h2>
          
          <div className="space-y-4">
            {/* API Key Toggle */}
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Require API Key Authentication</span>
                <input
                  type="checkbox"
                  name="requireAuth"
                  checked={formData.requireAuth}
                  onChange={handleInputChange}
                  className="toggle toggle-primary"
                />
              </label>
              <p className="text-sm text-gray-600 mt-1">
                Enable OpenAI-compatible authentication for this instance
              </p>
            </div>

            {/* vLLM API Key */}
            {formData.requireAuth && (
              <div>
                <label className="label">
                  <span className="label-text">vLLM API Key</span>
                  <span className="label-text-alt text-gray-500">
                    {defaults?.apiKey ? 'Using default' : 'Required'}
                  </span>
                </label>
                <input
                  type="password"
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleInputChange}
                  className="input input-bordered w-full"
                  placeholder={defaults?.apiKey ? 'Leave empty to use default' : 'sk-...'}
                />
                <p className="text-sm text-gray-600 mt-1">
                  API key for OpenAI-compatible authentication. Leave empty to use default.
                </p>
              </div>
            )}

            {/* HuggingFace API Key */}
            <div>
              <label className="label">
                <span className="label-text">HuggingFace API Token</span>
                <span className="label-text-alt text-gray-500">
                  {defaults?.hfToken ? 'Using default' : 'Optional'}
                </span>
              </label>
              <input
                type="password"
                name="hfApiKey"
                value={formData.hfApiKey}
                onChange={handleInputChange}
                className={`input input-bordered w-full ${errors.hfApiKey ? 'input-error' : ''}`}
                placeholder={defaults?.hfToken ? 'Leave empty to use default' : 'hf_...'}
              />
              {errors.hfApiKey && <p className="text-error text-sm mt-1">{errors.hfApiKey}</p>}
              <p className="text-sm text-gray-600 mt-1">
                Required for accessing gated models on HuggingFace
              </p>
            </div>
          </div>
        </div>

        {/* Network Configuration */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Network Configuration
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hostname */}
            <div>
              <label className="label">
                <span className="label-text">Hostname</span>
                <span className="label-text-alt text-gray-500">
                  {defaults?.hostname ? 'Using default' : 'Required'}
                </span>
              </label>
              <input
                type="text"
                name="hostname"
                value={formData.hostname}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                placeholder={defaults?.hostname || 'localhost'}
              />
            </div>

            {/* GPU Selection */}
            <div>
              <label className="label">
                <span className="label-text">GPU Selection</span>
                <span className="label-text-alt text-gray-500">
                  {defaults?.gpuSelection ? 'Using default' : 'Auto'}
                </span>
              </label>
              <select
                name="gpuSelection"
                value={formData.gpuSelection}
                onChange={handleInputChange}
                className="select select-bordered w-full"
              >
                <option value="auto">Auto-select (Recommended)</option>
                <option value="first">First Available GPU</option>
                <option value="least_used">Least Used GPU</option>
                {availableGPUs.map((gpu, index) => (
                  <option key={index} value={`gpu:${index}`}>
                    GPU {index}: {gpu.name} ({gpu.memory}GB)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* GPU Information */}
          {gpuInfo && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Available GPUs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {availableGPUs.map((gpu, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <span className="font-medium">GPU {index}:</span> {gpu.name}
                    </div>
                    <div className="text-gray-600">
                      {gpu.memory}GB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Configuration Toggle */}
        <div className="card p-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="btn btn-ghost w-full flex items-center justify-between"
          >
            <div className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              <span className="font-medium">Advanced vLLM Configuration</span>
            </div>
            {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Max Context Length */}
                <div>
                  <label className="label">
                    <span className="label-text">Max Context Length</span>
                    <span className="label-text-alt">
                      <Info className="w-3 h-3" />
                    </span>
                  </label>
                  <input
                    type="number"
                    name="maxContextLength"
                    value={formData.maxContextLength}
                    onChange={handleInputChange}
                    className="input input-bordered w-full"
                    placeholder="Auto-detect"
                    min="1"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Maximum sequence length. Leave empty for auto-detection.
                  </p>
                </div>

                {/* GPU Memory Utilization */}
                <div>
                  <label className="label">
                    <span className="label-text">GPU Memory Utilization</span>
                    <span className="label-text-alt">
                      <HardDrive className="w-3 h-3" />
                    </span>
                  </label>
                  <input
                    type="number"
                    name="gpuMemoryUtilization"
                    value={formData.gpuMemoryUtilization}
                    onChange={handleInputChange}
                    className="input input-bordered w-full"
                    step="0.01"
                    min="0.1"
                    max="1.0"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Fraction of GPU memory to use (0.1 - 1.0)
                  </p>
                </div>

                {/* Max Concurrent Sequences */}
                <div>
                  <label className="label">
                    <span className="label-text">Max Concurrent Sequences</span>
                    <span className="label-text-alt">
                      <Zap className="w-3 h-3" />
                    </span>
                  </label>
                  <input
                    type="number"
                    name="maxNumSeqs"
                    value={formData.maxNumSeqs}
                    onChange={handleInputChange}
                    className="input input-bordered w-full"
                    min="1"
                    max="2048"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Maximum number of concurrent sequences
                  </p>
                </div>

                {/* Tensor Parallel Size */}
                <div>
                  <label className="label">
                    <span className="label-text">Tensor Parallel Size</span>
                    <span className="label-text-alt">
                      <Cpu className="w-3 h-3" />
                    </span>
                  </label>
                  <input
                    type="number"
                    name="tensorParallelSize"
                    value={formData.tensorParallelSize}
                    onChange={handleInputChange}
                    className="input input-bordered w-full"
                    min="1"
                    max="8"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Number of GPUs for tensor parallelism
                  </p>
                </div>
              </div>

              {/* Quantization */}
              <div>
                <label className="label">
                  <span className="label-text">Quantization</span>
                  <span className="label-text-alt text-gray-500">Optional</span>
                </label>
                <select
                  name="quantization"
                  value={formData.quantization}
                  onChange={handleInputChange}
                  className="select select-bordered w-full"
                >
                  <option value="">No quantization</option>
                  <option value="awq">AWQ</option>
                  <option value="gptq">GPTQ</option>
                  <option value="squeezellm">SqueezeLLM</option>
                </select>
                <p className="text-sm text-gray-600 mt-1">
                  Quantization method to reduce memory usage
                </p>
              </div>

              {/* Trust Remote Code */}
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Trust Remote Code</span>
                  <input
                    type="checkbox"
                    name="trustRemoteCode"
                    checked={formData.trustRemoteCode}
                    onChange={handleInputChange}
                    className="checkbox checkbox-primary"
                  />
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  Allow execution of custom model code (use with caution)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(`/instance/${id}`)}
            className="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updating}
            className="btn btn-primary"
          >
            {updating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Update Instance
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditInstance; 