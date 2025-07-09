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
  Edit
} from 'lucide-react';
import { containerApi } from '../services/api';
import toast from 'react-hot-toast';

const InstanceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchInstance = async () => {
    try {
      const response = await containerApi.getAll();
      const foundInstance = response.data.find(inst => inst.id === id);
      if (foundInstance) {
        setInstance(foundInstance);
      } else {
        toast.error('Instance not found');
        navigate('/');
      }
    } catch (error) {
      console.error('Error fetching instance:', error);
      toast.error('Failed to fetch instance details');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await containerApi.getLogs(id, 500);
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
      await containerApi.start(id);
      toast.success('Instance started');
      fetchInstance();
    } catch (error) {
      console.error('Error starting instance:', error);
      toast.error('Failed to start instance');
    }
  };

  const handleStop = async () => {
    try {
      await containerApi.stop(id);
      toast.success('Instance stopped');
      fetchInstance();
    } catch (error) {
      console.error('Error stopping instance:', error);
      toast.error('Failed to stop instance');
    }
  };

  const handleRestart = async () => {
    try {
      await containerApi.restart(id);
      toast.success('Instance restarted');
      fetchInstance();
    } catch (error) {
      console.error('Error restarting instance:', error);
      toast.error('Failed to restart instance');
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Are you sure you want to remove ${instance?.name}?`)) {
      return;
    }

    try {
      await containerApi.remove(id);
      toast.success('Instance removed');
      navigate('/');
    } catch (error) {
      console.error('Error removing instance:', error);
      toast.error('Failed to remove instance');
    }
  };

  const handleEdit = () => {
    navigate(`/edit/${id}`);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
          <span className="text-lg text-gray-600">Loading instance...</span>
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="text-center py-12">
        <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Instance not found</h2>
        <p className="text-gray-600 mb-6">The instance you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/')}
          className="btn btn-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
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
            onClick={() => navigate(-1)}
            className="btn btn-secondary btn-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{instance.name}</h1>
            <p className="text-gray-600 mt-1">{instance.model_name}</p>
          </div>
        </div>
        {getStatusBadge(instance.status, instance.running)}
      </div>

      {/* Instance Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Server className="w-5 h-5 mr-2" />
            Instance Details
          </h3>
          <div className="space-y-3">
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
            <div className="flex space-x-2">
              <button
                onClick={handleEdit}
                className="btn btn-primary btn-sm flex-1"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Instance
              </button>
              <button
                onClick={handleRemove}
                className="btn btn-danger btn-sm flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Instance
              </button>
            </div>
          </div>
        </div>
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
              <p className="text-sm text-gray-600 mb-2">Authentication:</p>
              {instance.config && JSON.parse(instance.config).requireAuth !== false ? (
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2">
                    ✓ API Key Required (OpenAI-compatible)
                  </p>
                  {instance.api_key && (
                    <code className="text-sm bg-white p-2 rounded border block">
                      Authorization: Bearer {instance.api_key}
                    </code>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-orange-700">
                  ⚠ No Authentication Required (Public Access)
                </p>
              )}
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600 mb-2">Example cURL request (OpenAI-compatible):</p>
              <code className="text-sm bg-white p-2 rounded border block whitespace-pre-wrap">
{instance.config && JSON.parse(instance.config).requireAuth !== false ? 
`curl -X POST http://localhost:${instance.port}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${instance.api_key || 'YOUR_API_KEY'}" \\
  -d '{
    "model": "${instance.model_name}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'` :
`curl -X POST http://localhost:${instance.port}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${instance.model_name}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'`}
              </code>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600 mb-2">Using with OpenUI or other OpenAI-compatible tools:</p>
              <code className="text-sm bg-white p-2 rounded border block whitespace-pre-wrap">
{`# Set environment variables
export OPENAI_API_BASE="http://localhost:${instance.port}/v1"
${instance.config && JSON.parse(instance.config).requireAuth !== false ? 
`export OPENAI_API_KEY="${instance.api_key || 'YOUR_API_KEY'}"` : 
'# No API key needed - authentication disabled'}

# Use with OpenUI or any OpenAI SDK`}
              </code>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600 mb-2">Python SDK example:</p>
              <code className="text-sm bg-white p-2 rounded border block whitespace-pre-wrap">
{`from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:${instance.port}/v1",
    api_key="${instance.config && JSON.parse(instance.config).requireAuth !== false ? 
      (instance.api_key || 'YOUR_API_KEY') : 
      'dummy'}"  # Use 'dummy' when auth is disabled
)

response = client.chat.completions.create(
    model="${instance.model_name}",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstanceDetails; 