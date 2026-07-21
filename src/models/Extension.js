const mongoose = require('mongoose');

const extensionSchema = new mongoose.Schema(
  {
    extensionId: {
      type: String,
      required: [true, 'Extension ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Extension name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    apiKey: {
      type: String,
      default: '',
      select: false, // Hidden by default in queries
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Extension', extensionSchema);
