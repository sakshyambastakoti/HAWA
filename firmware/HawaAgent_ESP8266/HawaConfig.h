#ifndef HAWA_CONFIG_8266_H
#define HAWA_CONFIG_8266_H

#include <Arduino.h>
#include <EEPROM.h>

struct HawaStorageData {
    char magic[4]; // "HAWA"
    char ssid[32];
    char pass[64];
    char server[128];
    char name[32];
    char ver[16];
};

class HawaConfig8266 {
public:
    String ssid;
    String password;
    String serverUrl;
    String deviceName;
    String firmwareVersion;

    void begin() {
        EEPROM.begin(sizeof(HawaStorageData));
        HawaStorageData data;
        EEPROM.get(0, data);

        if (strncmp(data.magic, "HAWA", 4) == 0) {
            ssid = String(data.ssid);
            password = String(data.pass);
            serverUrl = String(data.server);
            deviceName = String(data.name);
            firmwareVersion = String(data.ver);
        } else {
            ssid = "";
            password = "";
            serverUrl = "";
            deviceName = "Hawa-ESP8266";
            firmwareVersion = "1.0.0";
        }
    }

    bool hasWifiCredentials() {
        return (ssid.length() > 0);
    }

    void saveCredentials(const String& newSsid, const String& newPass, const String& newServer, const String& newName) {
        HawaStorageData data;
        strncpy(data.magic, "HAWA", 4);
        strncpy(data.ssid, newSsid.c_str(), sizeof(data.ssid));
        strncpy(data.pass, newPass.c_str(), sizeof(data.pass));
        strncpy(data.server, newServer.c_str(), sizeof(data.server));
        strncpy(data.name, newName.c_str(), sizeof(data.name));
        strncpy(data.ver, firmwareVersion.c_str(), sizeof(data.ver));

        EEPROM.put(0, data);
        EEPROM.commit();

        ssid = newSsid;
        password = newPass;
        serverUrl = newServer;
        deviceName = newName;
    }

    void updateVersion(const String& newVer) {
        firmwareVersion = newVer;
        HawaStorageData data;
        EEPROM.get(0, data);
        strncpy(data.ver, newVer.c_str(), sizeof(data.ver));
        EEPROM.put(0, data);
        EEPROM.commit();
    }
};

#endif
