import { ESPLoader, Transport } from '/vendor/esptool.bundle.js';

// Top Workflow Tabs
const tabHawaOta = document.getElementById('tabHawaOta');
const tabCustomBin = document.getElementById('tabCustomBin');
const hawaOtaFormView = document.getElementById('hawaOtaFormView');
const customBinFormView = document.getElementById('customBinFormView');

// Step Names
const stepName1 = document.getElementById('stepName1');
const stepName2 = document.getElementById('stepName2');
const stepName3 = document.getElementById('stepName3');
const bubble1 = document.getElementById('bubble1');
const bubble2 = document.getElementById('bubble2');
const bubble3 = document.getElementById('bubble3');

// Tab 1 (HAWA OTA) Elements
const boardTypeHawa = document.getElementById('boardTypeHawa');
const wifiSsidHawa = document.getElementById('wifiSsidHawa');
const wifiPassHawa = document.getElementById('wifiPassHawa');
const deviceNameHawa = document.getElementById('deviceNameHawa');
const serverUrlHawa = document.getElementById('serverUrlHawa');
const startFlashHawaBtn = document.getElementById('startFlashHawaBtn');

// Tab 2 (Custom Firmware) Elements
const boardTypeCustom = document.getElementById('boardTypeCustom');
const customBinInput = document.getElementById('customBinInput');
const binDropzone = document.getElementById('binDropzone');
const dropzonePrompt = document.getElementById('dropzonePrompt');
const selectedBinInfo = document.getElementById('selectedBinInfo');
const binFileName = document.getElementById('binFileName');
const binFileSize = document.getElementById('binFileSize');
const removeBinFileBtn = document.getElementById('removeBinFileBtn');
const flashOffsetInput = document.getElementById('flashOffsetInput');
const setOffsetAppBtn = document.getElementById('setOffsetAppBtn');
const setOffsetBootBtn = document.getElementById('setOffsetBootBtn');
const eraseFlashCheck = document.getElementById('eraseFlashCheck');
const wifiSsidCustom = document.getElementById('wifiSsidCustom');
const wifiPassCustom = document.getElementById('wifiPassCustom');
const startFlashCustomBtn = document.getElementById('startFlashCustomBtn');

// Shared UI Elements
const browserWarning = document.getElementById('browserWarning');
const flasherProgress = document.getElementById('flasherProgress');
const flasherStatusText = document.getElementById('flasherStatusText');
const flasherPercent = document.getElementById('flasherPercent');
const flasherBarFill = document.getElementById('flasherBarFill');
const serialConsole = document.getElementById('serialConsole');

let currentActiveTab = 'hawa'; // 'hawa' or 'custom'
let selectedCustomFile = null;
let port = null;
let transport = null;
let esploader = null;

// Check Web Serial API support
if (!('serial' in navigator)) {
  if (browserWarning) browserWarning.style.display = 'block';
  if (startFlashHawaBtn) startFlashHawaBtn.disabled = true;
  if (startFlashCustomBtn) startFlashCustomBtn.disabled = true;
  logToConsole('[ERROR] Web Serial API not supported in this browser. Please use Chrome, Edge, or Brave.');
}

// Auto-fill Server URL from backend config
fetch('/api/config')
  .then(r => r.json())
  .then(cfg => {
    if (cfg.publicUrl && serverUrlHawa && !serverUrlHawa.value) {
      serverUrlHawa.value = cfg.publicUrl;
    }
  })
  .catch(() => {
    if (serverUrlHawa) serverUrlHawa.value = window.location.origin;
  });

