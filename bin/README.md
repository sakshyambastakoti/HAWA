# ESP32-S3 Test Binaries for HAWA Web Flasher

This directory contains pre-compiled, tested binary files specifically built for **ESP32-S3** to test the Web Flasher tool (`/flash.html`).

---

## 📁 Binary Files Included

| File | Size | Flash Address (Offset) | Best Used For |
| :--- | :--- | :--- | :--- |
| **`esp32s3_blink_merged_0x0000.bin`** | ~386 KB | **`0x0000`** *(Recommended)* | **Foolproof 1-Click Flash**: Contains bootloader + partition table + app in a single file. Works on blank, brand new, or erased chips. |
| **`esp32s3_blink_app_0x10000.bin`** | ~322 KB | **`0x1000`0** | Standard Arduino app partition binary. Flashes to the app partition without modifying existing bootloaders. |
| `bootloader_esp32s3_0x0000.bin` | 20 KB | `0x0000` | Standalone ESP32-S3 2nd stage bootloader. |
| `partitions_esp32s3_0x8000.bin` | 3 KB | `0x8000` | Standard dual-OTA partition table. |

---

## ⚡ How to Test with the Web Flasher (`/flash.html`)

### Method 1: Using "Custom Firmware (.bin)" Tab (Recommended for quick testing)

1. Open **`http://localhost:3000/flash.html`** in **Google Chrome** or **Microsoft Edge**.
2. Click on the **Custom Firmware (.bin)** tab.
3. Target Microcontroller: Select **ESP32-S3**.
4. In the **Choose .bin File** dropzone:
   - Click to browse and select: `d:\HAWA\bin\esp32s3_blink_merged_0x0000.bin`
5. **Flash Address (Offset)**:
   - Set to **`0x0000`** (Click the `0x0000 (Base)` quick button).
   - *(If using `esp32s3_blink_app_0x10000.bin`, set to `0x10000`)*.
6. Plug your **ESP32-S3** board into your computer's USB port.
   *(If your board has two USB ports marked "UART/COM" and "USB", connect to either one. If the browser fails to connect, hold the **BOOT** button while plugging in or clicking Flash).*
7. Click **Connect USB & Flash Custom .bin**.
8. Select your ESP32-S3 port in the browser popup and click **Connect**.
9. Watch the progress bar reach 100%!

---

## 💡 What You Will See After Flashing

1. **LED Feedback**:
   - Built-in **RGB NeoPixel** (GPIO 48 / GPIO 38): Cycles vibrant colors (**Cyan → Emerald → Violet → Amber → Deep Blue**) in a heartbeat rhythm!
   - Standard LED (GPIO 2 / 21 / 1 / 47): Pulses on and off.
2. **Live Serial Monitor Output** (at 115200 baud):
   ```text
   =======================================================
      HAWA (हावा) — ESP32-S3 LED BLINK & FLASHER TEST   
   =======================================================
   Chip Model       : ESP32-S3 (Rev 0)
   CPU Frequency    : 240 MHz
   Flash Size       : 8 MB
   Free Heap Memory : 307524 bytes
   Pins Controlled  : GPIO 2, 21, 1, 47 (LEDs) | GPIO 48, 38 (RGB NeoPixel)
   Flash Status     : OK — Flasher tool verified!
   =======================================================

   [HAWA TEST] Heartbeat #1 | LED Blinking OK | Free Heap: 307524 bytes
   [HAWA TEST] Heartbeat #2 | LED Blinking OK | Free Heap: 307524 bytes
   ```

---

## 🛠 Source Code
The full Arduino C++ source sketch is located at:
[ESP32S3_Blink.ino](file:///d:/HAWA/firmware/ESP32S3_Blink/ESP32S3_Blink.ino)
