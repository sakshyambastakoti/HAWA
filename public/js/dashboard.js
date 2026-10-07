// State
let devices = [];
let publicUrl = window.location.origin;
let selectedFile = null;
let uploadedFileMeta = null;
let activeOtaDeviceId = null;
let ws = null;

// Theme Toggle Handler
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleLabel = document.getElementById('themeToggleLabel');
const sunIcon = document.querySelector('.sun-icon');
const moonIcon = document.querySelector('.moon-icon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hawa_theme', theme);
  if (themeToggleLabel) themeToggleLabel.textContent = (theme === 'light' ? 'DARK' : 'LIGHT');
  if (sunIcon && moonIcon) {
    if (theme === 'light') {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'inline-block';
    } else {
      sunIcon.style.display = 'inline-block';
      moonIcon.style.display = 'none';
    }
  }
}

const currentTheme = localStorage.getItem('hawa_theme') || 'light';
applyTheme(currentTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const active = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(active);
  });
}

// DOM Elements
const statOnline = document.getElementById('statOnline');
const statTotal = document.getElementById('statTotal');
const statTunnel = document.getElementById('statTunnel');
const tunnelBadge = document.getElementById('tunnelBadge');
const tunnelStatusText = document.getElementById('tunnelStatusText');
const deviceGrid = document.getElementById('deviceGrid');
const deviceCountBadge = document.getElementById('deviceCountBadge');
const consoleLogs = document.getElementById('consoleLogs');
const consoleDeviceSelect = document.getElementById('consoleDeviceSelect');
const clearLogsBtn = document.getElementById('clearLogsBtn');

// Modal Elements
const deployModal = document.getElementById('deployModal');
const openDeployModalBtn = document.getElementById('openDeployModalBtn');
const closeDeployModalBtn = document.getElementById('closeDeployModalBtn');
const dropzone = document.getElementById('dropzone');
const firmwareFileInput = document.getElementById('firmwareFileInput');
const fileSelectedInfo = document.getElementById('fileSelectedInfo');
const selectedFileName = document.getElementById('selectedFileName');
const selectedFileSize = document.getElementById('selectedFileSize');
const selectedFileMd5 = document.getElementById('selectedFileMd5');
const targetDeviceSelect = document.getElementById('targetDeviceSelect');
const targetVersionInput = document.getElementById('targetVersionInput');
const startDeployBtn = document.getElementById('startDeployBtn');
const modalOtaProgress = document.getElementById('modalOtaProgress');
const modalProgressPercent = document.getElementById('modalProgressPercent');
const modalProgressBarFill = document.getElementById('modalProgressBarFill');

// Initialize WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WS] Connected to Hawa Hub');
    ws.send(JSON.stringify({ type: 'DASHBOARD_HELLO' }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWsMessage(data);
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[WS] Connection closed. Reconnecting in 3s...');
    setTimeout(connectWebSocket, 3000);
  };
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'INIT_STATE':
      devices = msg.devices || [];
      if (msg.publicUrl) updatePublicUrl(msg.publicUrl);
      renderDevices();
      updateStats();
      populateDeviceSelects();
      break;

    case 'DEVICE_UPDATED':
      const updated = msg.device;
      const idx = devices.findIndex(d => d.deviceId === updated.deviceId);
      if (idx !== -1) {
        devices[idx] = updated;
      } else {
        devices.push(updated);
      }
      renderDevices();
      updateStats();
      populateDeviceSelects();
      break;

    case 'DEVICE_HEARTBEAT':
      const dev = devices.find(d => d.deviceId === msg.deviceId);
      if (dev) {
        dev.rssi = msg.rssi;
        dev.freeHeap = msg.freeHeap;
        dev.uptime = msg.uptime;
        dev.isOnline = true;
        dev.status = 'online';
        dev.lastSeen = Date.now();
        updateDeviceCardMetrics(dev);
        updateStats();
      }
      break;

    case 'NEW_LOG':
      appendLog(msg.deviceId, msg.log);
      break;

    case 'OTA_PROGRESS_UPDATE':
      updateOtaProgress(msg.deviceId, msg.percent, msg.bytesRead, msg.totalBytes);
      break;

    case 'OTA_FINISHED':
      handleOtaFinished(msg.deviceId, msg.status, msg.message);
      break;

    case 'SERVER_CONFIG_UPDATED':
      if (msg.publicUrl) updatePublicUrl(msg.publicUrl);
      break;
  }
}

function updatePublicUrl(url) {
  publicUrl = url;
  statTunnel.textContent = url.replace('https://', '').replace('http://', '');
  tunnelStatusText.textContent = `Tunnel: ${url.replace('https://', '')}`;
  tunnelBadge.title = `Click to copy public link: ${url}`;
}

// Copy Tunnel URL on Click
tunnelBadge.addEventListener('click', () => {
  navigator.clipboard.writeText(publicUrl).then(() => {
    const oldText = tunnelStatusText.textContent;
    tunnelStatusText.textContent = 'Copied to Clipboard! 🎉';
    setTimeout(() => { tunnelStatusText.textContent = oldText; }, 2000);
  });
});