function logToConsole(text) {
  if (!serialConsole) return;
  serialConsole.textContent += `\n${text}`;
  serialConsole.scrollTop = serialConsole.scrollHeight;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function parseAddress(addrStr, defaultAddr = 0x10000) {
  if (!addrStr) return defaultAddr;
  addrStr = addrStr.trim();
  const parsed = parseInt(addrStr, 16);
  return isNaN(parsed) ? defaultAddr : parsed;
}

function updateStep(stepNumber) {
  if (bubble1) bubble1.className = 'step-bubble ' + (stepNumber >= 1 ? (stepNumber > 1 ? 'done' : 'active') : '');
  if (bubble2) bubble2.className = 'step-bubble ' + (stepNumber >= 2 ? (stepNumber > 2 ? 'done' : 'active') : '');
  if (bubble3) bubble3.className = 'step-bubble ' + (stepNumber >= 3 ? (stepNumber > 3 ? 'done' : 'active') : '');
}

// Custom Terminal logger for esptool-js
const espTerminal = {
  clean() {
    if (serialConsole) serialConsole.textContent = '';
  },
  writeLine(data) {
    logToConsole(data);
  },
  write(data) {
    if (serialConsole) {
      serialConsole.textContent += data;
      serialConsole.scrollTop = serialConsole.scrollHeight;
    }
  }
};

// =========================================================
// TAB SWITCHING: HAWA OTA vs CUSTOM FIRMWARE
// =========================================================
function switchTab(tab) {
  currentActiveTab = tab;
  updateStep(1);

  if (tab === 'hawa') {
    tabHawaOta.classList.add('active');
    tabHawaOta.setAttribute('aria-selected', 'true');
    tabCustomBin.classList.remove('active');
    tabCustomBin.setAttribute('aria-selected', 'false');

    hawaOtaFormView.style.display = 'block';
    customBinFormView.style.display = 'none';

    if (stepName1) stepName1.textContent = 'Select Board';
    if (stepName2) stepName2.textContent = 'Wi-Fi & Config';
    if (stepName3) stepName3.textContent = 'Flash & Link';

    logToConsole('[MODE: HAWA OTA] Ready to provision and link board.');
  } else {
    tabCustomBin.classList.add('active');
    tabCustomBin.setAttribute('aria-selected', 'true');
    tabHawaOta.classList.remove('active');
    tabHawaOta.setAttribute('aria-selected', 'false');

    customBinFormView.style.display = 'block';
    hawaOtaFormView.style.display = 'none';

    if (stepName1) stepName1.textContent = 'Chip & .bin File';
    if (stepName2) stepName2.textContent = 'Flash Settings';
    if (stepName3) stepName3.textContent = 'Flash & Monitor';

    logToConsole('[MODE: CUSTOM FIRMWARE] Select or drop your compiled .bin file.');
  }
}

if (tabHawaOta) tabHawaOta.addEventListener('click', () => switchTab('hawa'));
if (tabCustomBin) tabCustomBin.addEventListener('click', () => switchTab('custom'));

// Sync board selector between both tabs
function syncBoardSelection(sourceEl, targetEl) {
  if (!sourceEl || !targetEl) return;
  const val = sourceEl.value;
  targetEl.value = val;

  if (flashOffsetInput) {
    if (val === 'esp8266') {
      if (flashOffsetInput.value === '0x10000' || !flashOffsetInput.value) {
        flashOffsetInput.value = '0x0000';
      }
    } else {
      if (flashOffsetInput.value === '0x0000' || flashOffsetInput.value === '0x0') {
        flashOffsetInput.value = '0x10000';
      }
    }
  }
}

if (boardTypeHawa) {
  boardTypeHawa.addEventListener('change', () => syncBoardSelection(boardTypeHawa, boardTypeCustom));
}
if (boardTypeCustom) {
  boardTypeCustom.addEventListener('change', () => syncBoardSelection(boardTypeCustom, boardTypeHawa));
}

// Quick offset tags
if (setOffsetAppBtn && flashOffsetInput) {
  setOffsetAppBtn.addEventListener('click', () => { flashOffsetInput.value = '0x10000'; });
}
if (setOffsetBootBtn && flashOffsetInput) {
  setOffsetBootBtn.addEventListener('click', () => { flashOffsetInput.value = '0x0000'; });
}

// Custom .bin File Dropzone & Handling
function handleCustomFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.bin')) {
    alert('Please select a compiled binary (.bin) file.');
    return;
  }
  selectedCustomFile = file;
  if (binFileName) binFileName.textContent = file.name;
  if (binFileSize) binFileSize.textContent = formatBytes(file.size);
  if (dropzonePrompt) dropzonePrompt.style.display = 'none';
  if (selectedBinInfo) selectedBinInfo.style.display = 'flex';
  logToConsole(`[FILE] Loaded "${file.name}" (${formatBytes(file.size)})`);
}

