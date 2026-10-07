// HAWA Fleet Command Console - Dashboard Client Script
// Zero-emoji technical operations logic

// Global State
let devices = [];
let firmwares = [];
let selectedDeviceIds = new Set();
let publicUrl = window.location.origin;
let selectedFile = null;
let uploadedFileMeta = null;
let activeOtaDeviceId = null;
let ws = null;
let currentFilter = 'all';
let currentTagFilter = 'all';
let searchQuery = '';
let activeLogLevel = 'all';
let autoScrollLogs = true;
let historicalLogs = []; // Array of { deviceId, timestamp, text, level }

// =========================================================
// 1. THEME TOGGLE & SYNC
// =========================================================
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

// =========================================================
// 2. DOM ELEMENTS
// =========================================================
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

// Batch Bar & Tags
const batchBar = document.getElementById('batchBar');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const batchCountTag = document.getElementById('batchCountTag');
const batchRebootBtn = document.getElementById('batchRebootBtn');
const batchPingBtn = document.getElementById('batchPingBtn');
const batchDeployBtn = document.getElementById('batchDeployBtn');
const clearBatchSelectionBtn = document.getElementById('clearBatchSelectionBtn');
const tagChipsBar = document.getElementById('tagChipsBar');
const tagChipsList = document.getElementById('tagChipsList');

// Console Enhancements
const exportLogsBtn = document.getElementById('exportLogsBtn');
const toggleAutoScrollBtn = document.getElementById('toggleAutoScrollBtn');
const logLevelBtns = document.querySelectorAll('.log-level-btn');
const macroBtns = document.querySelectorAll('.macro-btn');

// Modals: Deploy Modal
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
const modalProgressText = document.getElementById('modalProgressText');

// Modals: Firmware Library Modal
const firmwareLibraryModal = document.getElementById('firmwareLibraryModal');
const openLibraryBtn = document.getElementById('openLibraryBtn');
const closeLibraryModalBtn = document.getElementById('closeLibraryModalBtn');
const libraryUploadBtn = document.getElementById('libraryUploadBtn');
const libraryCountTag = document.getElementById('libraryCountTag');
const firmwareLibraryList = document.getElementById('firmwareLibraryList');

// Modals: Device Edit Modal
const deviceEditModal = document.getElementById('deviceEditModal');
const closeDeviceEditModalBtn = document.getElementById('closeDeviceEditModalBtn');
const cancelDeviceEditBtn = document.getElementById('cancelDeviceEditBtn');
const deviceEditForm = document.getElementById('deviceEditForm');
const editDeviceIdHidden = document.getElementById('editDeviceIdHidden');
const editNicknameInput = document.getElementById('editNicknameInput');
const editTagsInput = document.getElementById('editTagsInput');
const editModalSubtitle = document.getElementById('editModalSubtitle');

// Toast Container
const toastContainer = document.getElementById('toastContainer');

// =========================================================
// 3. WEBSOCKET CONNECTION & EVENT DISPATCHER
// =========================================================
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
      if (Array.isArray(msg.firmwares)) firmwares = msg.firmwares;
      if (msg.publicUrl) updatePublicUrl(msg.publicUrl);
      renderDevices();
      renderTagChips();
      renderFirmwareLibrary();
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
      renderTagChips();
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

    case 'FIRMWARE_LIBRARY_UPDATED':
      if (Array.isArray(msg.firmwares)) {
        firmwares = msg.firmwares;
        renderFirmwareLibrary();
      }
      break;

    case 'FLEET_ALERT':
      showToastAlert(msg.alertType, msg.message);
      break;
  }
}

function updatePublicUrl(url) {
  publicUrl = url;
  if (statTunnel) statTunnel.textContent = url.replace('https://', '').replace('http://', '');
  if (tunnelStatusText) tunnelStatusText.textContent = `TUNNEL: ${url.replace('https://', '').replace('http://', '')}`;
  if (tunnelBadge) tunnelBadge.title = `Click to copy public gateway URL: ${url}`;
}

// Copy Tunnel URL on Click
if (tunnelBadge) {
  tunnelBadge.addEventListener('click', () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      const oldText = tunnelStatusText.textContent;
      tunnelStatusText.textContent = 'COPIED TO CLIPBOARD';
      setTimeout(() => { tunnelStatusText.textContent = oldText; }, 2000);
      showToastAlert('INFO', 'Gateway URL copied to clipboard');
    });
  });
}

