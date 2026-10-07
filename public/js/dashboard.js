// HAWA Fleet Command Console - Streamlined Mission Control
// Zero-emoji technical brutalist logic

// Application State
let devices = [];
let selectedTargetDeviceId = null;
let selectedFile = null;
let uploadedFileMeta = null;
let isDeploying = false;
let showAllDevices = false;
let publicUrl = window.location.origin;
let ws = null;

// =========================================================
// 1. THEME SWITCHER & PERSISTENCE
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
const statOnlineSub = document.getElementById('statOnlineSub');
const navActiveCountText = document.getElementById('navActiveCountText');
const navHubStatusText = document.getElementById('navHubStatusText');
const selectedTargetDisplay = document.getElementById('selectedTargetDisplay');
const selectedTargetSub = document.getElementById('selectedTargetSub');
const otaPipelineStatus = document.getElementById('otaPipelineStatus');
const otaPipelineSub = document.getElementById('otaPipelineSub');
const statTunnel = document.getElementById('statTunnel');

// Target Box & Devices
const targetSummaryBox = document.getElementById('targetSummaryBox');
const targetSummaryName = document.getElementById('targetSummaryName');
const targetSummaryMeta = document.getElementById('targetSummaryMeta');
const deviceGrid = document.getElementById('deviceGrid');
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
const toggleShowAllBtn = document.getElementById('toggleShowAllBtn');

// File Upload & Console
const firmwareDropzone = document.getElementById('firmwareDropzone');
const firmwareFileInput = document.getElementById('firmwareFileInput');
const fileSelectedBox = document.getElementById('fileSelectedBox');
const selectedFileName = document.getElementById('selectedFileName');
const selectedFileSize = document.getElementById('selectedFileSize');
const selectedFileMd5 = document.getElementById('selectedFileMd5');
const releaseVersionInput = document.getElementById('releaseVersionInput');
const removeFileBtn = document.getElementById('removeFileBtn');
const deployFirmwareBtn = document.getElementById('deployFirmwareBtn');
const deployBtnText = document.getElementById('deployBtnText');
const deployHelperText = document.getElementById('deployHelperText');

// Progress Bar Elements
const uploadProgressSection = document.getElementById('uploadProgressSection');
const stepUpload = document.getElementById('stepUpload');
const stepOta = document.getElementById('stepOta');
const stepFlash = document.getElementById('stepFlash');
const stepReboot = document.getElementById('stepReboot');
const progressStatusTag = document.getElementById('progressStatusTag');
const progressStatusMsg = document.getElementById('progressStatusMsg');
const progressPercentVal = document.getElementById('progressPercentVal');
const progressBarFill = document.getElementById('progressBarFill');
const progressBytesDisplay = document.getElementById('progressBytesDisplay');
const progressRateDisplay = document.getElementById('progressRateDisplay');
const progressResultBanner = document.getElementById('progressResultBanner');
const resultIcon = document.getElementById('resultIcon');
const resultMsg = document.getElementById('resultMsg');

// Activity Ticker & Toasts
const tickerContent = document.getElementById('tickerContent');
const toastContainer = document.getElementById('toastContainer');

// Settings & Edit Modals
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const systemSettingsForm = document.getElementById('systemSettingsForm');
const settingGatewayUrl = document.getElementById('settingGatewayUrl');
const testGatewayBtn = document.getElementById('testGatewayBtn');
const presetLocalHost = document.getElementById('presetLocalHost');
const presetOrigin = document.getElementById('presetOrigin');
const settingHeartbeatSec = document.getElementById('settingHeartbeatSec');
const settingTimeoutSec = document.getElementById('settingTimeoutSec');
const purgeOfflineDevicesBtn = document.getElementById('purgeOfflineDevicesBtn');

const deviceEditModal = document.getElementById('deviceEditModal');
const closeDeviceEditModalBtn = document.getElementById('closeDeviceEditModalBtn');
const cancelDeviceEditBtn = document.getElementById('cancelDeviceEditBtn');
const deviceEditForm = document.getElementById('deviceEditForm');
const editDeviceIdHidden = document.getElementById('editDeviceIdHidden');
const editNicknameInput = document.getElementById('editNicknameInput');
const editTagsInput = document.getElementById('editTagsInput');