if (binDropzone && customBinInput) {
  binDropzone.addEventListener('click', (e) => {
    if (removeBinFileBtn && (e.target === removeBinFileBtn || removeBinFileBtn.contains(e.target))) {
      return;
    }
    customBinInput.click();
  });

  customBinInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleCustomFile(e.target.files[0]);
    }
  });

  binDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    binDropzone.classList.add('dragover');
  });

  binDropzone.addEventListener('dragleave', () => {
    binDropzone.classList.remove('dragover');
  });

  binDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    binDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleCustomFile(e.dataTransfer.files[0]);
    }
  });
}

if (removeBinFileBtn) {
  removeBinFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedCustomFile = null;
    if (customBinInput) customBinInput.value = '';
    if (dropzonePrompt) dropzonePrompt.style.display = 'flex';
    if (selectedBinInfo) selectedBinInfo.style.display = 'none';
    logToConsole('[FILE] Selection cleared.');
  });
}

// Password toggle buttons
document.querySelectorAll('.toggle-password-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="23" x2="23" y2="23"></line>
        </svg>`;
    } else {
      input.type = 'password';
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>`;
    }
  });
});

// =========================================================
// FLASHING LOGIC (SHARED ENGINE)
// =========================================================

// Tab 1: Start HAWA OTA Flash
if (startFlashHawaBtn) {
  startFlashHawaBtn.addEventListener('click', async () => {
    const ssid = wifiSsidHawa ? wifiSsidHawa.value.trim() : '';
    const pass = wifiPassHawa ? wifiPassHawa.value : '';
    const name = deviceNameHawa && deviceNameHawa.value.trim() ? deviceNameHawa.value.trim() : 'Hawa-Client';
    let server = serverUrlHawa && serverUrlHawa.value.trim() ? serverUrlHawa.value.trim() : window.location.origin;

    if (!ssid) {
      alert('Please enter your Wi-Fi or Mobile Hotspot Network Name (SSID).');
      if (wifiSsidHawa) wifiSsidHawa.focus();
      return;
    }

    if (server.startsWith('http://')) server = server.replace('http://', 'ws://');
    if (server.startsWith('https://')) server = server.replace('https://', 'wss://');
    if (!server.startsWith('ws://') && !server.startsWith('wss://')) {
      server = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + server;
    }

    const board = boardTypeHawa ? boardTypeHawa.value : 'esp32';
    await executeFlash({
      mode: 'hawa',
      board,
      ssid,
      pass,
      name,
      server,
      activeBtn: startFlashHawaBtn
    });
  });
}

