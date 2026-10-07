#ifndef HAWA_OTA_H
#define HAWA_OTA_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include <esp_ota_ops.h>

typedef void (*OTAProgressCallback)(int percent, size_t written, size_t total);
typedef void (*OTAStatusCallback)(bool success, const String& message);

class HawaOTA {
public:
    static bool performOTA(const String& downloadUrl, size_t expectedSize, const String& expectedMD5, 
                           OTAProgressCallback progressCb, OTAStatusCallback statusCb) {
        HTTPClient http;
        http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        http.setTimeout(30000);

        bool isHttps = downloadUrl.startsWith("https://");

        WiFiClient plainClient;
        WiFiClientSecure secureClient;
        WiFiClient* clientPtr = nullptr;

        if (isHttps) {
            secureClient.setInsecure(); // Skip certificate verification for dynamic Cloudflare / tunnel domains
            clientPtr = &secureClient;
        } else {
            clientPtr = &plainClient;
        }

        if (!http.begin(*clientPtr, downloadUrl)) {
            if (statusCb) statusCb(false, "Failed to connect to download URL");
            return false;
        }

        int httpCode = http.GET();
        if (httpCode != HTTP_CODE_OK) {
            String err = "HTTP GET failed, error: " + String(httpCode) + " (" + http.errorToString(httpCode) + ")";
            http.end();
            if (statusCb) statusCb(false, err);
            return false;
        }

        int contentLength = http.getSize();
        if (contentLength <= 0 && expectedSize > 0) {
            contentLength = expectedSize;
        }

        if (contentLength <= 0) {
            http.end();
            if (statusCb) statusCb(false, "Invalid content length for firmware binary");
            return false;
        }

        bool canBegin = Update.begin(contentLength, U_FLASH);
        if (!canBegin) {
            String err = "Not enough space to begin OTA: " + String(Update.errorString());
            http.end();
            if (statusCb) statusCb(false, err);
            return false;
        }

        if (expectedMD5.length() == 32) {
            Update.setMD5(expectedMD5.c_str());
        }

        WiFiClient* stream = http.getStreamPtr();
        uint8_t buff[1024];
        size_t written = 0;
        int lastPercent = -1;

        while (http.connected() && (written < contentLength || contentLength == -1)) {
            size_t sizeAvailable = stream->available();
            if (sizeAvailable > 0) {
                int c = stream->readBytes(buff, ((sizeAvailable > sizeof(buff)) ? sizeof(buff) : sizeAvailable));
                Update.write(buff, c);
                written += c;

                if (contentLength > 0) {
                    int percent = (written * 100) / contentLength;
                    if (percent != lastPercent && percent % 2 == 0) { // report every 2%
                        lastPercent = percent;
                        if (progressCb) progressCb(percent, written, contentLength);
                    }
                }
            } else {
                delay(1);
            }

            if (contentLength > 0 && written >= (size_t)contentLength) {
                break;
            }
        }

        if (Update.end()) {
            if (Update.isFinished()) {
                http.end();
                if (statusCb) statusCb(true, "OTA Update written successfully. Rebooting...");
                return true;
            } else {
                String err = "Update not finished: " + String(Update.errorString());
                http.end();
                if (statusCb) statusCb(false, err);
                return false;
            }
        } else {
            String err = "Update error: " + String(Update.errorString());
            http.end();
            if (statusCb) statusCb(false, err);
            return false;
        }
    }

    // Rollback protection for ESP32 dual partitions
    static void validateCurrentApp() {
        esp_ota_mark_app_valid_cancel_rollback();
    }
};

#endif // HAWA_OTA_H
