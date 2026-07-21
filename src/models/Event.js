const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
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
    category: {
      type: String,
      required: [true, 'Event category is required'],
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Event action is required'],
      trim: true,
      index: true,
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
    value: {
      type: Number,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

eventSchema.index({ extensionId: 1, category: 1, action: 1 });
eventSchema.index({ extensionId: 1, timestamp: -1 });

module.exports = mongoose.model('Event', eventSchema);
