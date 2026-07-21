const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const { verifyExtensionKey } = require('../middleware/auth');
const { telemetryLimiter } = require('../middleware/rateLimiter');

// Apply rate limiter & API key check to telemetry routes
router.use(telemetryLimiter);
router.use(verifyExtensionKey);

// Lifecycle Endpoints
router.post('/install', telemetryController.trackInstall);
router.post('/ping', telemetryController.trackPing);
router.post('/uninstall', telemetryController.trackUninstall);

// Event Endpoint
router.post('/event', telemetryController.trackEvent);

module.exports = router;
