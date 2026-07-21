const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const { verifyExtensionKey } = require('../middleware/auth');
const { telemetryLimiter } = require('../middleware/rateLimiter');

// Apply rate limiter
router.use(telemetryLimiter);

// Public browser uninstall page endpoint (accessible without extension API key header)
router.get('/uninstall', telemetryController.renderUninstallPage);

// Apply API key check to API telemetry routes
router.use(verifyExtensionKey);

// Lifecycle Endpoints
router.post('/install', telemetryController.trackInstall);
router.post('/ping', telemetryController.trackPing);
router.post('/uninstall', telemetryController.trackUninstall);

// Event Endpoint
router.post('/event', telemetryController.trackEvent);

module.exports = router;
