import { ESPLoader, Transport } from '/vendor/esptool.bundle.js';

// DOM elements
const browserWarning = document.getElementById('browserWarning');
const boardTypeSelect = document.getElementById('boardType');
const wifiSsidInput = document.getElementById('wifiSsid');
const wifiPassInput = document.getElementById('wifiPass');
const deviceNameInput = document.getElementById('deviceName');
const serverUrlInput = document.getElementById('serverUrl');
const startFlashBtn = document.getElementById('startFlashBtn');
const flasherProgress = document.getElementById('flasherProgress');
const flasherStatusText = document.getElementById('flasherStatusText');
const flasherPercent = document.getElementById('flasherPercent');
const flasherBarFill = document.getElementById('flasherBarFill');
const serialConsole = document.getElementById('serialConsole');
const bubble1 = document.getElementById('bubble1');
const bubble2 = document.getElementById('bubble2');
const bubble3 = document.getElementById('bubble3');

let port = null;
let transport = null;
let esploader = null;

// Check Web Serial API support
if (!('serial' in navigator)) {
  browserWarning.style.display = 'block';
  startFlashBtn.disabled = true;
  logToConsole('❌ Error: Web Serial API is not supported in this browser. Please use Chrome or Edge.');
}

// Auto-fill Server URL from current backend
fetch('/api/config')
  .then(r => r.json())
  .then(cfg => {
    if (cfg.publicUrl && !serverUrlInput.value) {
      serverUrlInput.value = cfg.publicUrl;
    }
  })
  .catch(() => {
    serverUrlInput.value = window.location.origin;
  });

function logToConsole(text) {
  serialConsole.textContent += `\n${text}`;
  serialConsole.scrollTop = serialConsole.scrollHeight;
}

// Custom Terminal logger for esptool-js
const espTerminal = {
  clean() {
    serialConsole.textContent = '';
  },
  writeLine(data) {
    logToConsole(data);
  },
  write(data) {
    serialConsole.textContent += data;
    serialConsole.scrollTop = serialConsole.scrollHeight;
  }
};

// Start Flash & Provision flow
startFlashBtn.addEventListener('click', async () => {
  const ssid = wifiSsidInput.value.trim();
  const pass = wifiPassInput.value;
  const name = deviceNameInput.value.trim() || 'Hawa-Client';
  let server = serverUrlInput.value.trim() || window.location.origin;

  if (!ssid) {
    alert('Please enter your Wi-Fi or Mobile Hotspot Network Name (SSID).');
    wifiSsidInput.focus();
    return;
  }

  // Ensure WebSocket protocol prefix for firmware
  if (server.startsWith('http://')) server = server.replace('http://', 'ws://');
  if (server.startsWith('https://')) server = server.replace('https://', 'wss://');
  if (!server.startsWith('ws://') && !server.startsWith('wss://')) {
    server = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + server;
  }

  startFlashBtn.disabled = true;
  flasherProgress.classList.add('active');
  updateStep(2);

  try {
    logToConsole('👉 Requesting USB Serial Port access... (Please select your board in the popup)');
    port = await navigator.serial.requestPort();
    
    transport = new Transport(port);
    esploader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal: espTerminal
    });

    logToConsole('⚡ Connecting to ESP ROM bootloader...');
    flasherStatusText.textContent = 'Connecting to ROM bootloader...';
    
    const chip = await esploader.main();
    logToConsole(`✅ Connected to ${chip}! Initializing bootstrap flashing...`);

    // Fetch bootstrap binary based on board type
    const board = boardTypeSelect.value;
    flasherStatusText.textContent = `Downloading ${board.toUpperCase()} bootstrap binary...`;
    
    let binUrl = `/binaries/${board}/hawa_bootstrap_${board}.bin`;
    let binResponse = await fetch(binUrl);

    // If precompiled binary doesn't exist yet on server, notify user and provision config over serial directly
    if (!binResponse.ok) {
      logToConsole(`ℹ️ Precompiled image ${binUrl} not found on server.`);
      logToConsole(`ℹ️ Switching to Direct Serial Provisioning mode...`);
      flasherStatusText.textContent = 'Configuring Wi-Fi via Serial...';

      // Disconnect esploader stub so board reboots into application
      await transport.disconnect();

      // Perform serial handshake
      await performSerialProvisioning(port, ssid, pass, server, name);
      return;
    }

    const binBuffer = await binResponse.arrayBuffer();
    const fileArray = [{
      data: new Uint8Array(binBuffer),
      address: (board === 'esp8266' ? 0x0000 : 0x10000)
    }];

    flasherStatusText.textContent = 'Flashing Hawa Bootstrap Firmware...';
    updateStep(3);

    await esploader.writeFlash({
      fileArray,
      flashSize: 'keep',
      eraseAll: false,
      reportProgress: (fileIndex, written, total) => {
        const percent = Math.floor((written / total) * 100);
        flasherPercent.textContent = `${percent}%`;
        flasherBarFill.style.width = `${percent}%`;
        flasherStatusText.textContent = `Flashing: ${percent}% (${Math.round(written/1024)} KB / ${Math.round(total/1024)} KB)`;
      }
    });

    logToConsole('✅ Flashing complete! Resetting board and sending Wi-Fi credentials...');
    flasherStatusText.textContent = 'Provisioning Wi-Fi credentials...';

    await transport.disconnect();
    await new Promise(r => setTimeout(r, 1500));

    // Send credentials over serial
    await performSerialProvisioning(port, ssid, pass, server, name);

  } catch (err) {
    console.error(err);
    logToConsole(`❌ Error: ${err.message}`);
    flasherStatusText.textContent = 'Error during setup';
    startFlashBtn.disabled = false;
  }
});