function updateStats() {
  const onlineCount = devices.filter(d => d.isOnline).length;
  statOnline.textContent = onlineCount;
  statTotal.textContent = devices.length;
  deviceCountBadge.textContent = `(${devices.length} boards)`;
}

function renderDevices() {
  if (devices.length === 0) {
    deviceGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛰️</div>
        <h3>No ESP Boards Connected Yet</h3>
        <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 400px; margin-inline: auto;">
          Send your friends to the <strong><a href="/flash.html" target="_blank" style="color: var(--accent-cyan);">Web Serial Flasher</a></strong> to connect their ESP32 or ESP8266 board in 1 click!
        </p>
      </div>
    `;
    return;
  }

  deviceGrid.innerHTML = devices.map(dev => {
    const isOnline = dev.isOnline;
    const statusClass = dev.status === 'updating' ? 'updating' : (isOnline ? 'online' : 'offline');
    const statusText = dev.status === 'updating' ? 'Flashing OTA...' : (isOnline ? 'Online' : 'Offline');
    const wifiSignal = dev.rssi ? `${dev.rssi} dBm` : 'N/A';
    const heapKb = dev.freeHeap ? `${(dev.freeHeap / 1024).toFixed(0)} KB` : 'N/A';
    const uptimeStr = dev.uptime ? formatUptime(dev.uptime) : 'N/A';

    return `
      <div class="device-card ${statusClass}" id="card-${dev.deviceId}">
        <div class="device-header">
          <div class="device-name-group">
            <h4>${escapeHtml(dev.name || dev.deviceId)}</h4>
            <span class="device-chip-badge">${escapeHtml(dev.chip || 'ESP')} • ${escapeHtml(dev.deviceId)}</span>
          </div>
          <span class="status-pill ${statusClass}" id="pill-${dev.deviceId}">
            ${statusText}
          </span>
        </div>

        <div class="device-meta-list">
          <div class="meta-item">
            <div class="meta-label">Firmware</div>
            <div class="meta-value" id="fw-${dev.deviceId}">${escapeHtml(dev.firmwareVersion || '1.0.0')}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Wi-Fi RSSI</div>
            <div class="meta-value" id="rssi-${dev.deviceId}">${wifiSignal}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Free Heap</div>
            <div class="meta-value" id="heap-${dev.deviceId}">${heapKb}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Uptime</div>
            <div class="meta-value" id="uptime-${dev.deviceId}">${uptimeStr}</div>
          </div>
        </div>

        <!-- Progress bar for OTA -->
        <div class="device-ota-progress" id="progress-box-${dev.deviceId}">
          <div class="progress-header">
            <span>Flashing Firmware...</span>
            <span id="progress-txt-${dev.deviceId}">0%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="progress-bar-${dev.deviceId}"></div>
          </div>
        </div>

        <div class="device-actions">
          <button class="btn-primary btn-sm" onclick="openDeployForDevice('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''}>
            🚀 OTA Flash
          </button>
          <button class="btn-secondary btn-sm" onclick="rebootDevice('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''}>
            🔄 Reboot
          </button>
          <button class="btn-secondary btn-sm" onclick="toggleLed('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''}>
            💡 LED
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateDeviceCardMetrics(dev) {
  const rssiEl = document.getElementById(`rssi-${dev.deviceId}`);
  const heapEl = document.getElementById(`heap-${dev.deviceId}`);
  const uptimeEl = document.getElementById(`uptime-${dev.deviceId}`);
  const pillEl = document.getElementById(`pill-${dev.deviceId}`);

  if (rssiEl) rssiEl.textContent = dev.rssi ? `${dev.rssi} dBm` : 'N/A';
  if (heapEl) heapEl.textContent = dev.freeHeap ? `${(dev.freeHeap / 1024).toFixed(0)} KB` : 'N/A';
  if (uptimeEl) uptimeEl.textContent = dev.uptime ? formatUptime(dev.uptime) : 'N/A';
  if (pillEl) {
    pillEl.className = 'status-pill online';
    pillEl.textContent = 'Online';
  }
}

function updateOtaProgress(deviceId, percent, written, total) {
  // Update card progress bar
  const box = document.getElementById(`progress-box-${deviceId}`);
  const txt = document.getElementById(`progress-txt-${deviceId}`);
  const bar = document.getElementById(`progress-bar-${deviceId}`);

  if (box && txt && bar) {
    box.classList.add('active');
    txt.textContent = `${percent}%`;
    bar.style.width = `${percent}%`;
  }

  // Update modal progress bar if open
  if (activeOtaDeviceId === deviceId) {
    modalOtaProgress.style.display = 'block';
    modalProgressPercent.textContent = `${percent}%`;
    modalProgressBarFill.style.width = `${percent}%`;
  }
}

function handleOtaFinished(deviceId, status, message) {
  const isSuccess = status === 'SUCCESS';
  alert(isSuccess ? `🎉 Success! Device ${deviceId} finished OTA and is rebooting.` : `❌ OTA Failed for ${deviceId}: ${message}`);

  const box = document.getElementById(`progress-box-${deviceId}`);
  if (box) box.classList.remove('active');

  modalOtaProgress.style.display = 'none';
  closeDeployModal();
}

function populateDeviceSelects() {
  const onlineDevices = devices.filter(d => d.isOnline);
  
  targetDeviceSelect.innerHTML = `<option value="">Select an online board...</option>` + 
    onlineDevices.map(d => `<option value="${d.deviceId}">${escapeHtml(d.name || d.deviceId)} (${d.chip})</option>`).join('');

  consoleDeviceSelect.innerHTML = `<option value="">All Devices</option>` + 
    devices.map(d => `<option value="${d.deviceId}">${escapeHtml(d.name || d.deviceId)}</option>`).join('');
}

// Log Terminal
function appendLog(deviceId, log) {
  const filter = consoleDeviceSelect.value;
  if (filter && filter !== deviceId) return;

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const date = new Date(log.timestamp || Date.now());
  const timeStr = date.toTimeString().split(' ')[0];

  entry.innerHTML = `<span class="log-timestamp">[${timeStr}] [${deviceId}]:</span> ${escapeHtml(log.text || '')}`;
  consoleLogs.appendChild(entry);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

clearLogsBtn.addEventListener('click', () => {
  consoleLogs.innerHTML = '';
});

// Device Control Actions
window.rebootDevice = async function(deviceId) {
  if (!confirm(`Are you sure you want to remotely reboot device "${deviceId}"?`)) return;
  try {
    const res = await fetch(`/api/device/${deviceId}/reboot`, { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'Reboot signal sent!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.toggleLed = async function(deviceId) {
  try {
    await fetch(`/api/device/${deviceId}/toggle-led`, { method: 'POST' });
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.openDeployForDevice = function(deviceId) {
  openDeployModal();
  targetDeviceSelect.value = deviceId;
  validateDeployForm();
};

// Modal Logic
function openDeployModal() {
  deployModal.classList.add('open');
  populateDeviceSelects();
}

function closeDeployModal() {
  deployModal.classList.remove('open');
}

openDeployModalBtn.addEventListener('click', openDeployModal);
closeDeployModalBtn.addEventListener('click', closeDeployModal);
deployModal.addEventListener('click', (e) => {
  if (e.target === deployModal) closeDeployModal();
});

// Dropzone Handling
dropzone.addEventListener('click', () => firmwareFileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    handleFileSelected(e.dataTransfer.files[0]);
  }
});

firmwareFileInput.addEventListener('change', () => {
  if (firmwareFileInput.files.length) {
    handleFileSelected(firmwareFileInput.files[0]);
  }
});

async function handleFileSelected(file) {
  if (!file.name.endsWith('.bin')) {
    alert('Please select a compiled .bin firmware binary.');
    return;
  }

  selectedFile = file;
  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  selectedFileMd5.textContent = 'Uploading & computing MD5 hash...';
  fileSelectedInfo.style.display = 'block';

  // Upload to server immediately
  const formData = new FormData();
  formData.append('firmware', file);

  try {
    const res = await fetch('/api/firmware/upload', {
      method: 'POST',
      body: formData
    });
    uploadedFileMeta = await res.json();
    if (uploadedFileMeta.error) throw new Error(uploadedFileMeta.error);

    selectedFileMd5.textContent = `MD5: ${uploadedFileMeta.md5}`;
    validateDeployForm();
  } catch (err) {
    alert('Failed to upload firmware: ' + err.message);
    fileSelectedInfo.style.display = 'none';
    uploadedFileMeta = null;
  }
}

targetDeviceSelect.addEventListener('change', validateDeployForm);

function validateDeployForm() {
  const ready = (uploadedFileMeta && targetDeviceSelect.value);
  startDeployBtn.disabled = !ready;
}

startDeployBtn.addEventListener('click', async () => {
  if (!uploadedFileMeta || !targetDeviceSelect.value) return;

  const targetDeviceId = targetDeviceSelect.value;
  activeOtaDeviceId = targetDeviceId;

  startDeployBtn.disabled = true;
  modalOtaProgress.style.display = 'block';
  modalProgressPercent.textContent = '0%';
  modalProgressBarFill.style.width = '0%';

  try {
    const res = await fetch('/api/ota/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetDeviceId,
        filename: uploadedFileMeta.filename,
        targetVersion: targetVersionInput.value.trim() || 'v_latest'
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    console.log('[OTA] Dispatched successfully:', data);
  } catch (err) {
    alert('Failed to trigger OTA: ' + err.message);
    startDeployBtn.disabled = false;
  }
});

// Utilities
function formatUptime(seconds) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${seconds % 60}s`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById('refreshDevicesBtn').addEventListener('click', () => {
  fetch('/api/devices').then(r => r.json()).then(data => {
    devices = data;
    renderDevices();
    updateStats();
    populateDeviceSelects();
  });
});

// Start
connectWebSocket();