// Tab 2: Start Custom Firmware Flash
if (startFlashCustomBtn) {
  startFlashCustomBtn.addEventListener('click', async () => {
    if (!selectedCustomFile) {
      alert('Please select or drop a .bin file from your computer first.');
      if (binDropzone) binDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const board = boardTypeCustom ? boardTypeCustom.value : 'esp32';
    const defaultOffset = (board === 'esp8266' ? 0x0000 : 0x10000);
    const offset = parseAddress(flashOffsetInput ? flashOffsetInput.value : '', defaultOffset);
    const eraseAll = Boolean(eraseFlashCheck && eraseFlashCheck.checked);
    const ssid = wifiSsidCustom ? wifiSsidCustom.value.trim() : '';
    const pass = wifiPassCustom ? wifiPassCustom.value : '';

    await executeFlash({
      mode: 'custom',
      board,
      customFile: selectedCustomFile,
      offset,
      eraseAll,
      ssid,
      pass,
      name: 'Custom-Device',
      server: window.location.origin,
      activeBtn: startFlashCustomBtn
    });
  });
}

// Master execution pipeline
async function executeFlash(params) {
  const { mode, board, ssid, pass, name, server, customFile, offset, eraseAll, activeBtn } = params;

  if (activeBtn) activeBtn.disabled = true;
  if (flasherProgress) flasherProgress.classList.add('active');
  updateStep(2);

  try {
    logToConsole('[SERIAL] Requesting USB port access (select your board in browser dialog)...');
    port = await navigator.serial.requestPort();

    transport = new Transport(port);
    esploader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal: espTerminal
    });

    logToConsole('[BOOT] Connecting to ESP ROM bootloader at 115200 baud...');
    if (flasherStatusText) flasherStatusText.textContent = 'Connecting to ROM bootloader...';

    const chip = await esploader.main();
    logToConsole(`[CHIP] Detected: ${chip}. Initializing flash parameters...`);

    let fileArray = [];

    if (mode === 'custom') {
      if (flasherStatusText) flasherStatusText.textContent = `Reading custom binary (${customFile.name})...`;
      logToConsole(`[FILE] Reading "${customFile.name}" (${formatBytes(customFile.size)})...`);
      logToConsole(`[FLASH] Target offset: 0x${offset.toString(16).toUpperCase()}${eraseAll ? ' [full chip erase]' : ''}`);

      const binBuffer = await customFile.arrayBuffer();
      fileArray = [{
        data: new Uint8Array(binBuffer),
        address: offset
      }];
    } else {
      if (flasherStatusText) flasherStatusText.textContent = `Downloading ${board.toUpperCase()} bootstrap binary...`;
      const binUrl = `/binaries/${board}/hawa_bootstrap_${board}.bin`;
      const binResponse = await fetch(binUrl);

      if (!binResponse.ok) {
        logToConsole(`[WARN] Precompiled image ${binUrl} not found on server.`);
        logToConsole(`[INFO] Switching to direct serial provisioning mode...`);
        if (flasherStatusText) flasherStatusText.textContent = 'Configuring Wi-Fi via Serial...';

        await transport.disconnect();
        await performSerialProvisioning(port, ssid, pass, server, name, activeBtn);
        return;
      }

      const binBuffer = await binResponse.arrayBuffer();
      fileArray = [{
        data: new Uint8Array(binBuffer),
        address: (board === 'esp8266' ? 0x0000 : 0x10000)
      }];
    }

    if (flasherStatusText) {
      flasherStatusText.textContent = mode === 'custom' ? 'Flashing Custom Firmware...' : 'Flashing Hawa Bootstrap Firmware...';
    }
    updateStep(3);

    await esploader.writeFlash({
      fileArray,
      flashSize: 'keep',
      eraseAll: Boolean(eraseAll),
      reportProgress: (fileIndex, written, total) => {
        const percent = Math.floor((written / total) * 100);
        if (flasherPercent) flasherPercent.textContent = `${percent}%`;
        if (flasherBarFill) flasherBarFill.style.width = `${percent}%`;
        if (flasherStatusText) {
          flasherStatusText.textContent = `Flashing: ${percent}% (${Math.round(written/1024)} KB / ${Math.round(total/1024)} KB)`;
        }
      }
    });

    logToConsole('[FLASH] Write complete. Resetting board...');
    await transport.disconnect();
    await new Promise(r => setTimeout(r, 1200));

    if (ssid) {
      if (flasherStatusText) flasherStatusText.textContent = 'Provisioning Wi-Fi credentials...';
      logToConsole('[SERIAL] Sending network credentials over serial...');
      await performSerialProvisioning(port, ssid, pass, server, name, activeBtn);
    } else {
      if (flasherPercent) flasherPercent.textContent = '100%';
      if (flasherBarFill) flasherBarFill.style.width = '100%';
      if (flasherStatusText) flasherStatusText.textContent = 'Complete! Custom firmware running!';
      if (bubble3) bubble3.classList.add('done');

      logToConsole('\n------------------------------------------------------');
      logToConsole(`[SUCCESS] Custom firmware written to ${chip}.`);
      logToConsole('Board rebooted. Application running.');
      logToConsole('------------------------------------------------------');

      if (activeBtn) activeBtn.disabled = false;
      alert('Success: Custom firmware flashed to board.');

      await new Promise(r => setTimeout(r, 600));
      startLiveSerialMonitoring(port);
    }

  } catch (err) {
    console.error(err);
    logToConsole(`[ERROR] ${err.message}`);
    if (flasherStatusText) flasherStatusText.textContent = 'Error during setup';
    if (activeBtn) activeBtn.disabled = false;
  }
}

