import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Download, 
  Heart, 
  Star, 
  ExternalLink,
  RefreshCw,
  Plus,
  Filter
} from 'lucide-react';
import { modelApi } from '../services/api';
import toast from 'react-hot-toast';

const ModelSearch = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('text-generation');
  const [popularModels, setPopularModels] = useState([]);
  const [showPopular, setShowPopular] = useState(true);
  const navigate = useNavigate();

  const fetchPopularModels = async () => {
    try {
      setLoading(true);
      const response = await modelApi.getPopular(20);
      setPopularModels(response.data.models);
    } catch (error) {
      console.error('Error fetching popular models:', error);
      toast.error('Failed to fetch popular models');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setShowPopular(false);
      const response = await modelApi.search(searchQuery, 20, filter);
      setModels(response.data.models);
    } catch (error) {
      console.error('Error searching models:', error);
      toast.error('Failed to search models');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = (modelId) => {
    navigate('/create', { state: { selectedModel: modelId } });
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getModelTags = (tags) => {
    const relevantTags = tags.filter(tag => 
      !tag.includes('license:') && 
      !tag.includes('language:') && 
      tag.length < 20
    ).slice(0, 3);
    
    return relevantTags;
  };

  useEffect(() => {
    fetchPopularModels();
  }, []);

  const displayModels = showPopular ? popularModels : models;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Model Search</h1>
          <p className="text-gray-600 mt-2">Browse and search HuggingFace models</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="card p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search models (e.g., 'Llama', 'GPT', 'Mistral')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
              />
            </div>
            <div className="w-48">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input"
              >
                <option value="text-generation">Text Generation</option>
                <option value="text2text-generation">Text-to-Text</option>
                <option value="conversational">Conversational</option>
                <option value="text-classification">Text Classification</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </button>
          </div>
        </form>

        {!showPopular && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              Found {models.length} models for "{searchQuery}"
            </p>
            <button
              onClick={() => {
                setShowPopular(true);
                setSearchQuery('');
                setModels([]);
              }}
              className="btn btn-secondary btn-sm"
            >
              <Star className="w-4 h-4 mr-2" />
              Show Popular
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-32">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
            <span className="text-lg text-gray-600">Loading models...</span>
          </div>
        </div>
      )}

      {/* Models Grid */}
      {!loading && displayModels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {showPopular ? 'Popular Models' : 'Search Results'}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Filter className="w-4 h-4" />
              <span>Filter: {filter}</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayModels.map((model) => (
              <div key={model.id} className="card p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {model.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      by {model.author}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Download className="w-4 h-4 mr-1" />
                      {formatNumber(model.downloads)}
                    </div>
                    <div className="flex items-center">
                      <Heart className="w-4 h-4 mr-1" />
                      {formatNumber(model.likes)}
                    </div>
                  </div>
                </div>

                {model.description && (
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                    {model.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {getModelTags(model.tags).map((tag, index) => (
                    <span key={index} className="badge badge-info text-xs">
                      {tag}
                    </span>
                  ))}
                  {model.gated && (
                    <span className="badge badge-warning text-xs">
                      Gated
                    </span>
                  )}
                  {model.private && (
                    <span className="badge badge-error text-xs">
                      Private
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <a
                    href={`https://huggingface.co/${model.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View on HF
                  </a>
                  
                  <button
                    onClick={() => handleCreateInstance(model.id)}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create Instance
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !showPopular && models.length === 0 && searchQuery && (
        <div className="card p-12 text-center">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No models found</h2>
          <p className="text-gray-600 mb-6">
            Try adjusting your search terms or filter
          </p>
          <button
            onClick={() => {
              setShowPopular(true);
              setSearchQuery('');
              setModels([]);
            }}
            className="btn btn-primary"
          >
            <Star className="w-4 h-4 mr-2" />
            Browse Popular Models
          </button>
        </div>
      )}
    </div>
  );
};

export default ModelSearch; 