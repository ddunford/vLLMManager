const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const compression = require('compression');
const { initializeDatabase } = require('./database/init');
const { securityHeaders, apiLimiter, generalLimiter } = require('./middleware/security');
const { httpLogger, devLogger, securityLogger, logger } = require('./middleware/logging');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database FIRST, before loading routes
async function startServer() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    
    // Now import routes after database is initialized
    const containerRoutes = require('./routes/containers');
    const modelRoutes = require('./routes/models');
    const systemRoutes = require('./routes/system');
    const settingsRoutes = require('./routes/settings');
    const testRoutes = require('./routes/test');

    // Security and logging middleware
    app.use(securityHeaders);
    app.use(compression());
    app.use(securityLogger);
    
    // Request logging
    if (process.env.NODE_ENV === 'production') {
      app.use(httpLogger);
    } else {
      app.use(devLogger);
    }
    
    // Rate limiting
    app.use('/api/', apiLimiter);
    app.use(generalLimiter);
    
    // CORS and body parsing
    app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL || false 
        : true,
      credentials: true,
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Routes
    app.use('/api/containers', containerRoutes);
    app.use('/api/models', modelRoutes);
    app.use('/api/system', systemRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/test', testRoutes);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Serve static files from React build
    app.use(express.static(path.join(__dirname, '../frontend/build')));
    
    // Handle React routing - only for non-API routes
    app.get('*', (req, res) => {
      // Don't serve React app for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
    });

    app.listen(PORT, () => {
      logger.info(`vLLM Manager server running on port ${PORT}`);
      console.log(`vLLM Manager server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app; 