# Browser Extension Telemetry & Analytics Tracker Backend

A robust, production-ready Node.js + Express + MongoDB backend specifically designed to track **installations**, **uninstallations**, **active users (DAU/WAU/MAU)**, and **custom usage events** for all your browser extensions.

---

## 🚀 Key Features

- **Lifecycle Tracking**:
  - **Installs**: Tracks new extension installations with OS, browser name/version, locale, and version metadata.
  - **Pings / Heartbeats**: Tracks daily active users (DAU, WAU, MAU), retention, and extension version updates.
  - **Uninstalls**: Captures uninstallation events when user removes extension.
- **Custom Usage Events**: Log feature clicks, popup opens, errors, and custom actions within extensions.
- **Analytics & Dashboard API**: Endpoint delivering aggregated metrics, retention rate, browser/OS breakdowns, and top events.
- **Security & Performance**: Includes CORS for extension background origins (`chrome-extension://*`), Helmet security, API key authentication options, and rate-limiting.

---

## 🛠️ Prerequisites & Installation

### 1. Requirements
- Node.js (v16+ recommended)
- MongoDB Database (External cluster such as MongoDB Atlas or local instance)

### 2. Environment Setup
Create a `.env` file in the root directory (or copy `.env.example`):

```bash
cp .env.example .env
```

Configure your environment variables:
```env
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/extension_tracker?retryWrites=true&w=majority
REQUIRE_EXTENSION_KEY=false
API_KEY=your_secret_api_key_here
ALLOWED_ORIGINS=*
```

### 3. Run Locally

```bash
# Install dependencies
npm install

# Start in development mode (with nodemon)
npm run dev

# Start in production mode
npm start
```

---

## 📡 API Reference

### 1. Health Check
`GET /health`
```json
{
  "status": "ok",
  "uptime": 124.5,
  "timestamp": "2026-07-21T09:15:00.000Z",
  "service": "Browser Extension Tracker API"
}
```

---

### 2. Track Installation
`POST /api/v1/telemetry/install`

**Headers**:
- `Content-Type: application/json`
- `X-Extension-Key: your_secret_api_key_here` *(if enabled)*

**Request Body**:
```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "extensionId": "my-awesome-extension",
  "version": "1.0.0",
  "browser": "Chrome",
  "browserVersion": "126.0.0.0",
  "os": "macOS",
  "locale": "en-US",
  "metadata": { "source": "chrome_web_store" }
}
```

---

### 3. Track Daily Ping (Heartbeat / Active Users)
`POST /api/v1/telemetry/ping`

**Request Body**:
```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "extensionId": "my-awesome-extension",
  "version": "1.0.1"
}
```

---

### 4. Track Custom Event
`POST /api/v1/telemetry/event`

**Request Body**:
```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "extensionId": "my-awesome-extension",
  "category": "feature_usage",
  "action": "export_pdf_button_clicked",
  "label": "options_page",
  "value": 1,
  "metadata": { "fileSizeKb": 450 }
}
```

---

### 5. Track Uninstallation
`POST /api/v1/telemetry/uninstall`

**Request Body**:
```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "extensionId": "my-awesome-extension",
  "uninstallReason": "No longer needed"
}
```

---

### 6. Analytics Summary
`GET /api/v1/analytics/summary?extensionId=my-awesome-extension`

**Response**:
```json
{
  "success": true,
  "metrics": {
    "totalInstalls": 1500,
    "activeInstalls": 1250,
    "uninstalls": 250,
    "retentionRatePercent": 83.3,
    "activeUsers": {
      "dau": 420,
      "wau": 950,
      "mau": 1250
    }
  },
  "breakdowns": {
    "browsers": [
      { "browser": "Chrome", "count": 900 },
      { "browser": "Brave", "count": 200 },
      { "browser": "Edge", "count": 150 }
    ],
    "operatingSystems": [
      { "os": "macOS", "count": 700 },
      { "os": "Windows", "count": 550 }
    ]
  },
  "topEvents": [
    { "category": "feature_usage", "action": "export_pdf_button_clicked", "count": 830 }
  ]
}
```

---

## 🧩 Browser Extension Integration Guide (Manifest V3)

Copy the telemetry utility below directly into your extension project (e.g. `telemetry.js` or directly inside `background.js`).

### Step 1: `telemetry.js` Helper Module