// Helper to send text over serial port without stream lock leaks
async function writeSerialText(serialPort, text) {
  if (!serialPort || !serialPort.writable) return;
  const encoder = new TextEncoder();
  const writer = serialPort.writable.getWriter();
  try {
    await writer.write(encoder.encode(text));
  } finally {
    writer.releaseLock();
  }
}

let isMonitoringActive = false;

// Serial provisioning
async function performSerialProvisioning(serialPort, ssid, pass, server, name, activeBtn) {
  try {
    logToConsole('[SERIAL] Opening port at 115200 baud for configuration & logs...');
    if (!serialPort.readable || !serialPort.writable) {
      try {
        await serialPort.open({ baudRate: 115200 });
      } catch (openErr) {
        if (!openErr.message.includes('already open')) throw openErr;
      }
    }

    // Start serial monitoring immediately so boot logs and ACKs are displayed live!
    startLiveSerialMonitoring(serialPort);

    // Wait a brief moment for ESP bootloader to initialize
    await new Promise(r => setTimeout(r, 1200));

    const configPayload = JSON.stringify({
      ssid,
      pass,
      server,
      name
    });

    const configCommand = `HAWA_CONFIG:${configPayload}\n`;
    logToConsole(`[CONFIG] Sending network credentials over serial...`);
    logToConsole(`[CONFIG] SSID: "${ssid}", Server: "${server}"`);

    // Send configuration command
    await writeSerialText(serialPort, configCommand);
    await new Promise(r => setTimeout(r, 600));
    await writeSerialText(serialPort, configCommand);

    if (flasherPercent) flasherPercent.textContent = '100%';
    if (flasherBarFill) flasherBarFill.style.width = '100%';
    if (flasherStatusText) flasherStatusText.textContent = 'Config sent! Board connecting to Wi-Fi...';
    if (bubble3) bubble3.classList.add('done');

    logToConsole('\n------------------------------------------------------');
    logToConsole('[SUCCESS] Wi-Fi and Hawa Hub credentials sent to board.');
    logToConsole('Live serial monitor active below:');
    logToConsole('------------------------------------------------------\n');

  } catch (err) {
    logToConsole(`[WARN] Serial note: ${err.message}`);
    if (flasherStatusText) flasherStatusText.textContent = 'Board flashed! Please check monitor.';
    startLiveSerialMonitoring(serialPort);
  } finally {
    if (activeBtn) activeBtn.disabled = false;
  }
}

// Live serial stream listener (lock-free, direct chunk decoder)
async function startLiveSerialMonitoring(serialPort) {
  if (isMonitoringActive) return;
  if (!serialPort) return;

  if (!serialPort.readable) {
    try {
      await serialPort.open({ baudRate: 115200 });
    } catch (openErr) {
      if (!openErr.message.includes('already open')) {
        logToConsole(`[MONITOR] Could not open port: ${openErr.message}`);
        return;
      }
    }
  }

  isMonitoringActive = true;
  logToConsole('[MONITOR] Live serial stream connected at 115200 baud.\n');

  const decoder = new TextDecoder();
  try {
    while (serialPort.readable && isMonitoringActive) {
      const reader = serialPort.readable.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && serialConsole) {
            const chunk = decoder.decode(value, { stream: true });
            serialConsole.textContent += chunk;
            serialConsole.scrollTop = serialConsole.scrollHeight;
          }
        }
      } catch (readErr) {
        console.warn('Serial read error:', readErr);
        break;
      } finally {
        reader.releaseLock();
      }
    }
  } catch (err) {
    console.warn('Monitoring stream error:', err);
  } finally {
    isMonitoringActive = false;
  }
}
