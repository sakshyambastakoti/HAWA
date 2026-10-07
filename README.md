# HAWA (हावा) — Global Over-The-Air (OTA) IoT Platform

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sakshyambastakoti/HAWA)
[![Arduino Library](https://img.shields.io/badge/Arduino%20Library-Hawa%20v1.0.0-00979D.svg)](https://github.com/sakshyambastakoti/Hawa-Arduino-Library)

**Hawa** is an end-to-end Over-The-Air platform that makes remote microcontroller programming frictionless. Your users never need to install Arduino IDE, Python, or USB drivers. They plug their board into a browser once, and you can remotely flash firmware and view live serial debug logs from anywhere in the world.

---

## 🌐 24/7 Cloud Deployment (Render.com)

You can host the entire Hawa platform on **Render.com** in under 2 minutes:

### Option A: 1-Click Blueprint Deploy
Click the button below:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sakshyambastakoti/HAWA)

### Option B: Connect via Render Dashboard
1. Log in to [Render.com](https://render.com)
2. Click **New +** -> **Web Service**
3. Select your GitHub repository: `sakshyambastakoti/HAWA`
4. Configure service settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
5. Click **Deploy Web Service**
6. Render will assign you a permanent 24/7 HTTPS URL (e.g. `https://hawa-platform.onrender.com`).
   - Dashboard: `https://hawa-platform.onrender.com`
   - In-Browser Web Serial Flasher: `https://hawa-platform.onrender.com/flash.html`

---

## 📦 Official Arduino Library

Hawa is officially indexed in the **Arduino Library Manager**:
1. Open **Arduino IDE**
2. Go to **Sketch** -> **Include Library** -> **Manage Libraries...**
3. Search for **`Hawa`** and click **Install**.
4. In your sketch:
```cpp
#include <Hawa.h>

void setup() {
  Hawa.begin("Your_WiFi_SSID", "Your_WiFi_Password", "https://hawa-platform.onrender.com");
}

void loop() {
  Hawa.handle();
}
```

---

## Quick Start (Local Development)

### 1. Start the Server & Public Tunnel
In PowerShell in `d:\HAWA`:

```powershell
# Install dependencies (already completed)
npm install

# Start the local Hawa server
npm start
```
* Dashboard will run at: `http://localhost:3000`
* Friend flasher will run at: `http://localhost:3000/flash.html`

To make it accessible worldwide (zero port-forwarding):
```powershell
npm run tunnel
```
This spawns a free Cloudflare Quick Tunnel and outputs a public URL (e.g. `https://xxxx.trycloudflare.com`). Send `https://xxxx.trycloudflare.com/flash.html` to your friends!

---

## 👥 Part 1: For Your Friends (The Web Flasher)

1. Send your friend your Hawa public URL: `https://<your-tunnel>.trycloudflare.com/flash.html`
2. They open the link in **Google Chrome**, **Microsoft Edge**, or **Brave**.
3. They connect their ESP32 or ESP8266 to their laptop via USB.
4. They type their home Wi-Fi or mobile hotspot Name & Password and click **"Connect USB & Flash Board"**.
5. The browser communicates directly with the chip via the Web Serial API, flashes the bootstrap agent, and provisions the Wi-Fi credentials into flash storage.
6. **Done!** Their board connects to their Wi-Fi and connects back to your Hawa Hub automatically.

---

## 🛠️ Part 2: For You (The Developer Dashboard)

Open `http://localhost:3000`:

1. **Fleet Monitoring:** View all online boards in real-time with Wi-Fi signal strength (RSSI), free RAM (Heap), chip model, and uptime.
2. **1-Click Wireless Deployment:**
   - In Arduino IDE or PlatformIO, write your code and click **Sketch -> Export Compiled Binary**.
   - Drag & drop the `.bin` file into Hawa's **"Deploy Firmware"** window.
   - Select your friend's board and click **"Push Firmware Wirelessly 🌬️"**.
   - Watch real-time progress (`0% -> 100%`) as the firmware streams over the air!
3. **Live Remote Serial Console:**
   - Any log output or `hawaLog("...")` call from your friend's board streams directly to your web browser console in real-time.
4. **Remote Actions:**
   - Remotely reboot the board or toggle the onboard test LED with one click.

---

## 📁 Project Structure

```
d:\HAWA/
├── server.js                        # Node.js Express & WebSocket Gateway
├── config.js                        # Server configuration & tunnel settings
├── tunnel.js                        # Cloudflare Quick Tunnel spawner
├── package.json                     # Dependencies & scripts
│
├── public/                          # Web Frontend
│   ├── index.html                   # Developer Command Dashboard
│   ├── flash.html                   # Friend-Facing Web Serial Flasher
│   ├── css/
│   │   ├── dashboard.css            # Dark-mode dashboard styles
│   │   └── flasher.css              # Step-by-step flashing wizard styles
│   ├── js/
│   │   ├── dashboard.js             # Real-time WebSocket & deployment manager
│   │   └── flasher.js               # Web Serial API driver & auto-config
│   └── vendor/
│       └── esptool.bundle.js        # Bundled esptool-js for in-browser flashing
│
├── firmware/                        # Arduino C++ Source Codes
│   ├── HawaAgent_ESP32/             # ESP32 firmware agent
│   │   ├── HawaAgent_ESP32.ino
│   │   ├── HawaConfig.h
│   │   └── HawaOTA.h
│   └── HawaAgent_ESP8266/           # ESP8266 firmware agent
│       ├── HawaAgent_ESP8266.ino
│       ├── HawaConfig.h
│       └── HawaOTA.h
│
└── storage/
    ├── devices.json                 # Persistent device state
    └── uploads/                     # Uploaded .bin files
```

---

## 🛡️ Anti-Brick & Fail-Safe Features
- **ESP32 Dual-Partition Rollback:** If a newly deployed binary has a bug that crashes or fails to connect to Wi-Fi within 90 seconds, the chip automatically rolls back to the previous working firmware using ESP-IDF's native rollback partition.
- **MD5 Checksum Verification:** Every OTA binary is checked for cryptographic integrity before flash writing completes.
