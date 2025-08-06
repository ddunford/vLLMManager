import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { 
  Server, 
  Plus, 
  Play, 
  Square, 
  RotateCcw, 
  Trash2,
  ExternalLink,
  RefreshCw,
  Terminal,
  Clock,
  Activity,
  Download,
  Package,
  HardDrive,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { ollamaApi } from '../services/api';
import toast from 'react-hot-toast';

const OllamaManager = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: 'ollama-instance',
    apiKey: '',
    requireAuth: false,
    hostname: 'inference.vm',
    gpuSelection: 'auto'
  });

  const navigate = useNavigate();

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await ollamaApi.getAll();
      setInstances(response.data);
    } catch (error) {
      console.error('Error fetching Ollama instances:', error);
      toast.error('Failed to fetch Ollama instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const handleCreateInstance = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Instance name is required');
      return;
    }

    try {
      setCreating(true);
      const response = await ollamaApi.create(formData);
      toast.success(`Ollama instance "${formData.name}" created successfully`);
      setShowCreateForm(false);
      setFormData({
        name: 'ollama-instance',
        apiKey: '',
        requireAuth: false,
        hostname: 'inference.vm',
        gpuSelection: 'auto'
      });
      fetchInstances();
    } catch (error) {
      console.error('Error creating Ollama instance:', error);
      toast.error(error.response?.data?.error || 'Failed to create Ollama instance');
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (instance) => {
    try {
      await ollamaApi.start(instance.id);
      toast.success(`Started ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error starting Ollama instance:', error);
      toast.error('Failed to start Ollama instance');
    }
  };

  const handleStop = async (instance) => {
    try {
      await ollamaApi.stop(instance.id);
      toast.success(`Stopped ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error stopping Ollama instance:', error);
      toast.error('Failed to stop Ollama instance');
    }
  };

  const handleRestart = async (instance) => {
    try {
      await ollamaApi.restart(instance.id);
      toast.success(`Restarted ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error restarting Ollama instance:', error);
      toast.error('Failed to restart Ollama instance');
    }
  };

  const handleRemove = async (instance) => {
    if (!window.confirm(`Are you sure you want to remove ${instance.name}? This will also remove all downloaded models.`)) {
      return;
    }

    try {
      await ollamaApi.remove(instance.id);
      toast.success(`Removed ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error removing Ollama instance:', error);
      toast.error('Failed to remove Ollama instance');
    }
  };

  const handleViewDetails = (instance) => {
    navigate(`/ollama/${instance.id}`);
  };

  const getStatusBadge = (status, running) => {
    if (running) {
      return <span className="badge badge-success">Running</span>;
    }
    
    switch (status) {
      case 'running':
        return <span className="badge badge-success">Running</span>;
      case 'stopped':
        return <span className="badge badge-warning">Stopped</span>;
      case 'error':
        return <span className="badge badge-error">Error</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ollama Manager</h1>
          <p className="text-gray-600 mt-2">
            Manage Ollama instances and their models. Ollama can run multiple models in a single container.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Ollama Instance
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create Ollama Instance</h2>
            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Instance Name</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="ollama-instance"
                />
              </div>
              
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Require API Key Authentication</span>
                  <input
                    type="checkbox"
                    checked={formData.requireAuth}
                    onChange={(e) => setFormData({ ...formData, requireAuth: e.target.checked })}
                    className="toggle toggle-primary"
                  />
                </label>
              </div>

              {formData.requireAuth && (
                <div>
                  <label className="label">
                    <span className="label-text">API Key</span>
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="input input-bordered w-full"
                    placeholder="sk-..."
                  />
                </div>
              )}

              <div>
                <label className="label">
                  <span className="label-text">Hostname</span>
                </label>
                <input
                  type="text"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="inference.vm"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">GPU Selection</span>
                </label>
                <select
                  value={formData.gpuSelection}
                  onChange={(e) => setFormData({ ...formData, gpuSelection: e.target.value })}
                  className="select select-bordered w-full"
                >
                  <option value="auto">Auto-select (Recommended)</option>
                  <option value="first">First Available GPU</option>
                  <option value="least_used">Least Used GPU</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Instance'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instances List */}
      {instances.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Ollama instances yet</h3>
          <p className="text-gray-600 mb-4">
            Create your first Ollama instance to start managing models.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Instance
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {instances.map((instance) => (
            <div key={instance.id} className="card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Server className="w-5 h-5 mr-2" />
                    {instance.name}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Port: {instance.port} • {instance.deviceInfo || 'GPU mode'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(instance.status, instance.running)}
                  <button
                    onClick={() => fetchInstances()}
                    className="btn btn-ghost btn-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-2" />
                  Created: {formatDate(instance.created_at)}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Activity className="w-4 h-4 mr-2" />
                  Status: {instance.status}
                </div>
                {instance.running && (
                  <div className="flex items-center text-sm text-gray-600">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    <a
                      href={`http://${config.defaultHostname}:${instance.port}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Open Ollama
                    </a>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                {instance.running ? (
                  <button
                    onClick={() => handleStop(instance)}
                    className="btn btn-warning btn-sm"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => handleStart(instance)}
                    className="btn btn-success btn-sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </button>
                )}
                <button
                  onClick={() => handleRestart(instance)}
                  className="btn btn-secondary btn-sm"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restart
                </button>
                <button
                  onClick={() => handleViewDetails(instance)}
                  className="btn btn-primary btn-sm"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Manage Models
                </button>
                <button
                  onClick={() => handleRemove(instance)}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OllamaManager; 