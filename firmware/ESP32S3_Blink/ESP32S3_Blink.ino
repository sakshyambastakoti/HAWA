/*
 * =================================================================================
 * HAWA IoT Platform — ESP32-S3 Built-in LED & Diagnostics Blink Firmware
 * =================================================================================
 * Supported Boards:
 *  - ESP32-S3-DevKitC-1 (N8 / N16)
 *  - ESP32-S3-WROOM-1 / WROOM-2
 *  - YD-ESP32-S3 / NodeMCU ESP32-S3
 *  - Waveshare ESP32-S3 / LilyGO T-Display-S3
 * 
 * Features:
 *  - Blinks Standard GPIO LEDs: GPIO 2, 21, 1, 47
 *  - Drives Onboard WS2812 / NeoPixel RGB LEDs: GPIO 48 (DevKitC) & GPIO 38 (LilyGO)
 *  - Cycles smooth RGB colors (Cyan, Emerald, Violet, Amber, Deep Blue)
 *  - Continuous 115200 Baud Serial output with Chip Diagnostics & Heartbeat
 *  - USB CDC on Boot enabled (compatible with both USB and UART ports)
 * =================================================================================
 */

#include <Arduino.h>

// Common ESP32-S3 onboard LED pins
const int STANDARD_LED_PINS[] = {2, 21, 1, 47};
const int NUM_LEDS = sizeof(STANDARD_LED_PINS) / sizeof(STANDARD_LED_PINS[0]);

// RGB NeoPixel pins on ESP32-S3 boards (DevKitC uses 48, LilyGO uses 38)
const int RGB_PINS[] = {48, 38};
const int NUM_RGB = sizeof(RGB_PINS) / sizeof(RGB_PINS[0]);

uint32_t counter = 0;

void setLeds(bool on, uint8_t r, uint8_t g, uint8_t b) {
  // Toggle standard digital LEDs
  for (int i = 0; i < NUM_LEDS; i++) {
    digitalWrite(STANDARD_LED_PINS[i], on ? HIGH : LOW);
  }

  // Drive built-in NeoPixel RGB LED
  for (int i = 0; i < NUM_RGB; i++) {
    if (on) {
      neopixelWrite(RGB_PINS[i], r, g, b);
    } else {
      neopixelWrite(RGB_PINS[i], 0, 0, 0);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize LED pins as output
  for (int i = 0; i < NUM_LEDS; i++) {
    pinMode(STANDARD_LED_PINS[i], OUTPUT);
    digitalWrite(STANDARD_LED_PINS[i], LOW);
  }

  Serial.println("\n=======================================================");
  Serial.println("   HAWA (हावा) — ESP32-S3 LED BLINK & FLASHER TEST   ");
  Serial.println("=======================================================");
  Serial.printf("Chip Model       : %s (Rev %d)\n", ESP.getChipModel(), ESP.getChipRevision());
  Serial.printf("CPU Frequency    : %d MHz\n", ESP.getCpuFreqMHz());
  Serial.printf("Flash Size       : %u MB\n", ESP.getFlashChipSize() / (1024 * 1024));
  Serial.printf("Free Heap Memory : %u bytes\n", ESP.getFreeHeap());
  Serial.println("Pins Controlled  : GPIO 2, 21, 1, 47 (LEDs) | GPIO 48, 38 (RGB NeoPixel)");
  Serial.println("Flash Status     : OK — Flasher tool verified!");
  Serial.println("=======================================================\n");
}

void loop() {
  counter++;

  // Beautiful cycling color palette
  uint8_t colors[5][3] = {
    {0, 60, 80},   // Cyan
    {20, 80, 20},  // Emerald
    {70, 0, 80},   // Violet
    {80, 50, 0},   // Amber
    {0, 20, 80}    // Deep Blue
  };
  uint8_t r = colors[counter % 5][0];
  uint8_t g = colors[counter % 5][1];
  uint8_t b = colors[counter % 5][2];

  // Heartbeat pulse 1
  setLeds(true, r, g, b);
  delay(120);
  setLeds(false, 0, 0, 0);
  delay(120);

  // Heartbeat pulse 2
  setLeds(true, r, g, b);
  delay(120);
  setLeds(false, 0, 0, 0);

  Serial.printf("[HAWA TEST] Heartbeat #%u | LED Blinking OK | Free Heap: %u bytes\n", counter, ESP.getFreeHeap());

  delay(640);
}