// =========================================================
// 3. WEBSOCKET CONNECTION & EVENT DISPATCHER
// =========================================================
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    logActivity('WebSocket link established with HAWA Hub');
    if (navHubStatusText) navHubStatusText.textContent = 'HUB ONLINE';
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
    if (navHubStatusText) navHubStatusText.textContent = 'DISCONNECTED';
    logActivity('WebSocket connection lost. Reconnecting in 3s...');
    setTimeout(connectWebSocket, 3000);
  };
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'INIT_STATE':
      devices = msg.devices || [];
      if (msg.publicUrl) updatePublicUrl(msg.publicUrl);
      if (msg.settings) populateSettingsForm(msg.settings);
      updateStats();
      renderDevices();
      break;

    case 'DEVICE_UPDATED':
      const updated = msg.device;
      const idx = devices.findIndex(d => d.deviceId === updated.deviceId);
      if (idx !== -1) {
        devices[idx] = updated;
      } else {
        devices.push(updated);
      }
      updateStats();
      renderDevices();
      logActivity(`Device status updated: ${updated.nickname || updated.deviceId} (${updated.isOnline ? 'ONLINE' : 'OFFLINE'})`);
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
        updateDeviceCardMeters(dev);
        updateStats();
      }
      break;

    case 'OTA_PROGRESS_UPDATE':
      handleOtaProgress(msg.deviceId, msg.percent, msg.bytesRead, msg.totalBytes);
      break;

    case 'OTA_FINISHED':
      handleOtaComplete(msg.deviceId, msg.status, msg.message);
      break;

    case 'FLEET_ALERT':
      showToastAlert(msg.alertType, msg.message);
      logActivity(`[ALERT] ${msg.message}`);
      break;

    case 'SERVER_CONFIG_UPDATED':
      if (msg.settings && msg.settings.publicUrl) updatePublicUrl(msg.settings.publicUrl);
      break;
  }
}

function updatePublicUrl(url) {
  publicUrl = url;
  if (statTunnel) statTunnel.textContent = url.replace('https://', '').replace('http://', '');
}

if (statTunnel) {
  statTunnel.style.cursor = 'pointer';
  statTunnel.title = 'Click to copy gateway URL';
  statTunnel.addEventListener('click', () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl).then(() => {
        showToastAlert('INFO', 'Gateway URL copied to clipboard');
      });
    }
  });
}

// =========================================================
// 4. STATS & AVAILABLE DEVICES COUNTER (USER REQUIREMENT #1)
// =========================================================
function updateStats() {
  const onlineCount = devices.filter(d => d.isOnline).length;
  const totalCount = devices.length;

  if (statOnline) statOnline.textContent = onlineCount;
  if (statOnlineSub) {
    statOnlineSub.textContent = `${onlineCount} OF ${totalCount} NODES ACTIVE & READY FOR OTA`;
  }
  if (navActiveCountText) {
    navActiveCountText.textContent = `${onlineCount} ACTIVE NODE${onlineCount === 1 ? '' : 'S'}`;
  }

  // If currently selected target went offline, notify user
  if (selectedTargetDeviceId) {
    const targetDev = devices.find(d => d.deviceId === selectedTargetDeviceId);
    if (targetDev && !targetDev.isOnline) {
      if (selectedTargetSub) selectedTargetSub.textContent = 'TARGET NODE IS CURRENTLY OFFLINE';
      if (targetSummaryMeta) targetSummaryMeta.textContent = 'WARNING: Device is currently offline';
      validateDeployForm();
    }
  }
}

