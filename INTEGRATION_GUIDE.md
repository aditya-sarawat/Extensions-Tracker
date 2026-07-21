# Browser Extension Telemetry Integration Prompt & Guide

> **Instructions for AI Assistant / Developer**:
> You are tasked with integrating telemetry and usage analytics into this browser extension (Manifest V3 / V2).
> Follow the guide below to create a robust `telemetry.js` module and wire it up to the background service worker/script and UI components.

---

## 1. Overview & API Specification

- **Backend Telemetry Base URL**: `https://runtimeextensionstracker.vercel.app/api/v1/telemetry`
- **Optional Security Header**: `X-Extension-Key` (Set if `REQUIRE_EXTENSION_KEY` is enabled on the server)
- **Supported Endpoints**:
  1. `POST /api/v1/telemetry/install` — Tracks new installations / updates
  2. `POST /api/v1/telemetry/ping` — Tracks daily active users (DAU) & heartbeats
  3. `POST /api/v1/telemetry/uninstall` — Tracks uninstalls
  4. `POST /api/v1/telemetry/event` — Tracks custom user actions & events

---

## 2. Steps for Integration

### Step 1: Create `telemetry.js`

Add the following file to your extension source code (e.g., `src/telemetry.js` or `background/telemetry.js`):

```javascript
/**
 * Extension Telemetry Tracker Module
 * Connects to https://runtimeextensionstracker.vercel.app
 */

const TELEMETRY_CONFIG = {
  baseUrl: 'https://runtimeextensionstracker.vercel.app/api/v1/telemetry',
  extensionId: 'my-awesome-extension', // ⚠️ Change to your unique extension ID
  apiKey: '', // ⚠️ Optional: Add if server requires X-Extension-Key header
};

// Utility to generate UUID v4 if crypto.randomUUID is not available
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to get or create persistent Installation ID
async function getInstallationId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['telemetry_installation_id'], (result) => {
      if (result.telemetry_installation_id) {
        resolve(result.telemetry_installation_id);
      } else {
        const newId = generateUUID();
        chrome.storage.local.set({ telemetry_installation_id: newId }, () => {
          resolve(newId);
        });
      }
    });
  });
}

// Detect Browser & OS details
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Chrome';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Brave')) browser = 'Brave';

  let os = 'Unknown';
  if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';

  return { browser, os, locale: navigator.language || 'en-US' };
}

// Core HTTP request wrapper
async function sendTelemetry(endpoint, payload) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (TELEMETRY_CONFIG.apiKey) {
      headers['X-Extension-Key'] = TELEMETRY_CONFIG.apiKey;
    }

    const response = await fetch(`${TELEMETRY_CONFIG.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    return await response.json();
  } catch (error) {
    console.warn('[Telemetry Error]:', error.message);
    return null;
  }
}

/**
 * 1. Track Install / Update
 */
export async function trackInstall(reason = 'install') {
  const installationId = await getInstallationId();
  const manifest = chrome.runtime.getManifest();
  const { browser, os, locale } = getBrowserInfo();

  await sendTelemetry('/install', {
    installationId,
    extensionId: TELEMETRY_CONFIG.extensionId,
    version: manifest.version,
    browser,
    os,
    locale,
    metadata: { reason },
  });

  // Configure uninstall URL redirect
  const uninstallUrl = `${TELEMETRY_CONFIG.baseUrl}/uninstall?installationId=${installationId}&extensionId=${TELEMETRY_CONFIG.extensionId}`;
  if (chrome.runtime.setUninstallURL) {
    chrome.runtime.setUninstallURL(uninstallUrl);
  }
}

/**
 * 2. Track Daily Active User (Ping)
 */
export async function trackPing() {
  const installationId = await getInstallationId();
  const manifest = chrome.runtime.getManifest();

  await sendTelemetry('/ping', {
    installationId,
    extensionId: TELEMETRY_CONFIG.extensionId,
    version: manifest.version,
  });
}

/**
 * 3. Track Custom Event
 */
export async function trackEvent(category, action, label = '', value = null, metadata = {}) {
  const installationId = await getInstallationId();

  await sendTelemetry('/event', {
    installationId,
    extensionId: TELEMETRY_CONFIG.extensionId,
    category,
    action,
    label,
    value,
    metadata,
  });
}
```

---

### Step 2: Register in Background Service Worker (`background.js`)

In your extension's `background.js` (or `service_worker.js`), import and trigger the lifecycle events:

```javascript
import { trackInstall, trackPing, trackEvent } from './telemetry.js';

// 1. Handle Extension Installation / Updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    trackInstall(details.reason);
  }
});

// 2. Daily Ping Heartbeat (using chrome.alarms)
chrome.alarms.create('daily_telemetry_ping', { periodInMinutes: 1440 }); // Once every 24 hours

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'daily_telemetry_ping') {
    trackPing();
  }
});

// 3. Optional: Ping on Startup
chrome.runtime.onStartup.addListener(() => {
  trackPing();
});

// 4. Example Custom Event Tracking
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRACK_EVENT') {
    trackEvent(message.category, message.action, message.label, message.value, message.metadata);
  }
});
```

---

### Step 3: Ensure Manifest Permissions (`manifest.json`)

Ensure your `manifest.json` includes `storage`, `alarms`, and `host_permissions` for the backend domain:

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "https://runtimeextensionstracker.vercel.app/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

---

## 3. Usage Examples

### Sending Custom Events from Popup or Content Scripts

Send a message to `background.js` to track user actions:

```javascript
// Example: Tracking a button click in popup.js or content_script.js
document.getElementById('myButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'TRACK_EVENT',
    category: 'UI_Interaction',
    action: 'Click',
    label: 'Download Button',
    value: 1,
    metadata: { feature: 'pdf_exporter' }
  });
});
```
