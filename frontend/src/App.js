import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import ModelSearch from './pages/ModelSearch';
import CreateInstance from './pages/CreateInstance';
import EditInstance from './pages/EditInstance';
import InstanceDetails from './pages/InstanceDetails';
import OllamaManager from './pages/OllamaManager';
import OllamaDetails from './pages/OllamaDetails';
import Settings from './pages/Settings';
import Test from './pages/Test';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<ModelSearch />} />
            <Route path="/create" element={<CreateInstance />} />
            <Route path="/edit/:id" element={<EditInstance />} />
            <Route path="/ollama" element={<OllamaManager />} />
            <Route path="/ollama/:id" element={<OllamaDetails />} />
            <Route path="/test" element={<Test />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/instance/:id" element={<InstanceDetails />} />
          </Routes>
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#10b981',
              },
            },
            error: {
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App; 