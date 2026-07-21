const path = require('path');
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

    const htmlPath = path.join(__dirname, '../../public/uninstall.html');
    return res.sendFile(htmlPath);
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