// =========================================================
// 4. FLOATING FLEET HEALTH TOAST ALERTS
// =========================================================
function showToastAlert(type, message) {
  if (!toastContainer) return;

  const card = document.createElement('div');
  const typeClass = (type || 'INFO').toLowerCase();
  card.className = `toast-card ${typeClass}`;

  const header = document.createElement('div');
  header.className = 'toast-header';

  const tag = document.createElement('span');
  tag.className = 'toast-tag';
  tag.textContent = `ALERT // ${type.toUpperCase()}`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => card.remove());

  header.appendChild(tag);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'toast-msg';
  body.textContent = message;

  card.appendChild(header);
  card.appendChild(body);

  toastContainer.appendChild(card);

  // Auto remove after 4.5 seconds
  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateX(30px)';
    setTimeout(() => card.remove(), 250);
  }, 4500);
}

// =========================================================
// 5. TAGS FILTER & SEARCH
// =========================================================
function renderTagChips() {
  if (!tagChipsList || !tagChipsBar) return;

  const tagsSet = new Set();
  devices.forEach(d => {
    if (Array.isArray(d.tags)) {
      d.tags.forEach(t => tagsSet.add(t));
    }
  });

  if (tagsSet.size === 0) {
    tagChipsBar.style.display = 'none';
    return;
  }

  tagChipsBar.style.display = 'flex';
  const allTags = ['ALL', ...Array.from(tagsSet)];

  tagChipsList.innerHTML = allTags.map(tag => {
    const isActive = (tag === 'ALL' && currentTagFilter === 'all') || (tag.toLowerCase() === currentTagFilter);
    return `<button type="button" class="tag-chip ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
  }).join('');

  tagChipsList.querySelectorAll('.tag-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.dataset.tag;
      currentTagFilter = selected === 'ALL' ? 'all' : selected.toLowerCase();
      renderTagChips();
      renderDevices();
    });
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

// =========================================================
// 6. FLEET DEVICES MATRIX RENDERING
// =========================================================
function renderDevices() {
  const filtered = devices.filter(d => {
    if (currentFilter === 'online' && !d.isOnline) return false;
    if (currentFilter === 'offline' && d.isOnline) return false;
    
    if (currentTagFilter !== 'all') {
      const tags = (d.tags || []).map(t => t.toLowerCase());
      if (!tags.includes(currentTagFilter)) return false;
    }

    if (searchQuery) {
      const matchName = (d.name || '').toLowerCase().includes(searchQuery);
      const matchNick = (d.nickname || '').toLowerCase().includes(searchQuery);
      const matchId = (d.deviceId || '').toLowerCase().includes(searchQuery);
      const matchChip = (d.chip || '').toLowerCase().includes(searchQuery);
      const matchTags = (d.tags || []).join(' ').toLowerCase().includes(searchQuery);
      if (!matchName && !matchNick && !matchId && !matchChip && !matchTags) return false;
    }
    return true;
  });

  if (deviceCountBadge) {
    deviceCountBadge.textContent = `[${filtered.length} NODES]`;
  }

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
            : 'Try adjusting your tag or status filters, or clear search query.'}
        </p>
      </div>
    `;
    updateBatchBar();
    return;
  }

  deviceGrid.innerHTML = filtered.map(dev => {
    const isOnline = dev.isOnline;
    const isSelected = selectedDeviceIds.has(dev.deviceId);
    const statusClass = dev.status === 'updating' ? 'updating' : (isOnline ? 'online' : 'offline');
    const statusText = dev.status === 'updating' ? 'FLASHING OTA' : (isOnline ? 'ONLINE' : 'OFFLINE');
    const wifiSignal = dev.rssi ? `${dev.rssi} dBm` : 'N/A';
    const heapKb = dev.freeHeap ? `${(dev.freeHeap / 1024).toFixed(0)} KB` : 'N/A';
    const uptimeStr = dev.uptime ? formatUptime(dev.uptime) : 'N/A';

    // RSSI Signal Quality & Gauge Fill (0 to 100%)
    let rssiPercent = 0;
    let rssiColorClass = 'rssi-poor';
    if (dev.rssi) {
      // Typically -100 (0%) to -50 (100%)
      rssiPercent = Math.min(100, Math.max(10, ((dev.rssi + 100) / 50) * 100));
      if (dev.rssi >= -65) rssiColorClass = 'rssi-good';
      else if (dev.rssi >= -80) rssiColorClass = 'rssi-fair';
    }

    // Heap Utilization Fill
    const freeHeapBytes = dev.freeHeap || 0;
    const isHeapWarning = isOnline && freeHeapBytes > 0 && freeHeapBytes < (24 * 1024); // Low RAM < 24KB

    // Custom Tags
    const tagsHtml = (dev.tags && dev.tags.length > 0)
      ? `<div class="device-tags-container">
          ${dev.tags.map(t => `<span class="device-tag-badge">${escapeHtml(t)}</span>`).join('')}
         </div>`
      : '';

    // Live Sensor Metrics if ESP emitted any
    let sensorsHtml = '';
    if (dev.metrics && typeof dev.metrics === 'object') {
      const entries = Object.entries(dev.metrics).filter(([k]) => k !== 'updatedAt');
      if (entries.length > 0) {
        sensorsHtml = `
          <div class="sensor-stream-row">
            ${entries.map(([k, v]) => `
              <span class="sensor-chip">
                <span class="sensor-chip-key">${escapeHtml(k)}:</span>
                <span class="sensor-chip-val">${escapeHtml(String(v))}</span>
              </span>
            `).join('')}
          </div>
        `;
      }
    }

    return `
      <div class="device-card ${statusClass}" id="card-${dev.deviceId}">
        <!-- Multi-select checkbox -->
        <input type="checkbox" class="device-select-checkbox" data-id="${dev.deviceId}" ${isSelected ? 'checked' : ''} title="Select node for batch ops">

        <div class="device-header">
          <div class="device-name-group">
            <div class="device-nickname-row">
              <span class="device-nickname-text">${escapeHtml(dev.nickname || dev.name || dev.deviceId)}</span>
              <button type="button" class="device-edit-btn" onclick="openDeviceEditModal('${dev.deviceId}')" title="Configure nickname and tags">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
            </div>
            <span class="device-chip-badge">[ ${escapeHtml(dev.chip || 'ESP')} ] // ${escapeHtml(dev.deviceId)}</span>
          </div>
          <span class="status-pill ${statusClass}" id="pill-${dev.deviceId}">
            ${statusText}
          </span>
        </div>

        ${tagsHtml}

        <div class="device-meta-list">
          <div class="meta-item">
            <span class="meta-label">FIRMWARE</span>
            <span class="meta-value" id="fw-${dev.deviceId}">${escapeHtml(dev.firmwareVersion || '1.0.0')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">IP ADDR</span>
            <span class="meta-value monospace">${escapeHtml(dev.ip || 'DHCP')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">UPTIME</span>
            <span class="meta-value monospace" id="uptime-${dev.deviceId}">${uptimeStr}</span>
          </div>
        </div>

        <!-- Telemetry Meters (Signal RSSI & Free Heap Headroom) -->
        <div class="telemetry-meters-row">
          <div class="meter-col">
            <div class="meter-header">
              <span>WIFI SIGNAL</span>
              <span class="meter-val" id="rssi-${dev.deviceId}">${wifiSignal}</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill ${rssiColorClass}" id="rssi-bar-${dev.deviceId}" style="width: ${rssiPercent}%;"></div>
            </div>
          </div>
          <div class="meter-col">
            <div class="meter-header">
              <span>FREE HEAP RAM</span>
              <span class="meter-val" id="heap-${dev.deviceId}">${heapKb}</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill ${isHeapWarning ? 'heap-warn' : ''}" id="heap-bar-${dev.deviceId}" style="width: ${Math.min(100, Math.max(15, (freeHeapBytes / (160 * 1024)) * 100))}%;"></div>
            </div>
          </div>
        </div>

        ${sensorsHtml}

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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            FLASH
          </button>
          <button type="button" class="btn-secondary btn-sm" onclick="rebootDevice('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''} title="Remote hardware reset">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            REBOOT
          </button>
          <button type="button" class="btn-secondary btn-sm" onclick="toggleLed('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''} title="GPIO LED diagnostic">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
            </svg>
            LED
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Wire Checkboxes for Batch Ops
  document.querySelectorAll('.device-select-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedDeviceIds.add(id);
      else selectedDeviceIds.delete(id);
      updateBatchBar();
    });
  });

  updateBatchBar();
}

function updateDeviceCardMetrics(dev) {
  const rssiEl = document.getElementById(`rssi-${dev.deviceId}`);
  const heapEl = document.getElementById(`heap-${dev.deviceId}`);
  const uptimeEl = document.getElementById(`uptime-${dev.deviceId}`);
  const pillEl = document.getElementById(`pill-${dev.deviceId}`);
  const rssiBar = document.getElementById(`rssi-bar-${dev.deviceId}`);
  const heapBar = document.getElementById(`heap-bar-${dev.deviceId}`);

  if (rssiEl) rssiEl.textContent = dev.rssi ? `${dev.rssi} dBm` : 'N/A';
  if (heapEl) heapEl.textContent = dev.freeHeap ? `${(dev.freeHeap / 1024).toFixed(0)} KB` : 'N/A';
  if (uptimeEl) uptimeEl.textContent = dev.uptime ? formatUptime(dev.uptime) : 'N/A';
  
  if (pillEl) {
    pillEl.className = 'status-pill online';
    pillEl.textContent = 'ONLINE';
  }

  if (rssiBar && dev.rssi) {
    const rssiPercent = Math.min(100, Math.max(10, ((dev.rssi + 100) / 50) * 100));
    rssiBar.style.width = `${rssiPercent}%`;
  }

  if (heapBar && dev.freeHeap) {
    const heapPercent = Math.min(100, Math.max(15, (dev.freeHeap / (160 * 1024)) * 100));
    heapBar.style.width = `${heapPercent}%`;
  }
}

// =========================================================
// 7. BATCH OPERATIONS HANDLERS
// =========================================================
function updateBatchBar() {
  if (!batchBar || !batchCountTag) return;

  const count = selectedDeviceIds.size;
  if (count > 0) {
    batchBar.style.display = 'flex';
    batchCountTag.textContent = `${count} NODE${count > 1 ? 'S' : ''} SELECTED`;
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = (count === devices.length && devices.length > 0);
    }
  } else {
    batchBar.style.display = 'none';
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
  }
}

if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      devices.forEach(d => selectedDeviceIds.add(d.deviceId));
    } else {
      selectedDeviceIds.clear();
    }
    renderDevices();
  });
}

if (clearBatchSelectionBtn) {
  clearBatchSelectionBtn.addEventListener('click', () => {
    selectedDeviceIds.clear();
    renderDevices();
  });
}

if (batchRebootBtn) {
  batchRebootBtn.addEventListener('click', async () => {
    const targets = Array.from(selectedDeviceIds);
    if (targets.length === 0) return;
    if (!confirm(`Are you sure you want to reboot all ${targets.length} selected nodes?`)) return;

    try {
      const res = await fetch('/api/devices/batch-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reboot', targetDeviceIds: targets })
      });
      const data = await res.json();
      showToastAlert('INFO', `Dispatched reboot command to ${data.dispatchedCount} nodes`);
    } catch (err) {
      showToastAlert('ERROR', 'Failed to dispatch batch reboot: ' + err.message);
    }
  });
}

if (batchPingBtn) {
  batchPingBtn.addEventListener('click', async () => {
    const targets = Array.from(selectedDeviceIds);
    if (targets.length === 0) return;

    try {
      const res = await fetch('/api/devices/batch-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', targetDeviceIds: targets })
      });
      const data = await res.json();
      showToastAlert('INFO', `Dispatched telemetry ping to ${data.dispatchedCount} nodes`);
    } catch (err) {
      showToastAlert('ERROR', 'Failed to dispatch batch ping: ' + err.message);
    }
  });
}

if (batchDeployBtn) {
  batchDeployBtn.addEventListener('click', () => {
    const targets = Array.from(selectedDeviceIds);
    if (targets.length === 0) return;
    openLibraryModal();
    showToastAlert('INFO', `Select a firmware binary to deploy to ${targets.length} selected nodes`);
  });
}

// =========================================================
// 8. DEVICE METADATA EDIT MODAL
// =========================================================
window.openDeviceEditModal = function(deviceId) {
  const dev = devices.find(d => d.deviceId === deviceId);
  if (!dev || !deviceEditModal) return;

  editDeviceIdHidden.value = deviceId;
  editNicknameInput.value = dev.nickname || dev.name || '';
  editTagsInput.value = (dev.tags || []).join(', ');
  if (editModalSubtitle) {
    editModalSubtitle.textContent = `Configuring [${dev.chip || 'ESP'}] // ${dev.deviceId}`;
  }

  deviceEditModal.classList.add('active');
  deviceEditModal.classList.add('open');
};

function closeDeviceEditModal() {
  if (deviceEditModal) {
    deviceEditModal.classList.remove('active');
    deviceEditModal.classList.remove('open');
  }
}

if (closeDeviceEditModalBtn) closeDeviceEditModalBtn.addEventListener('click', closeDeviceEditModal);
if (cancelDeviceEditBtn) cancelDeviceEditBtn.addEventListener('click', closeDeviceEditModal);
if (deviceEditModal) {
  deviceEditModal.addEventListener('click', (e) => {
    if (e.target === deviceEditModal) closeDeviceEditModal();
  });
}

if (deviceEditForm) {
  deviceEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editDeviceIdHidden.value;
    const nickname = editNicknameInput.value.trim();
    const tags = editTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

    try {
      const res = await fetch(`/api/device/${id}/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, tags })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      closeDeviceEditModal();
      showToastAlert('INFO', `Updated metadata for node ${id}`);
    } catch (err) {
      alert('Error updating device metadata: ' + err.message);
    }
  });
}

// =========================================================
// 9. FIRMWARE LIBRARY & ROLLBACK PIPELINE
// =========================================================
function openLibraryModal() {
  if (!firmwareLibraryModal) return;
  firmwareLibraryModal.classList.add('active');
  firmwareLibraryModal.classList.add('open');
  renderFirmwareLibrary();
}

function closeLibraryModal() {
  if (!firmwareLibraryModal) return;
  firmwareLibraryModal.classList.remove('active');
  firmwareLibraryModal.classList.remove('open');
  const sideNavLibrary = document.getElementById('sideNavLibrary');
  if (sideNavLibrary) sideNavLibrary.classList.remove('active');
}

if (openLibraryBtn) openLibraryBtn.addEventListener('click', openLibraryModal);
if (closeLibraryModalBtn) closeLibraryModalBtn.addEventListener('click', closeLibraryModal);
if (firmwareLibraryModal) {
  firmwareLibraryModal.addEventListener('click', (e) => {
    if (e.target === firmwareLibraryModal) closeLibraryModal();
  });
}

if (libraryUploadBtn) {
  libraryUploadBtn.addEventListener('click', () => {
    closeLibraryModal();
    openDeployModal();
  });
}

function renderFirmwareLibrary() {
  if (!firmwareLibraryList) return;

  if (libraryCountTag) {
    libraryCountTag.textContent = `${firmwares.length} BINAR${firmwares.length === 1 ? 'Y' : 'IES'} STORED`;
  }

  if (firmwares.length === 0) {
    firmwareLibraryList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        </div>
        <h3>NO BINARIES IN LIBRARY</h3>
        <p>Deploy a firmware binary or upload one to persist it for fast rollback and redeployment.</p>
      </div>
    `;
    return;
  }

  firmwareLibraryList.innerHTML = firmwares.map(fw => {
    const sizeKb = (fw.size / 1024).toFixed(1);
    const dateStr = fw.uploadedAt ? new Date(fw.uploadedAt).toLocaleString() : 'N/A';

    return `
      <div class="firmware-card" id="fw-card-${escapeHtml(fw.filename)}">
        <div class="firmware-card-header">
          <div class="firmware-name-group">
            <span class="firmware-filename">${escapeHtml(fw.originalName || fw.filename)}</span>
            <span class="firmware-version-badge">${escapeHtml(fw.version || 'v_latest')}</span>
          </div>
          <span class="status-pill online">READY</span>
        </div>

        <div class="firmware-card-meta">
          <div class="firmware-meta-item">
            <span>SIZE:</span>
            <strong style="color: var(--text-main);">${sizeKb} KB</strong>
          </div>
          <div class="firmware-meta-item">
            <span>MD5:</span>
            <code class="firmware-md5-code" onclick="navigator.clipboard.writeText('${fw.md5}'); showToastAlert('INFO', 'MD5 copied to clipboard');" title="Click to copy MD5">${escapeHtml(fw.md5)}</code>
          </div>
          <div class="firmware-meta-item">
            <span>SAVED:</span>
            <span>${escapeHtml(dateStr)}</span>
          </div>
        </div>

        <div class="firmware-card-actions">
          <button type="button" class="btn-primary btn-sm" onclick="deployFromLibrary('${fw.filename}', '${escapeHtml(fw.originalName || fw.filename)}', '${fw.md5}', ${fw.size})" title="Deploy this saved binary to target device">
            DEPLOY TO NODE
          </button>
          <button type="button" class="btn-secondary btn-sm" onclick="batchRolloutFromLibrary('${fw.filename}', '${escapeHtml(fw.version || 'v_latest')}')" title="Batch deploy this binary to all online or selected nodes">
            BATCH ROLLOUT
          </button>
          <a href="/api/firmware/download/${fw.filename}" download="${fw.originalName || fw.filename}" class="btn-secondary btn-sm" title="Download .bin file">
            DOWNLOAD
          </a>
          <button type="button" class="btn-text btn-sm" onclick="deleteFirmware('${fw.filename}')" style="color: var(--text-muted); margin-left: auto;" title="Delete binary from disk">
            DELETE
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.deployFromLibrary = function(filename, originalName, md5, size) {
  closeLibraryModal();
  openDeployModal();

  uploadedFileMeta = { filename, originalName, md5, size };
  selectedFileName.textContent = originalName;
  selectedFileSize.textContent = `${(size / 1024).toFixed(1)} KB`;
  selectedFileMd5.textContent = `MD5: ${md5}`;
  fileSelectedInfo.style.display = 'block';

  validateDeployForm();
};

window.batchRolloutFromLibrary = async function(filename, version) {
  let targetIds = Array.from(selectedDeviceIds);
  if (targetIds.length === 0) {
    targetIds = devices.filter(d => d.isOnline).map(d => d.deviceId);
  }

  if (targetIds.length === 0) {
    alert('No online nodes available to deploy.');
    return;
  }

  if (!confirm(`Are you sure you want to rollout firmware "${filename}" to ${targetIds.length} nodes?`)) return;

  try {
    const res = await fetch('/api/ota/deploy-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetDeviceIds: targetIds,
        filename,
        targetVersion: version
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    closeLibraryModal();
    showToastAlert('INFO', `Batch OTA rollout initiated for ${data.count} nodes!`);
  } catch (err) {
    alert('Failed to initiate batch rollout: ' + err.message);
  }
};

window.deleteFirmware = async function(filename) {
  if (!confirm(`Delete binary "${filename}" from server library?`)) return;
  try {
    const res = await fetch(`/api/firmware/${filename}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToastAlert('INFO', `Removed ${filename} from library`);
  } catch (err) {
    alert('Failed to delete firmware: ' + err.message);
  }
};

// =========================================================
// 10. OTA DEPLOY MODAL HANDLING
// =========================================================
function openDeployModal() {
  if (!deployModal) return;
  deployModal.classList.add('active');
  deployModal.classList.add('open');
  populateDeviceSelects();
}

function closeDeployModal() {
  if (!deployModal) return;
  deployModal.classList.remove('active');
  deployModal.classList.remove('open');
  const sideNavDeploy = document.getElementById('sideNavDeploy');
  if (sideNavDeploy) sideNavDeploy.classList.remove('active');
}

if (openDeployModalBtn) openDeployModalBtn.addEventListener('click', openDeployModal);
if (closeDeployModalBtn) closeDeployModalBtn.addEventListener('click', closeDeployModal);
if (deployModal) {
  deployModal.addEventListener('click', (e) => {
    if (e.target === deployModal) closeDeployModal();
  });
}

// Dropzone Handling
if (dropzone) {
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
}

if (firmwareFileInput) {
  firmwareFileInput.addEventListener('change', () => {
    if (firmwareFileInput.files.length) {
      handleFileSelected(firmwareFileInput.files[0]);
    }
  });
}

async function handleFileSelected(file) {
  if (!file.name.endsWith('.bin')) {
    alert('Please select a compiled .bin firmware binary.');
    return;
  }

  selectedFile = file;
  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  selectedFileMd5.textContent = 'CALCULATING MD5 HASH & PERSISTING TO LIBRARY...';
  fileSelectedInfo.style.display = 'block';

  const formData = new FormData();
  formData.append('firmware', file);
  if (targetVersionInput.value.trim()) {
    formData.append('targetVersion', targetVersionInput.value.trim());
  }

  try {
    const res = await fetch('/api/firmware/upload', {
      method: 'POST',
      body: formData
    });
    uploadedFileMeta = await res.json();
    if (uploadedFileMeta.error) throw new Error(uploadedFileMeta.error);

    selectedFileMd5.textContent = `MD5: ${uploadedFileMeta.md5}`;
    validateDeployForm();
    showToastAlert('INFO', `Firmware binary saved to library: ${file.name}`);
  } catch (err) {
    alert('Failed to upload firmware: ' + err.message);
    fileSelectedInfo.style.display = 'none';
    uploadedFileMeta = null;
  }
}

if (targetDeviceSelect) targetDeviceSelect.addEventListener('change', validateDeployForm);

function validateDeployForm() {
  const ready = Boolean(uploadedFileMeta && targetDeviceSelect.value);
  startDeployBtn.disabled = !ready;
}

if (startDeployBtn) {
  startDeployBtn.addEventListener('click', async () => {
    if (!uploadedFileMeta || !targetDeviceSelect.value) return;

    const targetDeviceId = targetDeviceSelect.value;
    activeOtaDeviceId = targetDeviceId;

    startDeployBtn.disabled = true;
    modalOtaProgress.style.display = 'block';
    modalProgressPercent.textContent = '0%';
    modalProgressBarFill.style.width = '0%';
    modalProgressText.textContent = 'TRANSMITTING FIRMWARE...';

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
      activeOtaDeviceId = null;
      startDeployBtn.disabled = false;
    }, 2000);
  }
}

// =========================================================
// 11. REMOTE SERIAL TELEMETRY STREAM & LOG FILTERS
// =========================================================
function appendLog(deviceId, log) {
  if (!consoleLogs) return;

  const target = consoleDeviceSelect.value;
  const text = typeof log === 'object' ? log.text : String(log);
  const time = typeof log === 'object' ? log.timestamp : Date.now();

  // Detect log level
  let level = 'info';
  const upper = text.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FAIL') || upper.includes('ERR')) level = 'error';
  else if (upper.includes('WARN')) level = 'warn';

  historicalLogs.push({ deviceId, text, timestamp: time, level });
  if (historicalLogs.length > 500) historicalLogs.shift();

  // Check filter match
  if (target && target !== deviceId) return;
  if (activeLogLevel !== 'all' && level !== activeLogLevel) return;

  renderSingleLogEntry(deviceId, text, time, level);
}

function renderSingleLogEntry(deviceId, text, time, level) {
  const timeStr = new Date(time).toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  entry.textContent = `[${timeStr}] [${deviceId}] ${text}`;

  consoleLogs.appendChild(entry);
  if (autoScrollLogs) {
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }
}

function filterConsoleLogs() {
  if (!consoleLogs) return;
  consoleLogs.innerHTML = '';
  const target = consoleDeviceSelect.value;

  historicalLogs.forEach(item => {
    if (target && target !== item.deviceId) return;
    if (activeLogLevel !== 'all' && item.level !== activeLogLevel) return;
    renderSingleLogEntry(item.deviceId, item.text, item.timestamp, item.level);
  });
}

// Log Level Filter Pills
logLevelBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    logLevelBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLogLevel = btn.dataset.level || 'all';
    filterConsoleLogs();
  });
});

