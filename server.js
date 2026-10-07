const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const cors = require('cors');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure storage directories exist
if (!fs.existsSync(config.STORAGE_DIR)) fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
if (!fs.existsSync(config.UPLOADS_DIR)) fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });

// Setup Multer for .bin file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.UPLOADS_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16 MB max for ESP binary
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.bin')) {
      cb(null, true);
    } else {
      cb(new Error('Only .bin firmware files are supported'));
    }
  }
});

// Device Store (Persistent)
let devices = {};
function loadDevices() {
  try {
    if (fs.existsSync(config.DEVICES_FILE)) {
      devices = JSON.parse(fs.readFileSync(config.DEVICES_FILE, 'utf8'));
      // Mark all as offline on server restart
      Object.keys(devices).forEach(id => {
        devices[id].status = 'offline';
      });
    }
  } catch (err) {
    console.error('[Store] Error loading devices:', err.message);
    devices = {};
  }
}
function saveDevices() {
  try {
    fs.writeFileSync(config.DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf8');
  } catch (err) {
    console.error('[Store] Error saving devices:', err.message);
  }
}
loadDevices();

// Firmware Library Store (Persistent)
let firmwares = [];
function loadFirmwares() {
  try {
    if (fs.existsSync(config.FIRMWARES_FILE)) {
      firmwares = JSON.parse(fs.readFileSync(config.FIRMWARES_FILE, 'utf8'));
    } else {
      firmwares = [];
    }
  } catch (err) {
    console.error('[Store] Error loading firmwares:', err.message);
    firmwares = [];
  }
}
function saveFirmwares() {
  try {
    fs.writeFileSync(config.FIRMWARES_FILE, JSON.stringify(firmwares, null, 2), 'utf8');
  } catch (err) {
    console.error('[Store] Error saving firmwares:', err.message);
  }
}
loadFirmwares();

// System Settings Store (Persistent)
let systemSettings = {
  publicUrl: config.PUBLIC_URL,
  heartbeatInterval: config.HEARTBEAT_INTERVAL / 1000,
  pongTimeout: config.PONG_TIMEOUT / 1000,
  maxLogLines: 200,
  autoScrollLogs: true
};

function loadSettings() {
  try {
    if (fs.existsSync(config.SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf8'));
      systemSettings = { ...systemSettings, ...saved };
      if (saved.publicUrl) config.PUBLIC_URL = saved.publicUrl;
      if (saved.heartbeatInterval) config.HEARTBEAT_INTERVAL = saved.heartbeatInterval * 1000;
      if (saved.pongTimeout) config.PONG_TIMEOUT = saved.pongTimeout * 1000;
    }
  } catch (err) {
    console.error('[Store] Error loading settings:', err.message);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(config.SETTINGS_FILE, JSON.stringify(systemSettings, null, 2), 'utf8');
  } catch (err) {
    console.error('[Store] Error saving settings:', err.message);
  }
}
loadSettings();

// In-Memory Connection Tracking
const activeEspSockets = new Map(); // deviceId -> WebSocket
const activeDashboardSockets = new Set(); // Set of WebSockets
const recentLogs = new Map(); // deviceId -> Array of last 200 logs

function addDeviceLog(deviceId, message) {
  if (!recentLogs.has(deviceId)) {
    recentLogs.set(deviceId, []);
  }
  const logs = recentLogs.get(deviceId);
  const logEntry = {
    timestamp: Date.now(),
    text: message
  };
  logs.push(logEntry);
  if (logs.length > 200) logs.shift();
  return logEntry;
}

function broadcastToDashboards(data) {
  const payload = JSON.stringify(data);
  for (const client of activeDashboardSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Compute MD5 of file
function calculateMD5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ==========================================
// REST API ROUTES
// ==========================================

// Server & Tunnel info
app.get('/api/config', (req, res) => {
  res.json({
    publicUrl: config.PUBLIC_URL,
    localPort: config.PORT,
    activeDevicesCount: activeEspSockets.size,
    totalDevicesCount: Object.keys(devices).length
  });
});

// Update public URL (useful for Cloudflare Tunnel)
app.post('/api/tunnel/set-url', (req, res) => {
  const { url } = req.body;
  if (url) {
    config.PUBLIC_URL = url.replace(/\/$/, '');
    console.log(`[Tunnel] Public URL updated to: ${config.PUBLIC_URL}`);
    broadcastToDashboards({
      type: 'SERVER_CONFIG_UPDATED',
      publicUrl: config.PUBLIC_URL
    });
    return res.json({ success: true, publicUrl: config.PUBLIC_URL });
  }
  res.status(400).json({ error: 'URL required' });
});

// System Settings API (Get & Update)
app.get('/api/settings', (req, res) => {
  res.json({
    settings: systemSettings,
    server: {
      uptime: process.uptime(),
      localPort: config.PORT,
      host: config.HOST,
      activeEspCount: activeEspSockets.size,
      totalDevicesCount: Object.keys(devices).length,
      firmwaresCount: firmwares.length
    }
  });
});

app.post('/api/settings', (req, res) => {
  const { publicUrl, heartbeatInterval, pongTimeout, maxLogLines, autoScrollLogs } = req.body;

  if (publicUrl && typeof publicUrl === 'string') {
    config.PUBLIC_URL = publicUrl.trim().replace(/\/$/, '');
    systemSettings.publicUrl = config.PUBLIC_URL;
  }
  if (heartbeatInterval && !isNaN(heartbeatInterval)) {
    const sec = Math.max(5, Math.min(300, Number(heartbeatInterval)));
    config.HEARTBEAT_INTERVAL = sec * 1000;
    systemSettings.heartbeatInterval = sec;
  }
  if (pongTimeout && !isNaN(pongTimeout)) {
    const sec = Math.max(10, Math.min(600, Number(pongTimeout)));
    config.PONG_TIMEOUT = sec * 1000;
    systemSettings.pongTimeout = sec;
  }
  if (maxLogLines && !isNaN(maxLogLines)) {
    systemSettings.maxLogLines = Math.max(50, Math.min(1000, Number(maxLogLines)));
  }
  if (typeof autoScrollLogs === 'boolean') {
    systemSettings.autoScrollLogs = autoScrollLogs;
  }

  saveSettings();

  broadcastToDashboards({
    type: 'SERVER_CONFIG_UPDATED',
    publicUrl: config.PUBLIC_URL,
    settings: systemSettings
  });

  broadcastToDashboards({
    type: 'FLEET_ALERT',
    alertType: 'INFO',
    message: 'System settings & gateway configuration updated'
  });

  res.json({ success: true, settings: systemSettings, publicUrl: config.PUBLIC_URL });
});

// Purge Stale Offline Devices
app.post('/api/devices/purge-offline', (req, res) => {
  const initialCount = Object.keys(devices).length;
  Object.keys(devices).forEach(id => {
    if (!activeEspSockets.has(id)) {
      delete devices[id];
    }
  });
  saveDevices();

  broadcastToDashboards({
    type: 'INIT_STATE',
    devices: Object.values(devices).map(dev => ({
      ...dev,
      isOnline: activeEspSockets.has(dev.deviceId)
    })),
    firmwares,
    publicUrl: config.PUBLIC_URL
  });

  const purgedCount = initialCount - Object.keys(devices).length;
  res.json({ success: true, purgedCount });
});

// List all devices
app.get('/api/devices', (req, res) => {
  const list = Object.values(devices).map(dev => ({
    ...dev,
    isOnline: activeEspSockets.has(dev.deviceId)
  }));
  res.json(list);
});

// Get single device logs
app.get('/api/devices/:id/logs', (req, res) => {
  const { id } = req.params;
  const logs = recentLogs.get(id) || [];
  res.json(logs);
});

// List saved firmware binaries in library
app.get('/api/firmwares', (req, res) => {
  res.json(firmwares);
});

// Upload Firmware (.bin) & save to Library
app.post('/api/firmware/upload', upload.single('firmware'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No firmware file uploaded' });
    }

    const md5 = await calculateMD5(req.file.path);
    const targetVersion = req.body.targetVersion || req.body.version || 'v_latest';
    const fileInfo = {
      id: `fw_${Date.now()}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      version: targetVersion,
      size: req.file.size,
      md5,
      downloadUrl: `${config.PUBLIC_URL}/api/firmware/download/${req.file.filename}`,
      uploadedAt: new Date().toISOString()
    };

    // Save to library
    const existingIdx = firmwares.findIndex(f => f.filename === fileInfo.filename);
    if (existingIdx !== -1) {
      firmwares[existingIdx] = fileInfo;
    } else {
      firmwares.unshift(fileInfo);
    }
    saveFirmwares();

    broadcastToDashboards({
      type: 'FIRMWARE_LIBRARY_UPDATED',
      firmwares
    });

    console.log(`[Firmware] Uploaded & Indexed: ${fileInfo.originalName} (${(fileInfo.size / 1024).toFixed(1)} KB) MD5: ${md5}`);
    res.json(fileInfo);
  } catch (err) {
    console.error('[Firmware] Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Firmware from Library
app.delete('/api/firmware/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(config.UPLOADS_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    firmwares = firmwares.filter(f => f.filename !== filename);
    saveFirmwares();
    broadcastToDashboards({
      type: 'FIRMWARE_LIBRARY_UPDATED',
      firmwares
    });
    res.json({ success: true, message: `Firmware ${filename} removed` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete firmware: ' + err.message });
  }
});

// Download Firmware for ESP
app.get('/api/firmware/download/:filename', (req, res) => {
  const filePath = path.join(config.UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Firmware binary not found' });
  }

  // Set appropriate headers for ESP OTA streaming
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
  
  const stat = fs.statSync(filePath);
  res.setHeader('Content-Length', stat.size);
  
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// Trigger OTA Update to specific device(s)
app.post('/api/ota/deploy', (req, res) => {
  const { targetDeviceId, filename, targetVersion } = req.body;
  if (!targetDeviceId || !filename) {
    return res.status(400).json({ error: 'targetDeviceId and filename are required' });
  }

  const filePath = path.join(config.UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Firmware binary not found on server' });
  }

  const ws = activeEspSockets.get(targetDeviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(400).json({ error: `Device ${targetDeviceId} is currently offline` });
  }

  const stat = fs.statSync(filePath);
  calculateMD5(filePath).then(md5 => {
    const otaId = `ota_${Date.now()}`;
    // Full URL that the ESP will request
    const downloadUrl = `${config.PUBLIC_URL}/api/firmware/download/${filename}`;

    const otaPayload = {
      type: 'OTA_START',
      otaId,
      downloadUrl,
      size: stat.size,
      md5,
      version: targetVersion || 'v_latest'
    };

    console.log(`[OTA] Initiating update for device '${targetDeviceId}' with file '${filename}'`);
    ws.send(JSON.stringify(otaPayload));

    if (devices[targetDeviceId]) {
      devices[targetDeviceId].status = 'updating';
      devices[targetDeviceId].lastOta = {
        otaId,
        startedAt: Date.now(),
        filename,
        progress: 0,
        status: 'in_progress'
      };
      saveDevices();
    }

    broadcastToDashboards({
      type: 'DEVICE_UPDATED',
      device: devices[targetDeviceId]
    });

    res.json({ success: true, otaId, downloadUrl, size: stat.size, md5 });
  }).catch(err => {
    res.status(500).json({ error: 'Failed to prepare OTA package: ' + err.message });
  });
});

// Send Remote Reboot command
app.post('/api/device/:id/reboot', (req, res) => {
  const { id } = req.params;
  const ws = activeEspSockets.get(id);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(400).json({ error: `Device ${id} is offline` });
  }

  ws.send(JSON.stringify({ type: 'COMMAND', action: 'REBOOT' }));
  console.log(`[Device] Reboot command dispatched to ${id}`);
  res.json({ success: true, message: `Reboot command sent to ${id}` });
});

// Send Remote Pin Toggle command (e.g. built-in LED)
app.post('/api/device/:id/toggle-led', (req, res) => {
  const { id } = req.params;
  const ws = activeEspSockets.get(id);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(400).json({ error: `Device ${id} is offline` });
  }

  ws.send(JSON.stringify({ type: 'COMMAND', action: 'TOGGLE_LED' }));
  res.json({ success: true, message: `Toggle LED command sent to ${id}` });
});

// Trigger Batch OTA Update to multiple devices
app.post('/api/ota/deploy-batch', (req, res) => {
  const { targetDeviceIds, filename, targetVersion } = req.body;
  if (!Array.isArray(targetDeviceIds) || targetDeviceIds.length === 0 || !filename) {
    return res.status(400).json({ error: 'targetDeviceIds array and filename are required' });
  }

  const filePath = path.join(config.UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Firmware binary not found on server' });
  }

  const stat = fs.statSync(filePath);
  calculateMD5(filePath).then(md5 => {
    const downloadUrl = `${config.PUBLIC_URL}/api/firmware/download/${filename}`;
    let dispatched = 0;

    targetDeviceIds.forEach(devId => {
      const ws = activeEspSockets.get(devId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        const otaId = `ota_${Date.now()}_${devId}`;
        const otaPayload = {
          type: 'OTA_START',
          otaId,
          downloadUrl,
          size: stat.size,
          md5,
          version: targetVersion || 'v_latest'
        };
        ws.send(JSON.stringify(otaPayload));

        if (devices[devId]) {
          devices[devId].status = 'updating';
          devices[devId].lastOta = {
            otaId,
            startedAt: Date.now(),
            filename,
            progress: 0,
            status: 'in_progress'
          };
        }
        dispatched++;
      }
    });

    saveDevices();
    broadcastToDashboards({
      type: 'INIT_STATE',
      devices: Object.values(devices).map(dev => ({
        ...dev,
        isOnline: activeEspSockets.has(dev.deviceId)
      }))
    });

    res.json({ success: true, count: dispatched, totalTargets: targetDeviceIds.length });
  }).catch(err => {
    res.status(500).json({ error: 'Failed to prepare batch OTA package: ' + err.message });
  });
});

// Update Device Metadata (Nickname and Tags)
app.post('/api/device/:id/meta', (req, res) => {
  const { id } = req.params;
  const { nickname, tags } = req.body;

  if (!devices[id]) {
    return res.status(404).json({ error: `Device ${id} not found` });
  }

  if (typeof nickname === 'string') devices[id].nickname = nickname.trim();
  if (Array.isArray(tags)) devices[id].tags = tags.map(t => String(t).trim().toUpperCase()).filter(Boolean);

  saveDevices();

  const updatedDev = {
    ...devices[id],
    isOnline: activeEspSockets.has(id)
  };

  broadcastToDashboards({
    type: 'DEVICE_UPDATED',
    device: updatedDev
  });

  res.json({ success: true, device: updatedDev });
});

// Broadcast Batch Action (Reboot, Ping, LED toggle) to multiple devices
app.post('/api/devices/batch-action', (req, res) => {
  const { action, targetDeviceIds } = req.body;
  if (!action || !Array.isArray(targetDeviceIds)) {
    return res.status(400).json({ error: 'Action and targetDeviceIds required' });
  }

  let count = 0;
  targetDeviceIds.forEach(id => {
    const ws = activeEspSockets.get(id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (action === 'reboot') {
        ws.send(JSON.stringify({ type: 'COMMAND', action: 'REBOOT' }));
        count++;
      } else if (action === 'toggle-led') {
        ws.send(JSON.stringify({ type: 'COMMAND', action: 'TOGGLE_LED' }));
        count++;
      } else if (action === 'ping') {
        ws.send(JSON.stringify({ type: 'COMMAND', action: 'PING' }));
        count++;
      }
    }
  });

  res.json({ success: true, action, dispatchedCount: count });
});

// ==========================================
// WEBSOCKET COMMUNICATION HUB
// ==========================================

wss.on('connection', (ws, req) => {
  let clientType = 'UNKNOWN';
  let clientDeviceId = null;

  // Heartbeat tracking
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      console.warn('[WS] Invalid JSON received from client:', raw.toString());
      return;
    }

    switch (msg.type) {
      // 1. Dashboard UI Connection
      case 'DASHBOARD_HELLO': {
        clientType = 'DASHBOARD';
        activeDashboardSockets.add(ws);
        console.log('[WS] Developer Dashboard connected');
        // Send initial state
        ws.send(JSON.stringify({
          type: 'INIT_STATE',
          devices: Object.values(devices).map(dev => ({
            ...dev,
            isOnline: activeEspSockets.has(dev.deviceId)
          })),
          firmwares,
          publicUrl: config.PUBLIC_URL
        }));
        break;
      }

      // 2. ESP Microcontroller Device Registration
      case 'CLIENT_HELLO': {
        clientType = 'ESP';
        clientDeviceId = msg.deviceId || `esp_${msg.mac ? msg.mac.replace(/:/g, '') : Date.now()}`;
        
        // Store socket reference
        activeEspSockets.set(clientDeviceId, ws);

        const now = Date.now();
        const existing = devices[clientDeviceId] || {};

        devices[clientDeviceId] = {
          deviceId: clientDeviceId,
          name: msg.name || existing.name || clientDeviceId,
          nickname: existing.nickname || null,
          tags: existing.tags || [],
          chip: msg.chip || 'ESP32/ESP8266',
          mac: msg.mac || 'Unknown',
          ip: msg.ip || 'Unknown',
          rssi: msg.rssi || 0,
          firmwareVersion: msg.firmwareVersion || '1.0.0',
          freeHeap: msg.freeHeap || 0,
          uptime: msg.uptime || 0,
          status: 'online',
          lastSeen: now,
          firstSeen: existing.firstSeen || now,
          metrics: existing.metrics || null
        };

        saveDevices();
        console.log(`[WS] ESP Online: ${clientDeviceId} (${devices[clientDeviceId].chip}) IP: ${devices[clientDeviceId].ip}`);

        // Acknowledge connection
        ws.send(JSON.stringify({
          type: 'SERVER_HELLO_ACK',
          serverTime: now,
          deviceId: clientDeviceId
        }));

        // Broadcast to Dashboards
        broadcastToDashboards({
          type: 'DEVICE_UPDATED',
          device: { ...devices[clientDeviceId], isOnline: true }
        });

        // Broadcast Fleet Alert
        broadcastToDashboards({
          type: 'FLEET_ALERT',
          alertType: 'ONLINE',
          deviceId: clientDeviceId,
          message: `Hardware node [${devices[clientDeviceId].nickname || clientDeviceId}] connected to fleet`
        });
        break;
      }

      // 3. ESP Heartbeat Ping
      case 'HEARTBEAT': {
        if (clientDeviceId && devices[clientDeviceId]) {
          devices[clientDeviceId].rssi = msg.rssi ?? devices[clientDeviceId].rssi;
          devices[clientDeviceId].freeHeap = msg.freeHeap ?? devices[clientDeviceId].freeHeap;
          devices[clientDeviceId].uptime = msg.uptime ?? devices[clientDeviceId].uptime;
          devices[clientDeviceId].lastSeen = Date.now();
          devices[clientDeviceId].status = 'online';

          broadcastToDashboards({
            type: 'DEVICE_HEARTBEAT',
            deviceId: clientDeviceId,
            rssi: devices[clientDeviceId].rssi,
            freeHeap: devices[clientDeviceId].freeHeap,
            uptime: devices[clientDeviceId].uptime
          });
        }
        ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: Date.now() }));
        break;
      }

      // 4. Live Serial Log streamed from ESP
      case 'SERIAL_LOG': {
        if (clientDeviceId) {
          const logEntry = addDeviceLog(clientDeviceId, msg.text || msg.message || '');
          broadcastToDashboards({
            type: 'NEW_LOG',
            deviceId: clientDeviceId,
            log: logEntry
          });
        }
        break;
      }

      // 5. OTA Progress reports from ESP
      case 'OTA_PROGRESS': {
        if (clientDeviceId && devices[clientDeviceId]) {
          const percent = msg.percent || 0;
          devices[clientDeviceId].status = 'updating';
          if (devices[clientDeviceId].lastOta) {
            devices[clientDeviceId].lastOta.progress = percent;
          }

          broadcastToDashboards({
            type: 'OTA_PROGRESS_UPDATE',
            deviceId: clientDeviceId,
            percent,
            bytesRead: msg.bytesRead,
            totalBytes: msg.totalBytes
          });
        }
        break;
      }

      // 6. OTA Completion status
      case 'OTA_COMPLETE': {
        if (clientDeviceId && devices[clientDeviceId]) {
          const isSuccess = msg.status === 'SUCCESS';
          console.log(`[OTA] Device ${clientDeviceId} update finished: ${msg.status}`);
          
          if (devices[clientDeviceId].lastOta) {
            devices[clientDeviceId].lastOta.status = isSuccess ? 'completed' : 'failed';
            devices[clientDeviceId].lastOta.completedAt = Date.now();
            devices[clientDeviceId].lastOta.errorMessage = msg.error || null;
          }
          if (isSuccess && msg.newVersion) {
            devices[clientDeviceId].firmwareVersion = msg.newVersion;
          }
          devices[clientDeviceId].status = isSuccess ? 'rebooting' : 'online';
          saveDevices();

          broadcastToDashboards({
            type: 'OTA_FINISHED',
            deviceId: clientDeviceId,
            status: msg.status,
            message: msg.message || (isSuccess ? 'OTA Complete' : 'OTA Failed')
          });

          broadcastToDashboards({
            type: 'FLEET_ALERT',
            alertType: isSuccess ? 'OTA_SUCCESS' : 'OTA_FAIL',
            deviceId: clientDeviceId,
            message: `Node [${devices[clientDeviceId].nickname || clientDeviceId}] firmware update ${isSuccess ? 'successful' : 'failed: ' + (msg.error || 'error')}`
          });
        }
        break;
      }

      default:
        console.log('[WS] Unknown message type:', msg.type);
    }
  });

  ws.on('close', () => {
    if (clientType === 'DASHBOARD') {
      activeDashboardSockets.delete(ws);
      console.log('[WS] Dashboard disconnected');
    } else if (clientType === 'ESP' && clientDeviceId) {
      activeEspSockets.delete(clientDeviceId);
      console.log(`[WS] ESP Disconnected: ${clientDeviceId}`);
      if (devices[clientDeviceId]) {
        devices[clientDeviceId].status = 'offline';
        devices[clientDeviceId].lastSeen = Date.now();
        saveDevices();
        broadcastToDashboards({
          type: 'DEVICE_UPDATED',
          device: { ...devices[clientDeviceId], isOnline: false }
        });

        broadcastToDashboards({
          type: 'FLEET_ALERT',
          alertType: 'OFFLINE',
          deviceId: clientDeviceId,
          message: `Node [${devices[clientDeviceId].nickname || clientDeviceId}] dropped connection`
        });
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Socket error (${clientType}/${clientDeviceId}):`, err.message);
  });
});

// Periodic ping to keep connections healthy & detect dead sockets
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, config.HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

// Start Server
server.listen(config.PORT, config.HOST, () => {
  console.log(`=======================================================`);
  console.log(`🌬️  HAWA (हावा) OTA Platform Server Running`);
  console.log(`📍 Local Dashboard: http://localhost:${config.PORT}`);
  console.log(`⚡ Client Flasher:  http://localhost:${config.PORT}/flash.html`);
  console.log(`🌐 Configured Public URL: ${config.PUBLIC_URL}`);
  console.log(`=======================================================`);
});
