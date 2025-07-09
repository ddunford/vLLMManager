import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Cpu
} from 'lucide-react';
import { containerApi, modelApi, settingsApi, gpuApi } from '../services/api';
import toast from 'react-hot-toast';

const CreateInstance = () => {
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
  const [creating, setCreating] = useState(false);
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
  
  const navigate = useNavigate();
  const location = useLocation();

  // Load default settings
  const loadDefaults = async () => {
    try {
      setLoadingDefaults(true);
      const response = await settingsApi.getInstanceDefaults();
      setDefaults(response.data);
      
      // Auto-populate form with defaults
      setFormData(prev => ({
        ...prev,
        apiKey: prev.apiKey || response.data.apiKey || '',  // vLLM API key default
        hfApiKey: prev.hfApiKey || response.data.hfToken || '',  // HuggingFace token default
        hostname: prev.hostname || response.data.hostname || 'localhost',
        gpuSelection: prev.gpuSelection || response.data.gpuSelection || 'auto'
      }));
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
        
        // Auto-fill form with recommendations
        setFormData(prev => ({
          ...prev,
          maxContextLength: response.data.recommendations.maxModelLen || '',
          gpuMemoryUtilization: response.data.recommendations.gpuMemoryUtilization || 0.85,
          maxNumSeqs: response.data.recommendations.maxNumSeqs || 256,
          trustRemoteCode: response.data.recommendations.trustRemoteCode || false
        }));
        
        toast.success('Model configuration loaded');
      }
    } catch (error) {
      console.error('Error loading model config:', error);
      toast.error('Could not load model configuration');
    } finally {
      setLoadingModelConfig(false);
    }
  };

  // Pre-fill model if coming from search
  useEffect(() => {
    loadDefaults();
    loadGPUInfo();
    
    if (location.state?.selectedModel) {
      setFormData(prev => ({
        ...prev,
        modelName: location.state.selectedModel
      }));
      getModelConfiguration(location.state.selectedModel);
    }
  }, [location.state]);

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
    
    if (formData.maxContextLength && (isNaN(formData.maxContextLength) || formData.maxContextLength < 1)) {
      newErrors.maxContextLength = 'Context length must be a positive number';
    }
    
    if (formData.gpuMemoryUtilization < 0.1 || formData.gpuMemoryUtilization > 1.0) {
      newErrors.gpuMemoryUtilization = 'GPU memory utilization must be between 0.1 and 1.0';
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
      setCreating(true);
      
      // Prepare advanced configuration
      const advancedConfig = showAdvanced ? {
        maxContextLength: formData.maxContextLength || null,
        gpuMemoryUtilization: formData.gpuMemoryUtilization,
        maxNumSeqs: formData.maxNumSeqs,
        trustRemoteCode: formData.trustRemoteCode,
        quantization: formData.quantization || null,
        tensorParallelSize: formData.tensorParallelSize
      } : {};
      
      const response = await containerApi.create({
        name: formData.name,
        modelName: formData.modelName,
        apiKey: formData.apiKey || null,
        requireAuth: formData.requireAuth,
        hostname: formData.hostname || null,
        gpuSelection: formData.gpuSelection || null,
        ...advancedConfig
      });
      
      toast.success(`Instance "${formData.name}" created successfully`);
      navigate('/');
    } catch (error) {
      console.error('Error creating instance:', error);
      toast.error(error.response?.data?.error || 'Failed to create instance');
    } finally {
      setCreating(false);
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
    if (!modelConfig || !modelConfig.hiddenSize || !modelConfig.numLayers) {
      return 'Unknown';
    }
    
    // Rough estimation: (hidden_size * num_layers * vocab_size * 2 bytes) + overhead
    const vocabSize = modelConfig.vocabSize || 32000;
    const estimatedBytes = (modelConfig.hiddenSize * modelConfig.numLayers * vocabSize * 2) + (1024 * 1024 * 1024); // 1GB overhead
    const estimatedGB = (estimatedBytes / (1024 * 1024 * 1024)).toFixed(1);
    
    return `~${estimatedGB} GB`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Create New Instance</h1>
        <p className="text-gray-600 mt-2">
          Set up a new vLLM instance with your chosen model
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Instance Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Instance Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="my-llm-instance"
                    className={`input ${errors.name ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={generateInstanceName}
                    disabled={!formData.modelName}
                    className="btn btn-secondary btn-sm"
                    title="Generate name from model"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              {/* Model Name */}
              <div>
                <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 mb-2">
                  Model Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="modelName"
                    name="modelName"
                    value={formData.modelName}
                    onChange={handleInputChange}
                    placeholder="microsoft/DialoGPT-medium"
                    className={`input ${errors.modelName ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={validateModel}
                    disabled={validating || loadingModelConfig || !formData.modelName.trim()}
                    className="btn btn-secondary btn-sm"
                    title="Validate model"
                  >
                    {(validating || loadingModelConfig) ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.modelName && (
                  <p className="text-red-600 text-sm mt-1">{errors.modelName}</p>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  Enter the full model name from HuggingFace (e.g., "microsoft/DialoGPT-medium")
                </p>
              </div>

              {/* Model Validation Result */}
              {modelValidation && (
                <div className={`p-4 rounded-md ${
                  modelValidation.valid && modelValidation.accessible 
                    ? 'bg-green-50 border border-green-200' 
                    : modelValidation.valid 
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center">
                    {modelValidation.valid && modelValidation.accessible ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {modelValidation.valid && modelValidation.accessible && 'Model is valid and accessible'}
                        {modelValidation.valid && !modelValidation.accessible && 'Model requires authentication'}
                        {!modelValidation.valid && 'Model not found'}
                      </p>
                      
                      {modelValidation.model && (
                        <div className="mt-2 text-sm text-gray-600">
                          <p><strong>Downloads:</strong> {modelValidation.model.downloads?.toLocaleString()}</p>
                          <p><strong>Likes:</strong> {modelValidation.model.likes?.toLocaleString()}</p>
                          {modelValidation.model.pipeline_tag && (
                            <p><strong>Type:</strong> {modelValidation.model.pipeline_tag}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <a
                      href={`https://huggingface.co/${formData.modelName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 ml-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Basic Configuration */}
              <div className="space-y-6">
                {/* Authentication Toggle */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        id="requireAuth"
                        name="requireAuth"
                        checked={formData.requireAuth}
                        onChange={handleInputChange}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Require API Key Authentication
                      </span>
                    </label>
                    <Info className="w-4 h-4 text-gray-400" title="When disabled, the endpoint will accept requests without authentication" />
                  </div>
                  <p className="text-xs text-gray-600">
                    Enable this for production use. Disable for local testing without authentication.
                    {!formData.requireAuth && (
                      <span className="text-orange-600 font-medium"> Warning: Endpoint will be publicly accessible!</span>
                    )}
                  </p>
                </div>

                {/* API Key - Only show when authentication is required */}
                {formData.requireAuth && (
                  <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                      vLLM API Key
                      {defaults?.apiKey && !formData.apiKey && (
                        <span className="text-green-600 text-xs ml-2">(using saved default)</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        id="apiKey"
                        name="apiKey"
                        value={formData.apiKey}
                        onChange={handleInputChange}
                        placeholder={defaults?.apiKey ? "Using saved key..." : "sk-..."}
                        className="input pl-10"
                      />
                      <Key className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      OpenAI-compatible API key for accessing the vLLM endpoint. Keys should start with 'sk-' for compatibility.
                    </p>
                  </div>
                )}

                {/* HuggingFace API Key - Separate from vLLM API key */}
                <div>
                  <label htmlFor="hfApiKey" className="block text-sm font-medium text-gray-700 mb-2">
                    HuggingFace API Key {modelValidation?.requiresAuth && <span className="text-red-500">*</span>}
                    {defaults?.hfToken && !formData.hfApiKey && (
                      <span className="text-green-600 text-xs ml-2">(using saved default)</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      id="hfApiKey"
                      name="hfApiKey"
                      value={formData.hfApiKey || ''}
                      onChange={handleInputChange}
                      placeholder={defaults?.hfToken ? "Using saved token..." : "hf_..."}
                      className={`input pl-10 ${errors.hfApiKey ? 'border-red-500' : ''}`}
                    />
                    <Key className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                  {errors.hfApiKey && (
                    <p className="text-red-600 text-sm mt-1">{errors.hfApiKey}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    Required for gated/private models. Get your key from{' '}
                    <a 
                      href="https://huggingface.co/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800"
                    >
                      HuggingFace Settings
                    </a>
                  </p>
                </div>

                {/* Hostname */}
                <div>
                  <label htmlFor="hostname" className="block text-sm font-medium text-gray-700 mb-2">
                    Hostname
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="hostname"
                      name="hostname"
                      value={formData.hostname}
                      onChange={handleInputChange}
                      placeholder={defaults?.hostname || "localhost"}
                      className="input pl-10"
                    />
                    <Globe className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* GPU Selection */}
                <div>
                  <label htmlFor="gpuSelection" className="block text-sm font-medium text-gray-700 mb-2">
                    GPU Selection
                  </label>
                  <div className="relative">
                    <select
                      id="gpuSelection"
                      name="gpuSelection"
                      value={formData.gpuSelection}
                      onChange={handleInputChange}
                      className="input pl-10"
                    >
                      <option value="auto">Auto (Load Balance)</option>
                      {gpuInfo && gpuInfo.hasGPU && availableGPUs.map(gpu => (
                        <option key={gpu.id} value={gpu.id}>
                          GPU {gpu.id}: {gpu.name}
                          {gpu.memoryTotal !== 'Unknown' && ` (${Math.round(gpu.memoryFree/1024)}GB free)`}
                          {gpu.inUse > 0 && ` - ${gpu.inUse} instance(s)`}
                        </option>
                      ))}
                      {(!gpuInfo || !gpuInfo.hasGPU) && (
                        <option value="cpu">CPU Only</option>
                      )}
                    </select>
                    <Server className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              </div>

              {/* Advanced Configuration Toggle */}
              <div className="border-t pt-6">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Advanced Configuration
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-2" />
                  )}
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                    {/* Max Context Length */}
                    <div>
                      <label htmlFor="maxContextLength" className="block text-sm font-medium text-gray-700 mb-2">
                        Max Context Length
                        {recommendedParams?.maxModelLen && (
                          <span className="text-blue-600 text-xs ml-2">
                            (recommended: {recommendedParams.maxModelLen})
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        id="maxContextLength"
                        name="maxContextLength"
                        value={formData.maxContextLength}
                        onChange={handleInputChange}
                        placeholder="Auto-detect"
                        min="1"
                        max="131072"
                        className={`input ${errors.maxContextLength ? 'border-red-500' : ''}`}
                      />
                      {errors.maxContextLength && (
                        <p className="text-red-600 text-sm mt-1">{errors.maxContextLength}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        Leave empty to auto-detect. Higher values use more memory.
                      </p>
                    </div>

                    {/* GPU Memory Utilization */}
                    <div>
                      <label htmlFor="gpuMemoryUtilization" className="block text-sm font-medium text-gray-700 mb-2">
                        GPU Memory Utilization: {(formData.gpuMemoryUtilization * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        id="gpuMemoryUtilization"
                        name="gpuMemoryUtilization"
                        value={formData.gpuMemoryUtilization}
                        onChange={handleInputChange}
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Conservative (10%)</span>
                        <span>Balanced (85%)</span>
                        <span>Aggressive (100%)</span>
                      </div>
                    </div>

                    {/* Max Concurrent Sequences */}
                    <div>
                      <label htmlFor="maxNumSeqs" className="block text-sm font-medium text-gray-700 mb-2">
                        Max Concurrent Sequences
                      </label>
                      <input
                        type="number"
                        id="maxNumSeqs"
                        name="maxNumSeqs"
                        value={formData.maxNumSeqs}
                        onChange={handleInputChange}
                        min="1"
                        max="1024"
                        className="input"
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Lower values use less memory but reduce throughput.
                      </p>
                    </div>

                    {/* Trust Remote Code */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="trustRemoteCode"
                        name="trustRemoteCode"
                        checked={formData.trustRemoteCode}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label htmlFor="trustRemoteCode" className="text-sm text-gray-700">
                        Trust Remote Code
                        {recommendedParams?.trustRemoteCode && (
                          <span className="text-orange-600 ml-2">(required for this model)</span>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-between items-center pt-6 border-t">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary btn-lg"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Create Instance
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Model Information Sidebar */}
        <div className="space-y-6">
          {/* Model Configuration Panel */}
          {modelConfig && (
            <div className="card p-6">
              <div className="flex items-center mb-4">
                <Info className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Model Information</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                {modelConfig.maxContextLength && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Context Length:</span>
                    <span className="font-medium">{modelConfig.maxContextLength.toLocaleString()} tokens</span>
                  </div>
                )}
                
                {modelConfig.architecture && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Architecture:</span>
                    <span className="font-medium">{modelConfig.architecture}</span>
                  </div>
                )}
                
                {modelConfig.hiddenSize && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hidden Size:</span>
                    <span className="font-medium">{modelConfig.hiddenSize.toLocaleString()}</span>
                  </div>
                )}
                
                {modelConfig.numLayers && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Layers:</span>
                    <span className="font-medium">{modelConfig.numLayers}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Est. Memory:</span>
                  <span className="font-medium">{estimateMemoryUsage()}</span>
                </div>
                
                {modelConfig.license && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">License:</span>
                    <span className="font-medium">{modelConfig.license}</span>
                  </div>
                )}
              </div>
              
              {recommendedParams?.note && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  <strong>Note:</strong> {recommendedParams.note}
                </div>
              )}
            </div>
          )}

          {/* GPU Status Panel */}
          {gpuInfo && (
            <div className="card p-6">
              <div className="flex items-center mb-4">
                <Zap className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">GPU Status</h3>
              </div>
              
              {gpuInfo.hasGPU ? (
                <div className="space-y-3">
                  <div className="text-sm text-green-600">
                    ✓ {availableGPUs.length} GPU(s) available
                  </div>
                  {availableGPUs.map(gpu => (
                    <div key={gpu.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">GPU {gpu.id}:</span>
                      <span className="font-medium">
                        {Math.round(gpu.memoryFree/1024)}GB free
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-orange-600">
                  ⚠ No GPUs detected - CPU mode
                </div>
              )}
            </div>
          )}

          {/* Info Card */}
          <div className="card p-6 bg-blue-50 border border-blue-200">
            <div className="flex items-start">
              <Server className="w-6 h-6 text-blue-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Setup Tips
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Validate models to load optimal settings</li>
                  <li>• Use advanced mode for fine-tuning</li>
                  <li>• Lower context length saves memory</li>
                  <li>• Check estimated memory vs available GPU memory</li>
                  <li>• Models download on first run</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInstance; 