if (consoleDeviceSelect) {
  consoleDeviceSelect.addEventListener('change', filterConsoleLogs);
}

// Auto-Scroll Toggle
if (toggleAutoScrollBtn) {
  toggleAutoScrollBtn.addEventListener('click', () => {
    autoScrollLogs = !autoScrollLogs;
    toggleAutoScrollBtn.classList.toggle('active', autoScrollLogs);
    toggleAutoScrollBtn.textContent = `AUTO-SCROLL: ${autoScrollLogs ? 'ON' : 'OFF'}`;
  });
}

// Export Logs to .txt file
if (exportLogsBtn) {
  exportLogsBtn.addEventListener('click', () => {
    if (historicalLogs.length === 0) {
      alert('No logs recorded to export.');
      return;
    }
    const lines = historicalLogs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.deviceId}] ${l.text}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hawa_telemetry_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToastAlert('INFO', `Exported ${historicalLogs.length} log lines to text file`);
  });
}

// Console Input Execution
if (consoleInput) {
  consoleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = consoleInput.value.trim();
      if (!cmd) return;
      sendConsoleCommand(cmd);
      consoleInput.value = '';
    }
  });
}

// Command Macro Buttons
macroBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    if (cmd) sendConsoleCommand(cmd);
  });
});

function sendConsoleCommand(cmd) {
  const target = consoleDeviceSelect.value;
  const entry = document.createElement('div');
  entry.className = 'log-entry system';
  entry.textContent = `[TX] > ${cmd} ${target ? `(Target: ${target})` : '(Broadcast)'}`;
  consoleLogs.appendChild(entry);
  if (autoScrollLogs) consoleLogs.scrollTop = consoleLogs.scrollHeight;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'CMD', command: cmd, targetDeviceId: target || null }));
  }
}

