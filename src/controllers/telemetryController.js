const path = require('path');
const fs = require('fs');
const Installation = require('../models/Installation');
const Ping = require('../models/Ping');
const Event = require('../models/Event');

// Helper to format date as YYYY-MM-DD in UTC
const getFormattedDate = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * @route   POST /api/v1/telemetry/install
 * @desc    Track a new extension installation or reinstall
 */
exports.trackInstall = async (req, res, next) => {
  try {
    const {
      installationId,
      extensionId,
      version = '1.0.0',
      browser = 'Unknown',
      browserVersion = '',
      os = 'Unknown',
      locale = 'en',
      metadata = {},
    } = req.body;

    if (!installationId || !extensionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: installationId and extensionId',
      });
    }

    const now = new Date();
    const today = getFormattedDate();

    // Upsert Installation Record
    const installation = await Installation.findOneAndUpdate(
      { extensionId, installationId },
      {
        $set: {
          version,
          browser,
          browserVersion,
          os,
          locale,
          status: 'active',
          lastPingAt: now,
          uninstalledAt: null,
          uninstallReason: '',
        },
        $setOnInsert: {
          installedAt: now,
          metadata,
        },
      },
      { new: true, upsert: true }
    );

    // Record initial daily ping
    await Ping.updateOne(
      { extensionId, installationId, date: today },
      { $setOnInsert: { version, timestamp: now } },
      { upsert: true }
    ).catch(() => {}); // Ignore duplicate key errors if ping already recorded for today

    return res.status(200).json({
      success: true,
      message: 'Installation recorded successfully',
      data: {
        installationId: installation.installationId,
        extensionId: installation.extensionId,
        status: installation.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/telemetry/ping
 * @desc    Track active user heartbeat/ping (Daily Active Users)
 */
exports.trackPing = async (req, res, next) => {
  try {
    const { installationId, extensionId, version = '1.0.0' } = req.body;

    if (!installationId || !extensionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: installationId and extensionId',
      });
    }

    const now = new Date();
    const today = getFormattedDate();

    // Update installation last ping & status
    await Installation.updateOne(
      { extensionId, installationId },
      {
        $set: {
          lastPingAt: now,
          version,
          status: 'active',
        },
      }
    );

    // Log Ping for today (Unique per extensionId + installationId + date)
    await Ping.updateOne(
      { extensionId, installationId, date: today },
      { $setOnInsert: { version, timestamp: now } },
      { upsert: true }
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Ping recorded',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/telemetry/uninstall
 * @desc    Render uninstall HTML page & record uninstall status
 */
exports.renderUninstallPage = async (req, res, next) => {
  try {
    const { installationId, extensionId } = req.query;

    if (installationId && extensionId) {
      await Installation.updateOne(
        { extensionId, installationId },
        {
          $set: {
            status: 'uninstalled',
            uninstalledAt: new Date(),
          },
        }
      ).catch((err) => console.warn('Uninstall DB status update error:', err));
    }

    // Build feedback redirect URL with query parameters
    const feedbackBaseUrl = 'https://runtimedev.vercel.app/feedback';
    const params = new URLSearchParams();
    if (installationId) params.set('installationId', installationId);
    if (extensionId) params.set('extensionId', extensionId);
    const feedbackUrl = params.toString() ? `${feedbackBaseUrl}?${params.toString()}` : feedbackBaseUrl;

    const htmlPath = path.join(process.cwd(), 'public/uninstall.html');
    let htmlContent;
    
    try {
      htmlContent = fs.readFileSync(htmlPath, 'utf8');
    } catch (err) {
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Uninstalled</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #09090e; --card-bg: rgba(18, 18, 26, 0.75); --card-border: rgba(255, 255, 255, 0.08); --text: #f3f4f6; --text-muted: #9ca3af; --button-bg: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); --button-hover: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 24px; background-image: radial-gradient(circle at 50% 20%, rgba(168, 85, 247, 0.25) 0%, transparent 50%); }
    .card { background: var(--card-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px); border-radius: 24px; padding: 48px 36px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); }
    .icon-wrapper { width: 72px; height: 72px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 24px; }
    h1 { font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 15px; line-height: 1.6; color: var(--text-muted); margin-bottom: 32px; }
    .feedback-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 16px 28px; background: var(--button-bg); color: #ffffff; font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">👋</div>
    <h1>We're sorry to see you go</h1>
    <p>The extension has been uninstalled from your browser. Thank you for using our extension! We'd love to know how we can improve.</p>
    <a id="feedback-link" href="${feedbackUrl}" target="_blank" rel="noopener noreferrer" class="feedback-btn">
      <span>Share Your Feedback</span>
    </a>
  </div>
</body>
</html>`;
    }

    // Replace feedback link placeholder with exact target URL
    htmlContent = htmlContent.replace('href="https://runtimedev.vercel.app/feedback"', `href="${feedbackUrl}"`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(htmlContent);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/telemetry/uninstall
 * @desc    Track extension uninstallation feedback
 */
exports.trackUninstall = async (req, res, next) => {
  try {
    const { installationId, extensionId, uninstallReason = '', metadata = {} } = req.body;

    if (installationId && extensionId) {
      const now = new Date();
      await Installation.findOneAndUpdate(
        { extensionId, installationId },
        {
          $set: {
            status: 'uninstalled',
            uninstalledAt: now,
            uninstallReason,
            metadata,
          },
        },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Uninstallation recorded',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/telemetry/event
 * @desc    Track custom extension usage event
 */
exports.trackEvent = async (req, res, next) => {
  try {
    const {
      installationId,
      extensionId,
      category,
      action,
      label = '',
      value = null,
      metadata = {},
    } = req.body;

    if (!installationId || !extensionId || !category || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: installationId, extensionId, category, action',
      });
    }

    const event = await Event.create({
      installationId,
      extensionId,
      category,
      action,
      label,
      value,
      metadata,
      timestamp: new Date(),
    });

    // Touch lastPingAt on installation
    await Installation.updateOne(
      { extensionId, installationId },
      { $set: { lastPingAt: new Date() } }
    ).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Event recorded',
      eventId: event._id,
    });
  } catch (error) {
    next(error);
  }
};