// =========================================================
// 5. ACTIVE DEVICES RENDERING & SELECTION (USER REQUIREMENT #2)
// =========================================================
function renderDevices() {
  if (!deviceGrid) return;

  const onlineDevices = devices.filter(d => d.isOnline);
  const displayDevices = showAllDevices ? devices : onlineDevices;

  if (displayDevices.length === 0) {
    deviceGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="0"></rect>
            <rect x="9" y="9" width="6" height="6" rx="0"></rect>
            <line x1="9" y1="1" x2="9" y2="4"></line>
            <line x1="15" y1="1" x2="15" y2="4"></line>
            <line x1="9" y1="20" x2="9" y2="23"></line>
            <line x1="15" y1="20" x2="15" y2="23"></line>
            <line x1="20" y1="9" x2="23" y2="9"></line>
            <line x1="20" y1="14" x2="23" y2="14"></line>
            <line x1="1" y1="9" x2="4" y2="9"></line>
            <line x1="1" y1="14" x2="4" y2="14"></line>
          </svg>
        </div>
        <h3>${devices.length === 0 ? 'NO HARDWARE NODES REGISTERED' : '0 ACTIVE NODES ONLINE'}</h3>
        <p>
          ${devices.length === 0
            ? 'Connect your ESP32 or ESP8266 boards via the <a href="/flash.html" target="_blank" style="color: var(--text-main); font-weight: 600; text-decoration: underline;">Web Serial Flasher</a> to provision Wi-Fi and register them into HAWA.'
            : 'All registered hardware nodes are currently offline. Power on your devices, or click "SHOW ALL" to inspect offline profiles.'}
        </p>
      </div>
    `;
    return;
  }

  deviceGrid.innerHTML = displayDevices.map(dev => {
    const isOnline = Boolean(dev.isOnline);
    const isSelected = selectedTargetDeviceId === dev.deviceId;
    const wifiSignal = dev.rssi ? `${dev.rssi} dBm` : 'N/A';
    const heapKb = dev.freeHeap ? `${(dev.freeHeap / 1024).toFixed(0)} KB` : 'N/A';
    const uptimeStr = dev.uptime ? formatUptime(dev.uptime) : 'N/A';

    // RSSI signal fill calculation (-100 to -50)
    let rssiPercent = 0;
    if (dev.rssi) {
      rssiPercent = Math.min(100, Math.max(10, ((dev.rssi + 100) / 50) * 100));
    }

    const freeHeapBytes = dev.freeHeap || 0;
    const heapPercent = Math.min(100, Math.max(15, (freeHeapBytes / (160 * 1024)) * 100));

    return `
      <div class="device-card ${isOnline ? 'online' : 'offline'} ${isSelected ? 'selected-target' : ''}" 
           id="card-${dev.deviceId}" 
           onclick="handleCardClick('${dev.deviceId}', ${isOnline})"
           title="${isOnline ? 'Click to select as firmware target' : 'Device is offline'}">
        
        <div class="device-header">
          <div class="device-select-row">
            <div class="device-radio-box">
              <div class="device-radio-dot"></div>
            </div>
            <div class="device-name-group">
              <div class="device-nickname-row">
                <span class="device-nickname-text">${escapeHtml(dev.nickname || dev.name || dev.deviceId)}</span>
                <button type="button" class="device-edit-btn" onclick="event.stopPropagation(); openDeviceEditModal('${dev.deviceId}')" title="Configure nickname">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </button>
              </div>
              <span class="device-chip-badge">[ ${escapeHtml(dev.chip || 'ESP')} ] // ${escapeHtml(dev.deviceId)}</span>
            </div>
          </div>

          <span class="status-pill ${isOnline ? 'online' : 'offline'}">
            ${isOnline ? 'ACTIVE' : 'OFFLINE'}
          </span>
        </div>

        <div class="device-meta-list">
          <div class="meta-item">
            <span class="meta-label">IP ADDRESS</span>
            <span class="meta-value monospace">${escapeHtml(dev.ip || 'DHCP')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">FIRMWARE</span>
            <span class="meta-value">${escapeHtml(dev.firmwareVersion || 'v1.0.0')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">UPTIME</span>
            <span class="meta-value monospace" id="uptime-${dev.deviceId}">${uptimeStr}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">FREE HEAP</span>
            <span class="meta-value monospace" id="heap-${dev.deviceId}">${heapKb}</span>
          </div>
        </div>

        <!-- Telemetry Meters -->
        <div class="telemetry-meters-row">
          <div class="meter-col">
            <div class="meter-header">
              <span>WIFI SIGNAL</span>
              <span class="meter-val" id="rssi-${dev.deviceId}">${wifiSignal}</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill rssi-good" id="rssi-bar-${dev.deviceId}" style="width: ${rssiPercent}%;"></div>
            </div>
          </div>
          <div class="meter-col">
            <div class="meter-header">
              <span>HEAP RAM</span>
              <span class="meter-val">${heapKb}</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill" id="heap-bar-${dev.deviceId}" style="width: ${heapPercent}%;"></div>
            </div>
          </div>
        </div>

        <!-- Card bottom actions -->
        <div class="device-actions" onclick="event.stopPropagation()">
          <button type="button" class="btn-secondary btn-sm" onclick="rebootDevice('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''} title="Remote restart">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
            </svg>
            REBOOT
          </button>
          <button type="button" class="btn-secondary btn-sm" onclick="toggleLed('${dev.deviceId}')" ${!isOnline ? 'disabled' : ''} title="GPIO LED diagnostic">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
            </svg>
            LED
          </button>
        </div>

      </div>
    `;
  }).join('');
}

window.handleCardClick = function(deviceId, isOnline) {
  if (!isOnline) {
    showToastAlert('WARN', `Node ${deviceId} is currently offline`);
    return;
  }
  selectTargetDevice(deviceId);
};

function selectTargetDevice(deviceId) {
  selectedTargetDeviceId = deviceId;
  const dev = devices.find(d => d.deviceId === deviceId);

  // Update target display card
  if (dev) {
    const targetName = dev.nickname || dev.name || dev.deviceId;
    if (selectedTargetDisplay) selectedTargetDisplay.textContent = targetName;
    if (selectedTargetSub) selectedTargetSub.textContent = `[${dev.chip || 'ESP'}] IP: ${dev.ip || 'DHCP'} — ONLINE`;

    if (targetSummaryBox) targetSummaryBox.classList.add('has-target');
    if (targetSummaryName) targetSummaryName.textContent = `TARGET: ${targetName} (${dev.deviceId})`;
    if (targetSummaryMeta) targetSummaryMeta.textContent = `CHIP: ${dev.chip || 'ESP32'} | IP: ${dev.ip || 'DHCP'} | FW: ${dev.firmwareVersion || 'v1.0.0'}`;

    logActivity(`Selected target hardware node: ${targetName}`);
  }

  // Re-render device cards to reflect active radio dot
  renderDevices();
  validateDeployForm();
}

function updateDeviceCardMeters(dev) {
  const rssiEl = document.getElementById(`rssi-${dev.deviceId}`);
  const heapEl = document.getElementById(`heap-${dev.deviceId}`);
  const uptimeEl = document.getElementById(`uptime-${dev.deviceId}`);
  const rssiBar = document.getElementById(`rssi-bar-${dev.deviceId}`);

  if (rssiEl && dev.rssi) rssiEl.textContent = `${dev.rssi} dBm`;
  if (heapEl && dev.freeHeap) heapEl.textContent = `${(dev.freeHeap / 1024).toFixed(0)} KB`;
  if (uptimeEl && dev.uptime) uptimeEl.textContent = formatUptime(dev.uptime);
  if (rssiBar && dev.rssi) {
    const p = Math.min(100, Math.max(10, ((dev.rssi + 100) / 50) * 100));
    rssiBar.style.width = `${p}%`;
  }
}

// Filter and Sync Buttons
if (refreshDevicesBtn) {
  refreshDevicesBtn.addEventListener('click', () => {
    fetch('/api/devices')
      .then(r => r.json())
      .then(data => {
        devices = data;
        updateStats();
        renderDevices();
        showToastAlert('INFO', 'Synced fleet node state');
        logActivity('Fleet states refreshed from hub registry');
      })
      .catch(err => {
        showToastAlert('ERROR', 'Failed to sync devices: ' + err.message);
      });
  });
}

if (toggleShowAllBtn) {
  toggleShowAllBtn.addEventListener('click', () => {
    showAllDevices = !showAllDevices;
    toggleShowAllBtn.textContent = showAllDevices ? 'ACTIVE ONLY' : 'SHOW ALL';
    renderDevices();
  });
}

// =========================================================
// 6. FIRMWARE FILE SELECTION (.BIN) (USER REQUIREMENT #3)
// =========================================================
if (firmwareDropzone) {
  firmwareDropzone.addEventListener('click', () => firmwareFileInput.click());

  firmwareDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    firmwareDropzone.classList.add('dragover');
  });

  firmwareDropzone.addEventListener('dragleave', () => {
    firmwareDropzone.classList.remove('dragover');
  });

  firmwareDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    firmwareDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });
}

if (firmwareFileInput) {
  firmwareFileInput.addEventListener('change', () => {
    if (firmwareFileInput.files && firmwareFileInput.files.length) {
      handleFileSelected(firmwareFileInput.files[0]);
    }
  });
}

if (removeFileBtn) {
  removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    uploadedFileMeta = null;
    if (firmwareFileInput) firmwareFileInput.value = '';
    if (fileSelectedBox) fileSelectedBox.style.display = 'none';
    if (firmwareDropzone) firmwareDropzone.style.display = 'flex';
    validateDeployForm();
    logActivity('Cleared selected firmware binary');
  });
}

async function handleFileSelected(file) {
  if (!file.name.toLowerCase().endsWith('.bin')) {
    showToastAlert('WARN', 'Only compiled .bin firmware files are supported.');
    return;
  }

  selectedFile = file;
  uploadedFileMeta = null;

  if (selectedFileName) selectedFileName.textContent = file.name;
  if (selectedFileSize) selectedFileSize.textContent = formatBytes(file.size);
  if (selectedFileMd5) selectedFileMd5.textContent = 'CALCULATING MD5 HASH...';

  if (fileSelectedBox) fileSelectedBox.style.display = 'flex';
  if (firmwareDropzone) firmwareDropzone.style.display = 'none';

  logActivity(`Selected firmware binary: ${file.name} (${formatBytes(file.size)})`);

  // Calculate browser preview MD5 / SHA-256 for integrity verification
  calculateFileHash(file).then(hash => {
    if (selectedFileMd5) selectedFileMd5.textContent = `HASH: ${hash}`;
  });

  validateDeployForm();
}

async function calculateFileHash(file) {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  } catch (err) {
    return 'READY FOR UPLOAD';
  }
}

function validateDeployForm() {
  const hasTarget = Boolean(selectedTargetDeviceId);
  const targetDev = devices.find(d => d.deviceId === selectedTargetDeviceId);
  const targetIsOnline = Boolean(targetDev && targetDev.isOnline);
  const hasFile = Boolean(selectedFile);

  const canDeploy = hasTarget && targetIsOnline && hasFile && !isDeploying;

  if (deployFirmwareBtn) deployFirmwareBtn.disabled = !canDeploy;

  if (deployHelperText) {
    if (!hasTarget) {
      deployHelperText.textContent = 'Select an active device on the left to begin';
    } else if (!targetIsOnline) {
      deployHelperText.textContent = 'Selected device is currently offline';
    } else if (!hasFile) {
      deployHelperText.textContent = 'Select a .bin firmware binary above to deploy';
    } else if (isDeploying) {
      deployHelperText.textContent = 'Deployment in progress...';
    } else {
      deployHelperText.textContent = `Ready to push firmware to [${targetDev?.nickname || selectedTargetDeviceId}]`;
    }
  }
}

// =========================================================
// 7. REAL-TIME UPLOADING & FLASHING PROGRESS BAR (USER REQUIREMENT #4)
// =========================================================
if (deployFirmwareBtn) {
  deployFirmwareBtn.addEventListener('click', () => {
    if (!selectedTargetDeviceId || !selectedFile || isDeploying) return;
    startUploadAndDeploymentPipeline();
  });
}

function startUploadAndDeploymentPipeline() {
  isDeploying = true;
  validateDeployForm();

  const targetDeviceId = selectedTargetDeviceId;
  const targetDev = devices.find(d => d.deviceId === targetDeviceId);
  const devName = targetDev?.nickname || targetDeviceId;

  if (deployBtnText) deployBtnText.textContent = 'DEPLOYMENT IN PROGRESS...';
  if (otaPipelineStatus) otaPipelineStatus.textContent = 'UPLOADING';
  if (otaPipelineSub) otaPipelineSub.textContent = `TRANSMITTING TO ${devName.toUpperCase()}`;

  // Reset Progress Card UI
  if (uploadProgressSection) uploadProgressSection.style.display = 'flex';
  if (progressResultBanner) progressResultBanner.style.display = 'none';

  setStepperStage('stepUpload');
  updateProgressUI(0, `Uploading ${selectedFile.name} to HAWA Hub...`, `0 KB / ${formatBytes(selectedFile.size)}`, 'UPLOADING');
  logActivity(`Initiated upload of ${selectedFile.name} to hub for node ${devName}`);

  // Initiate real-time XMLHttpRequest upload
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('firmware', selectedFile);

  const releaseTag = releaseVersionInput ? releaseVersionInput.value.trim() : '';
  if (releaseTag) formData.append('targetVersion', releaseTag);

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const uploadPercent = Math.round((event.loaded / event.total) * 100);
      // Upload phase maps to 0% - 45% of total pipeline progress
      const overallPercent = Math.round(uploadPercent * 0.45);
      const speedStr = `${formatBytes(event.loaded)} / ${formatBytes(event.total)}`;
      updateProgressUI(overallPercent, `Uploading binary to hub: ${uploadPercent}% (${speedStr})`, speedStr, 'UPLOADING');
    }
  };

  xhr.onload = async () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        uploadedFileMeta = JSON.parse(xhr.responseText);
        if (uploadedFileMeta.error) throw new Error(uploadedFileMeta.error);

        // Upload complete, now trigger OTA over WebSocket/HTTP
        setStepperStage('stepOta');
        updateProgressUI(50, `Binary verified (MD5: ${uploadedFileMeta.md5}). Dispatching OTA packet...`, `${formatBytes(selectedFile.size)} stored`, 'OTA DISPATCH');
        logActivity(`Binary stored on hub. Dispatching OTA to ${devName}...`);

        await dispatchOtaToDevice(targetDeviceId, uploadedFileMeta.filename, releaseTag);
      } catch (err) {
        handleDeploymentFailure('Server response error: ' + err.message);
      }
    } else {
      let errMsg = `Upload failed (HTTP ${xhr.status})`;
      try {
        const errJson = JSON.parse(xhr.responseText);
        if (errJson.error) errMsg = errJson.error;
      } catch (_) {}
      handleDeploymentFailure(errMsg);
    }
  };

  xhr.onerror = () => {
    handleDeploymentFailure('Network connection error while uploading to hub');
  };

  xhr.open('POST', '/api/firmware/upload');
  xhr.send(formData);
}

async function dispatchOtaToDevice(targetDeviceId, filename, targetVersion) {
  try {
    const res = await fetch('/api/ota/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetDeviceId,
        filename,
        targetVersion: targetVersion || 'v_latest'
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    setStepperStage('stepFlash');
    updateProgressUI(55, `OTA update session started. Waiting for device flash ACK...`, 'STREAMING', 'FLASHING');
    logActivity(`OTA payload dispatched to node ${targetDeviceId}. Flashing flash memory...`);
  } catch (err) {
    handleDeploymentFailure('Failed to dispatch OTA: ' + err.message);
  }
}

function handleOtaProgress(deviceId, percent, bytesRead, totalBytes) {
  if (selectedTargetDeviceId === deviceId && isDeploying) {
    setStepperStage('stepFlash');
    // Device flash progress maps to 55% - 95% of total pipeline progress
    const flashProgress = 55 + Math.round((percent / 100) * 40);
    const bytesStr = totalBytes ? `${formatBytes(bytesRead || 0)} / ${formatBytes(totalBytes)}` : `${percent}%`;
    updateProgressUI(flashProgress, `Flashing hardware flash partition: ${percent}%`, bytesStr, 'FLASHING');
  }
}

function handleOtaComplete(deviceId, status, message) {
  if (selectedTargetDeviceId === deviceId) {
    if (status === 'SUCCESS') {
      setStepperStage('stepReboot');
      updateProgressUI(100, 'Flashing complete! Device is rebooting with new firmware.', '100% SUCCESS', 'REBOOTING');
      showDeploymentSuccess(`Firmware successfully flashed! Device [${deviceId}] is rebooting.`);
      logActivity(`Device ${deviceId} completed firmware flash successfully`);
    } else {
      handleDeploymentFailure(message || 'OTA flashing failed on hardware node.');
    }
  }
}

function updateProgressUI(percent, statusMsg, telemetryStr, statusTag) {
  const bounded = Math.min(100, Math.max(0, percent));
  if (progressBarFill) progressBarFill.style.width = `${bounded}%`;
  if (progressPercentVal) progressPercentVal.textContent = `${bounded}%`;
  if (progressStatusMsg) progressStatusMsg.textContent = statusMsg;
  if (progressStatusTag && statusTag) progressStatusTag.textContent = statusTag;
  if (progressBytesDisplay && telemetryStr) progressBytesDisplay.textContent = telemetryStr;
}

function setStepperStage(stageId) {
  const steps = [stepUpload, stepOta, stepFlash, stepReboot];
  let stageReached = false;

  steps.forEach(step => {
    if (!step) return;
    if (step.id === stageId) {
      step.className = 'step-pill active';
      stageReached = true;
    } else if (!stageReached) {
      step.className = 'step-pill done';
    } else {
      step.className = 'step-pill';
    }
  });
}

function showDeploymentSuccess(msg) {
  isDeploying = false;
  if (progressResultBanner) {
    progressResultBanner.className = 'progress-result-banner success';
    progressResultBanner.style.display = 'flex';
    if (resultMsg) resultMsg.textContent = msg;
  }
  if (deployBtnText) deployBtnText.textContent = 'DEPLOY ANOTHER FIRMWARE';
  if (otaPipelineStatus) otaPipelineStatus.textContent = 'SUCCESS';
  if (otaPipelineSub) otaPipelineSub.textContent = 'NODE REBOOTED WITH NEW BINARY';
  validateDeployForm();
  showToastAlert('INFO', msg);
}

function handleDeploymentFailure(errMsg) {
  isDeploying = false;
  if (progressResultBanner) {
    progressResultBanner.className = 'progress-result-banner error';
    progressResultBanner.style.display = 'flex';
    if (resultMsg) resultMsg.textContent = errMsg;
  }
  if (progressStatusTag) progressStatusTag.textContent = 'ERROR';
  if (deployBtnText) deployBtnText.textContent = 'RETRY DEPLOYMENT';
  if (otaPipelineStatus) otaPipelineStatus.textContent = 'FAILED';
  if (otaPipelineSub) otaPipelineSub.textContent = errMsg;
  validateDeployForm();
  showToastAlert('ERROR', errMsg);
  logActivity(`[DEPLOY ERROR] ${errMsg}`);
}

// =========================================================
// 8. HARDWARE CONTROLS (REBOOT, LED)
// =========================================================
window.rebootDevice = async function(deviceId) {
  if (!confirm(`Remotely restart hardware node "${deviceId}"?`)) return;
  try {
    const res = await fetch(`/api/device/${deviceId}/reboot`, { method: 'POST' });
    const data = await res.json();
    showToastAlert('INFO', data.message || `Reboot command dispatched to ${deviceId}`);
    logActivity(`Dispatched remote restart to ${deviceId}`);
  } catch (err) {
    showToastAlert('ERROR', 'Error: ' + err.message);
  }
};

window.toggleLed = async function(deviceId) {
  try {
    await fetch(`/api/device/${deviceId}/toggle-led`, { method: 'POST' });
    showToastAlert('INFO', `Toggled diagnostic LED on ${deviceId}`);
  } catch (err) {
    showToastAlert('ERROR', 'Error: ' + err.message);
  }
};

// =========================================================
// 9. DEVICE NICKNAME EDIT MODAL
// =========================================================
window.openDeviceEditModal = function(deviceId) {
  const dev = devices.find(d => d.deviceId === deviceId);
  if (!dev || !deviceEditModal) return;

  editDeviceIdHidden.value = deviceId;
  editNicknameInput.value = dev.nickname || dev.name || '';
  editTagsInput.value = (dev.tags || []).join(', ');

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
      showToastAlert('INFO', `Updated nickname for node ${id}`);
      logActivity(`Updated metadata for ${id}`);
    } catch (err) {
      alert('Error updating nickname: ' + err.message);
    }
  });
}

// =========================================================
// 10. SYSTEM SETTINGS MODAL
// =========================================================
function openSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.add('active');
  settingsModal.classList.add('open');
  fetchSettings();
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.remove('active');
  settingsModal.classList.remove('open');
}

if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);
if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettingsModal);
if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });
}

async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data && data.settings) {
      populateSettingsForm(data.settings);
    }
  } catch (err) {
    console.error('[SETTINGS] Fetch error:', err);
  }
}

function populateSettingsForm(s) {
  if (!s) return;
  if (settingGatewayUrl && s.publicUrl) settingGatewayUrl.value = s.publicUrl;
  if (settingHeartbeatSec && s.heartbeatInterval) settingHeartbeatSec.value = s.heartbeatInterval;
  if (settingTimeoutSec && s.pongTimeout) settingTimeoutSec.value = s.pongTimeout;
}

if (presetLocalHost) {
  presetLocalHost.addEventListener('click', () => {
    if (settingGatewayUrl) settingGatewayUrl.value = 'http://localhost:3000';
  });
}

if (presetOrigin) {
  presetOrigin.addEventListener('click', () => {
    if (settingGatewayUrl) settingGatewayUrl.value = window.location.origin;
  });
}

if (testGatewayBtn) {
  testGatewayBtn.addEventListener('click', async () => {
    const targetUrl = (settingGatewayUrl?.value || '').trim();
    if (!targetUrl) return;

    const orig = testGatewayBtn.textContent;
    testGatewayBtn.disabled = true;
    testGatewayBtn.textContent = 'PROBING...';

    try {
      const res = await fetch(targetUrl.replace(/\/+$/, '') + '/api/settings');
      if (res.ok) {
        testGatewayBtn.textContent = 'REACHABLE';
        showToastAlert('INFO', 'Gateway endpoint reached successfully');
      } else {
        testGatewayBtn.textContent = `HTTP ${res.status}`;
      }
    } catch (err) {
      testGatewayBtn.textContent = 'UNREACHABLE';
      showToastAlert('WARN', 'Could not reach gateway: ' + err.message);
    } finally {
      setTimeout(() => {
        testGatewayBtn.disabled = false;
        testGatewayBtn.textContent = orig;
      }, 3000);
    }
  });
}

if (systemSettingsForm) {
  systemSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      publicUrl: settingGatewayUrl ? settingGatewayUrl.value.trim() : '',
      heartbeatInterval: settingHeartbeatSec ? parseInt(settingHeartbeatSec.value, 10) : 15,
      pongTimeout: settingTimeoutSec ? parseInt(settingTimeoutSec.value, 10) : 45
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (payload.publicUrl) updatePublicUrl(payload.publicUrl);
      closeSettingsModal();
      showToastAlert('INFO', 'System settings updated');
      logActivity('Gateway settings updated');
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
  });
}

if (purgeOfflineDevicesBtn) {
  purgeOfflineDevicesBtn.addEventListener('click', async () => {
    const offlineCount = devices.filter(d => !d.isOnline).length;
    if (offlineCount === 0) {
      alert('No offline nodes detected in fleet storage.');
      return;
    }
    if (!confirm(`Permanently remove ${offlineCount} offline node(s) from registry?`)) return;

    try {
      const res = await fetch('/api/devices/purge-offline', { method: 'POST' });
      const data = await res.json();
      showToastAlert('INFO', `Purged ${data.purgedCount} offline node(s)`);
      logActivity(`Purged ${data.purgedCount} offline nodes from registry`);
      refreshDevicesBtn.click();
    } catch (err) {
      alert('Failed to purge offline nodes: ' + err.message);
    }
  });
}

// =========================================================
// 11. TOAST NOTIFICATIONS & ACTIVITY TICKER
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

  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateX(25px)';
    setTimeout(() => card.remove(), 250);
  }, 4500);
}

function logActivity(text) {
  if (!tickerContent) return;
  const time = new Date().toLocaleTimeString();
  tickerContent.textContent = `[${time}] ${text}`;
}

// =========================================================
// 12. UTILITIES
// =========================================================
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

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
// INITIALIZE
// =========================================================
fetchSettings();
connectWebSocket();
logActivity('HAWA Fleet Console operational. Scanning for active hardware...');
