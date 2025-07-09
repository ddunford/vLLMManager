import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  ExternalLink, 
  Activity,
  Clock,
  Server,
  Plus,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { containerApi, gpuApi } from '../services/api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gpuStats, setGpuStats] = useState(null);

  const fetchInstances = async () => {
    try {
      setRefreshing(true);
      const response = await containerApi.getAll();
      setInstances(response.data);
    } catch (error) {
      console.error('Error fetching instances:', error);
      toast.error('Failed to fetch instances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchGPUStats = async () => {
    try {
      const response = await gpuApi.getStats();
      setGpuStats(response.data);
    } catch (error) {
      console.error('Error fetching GPU stats:', error);
      // GPU stats are optional, so don't show error toast
    }
  };

  useEffect(() => {
    fetchInstances();
    fetchGPUStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchInstances();
      fetchGPUStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (instance) => {
    try {
      await containerApi.start(instance.id);
      toast.success(`Started ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error starting instance:', error);
      toast.error('Failed to start instance');
    }
  };

  const handleStop = async (instance) => {
    try {
      await containerApi.stop(instance.id);
      toast.success(`Stopped ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error stopping instance:', error);
      toast.error('Failed to stop instance');
    }
  };

  const handleRestart = async (instance) => {
    try {
      await containerApi.restart(instance.id);
      toast.success(`Restarted ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error restarting instance:', error);
      toast.error('Failed to restart instance');
    }
  };

  const handleRemove = async (instance) => {
    if (!window.confirm(`Are you sure you want to remove ${instance.name}?`)) {
      return;
    }

    try {
      await containerApi.remove(instance.id);
      toast.success(`Removed ${instance.name}`);
      fetchInstances();
    } catch (error) {
      console.error('Error removing instance:', error);
      toast.error('Failed to remove instance');
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
          <span className="text-lg text-gray-600">Loading instances...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">vLLM Instances</h1>
          <p className="text-gray-600 mt-2">Manage your running language model instances</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => { fetchInstances(); fetchGPUStats(); }}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to="/create" className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Instance
          </Link>
        </div>
      </div>

      {/* GPU Overview */}
      {gpuStats && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Server className="w-5 h-5 mr-2" />
              GPU Status
            </h2>
            <button
              onClick={fetchGPUStats}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
          
          {gpuStats.cpuMode ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-orange-600 mr-3" />
                <div>
                  <p className="text-orange-800 font-medium">CPU Mode</p>
                  <p className="text-orange-700 text-sm">No GPUs detected - instances will use CPU</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-800 font-medium">Total GPUs</p>
                    <p className="text-blue-600 text-sm">Available hardware</p>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {gpuStats.totalGPUs}
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-800 font-medium">Available</p>
                    <p className="text-green-600 text-sm">Ready for instances</p>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {gpuStats.availableGPUs}
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-800 font-medium">In Use</p>
                    <p className="text-purple-600 text-sm">Running instances</p>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {gpuStats.totalGPUs - gpuStats.availableGPUs}
                  </div>
                </div>
              </div>
              
              {gpuStats.gpuDetails && gpuStats.gpuDetails.length > 0 && (
                <div className="md:col-span-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">GPU Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {gpuStats.gpuDetails.map((gpu) => (
                      <div 
                        key={gpu.id} 
                        className={`border rounded-lg p-3 ${
                          gpu.status === 'available' 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-orange-200 bg-orange-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            GPU {gpu.id}
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            gpu.status === 'available' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {gpu.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate mb-1">
                          {gpu.name}
                        </p>
                        {gpu.memoryTotal !== 'Unknown' && (
                          <p className="text-xs text-gray-500">
                            {Math.round(gpu.memoryFree/1024)}GB free of {Math.round(gpu.memoryTotal/1024)}GB
                          </p>
                        )}
                        {gpu.instanceCount > 0 && (
                          <p className="text-xs text-gray-500">
                            {gpu.instanceCount} instance(s) running
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {instances.length === 0 ? (
        <div className="card p-12 text-center">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No instances running</h2>
          <p className="text-gray-600 mb-6">Get started by creating your first vLLM instance</p>
          <Link to="/create" className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Instance
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <div key={instance.id} className="card p-6 fade-in">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {instance.name}
                  </h3>
                  <p className="text-sm text-gray-600 truncate">
                    {instance.model_name}
                  </p>
                </div>
                {getStatusBadge(instance.status, instance.running)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Port:</span>
                  <span className="font-medium">{instance.port}</span>
                </div>
                {instance.gpu_id && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">GPU:</span>
                    <span className="font-medium">
                      {instance.gpu_id === 'auto' ? 'Auto' : `GPU ${instance.gpu_id}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">{formatDate(instance.created_at)}</span>
                </div>
                {instance.running && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">URL:</span>
                    <a
                      href={`http://localhost:${instance.port}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 flex items-center"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  {instance.running ? (
                    <button
                      onClick={() => handleStop(instance)}
                      className="btn btn-warning btn-sm"
                      title="Stop"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(instance)}
                      className="btn btn-success btn-sm"
                      title="Start"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRestart(instance)}
                    className="btn btn-secondary btn-sm"
                    title="Restart"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleRemove(instance)}
                    className="btn btn-danger btn-sm"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link
                  to={`/instance/${instance.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  <Activity className="w-4 h-4 mr-1" />
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard; 