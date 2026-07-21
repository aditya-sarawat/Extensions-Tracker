const connectDB = require('../src/config/db');
const app = require('../src/app');

// Ensure MongoDB connection is initialized in Vercel serverless environment
let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error('Vercel MongoDB Connection Error:', err);
    }
  }
  return app(req, res);
};
