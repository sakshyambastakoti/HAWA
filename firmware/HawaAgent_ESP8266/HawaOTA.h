#ifndef HAWA_OTA_8266_H
#define HAWA_OTA_8266_H

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266httpUpdate.h>

typedef void (*OTAProgressCallback)(int percent, size_t written, size_t total);
typedef void (*OTAStatusCallback)(bool success, const String& message);

class HawaOTA8266 {
public:
    static bool performOTA(const String& downloadUrl, const String& expectedMD5,
                           OTAProgressCallback progressCb, OTAStatusCallback statusCb) {
        WiFiClient client;
        ESPhttpUpdate.setLedPin(LED_BUILTIN, LOW);

        ESPhttpUpdate.onProgress([progressCb](int current, int total) {
            int percent = (current * 100) / total;
            if (progressCb) progressCb(percent, current, total);
        });

        if (expectedMD5.length() == 32) {
            ESPhttpUpdate.setMD5(expectedMD5.c_str());
        }

        t_httpUpdate_return ret = ESPhttpUpdate.update(client, downloadUrl);

        switch (ret) {
            case HTTP_UPDATE_FAILED: {
                String err = "HTTP_UPDATE_FAILED: " + ESPhttpUpdate.getLastErrorString();
                if (statusCb) statusCb(false, err);
                return false;
            }
            case HTTP_UPDATE_NO_UPDATES: {
                if (statusCb) statusCb(false, "HTTP_UPDATE_NO_UPDATES");
                return false;
            }
            case HTTP_UPDATE_OK: {
                if (statusCb) statusCb(true, "OTA Update OK. Rebooting...");
                return true;
            }
        }
        return false;
    }
};

#endif
