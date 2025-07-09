const express = require('express');
const dockerService = require('../services/dockerService');
const gpuService = require('../services/gpuService');
const os = require('os');

const router = express.Router();

// Get system information including GPU details
router.get('/info', async (req, res) => {
  try {
    const gpuInfo = await dockerService.getGPUInfo();
    
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
      freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)), // GB
      uptime: Math.round(os.uptime()),
      nodeVersion: process.version,
      gpu: gpuInfo || { hasGPU: false, type: 'unknown' }
    };
    
    res.json(systemInfo);
  } catch (error) {
    console.error('Error getting system info:', error);
    res.status(500).json({ error: 'Failed to get system information' });
  }
});

// Get detailed GPU information
router.get('/gpu', async (req, res) => {
  try {
    const gpuInfo = await dockerService.getGPUInfo();
    res.json(gpuInfo);
  } catch (error) {
    console.error('Error getting GPU info:', error);
    res.status(500).json({ error: 'Failed to get GPU information' });
  }
});

// Get available GPUs with usage information
router.get('/gpu/available', async (req, res) => {
  try {
    const availableGPUs = await dockerService.getAvailableGPUs();
    res.json(availableGPUs);
  } catch (error) {
    console.error('Error getting available GPUs:', error);
    res.status(500).json({ error: 'Failed to get available GPUs' });
  }
});

// Get GPU statistics and usage
router.get('/gpu/stats', async (req, res) => {
  try {
    const stats = await dockerService.getGPUStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error getting GPU stats:', error);
    res.status(500).json({ error: 'Failed to get GPU statistics' });
  }
});

// Refresh GPU detection
router.post('/refresh-gpu', async (req, res) => {
  try {
    const gpuInfo = await dockerService.refreshGPUInfo();
    res.json({
      message: 'GPU information refreshed',
      gpu: gpuInfo
    });
  } catch (error) {
    console.error('Error refreshing GPU info:', error);
    res.status(500).json({ error: 'Failed to refresh GPU information' });
  }
});

// Get device configuration for specific GPU
router.get('/device-config/:gpuId?', async (req, res) => {
  try {
    const { gpuId } = req.params;
    const selectedGPU = await gpuService.selectOptimalGPU(gpuId || 'auto');
    const deviceConfig = gpuService.getDeviceConfigForGPU(selectedGPU);
    
    res.json({
      deviceInfo: deviceConfig.deviceInfo,
      hasGPUSupport: deviceConfig.hostConfig.DeviceRequests || deviceConfig.hostConfig.Devices ? true : false,
      environment: deviceConfig.environment,
      gpuId: deviceConfig.gpuId,
      selectedGPU: selectedGPU
    });
  } catch (error) {
    console.error('Error getting device config:', error);
    res.status(500).json({ error: 'Failed to get device configuration' });
  }
});

module.exports = router; 