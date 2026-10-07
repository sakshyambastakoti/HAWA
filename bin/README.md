# Pre-Compiled Test Binaries for HAWA Web Flasher

This directory contains pre-compiled, tested binary files specifically built for testing the Web Flasher tool (`/flash.html`).

---

## 📁 1. ESP32 DevKit (Standard DevKit V1 / NodeMCU-32S / WROOM)

| File | Size | Flash Address (Offset) | Best Used For |
| :--- | :--- | :--- | :--- |
| **`esp32_blink_merged_0x0000.bin`** | ~363 KB | **`0x0000`** *(Recommended)* | **Foolproof 1-Click Flash**: Merged bootloader + partition table + app. Works on blank, brand new, or erased chips. |
| **`esp32_blink_app_0x10000.bin`** | ~299 KB | **`0x10000`** | Standard Arduino app partition binary. |
| `bootloader_esp32_0x1000.bin` | 23 KB | `0x1000` | Classic ESP32 2nd stage bootloader. |
| `partitions_esp32_0x8000.bin` | 3 KB | `0x8000` | Standard dual-OTA partition table. |

- **Built-in LED**: **GPIO 2** (Classic Blue LED on DevKit boards).
- **Serial Diagnostics**: 115200 baud on UART0.

---

## 📁 2. ESP32-S3 (DevKitC-1 / WROOM-1 / YD-ESP32-S3)

| File | Size | Flash Address (Offset) | Best Used For |
| :--- | :--- | :--- | :--- |
| **`esp32s3_blink_merged_0x0000.bin`** | ~386 KB | **`0x0000`** *(Recommended)* | **Foolproof 1-Click Flash**: Merged bootloader + partition table + app. |
| **`esp32s3_blink_app_0x10000.bin`** | ~322 KB | **`0x10000`** | Standard Arduino app partition binary. |
| `bootloader_esp32s3_0x0000.bin` | 20 KB | `0x0000` | ESP32-S3 2nd stage bootloader. |
| `partitions_esp32s3_0x8000.bin` | 3 KB | `0x8000` | Standard dual-OTA partition table. |

- **Built-in LED**: **RGB NeoPixel on GPIO 48 / GPIO 38** (smooth color cycling) & GPIO 2/21/1/47.
- **Serial Diagnostics**: 115200 baud (Native USB & UART CDC enabled).

---

## ⚡ How to Flash in HAWA (`http://localhost:3000/flash.html`)

1. Open `http://localhost:3000/flash.html` in Chrome or Edge.
2. Select **Custom Firmware (.bin)** tab.
3. Select your microcontroller (`ESP32` or `ESP32-S3`).
4. Select the corresponding `*_merged_0x0000.bin` file from this folder.
5. Ensure Flash Address is **`0x0000`**.
6. Plug your board via USB and click **Connect USB & Flash Custom .bin**.
7. Watch the progress bar reach 100% and view live heartbeat logs in the Serial Monitor!
