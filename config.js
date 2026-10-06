const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  STORAGE_DIR: path.join(__dirname, 'storage'),
  UPLOADS_DIR: path.join(__dirname, 'storage', 'uploads'),
  DEVICES_FILE: path.join(__dirname, 'storage', 'devices.json'),
  PUBLIC_BINARIES_DIR: path.join(__dirname, 'public', 'binaries'),
  HEARTBEAT_INTERVAL: 15000, // 15 seconds ping
  PONG_TIMEOUT: 45000, // 45 seconds timeout
  // Default public URL (updated automatically when Cloudflare tunnel runs)
  PUBLIC_URL: process.env.PUBLIC_URL || 'http://localhost:3000'
};
