const mongoose = require('mongoose');

const installationSchema = new mongoose.Schema(
  {
    installationId: {
      type: String,
      required: [true, 'Installation ID is required'],
      trim: true,
      index: true,
    },
    extensionId: {
      type: String,
      required: [true, 'Extension ID is required'],
      trim: true,
      index: true,
    },
    version: {
      type: String,
      default: '1.0.0',
    },
    browser: {
      type: String,
      default: 'Unknown',
    },
    browserVersion: {
      type: String,
      default: '',
    },
    os: {
      type: String,
      default: 'Unknown',
    },
    locale: {
      type: String,
      default: 'en',
    },
    status: {
      type: String,
      enum: ['active', 'uninstalled'],
      default: 'active',
      index: true,
    },
    installedAt: {
      type: Date,
      default: Date.now,
    },
    lastPingAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    uninstalledAt: {
      type: Date,
    },
    uninstallReason: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast lookup and aggregation
installationSchema.index({ extensionId: 1, installationId: 1 }, { unique: true });
installationSchema.index({ extensionId: 1, status: 1 });
installationSchema.index({ extensionId: 1, lastPingAt: -1 });

module.exports = mongoose.model('Installation', installationSchema);