if (clearLogsBtn) {
  clearLogsBtn.addEventListener('click', () => {
    consoleLogs.innerHTML = '<div class="log-entry system">[SYSTEM] Buffer cleared.</div>';
    historicalLogs = [];
  });
}

// =========================================================
// 12. HARDWARE CONTROL ACTIONS
// =========================================================
window.rebootDevice = async function(deviceId) {
  if (!confirm(`Remotely reboot node "${deviceId}"?`)) return;
  try {
    const res = await fetch(`/api/device/${deviceId}/reboot`, { method: 'POST' });
    const data = await res.json();
    showToastAlert('INFO', data.message || `Reboot command sent to ${deviceId}`);
  } catch (err) {
    showToastAlert('ERROR', 'Error: ' + err.message);
  }
};

window.toggleLed = async function(deviceId) {
  try {
    await fetch(`/api/device/${deviceId}/toggle-led`, { method: 'POST' });
    showToastAlert('INFO', `Toggled LED diagnostic on ${deviceId}`);
  } catch (err) {
    showToastAlert('ERROR', 'Error: ' + err.message);
  }
};

window.openDeployForDevice = function(deviceId) {
  openDeployModal();
  targetDeviceSelect.value = deviceId;
  validateDeployForm();
};

function updateStats() {
  const onlineCount = devices.filter(d => d.isOnline).length;
  if (statOnline) statOnline.textContent = onlineCount;
  if (statTotal) statTotal.textContent = devices.length;
}

