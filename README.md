# HAWA — Enterprise-Grade Over-The-Air (OTA) IoT Fleet Platform

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sakshyambastakoti/HAWA)
[![Arduino Library](https://img.shields.io/badge/Arduino%20Library-Hawa%20v1.0.0-00979D.svg)](https://github.com/sakshyambastakoti/Hawa-Arduino-Library)
[![Runtime: Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933.svg)](https://nodejs.org/)
[![Hardware Support](https://img.shields.io/badge/Hardware-ESP32%20%7C%20ESP8266-E7352C.svg)](https://www.espressif.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

**HAWA** is a full-stack, end-to-end IoT platform engineered for remote microcontroller lifecycle management. It eliminates the traditional toolchain friction associated with embedded development by providing:

1. **Driverless In-Browser Provisioning:** Flashes firmware and sets Wi-Fi configurations directly via the Web Serial API without requiring Python, USB drivers, or the Arduino IDE on the client machine.
2. **Centralized Fleet Observability:** Monitors real-time connection status, RSSI signal levels, free heap memory, uptime, and firmware versions across distributed devices.
3. **Targeted Over-The-Air (OTA) Deployments:** Pushes compiled binary files to remote devices with chunked streaming, progress tracking, and MD5 cryptographic integrity verification.
4. **Live Bidirectional Console:** Streams serial debug logs from remote devices to a centralized dashboard in real time.
5. **Anti-Brick Rollback Architecture:** Integrates dual-partition OTA validation to automatically roll back to previous stable firmware if a new release fails to connect.

---

## Architecture

```
+-------------------------------------------------------------------------+
|                              END USER                                   |
|   Google Chrome / MS Edge (Web Serial API)                              |
|   Connects board via USB -> Flashes Bootstrap Binary & Sets Wi-Fi        |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         DISTRIBUTED HARDWARE                            |
|   ESP32 / ESP8266 running Hawa Agent (Hawa.h)                           |
|   - Stores credentials in Non-Volatile Storage (NVS / EEPROM)           |
|   - Establishes persistent bidirectional WebSocket (WSS/WS) link        |
|   - Reports heap, RSSI, telemetry & logs                                |
+------------------------------------+------------------------------------+
                                     |
                                     | WebSocket (TLS) / HTTPS Streaming
                                     v
+-------------------------------------------------------------------------+
|                         HAWA CLOUD GATEWAY                              |
|   Node.js + Express + ws Engine (Render.com / Docker / Self-Hosted)     |
|   - WebSocket Message Router & Fleet State Tracker                      |
|   - Firmware Binary Storage & Header Parser (App / Merged 0x0000)       |
|   - REST API & Health Check Controller                                  |
+------------------------------------+------------------------------------+
                                     ^
                                     |
+------------------------------------+------------------------------------+
|                         OPERATOR DASHBOARD                              |
|   Web-Based Fleet Command Center (HTML5, Vanilla CSS, WebSockets)       |
|   - Real-time device metrics and terminal log viewer                    |
|   - Binary drag-and-drop file uploader & deployment controller          |
+-------------------------------------------------------------------------+
```

---

## Production Deployment (Render.com)

HAWA is configured for automated cloud deployment on **Render.com**.

### Automated Blueprint Deployment

1. Click the **Deploy to Render** button above or navigate to:
   ```
   https://render.com/deploy?repo=https://github.com/sakshyambastakoti/HAWA
   ```
2. Render reads `render.yaml`, provisions the Node runtime, executes `npm install`, and runs `npm start`.
3. Your deployment receives a permanent HTTPS/WSS endpoint (e.g., `https://hawa-platform.onrender.com`).

### Manual Web Service Configuration

If configuring manually via the Render dashboard:

| Setting | Value |
| :--- | :--- |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/config` |
| **Plan** | Free (or Starter for persistent disks) |

### Environment Variables

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `3000` | Port bound by the HTTP/WebSocket server. Render sets this dynamically. |
| `PUBLIC_URL` | No | Auto-detected | Fully qualified public URL (e.g., `https://your-service.onrender.com`). Auto-populated from `RENDER_EXTERNAL_URL` if omitted. |
| `NODE_ENV` | No | `production` | Node environment profile. |

> **Note on Free Tier Inactivity:** Render free instances spin down after 15 minutes of inactivity. If maintaining 24/7 continuous device connections without cold starts, consider an external monitoring ping (such as UptimeRobot) directed at `/api/config`, or upgrade to a persistent plan.

---

## Arduino Client Library

Microcontrollers connect to the HAWA ecosystem using the companion **Hawa Arduino Library**.

### Installation

* **Arduino IDE:** Open **Library Manager** (`Ctrl+Shift+I`), search for `Hawa`, and install version `1.0.0` or later.
* **PlatformIO:** Add the library and dependencies to `platformio.ini`:
  ```ini
  lib_deps =
      https://github.com/sakshyambastakoti/Hawa-Arduino-Library.git
      bblanchon/ArduinoJson@^6.21.3
      links2004/WebSockets@^2.4.1
  ```

### Firmware Integration

```cpp
#include <Arduino.h>
#include <Hawa.h>

void setup() {
    Serial.begin(115200);

    // Option A: Load Wi-Fi and Cloud endpoint automatically from NVS
    // (Configured via the Web Serial Flasher)
    Hawa.begin();

    // Option B: Explicit network declaration
    // Hawa.begin("WIFI_SSID", "WIFI_PASSWORD", "https://hawa-platform.onrender.com");

    // Register remote dashboard command listeners
    Hawa.onCommand("toggle_led", [](const String& payload) {
        digitalWrite(2, !digitalRead(2));
        Hawa.log("LED state toggled via remote command.");
    });
}

void loop() {
    // Process WebSocket communications, heartbeats, and OTA requests
    Hawa.loop();

    // Periodic telemetry transmission
    static unsigned long lastUpdate = 0;
    if (millis() - lastUpdate > 10000) {
        lastUpdate = millis();
        Hawa.sendData("heap_free", ESP.getFreeHeap());
    }
}
```

---

## Operational Workflows

### 1. In-Browser Device Provisioning

Endpoint: `https://<your-host>/flash.html`

1. The client opens the Web Serial Flasher in any browser supporting the Web Serial API (Chrome, Edge, Opera, Brave).
2. The board is connected via USB.
3. The operator inputs target Wi-Fi credentials and the HAWA Gateway URL.
4. The flasher detects the microcontroller ROM bootloader, writes the bootstrap image, and transmits provisioning parameters into non-volatile storage.
5. The device reboots, connects to the local network, and registers with the HAWA Gateway over TLS WebSockets.

### 2. Fleet Management and Over-The-Air Deployment

Endpoint: `https://<your-host>/`

1. **Fleet Observability:** Review the table of active devices, hardware signatures, RSSI connection quality, and uptime metrics.
2. **Firmware Upload:** Export compiled binaries from Arduino IDE or PlatformIO (`Export Compiled Binary`). Upload the `.bin` package into the HAWA Firmware Library.
3. **Targeted Deployment:** Select individual target boards or fleet subsets and trigger deployment.
4. **Validation:** The server packages the download URL, file size, and MD5 checksum. The target device streams the binary, verifies cryptographic hashes, flashes the application partition, and triggers an autonomous reboot.

---

## Local Development Setup

### Prerequisites

* Node.js 18.0.0 or higher
* npm 9.0.0 or higher

### Installation & Execution

```powershell
# Clone the repository
git clone https://github.com/sakshyambastakoti/HAWA.git
cd HAWA

# Install dependencies
npm install

# Start the local gateway server
npm start
```

* Dashboard UI: `http://localhost:3000`
* Web Serial Flasher: `http://localhost:3000/flash.html`

### Public Tunneling (Cloudflare Quick Tunnels)

To test remote devices against a local development server without manual router port-forwarding:

```powershell
npm run tunnel
```

Spawns a Cloudflare Quick Tunnel and outputs a public HTTPS URL routeable across the internet.

### Device Emulation

To test dashboard fleet behavior without physical hardware attached:

```powershell
npm run simulate
```

Launches virtual ESP32 instances that authenticate, send periodic telemetry, respond to ping/pong heartbeats, and process simulated OTA transmissions.

---

## REST API Reference

| Endpoint | Method | Payload | Description |
| :--- | :---: | :--- | :--- |
| `/api/config` | `GET` | None | Returns gateway public URL, listening port, and device counts. |
| `/api/devices` | `GET` | None | Returns array of all registered devices with online/offline status. |
| `/api/devices/:id/logs` | `GET` | None | Retrieves recent buffered terminal logs for a specified device. |
| `/api/firmware/upload` | `POST` | `multipart/form-data` (`.bin`) | Uploads and indexes a new firmware binary, computing MD5 checksums. |
| `/api/firmware/:filename` | `DELETE` | None | Removes a binary package from disk and updates fleet metadata. |
| `/api/firmware/download/:filename` | `GET` | None | Binary stream endpoint for microcontrollers executing OTA updates. |
| `/api/ota/deploy` | `POST` | JSON (`{ targetDeviceId, filename }`) | Dispatches an OTA execution order to a connected device. |
| `/api/device/:id/reboot` | `POST` | None | Sends a soft-reset command to a specified device. |
| `/api/settings` | `GET` / `POST` | JSON | Inspects or updates system-wide gateway parameters. |

---

## Security & Fail-Safe Mechanisms

* **Dual-Partition Rollback Validation:** Firmware images written via `HawaOTA.h` utilize ESP-IDF rollback protection (`esp_ota_mark_app_valid_cancel_rollback()`). If new firmware suffers a kernel panic or fails to establish connectivity, the hardware reverts to the prior operational image.
* **Cryptographic MD5 Checksums:** Binaries are hashed prior to transmission. Writing to flash is verified byte-by-byte and confirmed against the calculated MD5 digest.
* **Header Inspection:** The gateway inspects binary magic bytes (`0xE9`) to distinguish standard sketch images from merged factory binaries (`0x0000` offset), preventing partition table overwrites.
* **TLS WebSocket Security:** Device communications and browser sessions support WSS/HTTPS protocols for end-to-end data encryption.

---

## Repository Structure

```
HAWA/
|-- server.js                 # HTTP gateway, WebSocket router, and OTA coordinator
|-- config.js                 # Central runtime configuration and environment parser
|-- tunnel.js                 # Dynamic Cloudflare tunnel integration
|-- render.yaml               # Cloud infrastructure deployment blueprint
|-- package.json              # Service manifest and dependency tree
|-- simulate_esp.js           # Virtual device fleet emulator
|
|-- public/                   # Client-side web applications
|   |-- index.html            # Fleet management command dashboard
|   |-- flash.html            # Driverless Web Serial provisioning application
|   |-- css/                  # Interface stylesheets (dashboard, flasher)
|   |-- js/                   # Core browser logic and WebSocket clients
|   |-- binaries/             # Precompiled bootstrap binaries for ESP32/ESP8266
|   `-- vendor/               # Bundled esptool-js serial communications library
|
|-- firmware/                 # Reference firmware sources
|   |-- HawaAgent_ESP32/      # ESP32 production agent source code
|   |-- HawaAgent_ESP8266/    # ESP8266 production agent source code
|   `-- ESP32_Blink/          # Diagnostic validation sketch
|
`-- storage/                  # Local persistent data directory
    |-- devices.json          # Hardware registry and status metadata
    `-- uploads/              # Firmware repository directory
```

---

## License

Distributed under the ISC License. Firmware components and client libraries are open source under permissive terms.

**Author & Maintainer:** Sakshyam Bastakoti  
**Repository:** [https://github.com/sakshyambastakoti/HAWA](https://github.com/sakshyambastakoti/HAWA)
