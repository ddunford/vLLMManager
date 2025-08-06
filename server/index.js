const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const compression = require('compression');
const { initializeDatabase } = require('./database/init');
const { securityHeaders, apiLimiter, generalLimiter } = require('./middleware/security');
const { httpLogger, devLogger, securityLogger, logger } = require('./middleware/logging');
const orphanService = require('./services/orphanService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database and check for orphaned containers
async function startServer() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    
    // Check for orphaned containers on startup and auto-import them
    console.log('Checking for orphaned containers...');
    try {
      const orphanResults = await orphanService.checkAndImportOrphans(true);
      
      if (orphanResults.orphansDetected > 0) {
        console.log(`🔄 Orphan container recovery:`);
        console.log(`   Found: ${orphanResults.orphansDetected} orphaned containers`);
        
        if (orphanResults.imported) {
          console.log(`   Imported: ${orphanResults.imported.imported.length} containers`);
          console.log(`   Skipped: ${orphanResults.imported.skipped.length} containers`);
          console.log(`   Failed: ${orphanResults.imported.failed.length} containers`);
          
          // Log details of imported containers
          orphanResults.imported.imported.forEach(container => {
            console.log(`   ✅ Imported: ${container.name} (${container.modelName}) on port ${container.port}`);
          });
          
          // Log details of skipped containers
          orphanResults.imported.skipped.forEach(container => {
            console.log(`   ⏭️  Skipped: ${container.container} - ${container.reason}`);
          });
          
          // Log details of failed containers
          orphanResults.imported.failed.forEach(container => {
            console.log(`   ❌ Failed: ${container.container} - ${container.error}`);
          });
        }
      } else {
        console.log('✅ No orphaned containers found');
      }
    } catch (orphanError) {
      console.error('⚠️  Warning: Could not check for orphaned containers:', orphanError.message);
      console.log('   This is not critical - continuing with startup...');
    }
    
    // Now import routes after database is initialized
    const containerRoutes = require('./routes/containers');
    const ollamaRoutes = require('./routes/ollama');
    const modelRoutes = require('./routes/models');
    const systemRoutes = require('./routes/system');
    const settingsRoutes = require('./routes/settings');
    const testRoutes = require('./routes/test');

    // Security and logging middleware
    // app.use(securityHeaders); // Temporarily disabled for debugging
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
    app.use('/api/ollama', ollamaRoutes);
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