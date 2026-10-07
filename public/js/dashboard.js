// HAWA Fleet Command Console - Dashboard Client Script
// Zero-emoji technical operations logic

// State
let devices = [];
let publicUrl = window.location.origin;
let selectedFile = null;
let uploadedFileMeta = null;
let activeOtaDeviceId = null;
let ws = null;
let currentFilter = 'all';
let searchQuery = '';

// Theme Toggle Handler
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleLabel = document.getElementById('themeToggleLabel');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hawa_theme', theme);
  if (themeToggleLabel) themeToggleLabel.textContent = (theme === 'light' ? 'DARK' : 'LIGHT');
  
  const sunIcons = document.querySelectorAll('.sun-icon');
  const moonIcons = document.querySelectorAll('.moon-icon');
  sunIcons.forEach(icon => {
    icon.style.display = (theme === 'light' ? 'none' : 'inline-block');
  });
  moonIcons.forEach(icon => {
    icon.style.display = (theme === 'light' ? 'inline-block' : 'none');
  });
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
const consoleInput = document.getElementById('consoleInput');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const fleetSearchInput = document.getElementById('fleetSearchInput');

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
  }
}

function updatePublicUrl(url) {
  publicUrl = url;
  if (statTunnel) statTunnel.textContent = url.replace('https://', '').replace('http://', '');
  if (tunnelStatusText) tunnelStatusText.textContent = `TUNNEL: ${url.replace('https://', '').replace('http://', '')}`;
  if (tunnelBadge) tunnelBadge.title = `Click to copy public gateway URL: ${url}`;
  if (drawerTunnelVal) drawerTunnelVal.textContent = url.replace('https://', '').replace('http://', '');
}

// Copy Tunnel URL on Click
if (tunnelBadge) {
  tunnelBadge.addEventListener('click', () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      const oldText = tunnelStatusText.textContent;
      tunnelStatusText.textContent = 'COPIED TO CLIPBOARD';
      setTimeout(() => { tunnelStatusText.textContent = oldText; }, 2000);
    });
  });
}

function updateStats() {
  const onlineCount = devices.filter(d => d.isOnline).length;
  if (statOnline) statOnline.textContent = onlineCount;
  if (statTotal) statTotal.textContent = devices.length;
  if (deviceCountBadge) deviceCountBadge.textContent = `[${devices.length} NODES]`;
  if (drawerOnlineCount) drawerOnlineCount.textContent = `${onlineCount} ONLINE`;
}

// Edge Slide-bar Elements and Handlers
const edgeSidebarDrawer = document.getElementById('edgeSidebarDrawer');
const edgeDrawerBackdrop = document.getElementById('edgeDrawerBackdrop');
const railPod = document.getElementById('railPod');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const railPillFleet = document.getElementById('railPillFleet');
const railPillConsole = document.getElementById('railPillConsole');
const drawerLinkFleet = document.getElementById('drawerLinkFleet');
const drawerLinkConsole = document.getElementById('drawerLinkConsole');
const drawerLinkDeploy = document.getElementById('drawerLinkDeploy');
const drawerDeployBtn = document.getElementById('drawerDeployBtn');
const drawerOnlineCount = document.getElementById('drawerOnlineCount');
const drawerTunnelVal = document.getElementById('drawerTunnelVal');

function openEdgeDrawer() {
  if (edgeSidebarDrawer) edgeSidebarDrawer.classList.add('open');
  if (edgeDrawerBackdrop) edgeDrawerBackdrop.classList.add('open');
}

function closeEdgeDrawer() {
  if (edgeSidebarDrawer) edgeSidebarDrawer.classList.remove('open');
  if (edgeDrawerBackdrop) edgeDrawerBackdrop.classList.remove('open');
}

if (railPod) {
  railPod.addEventListener('click', (e) => {
    if (e.target.closest('.rail-pill')) return;
    if (edgeSidebarDrawer && edgeSidebarDrawer.classList.contains('open')) {
      closeEdgeDrawer();
    } else {
      openEdgeDrawer();
    }
  });
}

if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeEdgeDrawer);
if (edgeDrawerBackdrop) edgeDrawerBackdrop.addEventListener('click', closeEdgeDrawer);

