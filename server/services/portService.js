const { getDatabase } = require('../database/init');

class PortService {
  constructor() {
    this.MIN_PORT = 8001;
    this.MAX_PORT = 9000;
  }

  async allocatePort(instanceId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      // Find an available port
      db.all('SELECT port FROM allocated_ports ORDER BY port', (err, rows) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        const allocatedPorts = rows.map(row => row.port);
        let availablePort = this.MIN_PORT;

        // Find the first available port
        while (availablePort <= this.MAX_PORT) {
          if (!allocatedPorts.includes(availablePort)) {
            break;
          }
          availablePort++;
        }

        if (availablePort > this.MAX_PORT) {
          db.close();
          reject(new Error('No available ports'));
          return;
        }

        // Allocate the port
        db.run(
          'INSERT INTO allocated_ports (port, instance_id) VALUES (?, ?)',
          [availablePort, instanceId],
          function(err) {
            db.close();
            if (err) {
              reject(err);
              return;
            }
            resolve(availablePort);
          }
        );
      });
    });
  }

  async releasePort(port) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      db.run('DELETE FROM allocated_ports WHERE port = ?', [port], function(err) {
        db.close();
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      });
    });
  }

  async getPortForInstance(instanceId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      db.get(
        'SELECT port FROM allocated_ports WHERE instance_id = ?',
        [instanceId],
        (err, row) => {
          db.close();
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? row.port : null);
        }
      );
    });
  }

  async getAllocatedPorts() {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      db.all('SELECT * FROM allocated_ports', (err, rows) => {
        db.close();
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }
}

module.exports = new PortService(); 