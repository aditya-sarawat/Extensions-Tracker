const rateLimit = require('express-rate-limit');

// Protect telemetry routes against excessive spam/abuse
const telemetryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests sent from this IP, please try again later.',
  },
});

module.exports = { telemetryLimiter };
