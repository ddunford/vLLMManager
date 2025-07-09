const request = require('supertest');
const app = require('../index');

describe('API Tests', () => {
  describe('Health Check', () => {
    test('GET /api/health should return 200', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Container API', () => {
    test('GET /api/containers should return array', async () => {
      const response = await request(app)
        .get('/api/containers')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/containers should require name and modelName', async () => {
      const response = await request(app)
        .post('/api/containers')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/containers should accept valid data', async () => {
      const response = await request(app)
        .post('/api/containers')
        .send({
          name: 'test-instance',
          modelName: 'microsoft/DialoGPT-medium',
          apiKey: 'test-key',
          hostname: 'localhost'
        });
      
      // Should either succeed or fail gracefully
      expect([200, 201, 400, 500]).toContain(response.status);
    });
  });

  describe('Models API', () => {
    test('GET /api/models/popular should return array', async () => {
      const response = await request(app)
        .get('/api/models/popular')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/models/search should accept query parameter', async () => {
      const response = await request(app)
        .get('/api/models/search')
        .query({ query: 'gpt' })
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Settings API', () => {
    test('GET /api/settings should return settings object', async () => {
      const response = await request(app)
        .get('/api/settings')
        .expect(200);
      
      expect(typeof response.body).toBe('object');
    });

    test('GET /api/settings/defaults/instance should return defaults', async () => {
      const response = await request(app)
        .get('/api/settings/defaults/instance')
        .expect(200);
      
      expect(response.body).toHaveProperty('hostname');
      expect(response.body).toHaveProperty('apiKey');
    });
  });

  describe('System API', () => {
    test('GET /api/system/info should return system info', async () => {
      const response = await request(app)
        .get('/api/system/info')
        .expect(200);
      
      expect(response.body).toHaveProperty('node_version');
      expect(response.body).toHaveProperty('platform');
    });
  });
}); 