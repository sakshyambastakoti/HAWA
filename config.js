const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  STORAGE_DIR: path.join(__dirname, 'storage'),
  UPLOADS_DIR: path.join(__dirname, 'storage', 'uploads'),
  DEVICES_FILE: path.join(__dirname, 'storage', 'devices.json'),
  FIRMWARES_FILE: path.join(__dirname, 'storage', 'firmwares.json'),
  SETTINGS_FILE: path.join(__dirname, 'storage', 'settings.json'),
  PUBLIC_BINARIES_DIR: path.join(__dirname, 'public', 'binaries'),
  HEARTBEAT_INTERVAL: 15000, // 15 seconds ping
  PONG_TIMEOUT: 45000, // 45 seconds timeout
  // Default public URL (auto-detects Render.com or custom environment)
  PUBLIC_URL: (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '')
};
