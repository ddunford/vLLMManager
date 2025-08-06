import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Play, 
  Zap, 
  Eye, 
  Settings, 
  RefreshCw,
  Send,
  Bot,
  User,
  Clipboard,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Code,
  Image
} from 'lucide-react';
import { testApi, ollamaApi } from '../services/api';
import toast from 'react-hot-toast';

const Test = () => {
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
  const [capabilities, setCapabilities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testMode, setTestMode] = useState('chat');
  const [presets, setPresets] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatOptions, setChatOptions] = useState({
    temperature: 0.7,
    maxTokens: 512,
    topP: 0.9
  });

  // Completion state
  const [completionPrompt, setCompletionPrompt] = useState('');
  const [completionOptions, setCompletionOptions] = useState({
    temperature: 0.7,
    maxTokens: 512,
    topP: 0.9
  });

  // Embeddings state
  const [embeddingInput, setEmbeddingInput] = useState('');
  const [embeddingResult, setEmbeddingResult] = useState(null);

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageOptions, setImageOptions] = useState({
    size: '1024x1024',
    quality: 'standard',
    n: 1
  });
  const [imageResult, setImageResult] = useState(null);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await testApi.getInstances();
      setInstances(response.data);
      
      if (response.data.length > 0 && !selectedInstance) {
        const firstInstance = response.data[0];
        setSelectedInstance(firstInstance);
        if (firstInstance.type === 'ollama') {
          fetchOllamaModels(firstInstance.id);
        }
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
      toast.error('Failed to fetch running instances');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await testApi.getPresets();
      setPresets(response.data);
    } catch (error) {
      console.error('Error fetching presets:', error);
    }
  };

  const fetchOllamaModels = async (instanceId) => {
    try {
      const response = await ollamaApi.getModels(instanceId);
      setOllamaModels(response.data.models || []);
      if (response.data.models?.length > 0) {
        setSelectedOllamaModel(response.data.models[0].name);
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      toast.error('Could not load models for Ollama instance.');
    }
  };

  const fetchCapabilities = async (instanceId, instanceType) => {
    try {
      // For Ollama, we assume chat is supported and don't need to detect other capabilities
      if (instanceType === 'ollama') {
        setCapabilities({ chatCompletion: true });
        return;
      }
      const response = await testApi.getCapabilities(instanceId);
      setCapabilities(response.data);
    } catch (error) {
      console.error('Error fetching capabilities:', error);
      setCapabilities(null);
    }
  };

  useEffect(() => {
    fetchInstances();
    fetchPresets();
  }, []);

  useEffect(() => {
    if (selectedInstance) {
      fetchCapabilities(selectedInstance.id, selectedInstance.type);
      setConversationHistory([]);
      setOllamaModels([]); // Clear models on instance change
      if (selectedInstance.type === 'ollama') {
        fetchOllamaModels(selectedInstance.id);
      }
    }
  }, [selectedInstance]);

  const handleInstanceChange = (instanceId) => {
    const instance = instances.find(i => i.id === instanceId);
    setSelectedInstance(instance);
  };

  const handleQuickTest = async () => {
    if (!selectedInstance) return;

    try {
      setTesting(true);
      const response = await testApi.quickTest(selectedInstance.id);
      
      if (response.data.success) {
        toast.success('Instance is working correctly!');
        setConversationHistory([
          {
            role: 'assistant',
            content: response.data.response,
            timestamp: new Date().toISOString()
          }
        ]);
      } else {
        toast.error(`Test failed: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Quick test error:', error);
      toast.error('Quick test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInstance || !chatInput.trim()) return;
    if (selectedInstance.type === 'ollama' && !selectedOllamaModel) {
      toast.error('Please select a model for this Ollama instance.');
      return;
    }

    const userMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    const messages = [...conversationHistory, userMessage];
    setConversationHistory(messages);
    setChatInput('');
    setTesting(true);

    try {
      const response = await testApi.chat(selectedInstance.id, {
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        options: chatOptions,
        instanceType: selectedInstance.type,
        modelName: selectedInstance.type === 'ollama' ? selectedOllamaModel : selectedInstance.model_name
      });

      if (response.data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: response.data.response.choices[0]?.message?.content || 'No response',
          timestamp: new Date().toISOString(),
          usage: response.data.response.usage
        };
        
        setConversationHistory([...messages, assistantMessage]);
      } else {
        toast.error('Chat failed: ' + (response.data.error?.message || response.data.error));
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Chat request failed');
    } finally {
      setTesting(false);
    }
  };

  const handleCompletionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInstance || !completionPrompt.trim()) return;

    setTesting(true);
    try {
      const response = await testApi.completion(selectedInstance.id, {
        prompt: completionPrompt,
        options: completionOptions
      });

      if (response.data.success) {
        const completion = response.data.response.choices[0]?.text || 'No completion';
        setConversationHistory([
          {
            role: 'user',
            content: `Prompt: ${completionPrompt}`,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: completion,
            timestamp: new Date().toISOString(),
            usage: response.data.response.usage
          }
        ]);
        toast.success('Completion generated successfully');
      } else {
        toast.error('Completion failed: ' + (response.data.error?.message || response.data.error));
      }
    } catch (error) {
      console.error('Completion error:', error);
      toast.error('Completion request failed');
    } finally {
      setTesting(false);
    }
  };

  const handleEmbeddingsSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInstance || !embeddingInput.trim()) return;

    setTesting(true);
    try {
      const response = await testApi.embeddings(selectedInstance.id, {
        input: embeddingInput
      });

      if (response.data.success) {
        setEmbeddingResult(response.data.response);
        toast.success('Embeddings generated successfully');
      } else {
        toast.error('Embeddings failed: ' + (response.data.error?.message || response.data.error));
        setEmbeddingResult(null);
      }
    } catch (error) {
      console.error('Embeddings error:', error);
      toast.error('Embeddings request failed');
      setEmbeddingResult(null);
    } finally {
      setTesting(false);
    }
  };

  const handleImageGeneration = async (e) => {
    e.preventDefault();
    if (!selectedInstance || !imagePrompt.trim()) return;

    setTesting(true);
    try {
      const response = await testApi.imageGeneration(selectedInstance.id, {
        prompt: imagePrompt,
        options: imageOptions
      });

      if (response.data.success) {
        setImageResult(response.data.response);
        toast.success('Image generated successfully');
      } else {
        toast.error('Image generation failed: ' + (response.data.error?.message || response.data.error));
        setImageResult(null);
      }
    } catch (error) {
      console.error('Image generation error:', error);
      toast.error('Image generation request failed');
      setImageResult(null);
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (preset) => {
    if (testMode === 'chat') {
      setConversationHistory([]);
      setChatOptions(preset.options);
      // Auto-add the first message if it's a chat preset
      if (preset.messages && preset.messages.length > 0) {
        setChatInput(preset.messages[0].content);
      }
    } else if (testMode === 'completion') {
      setCompletionPrompt(preset.prompt);
      setCompletionOptions(preset.options);
      setConversationHistory([]);
    } else if (testMode === 'images') {
      setImagePrompt(preset.prompt);
      setImageOptions(preset.options);
      setImageResult(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const clearHistory = () => {
    setConversationHistory([]);
    setEmbeddingResult(null);
    setImageResult(null);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
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

  if (instances.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Running Instances</h2>
        <p className="text-gray-600 mb-6">Start some vLLM instances to test them here.</p>
        <a href="/create" className="btn btn-primary">
          Create Instance
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-8 h-8 mr-3" />
            Test vLLM Instances
          </h1>
          <p className="text-gray-600 mt-2">Interact with and test your running models</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchInstances}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          
          {selectedInstance && (
            <button
              onClick={handleQuickTest}
              disabled={testing}
              className="btn btn-primary btn-sm"
            >
              <Zap className="w-4 h-4 mr-2" />
              Quick Test
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Instance Selection */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Instance</h3>
            <select
              value={selectedInstance?.id || ''}
              onChange={(e) => handleInstanceChange(e.target.value)}
              className="input mb-4"
            >
              {instances.map(instance => (
                <option key={instance.id} value={instance.id}>
                  {instance.name} ({instance.model_name})
                </option>
              ))}
            </select>
            
            {selectedInstance && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Port:</span>
                  <span className="font-medium">{selectedInstance.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">GPU:</span>
                  <span className="font-medium">
                    {selectedInstance.gpu_id ? `GPU ${selectedInstance.gpu_id}` : 'CPU'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-green-600">{selectedInstance.status}</span>
                </div>
              </div>
            )}
          </div>

          {/* Capabilities */}
          {capabilities && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Capabilities</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Chat</span>
                  {capabilities.capabilities?.chatCompletion ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Completion</span>
                  {capabilities.capabilities?.textCompletion ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Embeddings</span>
                  {capabilities.capabilities?.embeddings ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Vision</span>
                  {capabilities.capabilities?.vision ? (
                    <Eye className="w-4 h-4 text-blue-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Test Mode Selection */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Mode</h3>
            <div className="space-y-2">
              <button
                onClick={() => setTestMode('chat')}
                className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  testMode === 'chat'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </button>
              <button
                onClick={() => setTestMode('completion')}
                className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  testMode === 'completion'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Code className="w-4 h-4 mr-2" />
                Completion
              </button>
              <button
                onClick={() => setTestMode('embeddings')}
                className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  testMode === 'embeddings'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Activity className="w-4 h-4 mr-2" />
                Embeddings
              </button>
              <button
                onClick={() => setTestMode('images')}
                className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  testMode === 'images'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Image className="w-4 h-4 mr-2" />
                Images
              </button>
            </div>
          </div>

          {/* Presets */}
          {presets && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Presets</h3>
              <div className="space-y-2">
                {(() => {
                  if (testMode === 'chat') return presets.chatPresets;
                  if (testMode === 'completion') return presets.completionPresets;
                  if (testMode === 'images') return presets.imagePresets || [];
                  return [];
                })().map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {testMode === 'chat' && (
            <>
              {/* Chat Interface */}
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Chat Interface</h2>
                  <button
                    onClick={clearHistory}
                    className="btn btn-secondary btn-sm"
                  >
                    Clear History
                  </button>
                </div>

                {/* Conversation History */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 min-h-96 max-h-96 overflow-y-auto">
                  {conversationHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <MessageSquare className="w-8 h-8 mr-2" />
                      Start a conversation...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {conversationHistory.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-md px-4 py-2 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-primary-600 text-white'
                              : 'bg-white border border-gray-200'
                          }`}>
                            <div className="flex items-center mb-1">
                              {message.role === 'user' ? (
                                <User className="w-4 h-4 mr-2" />
                              ) : (
                                <Bot className="w-4 h-4 mr-2" />
                              )}
                              <span className="text-xs opacity-75">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            {message.usage && (
                              <div className="text-xs opacity-75 mt-2">
                                Tokens: {message.usage.prompt_tokens}+{message.usage.completion_tokens}={message.usage.total_tokens}
                              </div>
                            )}
                            <button
                              onClick={() => copyToClipboard(message.content)}
                              className="text-xs opacity-75 hover:opacity-100 mt-1"
                            >
                              <Clipboard className="w-3 h-3 inline mr-1" />
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                      {testing && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
                            <div className="flex items-center">
                              <Bot className="w-4 h-4 mr-2" />
                              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                              Thinking...
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleChatSubmit}>
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type your message..."
                      className="input flex-1"
                      disabled={testing}
                    />
                    <button
                      type="submit"
                      disabled={testing || !chatInput.trim()}
                      className="btn btn-primary"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Chat Options */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Options</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Temperature: {chatOptions.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={chatOptions.temperature}
                      onChange={(e) => setChatOptions({...chatOptions, temperature: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="4096"
                      value={chatOptions.maxTokens}
                      onChange={(e) => setChatOptions({...chatOptions, maxTokens: parseInt(e.target.value)})}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Top P: {chatOptions.topP}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={chatOptions.topP}
                      onChange={(e) => setChatOptions({...chatOptions, topP: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {testMode === 'completion' && (
            <>
              {/* Text Completion Interface */}
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Text Completion</h2>
                  <button
                    onClick={clearHistory}
                    className="btn btn-secondary btn-sm"
                  >
                    Clear Results
                  </button>
                </div>

                <form onSubmit={handleCompletionSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prompt
                    </label>
                    <textarea
                      value={completionPrompt}
                      onChange={(e) => setCompletionPrompt(e.target.value)}
                      placeholder="Enter your prompt here..."
                      className="input h-32"
                      disabled={testing}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={testing || !completionPrompt.trim()}
                    className="btn btn-primary"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </button>
                </form>

                {/* Results */}
                {conversationHistory.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
                    <div className="space-y-4">
                      {conversationHistory.map((message, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              {message.role === 'user' ? 'Prompt' : 'Completion'}
                            </span>
                            <button
                              onClick={() => copyToClipboard(message.content)}
                              className="text-sm text-gray-600 hover:text-gray-800"
                            >
                              <Clipboard className="w-4 h-4 inline mr-1" />
                              Copy
                            </button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.usage && (
                            <div className="text-xs text-gray-500 mt-2">
                              Tokens: {message.usage.prompt_tokens}+{message.usage.completion_tokens}={message.usage.total_tokens}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Completion Options */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Options</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Temperature: {completionOptions.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={completionOptions.temperature}
                      onChange={(e) => setCompletionOptions({...completionOptions, temperature: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="4096"
                      value={completionOptions.maxTokens}
                      onChange={(e) => setCompletionOptions({...completionOptions, maxTokens: parseInt(e.target.value)})}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Top P: {completionOptions.topP}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={completionOptions.topP}
                      onChange={(e) => setCompletionOptions({...completionOptions, topP: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {testMode === 'embeddings' && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Embeddings</h2>

              <form onSubmit={handleEmbeddingsSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Input Text
                  </label>
                  <textarea
                    value={embeddingInput}
                    onChange={(e) => setEmbeddingInput(e.target.value)}
                    placeholder="Enter text to get embeddings..."
                    className="input h-32"
                    disabled={testing}
                  />
                </div>

                <button
                  type="submit"
                  disabled={testing || !embeddingInput.trim()}
                  className="btn btn-primary"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4 mr-2" />
                      Get Embeddings
                    </>
                  )}
                </button>
              </form>

              {embeddingResult && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-600">
                        <p>Model: {embeddingResult.model}</p>
                        <p>Dimensions: {embeddingResult.data[0]?.embedding?.length || 'Unknown'}</p>
                        <p>Usage: {embeddingResult.usage?.total_tokens || 'Unknown'} tokens</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(embeddingResult.data[0]?.embedding))}
                        className="btn btn-secondary btn-sm"
                      >
                        <Clipboard className="w-4 h-4 mr-2" />
                        Copy Vector
                      </button>
                    </div>
                    <div className="bg-white rounded border p-4 max-h-40 overflow-auto">
                      <code className="text-xs break-all">
                        [{embeddingResult.data[0]?.embedding?.slice(0, 10).join(', ')}...] 
                        ({embeddingResult.data[0]?.embedding?.length} dimensions)
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {testMode === 'images' && (
            <>
              {/* Image Generation Interface */}
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Image Generation</h2>
                  <button
                    onClick={() => setImageResult(null)}
                    className="btn btn-secondary btn-sm"
                  >
                    Clear Results
                  </button>
                </div>

                <form onSubmit={handleImageGeneration} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image Description
                    </label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Describe the image you want to generate..."
                      className="input h-32"
                      disabled={testing}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={testing || !imagePrompt.trim()}
                    className="btn btn-primary"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Image className="w-4 h-4 mr-2" />
                        Generate Image
                      </>
                    )}
                  </button>
                </form>

                {/* Image Results */}
                {imageResult && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Images</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {imageResult.data?.map((image, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="mb-4">
                            <img
                              src={image.url}
                              alt={`Generated image ${index + 1}`}
                              className="w-full h-64 object-cover rounded-lg border"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden w-full h-64 bg-gray-200 rounded-lg border items-center justify-center">
                              <p className="text-gray-500">Failed to load image</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                              <p>Image {index + 1}</p>
                              <p>Revision ID: {image.revised_prompt ? 'Revised' : 'Original'}</p>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => copyToClipboard(image.url)}
                                className="btn btn-secondary btn-sm"
                              >
                                <Clipboard className="w-4 h-4 mr-2" />
                                Copy URL
                              </button>
                              <a
                                href={image.url}
                                download={`generated-image-${index + 1}.png`}
                                className="btn btn-primary btn-sm"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                          {image.revised_prompt && (
                            <div className="mt-2 text-sm text-gray-600">
                              <p><strong>Revised Prompt:</strong> {image.revised_prompt}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Image Generation Options */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Options</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image Size
                    </label>
                    <select
                      value={imageOptions.size}
                      onChange={(e) => setImageOptions({...imageOptions, size: e.target.value})}
                      className="input"
                    >
                      <option value="1024x1024">1024x1024</option>
                      <option value="1792x1024">1792x1024</option>
                      <option value="1024x1792">1024x1792</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quality
                    </label>
                    <select
                      value={imageOptions.quality}
                      onChange={(e) => setImageOptions({...imageOptions, quality: e.target.value})}
                      className="input"
                    >
                      <option value="standard">Standard</option>
                      <option value="hd">HD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Images
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={imageOptions.n}
                      onChange={(e) => setImageOptions({...imageOptions, n: parseInt(e.target.value)})}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Test; 