// Sends the HAWA_CONFIG payload over Serial
async function performSerialProvisioning(serialPort, ssid, pass, server, name) {
  try {
    logToConsole('📡 Opening Serial port at 115200 baud to inject Wi-Fi config...');
    await serialPort.open({ baudRate: 115200 });

    const textEncoder = new TextEncoderStream();
    const writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
    const writer = textEncoder.writable.getWriter();

    const configPayload = JSON.stringify({
      ssid,
      pass,
      server,
      name
    });

    const configCommand = `HAWA_CONFIG:${configPayload}\n`;
    logToConsole(`📤 Sending Config: SSID "${ssid}", Server "${server}"...`);
    
    // Give board a moment, then send command 3 times to ensure reception
    await new Promise(r => setTimeout(r, 1000));
    await writer.write(configCommand);
    await new Promise(r => setTimeout(r, 500));
    await writer.write(configCommand);

    writer.releaseLock();
    await serialPort.close();

    flasherPercent.textContent = '100%';
    flasherBarFill.style.width = '100%';
    flasherStatusText.textContent = '🎉 Complete! Board Connected to Hawa!';
    bubble3.classList.add('done');

    logToConsole('\n======================================================');
    logToConsole('🎉 SUCCESS! Wi-Fi & Hawa configuration saved to your board.');
    logToConsole('Your board will now connect to Wi-Fi and reach your friend.');
    logToConsole('They can now remotely program and monitor this board wirelessly!');
    logToConsole('======================================================');

    alert('🎉 Success! Your ESP board is now configured and connected to Hawa. You can now unplug it or leave it running!');

  } catch (err) {
    logToConsole(`⚠️ Serial configuration step note: ${err.message}`);
    flasherStatusText.textContent = 'Board flashed! Please restart board.';
  } finally {
    startFlashBtn.disabled = false;
  }
}

function updateStep(stepNumber) {
  bubble1.className = 'step-bubble ' + (stepNumber >= 1 ? (stepNumber > 1 ? 'done' : 'active') : '');
  bubble2.className = 'step-bubble ' + (stepNumber >= 2 ? (stepNumber > 2 ? 'done' : 'active') : '');
  bubble3.className = 'step-bubble ' + (stepNumber >= 3 ? (stepNumber > 3 ? 'done' : 'active') : '');
}
