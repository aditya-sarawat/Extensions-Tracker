const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Aggregate summary endpoint
router.get('/summary', analyticsController.getSummary);

module.exports = router;