```javascript
// telemetry.js - Include this in your browser extension background script

const BACKEND_URL = 'https://your-tracker-domain.com'; // Replace with your deployed backend URL or http://localhost:5001
const EXTENSION_ID = 'my-awesome-extension'; // Your unique extension key
const API_KEY = 'secret_extension_telemetry_key_12345'; // Optional match with backend .env

// Helper to get or generate anonymous Installation ID
async function getInstallationId() {
  const result = await chrome.storage.local.get(['installationId']);
  if (result.installationId) {
    return result.installationId;
  }
  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ installationId: newId });
  return newId;
}

// Detect Browser & OS details
function getSystemInfo() {
  const userAgent = navigator.userAgent;
  let browser = 'Chrome';
  if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Brave')) browser = 'Brave';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';

  let os = 'Unknown';
  if (userAgent.includes('Macintosh')) os = 'macOS';
  else if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Linux')) os = 'Linux';

  return { browser, os, locale: navigator.language || 'en' };
}

// Sending Telemetry Requests
async function sendTelemetry(endpoint, payload) {
  try {
    const installationId = await getInstallationId();
    const manifest = chrome.runtime.getManifest();
    
    await fetch(`${BACKEND_URL}/api/v1/telemetry/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': API_KEY,
      },
      body: JSON.stringify({
        installationId,
        extensionId: EXTENSION_ID,
        version: manifest.version,
        ...payload,
      }),
    });
  } catch (err) {
    console.warn('[Telemetry Error]', err);
  }
}

// Exportable API methods
export const Telemetry = {
  trackInstall: async () => {
    const system = getSystemInfo();
    await sendTelemetry('install', {
      browser: system.browser,
      os: system.os,
      locale: system.locale,
    });
  },

  trackPing: async () => {
    await sendTelemetry('ping', {});
  },

  trackEvent: async (category, action, label = '', value = null, metadata = {}) => {
    await sendTelemetry('event', { category, action, label, value, metadata });
  },

  setupUninstallRedirect: async () => {
    const installationId = await getInstallationId();
    // Redirects user on uninstall to log the event
    const uninstallUrl = `${BACKEND_URL}/api/v1/telemetry/uninstall?installationId=${installationId}&extensionId=${EXTENSION_ID}`;
    chrome.runtime.setUninstallUrl(uninstallUrl);
  }
};
```

---

### Step 2: Wire into `background.js` (Service Worker)

```javascript
import { Telemetry } from './telemetry.js';

// 1. Listen for Installation & Updates
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Extension Installed! Tracking install...');
    await Telemetry.trackInstall();
    await Telemetry.setupUninstallRedirect();
  } else if (details.reason === 'update') {
    console.log('Extension Updated! Sending ping...');
    await Telemetry.trackPing();
  }

  // Set up Daily Ping Alarm (every 24 hours)
  chrome.alarms.create('daily_telemetry_ping', { periodInMinutes: 1440 });
});

// 2. Alarm listener for periodic daily pings (DAU tracking)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily_telemetry_ping') {
    await Telemetry.trackPing();
  }
});

// 3. Track custom events anywhere in extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRACK_EVENT') {
    Telemetry.trackEvent(request.category, request.action, request.label, request.value);
  }
});
```

---

## 📁 Project Architecture

```
Tracker/
├── .env                  # Configuration variables
├── .env.example          # Environment template
├── package.json          # Dependencies & scripts
├── README.md             # Complete documentation
└── src/
    ├── app.js            # Express app configuration & middleware
    ├── server.js         # Entry point & listener
    ├── config/
    │   └── db.js         # MongoDB connection setup
    ├── controllers/
    │   ├── analyticsController.js  # Aggregation metrics (DAU/WAU/MAU)
    │   └── telemetryController.js  # Telemetry endpoints
    ├── middleware/
    │   ├── auth.js       # Extension key authorization
    │   ├── errorHandler.js # Error handler
    │   └── rateLimiter.js  # Rate limiter
    ├── models/
    │   ├── Event.js      # Custom usage event schema
    │   ├── Extension.js  # Extension registration schema
    │   ├── Installation.js # Instance records schema
    │   └── Ping.js       # Daily ping records schema
    └── routes/
        ├── analyticsRoutes.js
        └── telemetryRoutes.js
```

---

## 📄 License
ISC