function populateDeviceSelects() {
  const selects = [consoleDeviceSelect, targetDeviceSelect];
  selects.forEach(sel => {
    if (!sel) return;
    const currentVal = sel.value;
    const isTargetSel = sel === targetDeviceSelect;

    sel.innerHTML = isTargetSel
      ? '<option value="">SELECT AN ONLINE NODE...</option>'
      : '<option value="">ALL FLEET NODES</option>';

    devices.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = `${dev.nickname || dev.name || dev.deviceId} (${dev.chip || 'ESP'}${dev.isOnline ? ' - ONLINE' : ' - OFFLINE'})`;
      if (isTargetSel && !dev.isOnline) opt.disabled = true;
      sel.appendChild(opt);
    });

    if (currentVal) sel.value = currentVal;
  });
}

// Refresh Fleet State
const refreshBtn = document.getElementById('refreshDevicesBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    fetch('/api/devices').then(r => r.json()).then(data => {
      devices = data;
      renderDevices();
      renderTagChips();
      updateStats();
      populateDeviceSelects();
      showToastAlert('INFO', 'Synced fleet node state');
    });
  });
}

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

// =========================================================
// 13. TACTILE SIDEBAR MENU - CAPSULE BUTTON CONTROLS (USER SKETCH)
// =========================================================
const sideNavFleet = document.getElementById('sideNavFleet');
const sideNavConsole = document.getElementById('sideNavConsole');
const sideNavLibrary = document.getElementById('sideNavLibrary');
const sideNavDeploy = document.getElementById('sideNavDeploy');
const sideNavFlasher = document.getElementById('sideNavFlasher');
const sidebarThemeBtn = document.getElementById('sidebarThemeBtn');
const devicesSection = document.getElementById('devicesSection') || document.querySelector('.devices-section');
const consolePanelEl = document.getElementById('consolePanel');