if (railPillFleet) {
  railPillFleet.addEventListener('click', (e) => {
    e.stopPropagation();
    railPillFleet.classList.add('active');
    if (railPillConsole) railPillConsole.classList.remove('active');
    const target = document.querySelector('.devices-section') || document.querySelector('.ops-bar');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
}

if (railPillConsole) {
  railPillConsole.addEventListener('click', (e) => {
    e.stopPropagation();
    railPillConsole.classList.add('active');
    if (railPillFleet) railPillFleet.classList.remove('active');
    const target = document.getElementById('consolePanel');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
}

if (drawerLinkFleet) {
  drawerLinkFleet.addEventListener('click', () => {
    closeEdgeDrawer();
    const target = document.querySelector('.devices-section') || document.querySelector('.ops-bar');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
}

if (drawerLinkConsole) {
  drawerLinkConsole.addEventListener('click', () => {
    closeEdgeDrawer();
    const target = document.getElementById('consolePanel');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
}

if (drawerLinkDeploy) {
  drawerLinkDeploy.addEventListener('click', () => {
    closeEdgeDrawer();
    openDeployModal();
  });
}

if (drawerDeployBtn) {
  drawerDeployBtn.addEventListener('click', () => {
    closeEdgeDrawer();
    openDeployModal();
  });
}

// Filter and Search Event Handlers
document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter || 'all';
    renderDevices();
  });
});

if (fleetSearchInput) {
  fleetSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderDevices();
  });
}

function renderDevices() {
  const filtered = devices.filter(d => {
    if (currentFilter === 'online' && !d.isOnline) return false;
    if (currentFilter === 'offline' && d.isOnline) return false;
    if (searchQuery) {
      const matchName = (d.name || '').toLowerCase().includes(searchQuery);
      const matchId = (d.deviceId || '').toLowerCase().includes(searchQuery);
      const matchChip = (d.chip || '').toLowerCase().includes(searchQuery);
      if (!matchName && !matchId && !matchChip) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    deviceGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="0"></rect>
            <rect x="2" y="14" width="20" height="8" rx="0"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
        </div>
        <h3>${devices.length === 0 ? 'NO HARDWARE NODES DETECTED' : 'NO MATCHING NODES FOUND'}</h3>
        <p>
          ${devices.length === 0 
            ? 'Connect your ESP32 or ESP8266 boards via the <a href="/flash.html" target="_blank" style="color: var(--text-main); font-weight: 600; text-decoration: underline;">Web Serial Flasher</a> to register them into this fleet console.'
            : 'Try adjusting your filter selection or clear the search criteria.'}
        </p>
      </div>
    `;
    return;
  }

  deviceGrid.innerHTML = filtered.map(dev => {
    const isOnline = dev.isOnline;
    const statusClass = dev.status === 'updating' ? 'updating' : (isOnline ? 'online' : 'offline');
    const statusText = dev.status === 'updating' ? 'FLASHING OTA' : (isOnline ? 'ONLINE' : 'OFFLINE');
    const wifiSignal = dev.rssi ? `${dev.rssi} dBm` : 'N/A';
    const heapKb = dev.freeHeap ? `${(dev.freeHeap / 1024).toFixed(0)} KB` : 'N/A';
    const uptimeStr = dev.uptime ? formatUptime(dev.uptime) : 'N/A';

    return `
      <div class="device-card ${statusClass}" id="card-${dev.deviceId}">
        <div class="device-header">
          <div class="device-name-group">
            <h4>${escapeHtml(dev.name || dev.deviceId)}</h4>
            <span class="device-chip-badge">[ ${escapeHtml(dev.chip || 'ESP')} ] // ${escapeHtml(dev.deviceId)}</span>
          </div>
          <span class="status-pill ${statusClass}" id="pill-${dev.deviceId}">
            ${statusText}
          </span>
        </div>

        <div class="device-meta-list">
          <div class="meta-item">
            <span class="meta-label">FIRMWARE</span>
            <span class="meta-value" id="fw-${dev.deviceId}">${escapeHtml(dev.firmwareVersion || '1.0.0')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">WIFI RSSI</span>
            <span class="meta-value" id="rssi-${dev.deviceId}">${wifiSignal}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">FREE HEAP</span>
            <span class="meta-value" id="heap-${dev.deviceId}">${heapKb}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">UPTIME</span>
            <span class="meta-value" id="uptime-${dev.deviceId}">${uptimeStr}</span>
          </div>
        </div>

        <!-- Progress bar for OTA -->
        <div class="device-ota-progress" id="progress-box-${dev.deviceId}">
          <div class="progress-header">
            <span>TRANSMITTING FIRMWARE...</span>
            <span id="progress-txt-${dev.deviceId}">0%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="progress-bar-${dev.deviceId}"></div>
          </div>
        </div>

        <div class="device-actions">
          <button type="button" class="btn-primary btn-sm" onclick="openDeployForDevice('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''} title="Push remote OTA firmware">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            FLASH
          </button>
          <button type="button" class="btn-secondary btn-sm" onclick="rebootDevice('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''} title="Remote hardware reset">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            REBOOT
          </button>
          <button type="button" class="btn-secondary btn-sm" onclick="toggleLed('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''} title="GPIO LED diagnostic">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
            </svg>
            LED
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
    pillEl.textContent = 'ONLINE';
  }
}

function updateOtaProgress(deviceId, percent, written, total) {
  const box = document.getElementById(`progress-box-${deviceId}`);
  const txt = document.getElementById(`progress-txt-${deviceId}`);
  const bar = document.getElementById(`progress-bar-${deviceId}`);

  if (box && txt && bar) {
    box.classList.add('active');
    txt.textContent = `${percent}%`;
    bar.style.width = `${percent}%`;
  }

  if (activeOtaDeviceId === deviceId) {
    modalOtaProgress.style.display = 'block';
    modalProgressPercent.textContent = `${percent}%`;
    modalProgressBarFill.style.width = `${percent}%`;
  }
}

function handleOtaFinished(deviceId, status, message) {
  const isSuccess = status === 'SUCCESS';
  const box = document.getElementById(`progress-box-${deviceId}`);
  if (box) box.classList.remove('active');

  const dev = devices.find(d => d.deviceId === deviceId);
  if (dev) {
    dev.status = isSuccess ? 'online' : 'error';
    const pillEl = document.getElementById(`pill-${deviceId}`);
    if (pillEl) {
      pillEl.className = `status-pill ${isSuccess ? 'online' : 'offline'}`;
      pillEl.textContent = isSuccess ? 'ONLINE' : 'ERROR';
    }
  }

  if (activeOtaDeviceId === deviceId) {
    modalProgressText.textContent = isSuccess ? 'COMPLETE!' : 'FAILED';
    setTimeout(() => {
      closeDeployModal();
      modalOtaProgress.style.display = 'none';
      startDeployBtn.disabled = false;
      activeOtaDeviceId = null;
    }, 1500);
  }

  alert(`[OTA] Device ${deviceId}: ${message}`);
}

function populateDeviceSelects() {
  const opts = '<option value="">ALL FLEET NODES</option>' + 
    devices.map(d => `<option value="${d.deviceId}">${escapeHtml(d.name || d.deviceId)} (${d.chip || 'ESP'})</option>`).join('');
  
  const currentVal = consoleDeviceSelect.value;
  consoleDeviceSelect.innerHTML = opts;
  consoleDeviceSelect.value = currentVal;

  const modalOpts = '<option value="">SELECT AN ONLINE NODE...</option>' + 
    devices.filter(d => d.isOnline).map(d => `<option value="${d.deviceId}">${escapeHtml(d.name || d.deviceId)} [${d.chip || 'ESP'}] - ${d.deviceId}</option>`).join('');
  
  const currentModalVal = targetDeviceSelect.value;
  targetDeviceSelect.innerHTML = modalOpts;
  targetDeviceSelect.value = currentModalVal;
}

// Telemetry Console Logging
function appendLog(deviceId, log) {
  const selected = consoleDeviceSelect.value;
  if (selected && selected !== deviceId) return;

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const d = new Date(log.timestamp || Date.now());
  const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');

  entry.innerHTML = `<span style="color: var(--text-muted); font-family: var(--font-mono);">[${timeStr}] [${escapeHtml(deviceId)}]:</span> ${escapeHtml(log.text || '')}`;
  consoleLogs.appendChild(entry);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

clearLogsBtn.addEventListener('click', () => {
  consoleLogs.innerHTML = '';
});

// Quick console command input
if (consoleInput) {
  consoleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = consoleInput.value.trim();
      if (!cmd) return;
      const target = consoleDeviceSelect.value;

      const entry = document.createElement('div');
      entry.className = 'log-entry system';
      entry.textContent = `[TX] > ${cmd} ${target ? `(Target: ${target})` : '(Broadcast)'}`;
      consoleLogs.appendChild(entry);
      consoleLogs.scrollTop = consoleLogs.scrollHeight;
      consoleInput.value = '';

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CMD', command: cmd, targetDeviceId: target || null }));
      }
    }
  });
}

// Device Control Actions
window.rebootDevice = async function(deviceId) {
  if (!confirm(`Are you sure you want to remotely reboot device "${deviceId}"?`)) return;
  try {
    const res = await fetch(`/api/device/${deviceId}/reboot`, { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'Reboot signal sent successfully.');
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
  deployModal.classList.add('active');
  deployModal.classList.add('open');
  populateDeviceSelects();
}

function closeDeployModal() {
  deployModal.classList.remove('active');
  deployModal.classList.remove('open');
  const sideNavDeploy = document.getElementById('sideNavDeploy');
  if (sideNavDeploy) sideNavDeploy.classList.remove('active');
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
  selectedFileMd5.textContent = 'CALCULATING MD5 HASH...';
  fileSelectedInfo.style.display = 'block';

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
  const ready = Boolean(uploadedFileMeta && targetDeviceSelect.value);
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
  if (h > 0) return `${h}H ${m % 60}M`;
  return `${m}M ${seconds % 60}S`;
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

// Connect WebSocket on load
connectWebSocket();

// =========================================================
// TACTILE SIDEBAR MENU - CAPSULE BUTTON CONTROLS (USER SKETCH)
// =========================================================
const sideNavFleet = document.getElementById('sideNavFleet');
const sideNavConsole = document.getElementById('sideNavConsole');
const sideNavDeploy = document.getElementById('sideNavDeploy');
const sideNavFlasher = document.getElementById('sideNavFlasher');
const sidebarThemeBtn = document.getElementById('sidebarThemeBtn');
const devicesSection = document.getElementById('devicesSection') || document.querySelector('.devices-section');
const consolePanelEl = document.getElementById('consolePanel');

function setActiveNavCapsule(activeBtn) {
  [sideNavFleet, sideNavConsole].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });
  if (activeBtn) activeBtn.classList.add('active');
}

// 1. Fleet Matrix Capsule Click
if (sideNavFleet) {
  sideNavFleet.addEventListener('click', () => {
    setActiveNavCapsule(sideNavFleet);
    if (devicesSection) {
      devicesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      devicesSection.classList.add('section-highlight-ping');
      setTimeout(() => devicesSection.classList.remove('section-highlight-ping'), 1200);
    }
  });
}

// 2. Serial Telemetry Stream Capsule Click
if (sideNavConsole) {
  sideNavConsole.addEventListener('click', () => {
    setActiveNavCapsule(sideNavConsole);
    if (consolePanelEl) {
      consolePanelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const consoleInputEl = document.getElementById('consoleInput');
      if (consoleInputEl) setTimeout(() => consoleInputEl.focus(), 350);
      consolePanelEl.classList.add('section-highlight-ping');
      setTimeout(() => consolePanelEl.classList.remove('section-highlight-ping'), 1200);
    }
  });
}

// 3. OTA Deployer Capsule Click
if (sideNavDeploy) {
  sideNavDeploy.addEventListener('click', () => {
    openDeployModal();
    sideNavDeploy.classList.add('active');
  });
}

// 4. Web Flasher Bench Capsule Click
if (sideNavFlasher) {
  sideNavFlasher.addEventListener('click', () => {
    sideNavFlasher.classList.add('active');
    setTimeout(() => sideNavFlasher.classList.remove('active'), 500);
  });
}

// 5. Sidebar Bottom Theme Toggle Click
if (sidebarThemeBtn) {
  sidebarThemeBtn.addEventListener('click', () => {
    const active = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(active);
  });
}

// 6. ScrollSpy: Auto-illuminate active capsule as operator scrolls views
if (window.IntersectionObserver && devicesSection && consolePanelEl) {
  const scrollSpyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
        if (entry.target === devicesSection) {
          setActiveNavCapsule(sideNavFleet);
        } else if (entry.target === consolePanelEl) {
          setActiveNavCapsule(sideNavConsole);
        }
      }
    });
  }, { threshold: [0.35, 0.7] });

  scrollSpyObserver.observe(devicesSection);
  scrollSpyObserver.observe(consolePanelEl);
}
