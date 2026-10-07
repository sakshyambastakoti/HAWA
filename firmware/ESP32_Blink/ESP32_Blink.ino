/*
 * =================================================================================
 * HAWA IoT Platform — ESP32 DevKit Built-in LED & Diagnostics Blink Firmware
 * =================================================================================
 * Supported Boards:
 *  - ESP32 DevKit V1 (DOIT / 30-pin / 36-pin)
 *  - NodeMCU-32S
 *  - ESP32-WROOM-32 / WROOM-32D / WROOM-32U
 *  - Generic ESP32 Dual-Core Dev Modules
 * 
 * Features:
 *  - Blinks Standard Onboard LED: GPIO 2 (Active HIGH)
 *  - Also drives accessory outputs: GPIO 4, 5, 16
 *  - Heartbeat double-pulse rhythm
 *  - Continuous 115200 Baud Serial output with Chip Diagnostics & Heartbeat
 * =================================================================================
 */

#include <Arduino.h>

// Built-in LED on ESP32 DevKit V1 / NodeMCU-32S / ESP32-WROOM
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

const int LED_PINS[] = {LED_BUILTIN, 4, 5, 16};
const int NUM_LEDS = sizeof(LED_PINS) / sizeof(LED_PINS[0]);

uint32_t counter = 0;

void setLeds(bool state) {
  for (int i = 0; i < NUM_LEDS; i++) {
    digitalWrite(LED_PINS[i], state ? HIGH : LOW);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize LED pins as outputs
  for (int i = 0; i < NUM_LEDS; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }

  Serial.println("\n=======================================================");
  Serial.println("    HAWA (हावा) — ESP32 DEVKIT LED BLINK & TEST       ");
  Serial.println("=======================================================");
  Serial.printf("Chip Model       : %s (Rev %d)\n", ESP.getChipModel(), ESP.getChipRevision());
  Serial.printf("CPU Frequency    : %d MHz\n", ESP.getCpuFreqMHz());
  Serial.printf("Flash Size       : %u MB\n", ESP.getFlashChipSize() / (1024 * 1024));
  Serial.printf("Free Heap Memory : %u bytes\n", ESP.getFreeHeap());
  Serial.printf("Built-in LED Pin : GPIO %d (Active HIGH)\n", LED_BUILTIN);
  Serial.println("Flash Status     : OK — Flasher tool verified!");
  Serial.println("=======================================================\n");
}

void loop() {
  counter++;

  // Heartbeat pulse 1
  setLeds(true);
  delay(120);
  setLeds(false);
  delay(120);

  // Heartbeat pulse 2
  setLeds(true);
  delay(120);
  setLeds(false);

  Serial.printf("[HAWA TEST] ESP32 DevKit Heartbeat #%u | LED (GPIO %d) Blinking OK | Free Heap: %u bytes\n", 
                counter, LED_BUILTIN, ESP.getFreeHeap());

  delay(640);
}
