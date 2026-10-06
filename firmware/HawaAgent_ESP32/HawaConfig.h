#ifndef HAWA_CONFIG_H
#define HAWA_CONFIG_H

#include <Arduino.h>
#include <Preferences.h>

class HawaConfig {
private:
    Preferences prefs;

public:
    String ssid;
    String password;
    String serverUrl;
    String deviceName;
    String firmwareVersion;

    HawaConfig() {
        firmwareVersion = "1.0.0";
    }

    void begin() {
        prefs.begin("hawa", false);
        ssid = prefs.getString("ssid", "");
        password = prefs.getString("pass", "");
        serverUrl = prefs.getString("server", "");
        deviceName = prefs.getString("name", "Hawa-ESP32");
        firmwareVersion = prefs.getString("ver", "1.0.0");
    }

    bool hasWifiCredentials() {
        return (ssid.length() > 0);
    }

    void saveCredentials(const String& newSsid, const String& newPass, const String& newServer, const String& newName) {
        prefs.begin("hawa", false);
        if (newSsid.length() > 0) prefs.putString("ssid", newSsid);
        if (newPass.length() >= 0) prefs.putString("pass", newPass);
        if (newServer.length() > 0) prefs.putString("server", newServer);
        if (newName.length() > 0) prefs.putString("name", newName);
        prefs.end();

        ssid = newSsid;
        password = newPass;
        serverUrl = newServer;
        deviceName = newName;
    }

    void updateVersion(const String& newVer) {
        prefs.begin("hawa", false);
        prefs.putString("ver", newVer);
        prefs.end();
        firmwareVersion = newVer;
    }

    void clear() {
        prefs.begin("hawa", false);
        prefs.clear();
        prefs.end();
    }
};

#endif // HAWA_CONFIG_H
