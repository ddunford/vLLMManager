// Test setup file
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // Use in-memory database for tests
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock external dependencies that might not be available in test environment
jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    listContainers: jest.fn().mockResolvedValue([]),
    createContainer: jest.fn().mockResolvedValue({
      id: 'test-container-id',
      start: jest.fn().mockResolvedValue({}),
      stop: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({}),
    }),
    getContainer: jest.fn().mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        State: { Status: 'running', Running: true }
      }),
      logs: jest.fn().mockResolvedValue('Test logs'),
      start: jest.fn().mockResolvedValue({}),
      stop: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({}),
    }),
  }));
});

// Mock GPU service for tests
jest.mock('../services/gpuService', () => ({
  initializeGPUDetection: jest.fn().mockResolvedValue({}),
  getGPUInfo: jest.fn().mockResolvedValue({ hasGPU: false, gpus: [] }),
  getAvailableGPUs: jest.fn().mockResolvedValue([]),
  selectOptimalGPU: jest.fn().mockResolvedValue({ id: 'cpu', name: 'CPU' }),
  getDeviceConfigForGPU: jest.fn().mockReturnValue({
    hostConfig: {},
    environment: ['VLLM_LOGGING_LEVEL=INFO'],
    deviceInfo: 'CPU-only mode',
    gpuId: null,
  }),
}));

// Global test timeout
jest.setTimeout(30000); 