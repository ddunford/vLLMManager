import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Download,
  Upload,
  RotateCcw,
  Key,
  Globe,
  Server,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { settingsApi, gpuApi } from '../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [availableGPUs, setAvailableGPUs] = useState([]);

  const settingsConfig = {
    'default_hf_token': {
      label: 'Default HuggingFace API Token',
      type: 'password',
      icon: Key,
      description: 'Your HuggingFace API token for accessing gated models',
      placeholder: 'hf_...'
    },
    'default_hostname': {
      label: 'Default Hostname',
      type: 'text',
      icon: Globe,
      description: 'Default hostname for vLLM instance URLs',
      placeholder: 'inference.vm'
    },
    'default_api_key': {
      label: 'Default vLLM API Key',
      type: 'text',
      icon: Key,
      description: 'Default API key for vLLM instances',
      placeholder: 'localkey'
    },
    'auto_start_instances': {
      label: 'Auto-start Instances',
      type: 'boolean',
      icon: Server,
      description: 'Automatically start instances after creation'
    },
    'default_model_filter': {
      label: 'Default Model Filter',
      type: 'select',
      icon: Server,
      description: 'Default filter when searching for models',
      options: [
        { value: 'text-generation', label: 'Text Generation' },
        { value: 'text2text-generation', label: 'Text-to-Text' },
        { value: 'conversational', label: 'Conversational' },
        { value: 'text-classification', label: 'Text Classification' }
      ]
    },
    'max_concurrent_instances': {
      label: 'Max Concurrent Instances',
      type: 'number',
      icon: Server,
      description: 'Maximum number of instances that can run simultaneously',
      min: 1,
      max: 20
    },
    'default_gpu_selection': {
      label: 'Default GPU Selection',
      type: 'gpu-select',
      icon: Server,
      description: 'Default GPU selection strategy for new instances'
    },
    'enable_gpu_load_balancing': {
      label: 'Enable GPU Load Balancing',
      type: 'boolean',
      icon: Server,
      description: 'Automatically balance GPU usage across available GPUs'
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsApi.getAll();
      setSettings(response.data);
      setModified(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    loadGPUInfo();
  }, []);

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

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value
      }
    }));
    setModified(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const settingsToUpdate = {};
      Object.keys(settings).forEach(key => {
        settingsToUpdate[key] = settings[key].value;
      });
      
      await settingsApi.updateMultiple(settingsToUpdate);
      setModified(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      await settingsApi.reset();
      await fetchSettings();
      toast.success('Settings reset to defaults');
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  const handleExport = async () => {
    try {
      const response = await settingsApi.exportBackup();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vllm-manager-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Settings exported successfully');
    } catch (error) {
      console.error('Error exporting settings:', error);
      toast.error('Failed to export settings');
    }
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        
        if (!backup.settings) {
          throw new Error('Invalid backup file format');
        }
        
        await settingsApi.importRestore(backup.settings);
        await fetchSettings();
        toast.success('Settings imported successfully');
      } catch (error) {
        console.error('Error importing settings:', error);
        toast.error('Failed to import settings: ' + error.message);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const renderSettingInput = (key, config) => {
    const setting = settings[key];
    if (!setting) return null;

    const IconComponent = config.icon;

    switch (config.type) {
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={key}
              checked={setting.value === 'true'}
              onChange={(e) => handleSettingChange(key, e.target.checked ? 'true' : 'false')}
              className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor={key} className="text-sm text-gray-700">
              {config.label}
            </label>
          </div>
        );

      case 'select':
        return (
          <div>
            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-2">
              {config.label}
            </label>
            <select
              id={key}
              value={setting.value}
              onChange={(e) => handleSettingChange(key, e.target.value)}
              className="input"
            >
              {config.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'gpu-select':
        return (
          <div>
            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-2">
              {config.label}
            </label>
            <select
              id={key}
              value={setting.value}
              onChange={(e) => handleSettingChange(key, e.target.value)}
              className="input"
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
                <option value="cpu" disabled>No GPUs Available</option>
              )}
            </select>
            {gpuInfo && gpuInfo.hasGPU && (
              <p className="text-sm text-green-600 mt-1">
                ✓ {availableGPUs.length} GPU(s) available
              </p>
            )}
            {(!gpuInfo || !gpuInfo.hasGPU) && (
              <p className="text-sm text-orange-600 mt-1">
                ⚠ No GPUs detected - instances will use CPU
              </p>
            )}
          </div>
        );

      case 'number':
        return (
          <div>
            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-2">
              {config.label}
            </label>
            <input
              type="number"
              id={key}
              value={setting.value}
              onChange={(e) => handleSettingChange(key, e.target.value)}
              min={config.min}
              max={config.max}
              className="input"
            />
          </div>
        );

      default:
        return (
          <div>
            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-2">
              {config.label}
            </label>
            <div className="relative">
              <input
                type={config.type}
                id={key}
                value={setting.value}
                onChange={(e) => handleSettingChange(key, e.target.value)}
                placeholder={config.placeholder}
                className={`input ${IconComponent ? 'pl-10' : ''}`}
              />
              {IconComponent && (
                <IconComponent className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              )}
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
          <span className="text-lg text-gray-600">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <SettingsIcon className="w-8 h-8 mr-3" />
            Settings
          </h1>
          <p className="text-gray-600 mt-2">Configure your vLLM Manager preferences</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {modified && (
            <div className="flex items-center text-yellow-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">Unsaved changes</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">General Settings</h2>
            
            <div className="space-y-6">
              {Object.entries(settingsConfig).map(([key, config]) => (
                <div key={key} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                  {renderSettingInput(key, config)}
                  <p className="text-sm text-gray-600 mt-2">{config.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="card p-6">
            <div className="flex justify-between items-center">
              <div className="flex space-x-4">
                <button
                  onClick={handleSave}
                  disabled={!modified || saving}
                  className="btn btn-primary"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
                
                <button
                  onClick={fetchSettings}
                  className="btn btn-secondary"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>

              <button
                onClick={handleReset}
                className="btn btn-warning"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Backup & Restore */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup & Restore</h3>
            
            <div className="space-y-4">
              <button
                onClick={handleExport}
                className="btn btn-secondary w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Settings
              </button>
              
              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  id="import-file"
                />
                <label
                  htmlFor="import-file"
                  className="btn btn-secondary w-full cursor-pointer inline-flex items-center justify-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Settings
                </label>
              </div>
            </div>
          </div>

          {/* Status Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Configuration</span>
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Loaded</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Changes</span>
                <div className={`flex items-center ${modified ? 'text-yellow-600' : 'text-green-600'}`}>
                  {modified ? (
                    <>
                      <AlertCircle className="w-4 h-4 mr-1" />
                      <span className="text-sm">Pending</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      <span className="text-sm">Saved</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Settings</span>
                <span className="text-sm font-medium">{Object.keys(settings).length}</span>
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="card p-6 bg-blue-50 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Quick Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Settings are applied when creating new instances</li>
              <li>• You can override defaults on a per-instance basis</li>
              <li>• Export your settings as a backup</li>
              <li>• Reset to defaults if something goes wrong</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 