# Factory Bootstrap Binaries

Place pre-compiled `.bin` files here if you want the Web Serial Flasher (`/flash.html`) to flash the bootstrap agent directly:

- `public/binaries/esp32/hawa_bootstrap_esp32.bin`
- `public/binaries/esp8266/hawa_bootstrap_esp8266.bin`

### How to export `.bin` from Arduino IDE:
1. Open `firmware/HawaAgent_ESP32/HawaAgent_ESP32.ino` (or ESP8266).
2. Select your board model.
3. In the menu, click **Sketch** -> **Export Compiled Binary**.
4. Copy the generated `.bin` file into this folder.

*Note: If no `.bin` file is in this folder, the Web Serial Flasher automatically uses **Direct Serial Provisioning Mode**, sending the Wi-Fi credentials straight to the board over USB Serial CDC.*
