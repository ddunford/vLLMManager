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
  Globe
} from 'lucide-react';
import { containerApi, modelApi, settingsApi, gpuApi } from '../services/api';
import toast from 'react-hot-toast';

const CreateInstance = () => {
  const [formData, setFormData] = useState({
    name: '',
    modelName: '',
    apiKey: '',
    hostname: '',
    gpuSelection: ''
  });
  const [creating, setCreating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [modelValidation, setModelValidation] = useState(null);
  const [errors, setErrors] = useState({});
  const [defaults, setDefaults] = useState(null);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [availableGPUs, setAvailableGPUs] = useState([]);
  
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
        apiKey: prev.apiKey || response.data.hfToken || '',
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

  // Pre-fill model if coming from search
  useEffect(() => {
    loadDefaults();
    loadGPUInfo();
    
    if (location.state?.selectedModel) {
      setFormData(prev => ({
        ...prev,
        modelName: location.state.selectedModel
      }));
    }
  }, [location.state]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      
      const response = await modelApi.validate(formData.modelName, formData.apiKey);
      setModelValidation(response.data);
      
      if (response.data.valid && response.data.accessible) {
        toast.success('Model is valid and accessible');
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
    
    if (modelValidation?.requiresAuth && !formData.apiKey.trim()) {
      newErrors.apiKey = 'API key is required for this model';
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
      
      const response = await containerApi.create({
        name: formData.name,
        modelName: formData.modelName,
        apiKey: formData.apiKey || null,
        hostname: formData.hostname || null,
        gpuSelection: formData.gpuSelection || null
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Create New Instance</h1>
        <p className="text-gray-600 mt-2">
          Set up a new vLLM instance with your chosen model
        </p>
      </div>

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
                disabled={validating || !formData.modelName.trim()}
                className="btn btn-secondary btn-sm"
                title="Validate model"
              >
                {validating ? (
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

          {/* API Key */}
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              HuggingFace API Key {modelValidation?.requiresAuth && <span className="text-red-500">*</span>}
              {defaults?.hfToken && !formData.apiKey && (
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
                placeholder={defaults?.hfToken ? "Using saved token..." : "hf_..."}
                className={`input pl-10 ${errors.apiKey ? 'border-red-500' : ''}`}
              />
              <Key className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
            {errors.apiKey && (
              <p className="text-red-600 text-sm mt-1">{errors.apiKey}</p>
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
              {defaults?.hostname && !formData.hostname && (
                <span className="text-green-600 text-xs ml-2">(using default: {defaults.hostname})</span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                id="hostname"
                name="hostname"
                value={formData.hostname}
                onChange={handleInputChange}
                placeholder={defaults?.hostname || "localhost"}
                className={`input pl-10`}
              />
              <Globe className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Hostname for accessing the vLLM instance (e.g., localhost, your-server.com)
            </p>
          </div>

          {/* GPU Selection */}
          <div>
            <label htmlFor="gpuSelection" className="block text-sm font-medium text-gray-700 mb-2">
              GPU Selection
              {defaults?.gpuSelection && !formData.gpuSelection && (
                <span className="text-green-600 text-xs ml-2">(using default: {defaults.gpuSelection})</span>
              )}
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
            {gpuInfo && gpuInfo.hasGPU && (
              <p className="text-sm text-green-600 mt-1">
                ✓ {availableGPUs.length} GPU(s) available for load balancing
              </p>
            )}
            {(!gpuInfo || !gpuInfo.hasGPU) && (
              <p className="text-sm text-orange-600 mt-1">
                ⚠ No GPUs detected - instance will use CPU
              </p>
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

      {/* Info Card */}
      <div className="card p-6 bg-blue-50 border border-blue-200">
        <div className="flex items-start">
          <Server className="w-6 h-6 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Instance Setup
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• A unique port will be automatically assigned</li>
              <li>• The instance will download and cache the model on first run</li>
              <li>• You can access the OpenAI-compatible API at the assigned port</li>
              <li>• Instance will restart automatically if it crashes</li>
              {gpuInfo && gpuInfo.hasGPU && (
                <li>• GPU selection supports automatic load balancing across available GPUs</li>
              )}
              {defaults && (
                <li>• Default values are loaded from your saved <a href="/settings" className="underline text-blue-700">Settings</a></li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInstance; 