function setActiveNavCapsule(activeBtn) {
  [sideNavFleet, sideNavConsole, sideNavLibrary, sideNavDeploy].forEach(btn => {
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
      if (consoleInput) setTimeout(() => consoleInput.focus(), 350);
      consolePanelEl.classList.add('section-highlight-ping');
      setTimeout(() => consolePanelEl.classList.remove('section-highlight-ping'), 1200);
    }
  });
}

// 3. Firmware Library Capsule Click
if (sideNavLibrary) {
  sideNavLibrary.addEventListener('click', () => {
    setActiveNavCapsule(sideNavLibrary);
    openLibraryModal();
  });
}

// 4. OTA Deployer Capsule Click
if (sideNavDeploy) {
  sideNavDeploy.addEventListener('click', () => {
    openDeployModal();
    setActiveNavCapsule(sideNavDeploy);
  });
}

// 5. Web Flasher Bench Capsule Click
if (sideNavFlasher) {
  sideNavFlasher.addEventListener('click', () => {
    sideNavFlasher.classList.add('active');
    setTimeout(() => sideNavFlasher.classList.remove('active'), 500);
  });
}

// 6. Sidebar Bottom Theme Toggle Click
if (sidebarThemeBtn) {
  sidebarThemeBtn.addEventListener('click', () => {
    const active = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(active);
  });
}

// 7. ScrollSpy: Auto-illuminate active capsule as operator scrolls views
if (window.IntersectionObserver && devicesSection && consolePanelEl) {
  const scrollSpyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
        if (entry.target === devicesSection) {
          if (!sideNavLibrary?.classList.contains('active') && !sideNavDeploy?.classList.contains('active')) {
            setActiveNavCapsule(sideNavFleet);
          }
        } else if (entry.target === consolePanelEl) {
          if (!sideNavLibrary?.classList.contains('active') && !sideNavDeploy?.classList.contains('active')) {
            setActiveNavCapsule(sideNavConsole);
          }
        }
      }
    });
  }, { threshold: [0.35, 0.7] });

  scrollSpyObserver.observe(devicesSection);
  scrollSpyObserver.observe(consolePanelEl);
}

// Connect WebSocket on load
connectWebSocket();
