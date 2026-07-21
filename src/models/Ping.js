const mongoose = require('mongoose');

const pingSchema = new mongoose.Schema(
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
    date: {
      type: String, // YYYY-MM-DD format for easy daily aggregation
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index to quickly count unique daily active users
pingSchema.index({ extensionId: 1, date: 1 });
pingSchema.index({ extensionId: 1, installationId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Ping', pingSchema);
