const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/vllm.db');

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // Use serialize to ensure all operations complete in sequence
    db.serialize(() => {
      // Create instances table
      db.run(`
        CREATE TABLE IF NOT EXISTS instances (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          model_name TEXT NOT NULL,
          port INTEGER NOT NULL UNIQUE,
          container_id TEXT,
          status TEXT DEFAULT 'stopped',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          config TEXT,
          api_key TEXT,
          gpu_id TEXT
        )
      `);

      // Add gpu_id column to existing instances table (for backward compatibility)
      db.run(`
        ALTER TABLE instances ADD COLUMN gpu_id TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.log('gpu_id column already exists or error adding it:', err.message);
        }
      });

      // Create ports table to track allocated ports
      db.run(`
        CREATE TABLE IF NOT EXISTS allocated_ports (
          port INTEGER PRIMARY KEY,
          instance_id TEXT,
          allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (instance_id) REFERENCES instances (id)
        )
      `);

      // Create settings table for user preferences
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default settings
      db.run(`
        INSERT OR IGNORE INTO settings (key, value, description) VALUES 
        ('default_hf_token', '', 'Default HuggingFace API token for accessing models'),
        ('default_hostname', '${process.env.DEFAULT_HOSTNAME || 'localhost'}', 'Default hostname for vLLM instance URLs'),
        ('default_api_key', '${process.env.DEFAULT_API_KEY || 'localkey'}', 'Default API key for vLLM instances'),
        ('auto_start_instances', 'true', 'Automatically start instances after creation'),
        ('default_model_filter', 'text-generation', 'Default filter for model search'),
        ('max_concurrent_instances', '5', 'Maximum number of concurrent instances allowed'),
        ('default_gpu_selection', 'auto', 'Default GPU selection strategy (auto for load balancing, or specific GPU ID)'),
        ('enable_gpu_load_balancing', 'true', 'Enable automatic GPU load balancing')
      `, (err) => {
        if (err) {
          console.error('Error inserting default settings:', err);
        } else {
          console.log('Database initialized successfully with default settings');
        }
      });

      // Close database and resolve promise
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database initialization completed');
          resolve();
        }
      });
    });
  });
}

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

module.exports = {
  initializeDatabase,
  getDatabase
}; 