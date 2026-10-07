/*
 * Project Hawa - ESP32 Client Agent Firmware
 * 
 * Features:
 *  - Persistent NVS config (Wi-Fi, Server URL, Device Name)
 *  - Automatic Serial Provisioning from Web Serial Flasher
 *  - Secure/Standard WebSocket connection to Hawa Hub
 *  - Streaming Over-The-Air (OTA) updates with live percentage feedback
 *  - Remote Serial Monitor streaming (see your board's logs from anywhere)
 *  - Dual-partition rollback protection
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h> // Arduino library: WebSockets by Markus Sattler
#include <ArduinoJson.h>      // Arduino library: ArduinoJson v6 or v7

#include "HawaConfig.h"
#include "HawaOTA.h"

#define LED_PIN 2 // Built-in LED on most ESP32 Dev modules

HawaConfig config;
WebSocketsClient webSocket;
unsigned long lastHeartbeat = 0;
bool isOtaRunning = false;
String currentDeviceId;

void sendJsonToWs(String jsonStr) {
    if (webSocket.isConnected()) {
        webSocket.sendTXT(jsonStr);
    }
}

// Log message to both local Serial and remote Web Dashboard
void hawaLog(String msg) {
    Serial.println(msg);
    if (webSocket.isConnected() && !isOtaRunning) {
        DynamicJsonDocument doc(512);
        doc["type"] = "SERIAL_LOG";
        doc["deviceId"] = currentDeviceId;
        doc["text"] = msg;
        String out;
        serializeJson(doc, out);
        webSocket.sendTXT(out);
    }
}

// Progress callback during OTA
void onOTAProgress(int percent, size_t written, size_t total) {
    DynamicJsonDocument doc(256);
    doc["type"] = "OTA_PROGRESS";
    doc["deviceId"] = currentDeviceId;
    doc["percent"] = percent;
    doc["bytesRead"] = written;
    doc["totalBytes"] = total;
    String out;
    serializeJson(doc, out);
    sendJsonToWs(out);
}

// Completion callback after OTA
void onOTAStatus(bool success, const String& message) {
    DynamicJsonDocument doc(256);
    doc["type"] = "OTA_COMPLETE";
    doc["deviceId"] = currentDeviceId;
    doc["status"] = success ? "SUCCESS" : "FAILED";
    doc["message"] = message;
    String out;
    serializeJson(doc, out);
    sendJsonToWs(out);
}

// Parse Serial input for Web Serial Flasher and manual provisioning
void checkSerialProvisioning() {
    if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) return;

        Serial.println("[SERIAL RX] " + line);

        // 1. JSON format from Web Serial Flasher: HAWA_CONFIG:{...}
        int hawaIdx = line.indexOf("HAWA_CONFIG:");
        if (hawaIdx != -1) {
            String jsonPart = line.substring(hawaIdx + 12);
            jsonPart.trim();
            DynamicJsonDocument doc(512);
            DeserializationError err = deserializeJson(doc, jsonPart);

            if (!err) {
                String newSsid = doc["ssid"] | "";
                String newPass = doc["pass"] | "";
                String newServer = doc["server"] | "wss://leaves-pensions-honest-leadership.trycloudflare.com";
                String newName = doc["name"] | "ESP32-Device";

                config.saveCredentials(newSsid, newPass, newServer, newName);
                Serial.println("\n==================================");
                Serial.println("[HAWA] Wi-Fi CONFIG SAVED TO NVS!");
                Serial.println("SSID: " + newSsid);
                Serial.println("Server: " + newServer);
                Serial.println("Rebooting board to connect to Wi-Fi...");
                Serial.println("==================================\n");
                delay(1000);
                ESP.restart();
                return;
            } else {
                Serial.println("HAWA_ERR:INVALID_JSON (" + String(err.c_str()) + ")");
            }
        }

        // 2. Simple human-readable format: WIFI:ssid,password or WIFI:ssid,password,server
        int wifiIdx = line.indexOf("WIFI:");
        if (wifiIdx != -1) {
            String params = line.substring(wifiIdx + 5);
            params.trim();
            int comma1 = params.indexOf(',');
            if (comma1 != -1) {
                String newSsid = params.substring(0, comma1);
                String rest = params.substring(comma1 + 1);
                int comma2 = rest.indexOf(',');
                String newPass = (comma2 != -1) ? rest.substring(0, comma2) : rest;
                String newServer = (comma2 != -1) ? rest.substring(comma2 + 1) : "wss://leaves-pensions-honest-leadership.trycloudflare.com";
                newSsid.trim();
                newPass.trim();
                newServer.trim();

                config.saveCredentials(newSsid, newPass, newServer, "ESP32-Device");
                Serial.println("\n==================================");
                Serial.println("[HAWA] Wi-Fi SAVED VIA SERIAL COMMAND!");
                Serial.println("SSID: " + newSsid);
                Serial.println("Server: " + newServer);
                Serial.println("Rebooting board to connect to Wi-Fi...");
                Serial.println("==================================\n");
                delay(1000);
                ESP.restart();
                return;
            }
        }

        // 3. Status inspection
        if (line.equalsIgnoreCase("STATUS")) {
            Serial.println("\n[HAWA STATUS]");
            Serial.println("Device ID   : " + currentDeviceId);
            Serial.println("NVS SSID    : " + (config.ssid.length() > 0 ? config.ssid : "<NONE>"));
            Serial.println("NVS Server  : " + (config.serverUrl.length() > 0 ? config.serverUrl : "<NONE>"));
            Serial.println("WiFi Status : " + String(WiFi.status() == WL_CONNECTED ? "CONNECTED (" + WiFi.localIP().toString() + ")" : "DISCONNECTED"));
            Serial.println("Free Heap   : " + String(ESP.getFreeHeap()) + " bytes\n");
            return;
        }

        // 4. Maintenance commands
        if (line.equalsIgnoreCase("CLEAR")) {
            config.clear();
            Serial.println("[HAWA] NVS Credentials cleared. Restarting...");
            delay(1000);
            ESP.restart();
            return;
        }

        if (line.equalsIgnoreCase("REBOOT")) {
            Serial.println("[HAWA] Restarting ESP...");
            delay(500);
            ESP.restart();
            return;
        }

        // Fallback guidance
        Serial.println("\n[HAWA SERIAL COMMAND HELP]");
        Serial.println("> Send Wi-Fi:   WIFI:your_ssid,your_password");
        Serial.println("> Or JSON:      HAWA_CONFIG:{\"ssid\":\"name\",\"pass\":\"pw\",\"server\":\"wss://...\"}");
        Serial.println("> Other:        STATUS | REBOOT | CLEAR\n");
    }
}

// WebSocket Event Handler
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected from Hawa Server");
            break;

        case WStype_CONNECTED: {
            Serial.println("[WS] Connected! Sending CLIENT_HELLO...");
            DynamicJsonDocument doc(512);
            doc["type"] = "CLIENT_HELLO";
            doc["deviceId"] = currentDeviceId;
            doc["name"] = config.deviceName;
            doc["chip"] = "ESP32 (" + String(ESP.getChipModel()) + ")";
            doc["mac"] = WiFi.macAddress();
            doc["ip"] = WiFi.localIP().toString();
            doc["rssi"] = WiFi.RSSI();
            doc["firmwareVersion"] = config.firmwareVersion;
            doc["freeHeap"] = ESP.getFreeHeap();
            doc["uptime"] = millis() / 1000;

            String out;
            serializeJson(doc, out);
            webSocket.sendTXT(out);
            break;
        }

        case WStype_TEXT: {
            DynamicJsonDocument doc(1024);
            DeserializationError err = deserializeJson(doc, payload);
            if (err) return;

            String msgType = doc["type"] | "";

            // Handle OTA trigger
            if (msgType == "OTA_START") {
                String downloadUrl = doc["downloadUrl"] | "";
                size_t size = doc["size"] | 0;
                String md5 = doc["md5"] | "";
                String targetVersion = doc["version"] | "";

                hawaLog("[OTA] Starting Over-The-Air Update from: " + downloadUrl);
                isOtaRunning = true;

                bool ok = HawaOTA::performOTA(downloadUrl, size, md5, onOTAProgress, onOTAStatus);
                if (ok) {
                    if (targetVersion.length() > 0) {
                        config.updateVersion(targetVersion);
                    }
                    delay(2000);
                    ESP.restart();
                } else {
                    isOtaRunning = false;
                }
            }
            // Handle Remote Commands
            else if (msgType == "COMMAND") {
                String action = doc["action"] | "";
                if (action == "REBOOT") {
                    hawaLog("[CMD] Remote reboot request received. Restarting...");
                    delay(1000);
                    ESP.restart();
                } else if (action == "TOGGLE_LED") {
                    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
                    hawaLog("[CMD] LED Toggled!");
                }
            }
            break;
        }

        case WStype_BIN:
        case WStype_ERROR:
        case WStype_PONG:
            break;
    }
}

void setup() {
    Serial.begin(115200);
    Serial.setTimeout(100);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Cancel rollback if boot was successful
    HawaOTA::validateCurrentApp();

    config.begin();
    WiFi.mode(WIFI_STA);
    currentDeviceId = "hawa-esp32-" + WiFi.macAddress();
    currentDeviceId.replace(":", "");
    currentDeviceId.toLowerCase();

    Serial.println("\n==================================");
    Serial.println("[HAWA] ESP32 Client Agent");
    Serial.println("Device ID: " + currentDeviceId);
    Serial.println("Firmware Ver: " + config.firmwareVersion);
    Serial.println("==================================");

    if (!config.hasWifiCredentials()) {
        Serial.println("[Hawa] No Wi-Fi configured. Waiting for Web Serial Flasher configuration...");
        // Fast blink indicates unconfigured state
        for (int i = 0; i < 5; i++) {
            digitalWrite(LED_PIN, HIGH); delay(100);
            digitalWrite(LED_PIN, LOW); delay(100);
        }
        return;
    }

    Serial.println("[WiFi] Connecting to: " + config.ssid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(config.ssid.c_str(), config.password.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
        checkSerialProvisioning(); // Allow re-provisioning during connect
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
        digitalWrite(LED_PIN, HIGH);

        // Setup WebSocket client
        String server = config.serverUrl;
        if (server.length() == 0) {
            server = "ws://192.168.1.100:3000"; // fallback
        }

        // Parse protocol, host, port
        bool isSSL = server.startsWith("wss://");
        server.replace("wss://", "");
        server.replace("ws://", "");
        server.replace("https://", "");
        server.replace("http://", "");

        int port = isSSL ? 443 : 3000;
        int colonIdx = server.indexOf(':');
        int slashIdx = server.indexOf('/');
        String host = server;

        if (colonIdx > 0) {
            host = server.substring(0, colonIdx);
            String portStr = (slashIdx > colonIdx) ? server.substring(colonIdx + 1, slashIdx) : server.substring(colonIdx + 1);
            port = portStr.toInt();
        } else if (slashIdx > 0) {
            host = server.substring(0, slashIdx);
        }

        Serial.printf("[WS] Connecting to %s:%d (SSL: %s)...\n", host.c_str(), port, isSSL ? "yes" : "no");
        if (isSSL) {
            webSocket.beginSSL(host.c_str(), port, "/ws");
        } else {
            webSocket.begin(host.c_str(), port, "/ws");
        }
        webSocket.onEvent(webSocketEvent);
        webSocket.setReconnectInterval(5000);
    } else {
        Serial.println("\n[WiFi] Connection failed. Waiting for re-provisioning over Serial...");
    }
}

void loop() {
    checkSerialProvisioning();

    if (WiFi.status() == WL_CONNECTED) {
        webSocket.loop();

        // Send Heartbeat every 15s
        if (millis() - lastHeartbeat > 15000 && !isOtaRunning) {
            lastHeartbeat = millis();
            DynamicJsonDocument doc(256);
            doc["type"] = "HEARTBEAT";
            doc["deviceId"] = currentDeviceId;
            doc["rssi"] = WiFi.RSSI();
            doc["freeHeap"] = ESP.getFreeHeap();
            doc["uptime"] = millis() / 1000;
            String out;
            serializeJson(doc, out);
            sendJsonToWs(out);
        }
    }
}
