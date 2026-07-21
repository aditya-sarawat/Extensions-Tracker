const Installation = require('../models/Installation');
const Ping = require('../models/Ping');
const Event = require('../models/Event');

/**
 * @route   GET /api/v1/analytics/summary
 * @desc    Get aggregate analytics metrics (DAU, WAU, MAU, retention, OS/Browser breakdowns)
 */
exports.getSummary = async (req, res, next) => {
  try {
    const { extensionId } = req.query;

    const filter = {};
    if (extensionId) {
      filter.extensionId = extensionId;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Overall Installation Totals
    const [totalInstalls, activeInstalls, uninstalls] = await Promise.all([
      Installation.countDocuments(filter),
      Installation.countDocuments({ ...filter, status: 'active' }),
      Installation.countDocuments({ ...filter, status: 'uninstalled' }),
    ]);

    const retentionRate = totalInstalls > 0 ? ((activeInstalls / totalInstalls) * 100).toFixed(1) : 0;

    // 2. Active Users (DAU, WAU, MAU) based on lastPingAt
    const [dau, wau, mau] = await Promise.all([
      Installation.countDocuments({ ...filter, status: 'active', lastPingAt: { $gte: twentyFourHoursAgo } }),
      Installation.countDocuments({ ...filter, status: 'active', lastPingAt: { $gte: sevenDaysAgo } }),
      Installation.countDocuments({ ...filter, status: 'active', lastPingAt: { $gte: thirtyDaysAgo } }),
    ]);

    // 3. Browser Distribution
    const browserBreakdown = await Installation.aggregate([
      { $match: { ...filter, status: 'active' } },
      { $group: { _id: '$browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 4. OS Distribution
    const osBreakdown = await Installation.aggregate([
      { $match: { ...filter, status: 'active' } },
      { $group: { _id: '$os', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 5. Version Distribution
    const versionBreakdown = await Installation.aggregate([
      { $match: { ...filter, status: 'active' } },
      { $group: { _id: '$version', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 6. Top Custom Events (last 30 days)
    const topEvents = await Event.aggregate([
      {
        $match: {
          ...(extensionId && { extensionId }),
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { category: '$category', action: '$action' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          category: '$_id.category',
          action: '$_id.action',
          count: 1,
        },
      },
    ]);

    // 7. Recent Installs (latest 5)
    const recentInstalls = await Installation.find(filter)
      .sort({ installedAt: -1 })
      .limit(5)
      .select('installationId extensionId browser os version status installedAt lastPingAt');

    return res.status(200).json({
      success: true,
      timestamp: now,
      extensionFilter: extensionId || 'all',
      metrics: {
        totalInstalls,
        activeInstalls,
        uninstalls,
        retentionRatePercent: Number(retentionRate),
        activeUsers: {
          dau, // Daily Active Users (24h)
          wau, // Weekly Active Users (7d)
          mau, // Monthly Active Users (30d)
        },
      },
      breakdowns: {
        browsers: browserBreakdown.map((b) => ({ browser: b._id || 'Unknown', count: b.count })),
        operatingSystems: osBreakdown.map((o) => ({ os: o._id || 'Unknown', count: o.count })),
        versions: versionBreakdown.map((v) => ({ version: v._id || '1.0.0', count: v.count })),
      },
      topEvents,
      recentInstalls,
    });
  } catch (error) {
    next(error);
  }
};
