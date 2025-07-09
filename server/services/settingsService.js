const { getDatabase } = require('../database/init');

class SettingsService {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  async loadSettings() {
    if (this.initialized) {
      return;
    }

    try {
      const db = getDatabase();
      
      return new Promise((resolve, reject) => {
        db.all('SELECT key, value, description FROM settings', (err, rows) => {
          db.close();
          
          if (err) {
            // If settings table doesn't exist yet, just mark as initialized
            console.log('Settings table not ready yet, will try again later');
            resolve([]);
            return;
          }
          
          // Cache all settings
          rows.forEach(row => {
            this.cache.set(row.key, {
              value: row.value,
              description: row.description
            });
          });
          
          this.initialized = true;
          console.log(`Loaded ${rows.length} settings from database`);
          resolve(rows);
        });
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async getAllSettings() {
    // Ensure settings are loaded
    await this.loadSettings();
    
    try {
      const db = getDatabase();
      
      return new Promise((resolve, reject) => {
        db.all('SELECT key, value, description, updated_at FROM settings ORDER BY key', (err, rows) => {
          db.close();
          
          if (err) {
            console.error('Error getting all settings:', err);
            resolve({});
            return;
          }
          
          const settings = {};
          rows.forEach(row => {
            settings[row.key] = {
              value: row.value,
              description: row.description,
              updatedAt: row.updated_at
            };
          });
          
          resolve(settings);
        });
      });
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  }

  async getSetting(key, defaultValue = null) {
    // Ensure settings are loaded
    await this.loadSettings();
    
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key).value;
    }

    try {
      const db = getDatabase();
      
      return new Promise((resolve, reject) => {
        db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
          db.close();
          
          if (err) {
            console.error('Error getting setting from database:', err);
            resolve(defaultValue);
            return;
          }
          
          const value = row ? row.value : defaultValue;
          
          // Cache the result
          if (row) {
            this.cache.set(key, { value: row.value });
          }
          
          resolve(value);
        });
      });
    } catch (error) {
      console.error('Error getting setting:', error);
      return defaultValue;
    }
  }

  async updateSetting(key, value) {
    try {
      const db = getDatabase();
      
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
          [value, key],
          function(err) {
            db.close();
            
            if (err) {
              reject(err);
              return;
            }
            
            if (this.changes === 0) {
              reject(new Error(`Setting '${key}' not found`));
              return;
            }
            
            // Update cache
            if (settingsService.cache.has(key)) {
              settingsService.cache.get(key).value = value;
            } else {
              settingsService.cache.set(key, { value });
            }
            
            resolve({ key, value, updated: true });
          }
        );
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  }

  async updateMultipleSettings(settings) {
    const results = [];
    const errors = [];

    for (const [key, value] of Object.entries(settings)) {
      try {
        const result = await this.updateSetting(key, value);
        results.push(result);
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    }

    return { success: results, errors };
  }

  // Helper methods for common settings
  async getDefaultHFToken() {
    return await this.getSetting('default_hf_token', '');
  }

  async getDefaultHostname() {
    return await this.getSetting('default_hostname', 'localhost');
  }

  async getDefaultAPIKey() {
    return await this.getSetting('default_api_key', 'localkey');
  }

  async getAutoStartInstances() {
    const value = await this.getSetting('auto_start_instances', 'true');
    return value === 'true';
  }

  async getDefaultModelFilter() {
    return await this.getSetting('default_model_filter', 'text-generation');
  }

  async getMaxConcurrentInstances() {
    const value = await this.getSetting('max_concurrent_instances', '5');
    return parseInt(value);
  }

  async getDefaultGPUSelection() {
    return await this.getSetting('default_gpu_selection', 'auto');
  }

  async getGPULoadBalancingEnabled() {
    const value = await this.getSetting('enable_gpu_load_balancing', 'true');
    return value === 'true';
  }

  // Get instance defaults for creating new instances
  async getInstanceDefaults() {
    return {
      hfToken: await this.getDefaultHFToken(),
      hostname: await this.getDefaultHostname(),
      apiKey: await this.getDefaultAPIKey(),
      autoStart: await this.getAutoStartInstances(),
      modelFilter: await this.getDefaultModelFilter(),
      gpuSelection: await this.getDefaultGPUSelection(),
      gpuLoadBalancing: await this.getGPULoadBalancingEnabled()
    };
  }
}

const settingsService = new SettingsService();
module.exports = settingsService; 