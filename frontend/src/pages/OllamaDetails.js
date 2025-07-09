import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Square, 
  RotateCcw, 
  Trash2,
  ExternalLink,
  RefreshCw,
  Terminal,
  Clock,
  Server,
  Activity,
  Download,
  Package,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Plus,
  Search
} from 'lucide-react';
import { ollamaApi } from '../services/api';
import toast from 'react-hot-toast';

const OllamaDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showPullForm, setShowPullForm] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [modelName, setModelName] = useState('');

  const fetchInstance = async () => {
    try {
      const response = await ollamaApi.get(id);
      setInstance(response.data);
    } catch (error) {
      console.error('Error fetching Ollama instance:', error);
      toast.error('Failed to fetch Ollama instance details');
      navigate('/ollama');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await ollamaApi.getLogs(id, 500);
      setLogs(response.data.logs || 'No logs available');
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch logs');
      setLogs('Error loading logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstance();
    fetchLogs();
  }, [id]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchInstance();
        fetchLogs();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleStart = async () => {
    try {
      await ollamaApi.start(id);
      toast.success('Ollama instance started');
      fetchInstance();
    } catch (error) {
      console.error('Error starting Ollama instance:', error);
      toast.error('Failed to start Ollama instance');
    }
  };

  const handleStop = async () => {
    try {
      await ollamaApi.stop(id);
      toast.success('Ollama instance stopped');
      fetchInstance();
    } catch (error) {
      console.error('Error stopping Ollama instance:', error);
      toast.error('Failed to stop Ollama instance');
    }
  };

  const handleRestart = async () => {
    try {
      await ollamaApi.restart(id);
      toast.success('Ollama instance restarted');
      fetchInstance();
    } catch (error) {
      console.error('Error restarting Ollama instance:', error);
      toast.error('Failed to restart Ollama instance');
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Are you sure you want to remove ${instance?.name}? This will also remove all downloaded models.`)) {
      return;
    }

    try {
      await ollamaApi.remove(id);
      toast.success('Ollama instance removed');
      navigate('/ollama');
    } catch (error) {
      console.error('Error removing Ollama instance:', error);
      toast.error('Failed to remove Ollama instance');
    }
  };

  const handlePullModel = async (e) => {
    e.preventDefault();
    
    if (!modelName.trim()) {
      toast.error('Model name is required');
      return;
    }

    try {
      setPulling(true);
      await ollamaApi.pullModel(id, modelName);
      toast.success(`Model ${modelName} pulled successfully`);
      setShowPullForm(false);
      setModelName('');
      fetchInstance();
    } catch (error) {
      console.error('Error pulling model:', error);
      toast.error(error.response?.data?.error || 'Failed to pull model');
    } finally {
      setPulling(false);
    }
  };

  const handleDeleteModel = async (modelName) => {
    if (!window.confirm(`Are you sure you want to delete the model "${modelName}"?`)) {
      return;
    }

    try {
      await ollamaApi.deleteModel(id, modelName);
      toast.success(`Model ${modelName} deleted successfully`);
      fetchInstance();
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error('Failed to delete model');
    }
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

  const getModelStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <span className="badge badge-success">Ready</span>;
      case 'downloading':
        return <span className="badge badge-info">Downloading</span>;
      case 'failed':
        return <span className="badge badge-error">Failed</span>;
      default:
        return <span className="badge badge-warning">{status}</span>;
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

  if (!instance) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ollama instance not found</h3>
        <button
          onClick={() => navigate('/ollama')}
          className="btn btn-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Ollama Manager
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/ollama')}
            className="btn btn-ghost btn-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Server className="w-8 h-8 mr-3" />
              {instance.name}
            </h1>
            <p className="text-gray-600 mt-1">
              Ollama instance on port {instance.port}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(instance.status, instance.running)}
          <button
            onClick={() => fetchInstance()}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instance Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Instance Details */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Instance Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium">{instance.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Port:</span>
                <span className="font-medium">{instance.port}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">{formatDate(instance.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Updated:</span>
                <span className="font-medium">{formatDate(instance.updated_at)}</span>
              </div>
              {instance.running && (
                <div className="flex justify-between">
                  <span className="text-gray-600">API URL:</span>
                  <a
                    href={`http://localhost:${instance.port}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-800 flex items-center"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Models */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Models ({instance.models?.length || 0})
              </h3>
              <button
                onClick={() => setShowPullForm(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Pull Model
              </button>
            </div>

            {/* Pull Model Form */}
            {showPullForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Pull New Model</h4>
                <form onSubmit={handlePullModel} className="flex space-x-2">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="input input-bordered flex-1"
                    placeholder="llama2:7b"
                  />
                  <button
                    type="submit"
                    disabled={pulling}
                    className="btn btn-primary btn-sm"
                  >
                    {pulling ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Pulling...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Pull
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPullForm(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Models List */}
            {instance.models && instance.models.length > 0 ? (
              <div className="space-y-3">
                {instance.models.map((model) => (
                  <div key={model.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-sm text-gray-600">
                          {model.size && `Size: ${formatSize(model.size)}`}
                          {model.modified_at && ` • Modified: ${formatDate(model.modified_at)}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getModelStatusBadge(model.status)}
                      <button
                        onClick={() => handleDeleteModel(model.name)}
                        className="btn btn-danger btn-xs"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No models downloaded yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Pull a model to get started
                </p>
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Terminal className="w-5 h-5 mr-2" />
                Container Logs
              </h3>
              <div className="flex items-center space-x-2">
                <label className="flex items-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="mr-2"
                  />
                  Auto-refresh
                </label>
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="btn btn-secondary btn-sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
            
            <div className="bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-auto max-h-96">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading logs...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap">{logs}</pre>
              )}
            </div>
          </div>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Actions
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                {instance.running ? (
                  <button
                    onClick={handleStop}
                    className="btn btn-warning btn-sm flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    className="btn btn-success btn-sm flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </button>
                )}
                <button
                  onClick={handleRestart}
                  className="btn btn-secondary btn-sm flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restart
                </button>
              </div>
              <button
                onClick={handleRemove}
                className="btn btn-danger btn-sm w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Instance
              </button>
            </div>
          </div>

          {/* API Usage */}
          {instance.running && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">API Usage</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600 mb-2">Base URL:</p>
                  <code className="text-sm bg-white p-2 rounded border block">
                    http://localhost:{instance.port}
                  </code>
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600 mb-2">Example cURL request:</p>
                  <code className="text-sm bg-white p-2 rounded border block whitespace-pre-wrap">
{`curl -X POST http://localhost:${instance.port}/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama2:7b",
    "prompt": "Hello, how are you?",
    "stream": false
  }'`}
                  </code>
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600 mb-2">Python SDK example:</p>
                  <code className="text-sm bg-white p-2 rounded border block whitespace-pre-wrap">
{`import requests

response = requests.post(
    f"http://localhost:${instance.port}/api/generate",
    json={
        "model": "llama2:7b",
        "prompt": "Hello, how are you?",
        "stream": False
    }
)
print(response.json()["response"])`}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OllamaDetails; 