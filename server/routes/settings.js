const express = require('express');
const settingsService = require('../services/settingsService');

const router = express.Router();

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await settingsService.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Get a specific setting
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await settingsService.getSetting(key);
    
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ key, value });
  } catch (error) {
    console.error('Error getting setting:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

// Update a specific setting
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    const result = await settingsService.updateSetting(key, value.toString());
    res.json(result);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: error.message || 'Failed to update setting' });
  }
});

// Update multiple settings at once
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    
    const result = await settingsService.updateMultipleSettings(settings);
    
    if (result.errors.length > 0) {
      return res.status(207).json({
        message: 'Some settings updated with errors',
        success: result.success,
        errors: result.errors
      });
    }
    
    res.json({
      message: 'All settings updated successfully',
      success: result.success
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get instance defaults (commonly used settings for creating instances)
router.get('/defaults/instance', async (req, res) => {
  try {
    const defaults = await settingsService.getInstanceDefaults();
    res.json(defaults);
  } catch (error) {
    console.error('Error getting instance defaults:', error);
    res.status(500).json({ error: 'Failed to get instance defaults' });
  }
});

// Reset settings to defaults
router.post('/reset', async (req, res) => {
  try {
    const defaultSettings = {
      'default_hf_token': '',
      'default_hostname': 'inference.vm',
      'default_api_key': 'localkey',
      'auto_start_instances': 'true',
      'default_model_filter': 'text-generation',
      'max_concurrent_instances': '5'
    };
    
    const result = await settingsService.updateMultipleSettings(defaultSettings);
    
    res.json({
      message: 'Settings reset to defaults',
      success: result.success,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

// Export/backup settings
router.get('/export/backup', async (req, res) => {
  try {
    const settings = await settingsService.getAllSettings();
    
    const backup = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      settings: settings
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=vllm-manager-settings.json');
    res.json(backup);
  } catch (error) {
    console.error('Error exporting settings:', error);
    res.status(500).json({ error: 'Failed to export settings' });
  }
});

// Import/restore settings
router.post('/import/restore', async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    
    // Extract only the values from the imported settings
    const settingsToImport = {};
    Object.keys(settings).forEach(key => {
      if (settings[key].value !== undefined) {
        settingsToImport[key] = settings[key].value;
      }
    });
    
    const result = await settingsService.updateMultipleSettings(settingsToImport);
    
    res.json({
      message: 'Settings imported successfully',
      imported: Object.keys(settingsToImport).length,
      success: result.success,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error importing settings:', error);
    res.status(500).json({ error: 'Failed to import settings' });
  }
});

module.exports = router; 