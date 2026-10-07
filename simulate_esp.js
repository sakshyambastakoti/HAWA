// HAWA - Virtual ESP32 Hardware Simulator for Testing
// Connects to local HAWA Hub (ws://localhost:3000/ws) as an active ESP32 device
// Emits heartbeats and responds to OTA firmware updates with real-time flash progress

const { WebSocket } = require('ws');
const http = require('http');

const HUB_URL = process.env.HUB_WS_URL || 'ws://localhost:3000/ws';
const DEVICE_ID = process.env.DEVICE_ID || 'esp32-hawa-demo';
const DEVICE_NAME = process.env.DEVICE_NAME || 'Living Room Node (ESP32)';

console.log(`[Virtual ESP32] Starting simulator for node: ${DEVICE_ID} (${DEVICE_NAME})`);
console.log(`[Virtual ESP32] Connecting to hub at ${HUB_URL}...`);

let ws = null;
let uptimeSeconds = 120;

function connect() {
  ws = new WebSocket(HUB_URL);

  ws.on('open', () => {
    console.log('[Virtual ESP32] Connected to HAWA Hub! Sending CLIENT_HELLO registration...');
    ws.send(JSON.stringify({
      type: 'CLIENT_HELLO',
      deviceId: DEVICE_ID,
      name: DEVICE_NAME,
      chip: 'ESP32 (ESP32-D0WDQ6)',
      mac: '24:6F:28:1A:BC:3D',
      ip: '192.168.1.108',
      rssi: -54,
      firmwareVersion: '1.0.0',
      freeHeap: 218400,
      uptime: uptimeSeconds
    }));

    // Start periodic heartbeat
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        uptimeSeconds += 15;
        const rssiVal = -50 - Math.floor(Math.random() * 12);
        ws.send(JSON.stringify({
          type: 'HEARTBEAT',
          rssi: rssiVal,
          freeHeap: 210000 + Math.floor(Math.random() * 10000),
          uptime: uptimeSeconds
        }));
      }
    }, 15000);
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log('[Virtual ESP32] Received message from Hub:', msg.type);

      // Handle OTA Firmware Update command from Hub
      if (msg.type === 'OTA_START') {
        console.log(`[Virtual ESP32] OTA Deployment received! ID: ${msg.otaId}`);
        console.log(`[Virtual ESP32] Downloading binary from: ${msg.downloadUrl}`);
        simulateOtaDownloadAndFlash(msg);
      }

      // Handle Hardware Commands (Reboot, Toggle LED)
      if (msg.type === 'COMMAND') {
        if (msg.action === 'REBOOT') {
          console.log('[Virtual ESP32] Reboot command received! Restarting in 2s...');
          setTimeout(() => {
            uptimeSeconds = 0;
            console.log('[Virtual ESP32] Node rebooted successfully.');
          }, 2000);
        } else if (msg.action === 'TOGGLE_LED') {
          console.log('[Virtual ESP32] GPIO LED state toggled.');
        }
      }
    } catch (err) {
      console.error('[Virtual ESP32] Error processing message:', err.message);
    }
  });

  ws.on('close', () => {
    console.warn('[Virtual ESP32] Connection lost. Reconnecting in 3s...');
    setTimeout(connect, 3000);
  });

  ws.on('error', (err) => {
    console.error('[Virtual ESP32] Connection error:', err.message);
  });
}

function simulateOtaDownloadAndFlash(otaMeta) {
  const totalBytes = otaMeta.size || 1024 * 512;
  let currentBytes = 0;
  let percent = 0;

  const interval = setInterval(() => {
    percent += 15;
    if (percent > 100) percent = 100;
    currentBytes = Math.floor((percent / 100) * totalBytes);

    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`[Virtual ESP32] Flashing progress: ${percent}% (${currentBytes} / ${totalBytes} bytes)`);
      ws.send(JSON.stringify({
        type: 'OTA_PROGRESS',
        percent,
        bytesRead: currentBytes,
        totalBytes
      }));
    }

    if (percent >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          console.log('[Virtual ESP32] OTA Flash complete! Sending OTA_COMPLETE ACK...');
          ws.send(JSON.stringify({
            type: 'OTA_COMPLETE',
            status: 'SUCCESS',
            message: 'Firmware binary flashed to partition 0x10000 successfully',
            newVersion: otaMeta.version || 'v2.0.0'
          }));
        }
      }, 800);
    }
  }, 450);
}

connect();
