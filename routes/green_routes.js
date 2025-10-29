// Routes - API Endpoint for Green Routes
const express = require('express');
const router = express.Router();
const greenRouteController = require('../controllers/greenRouteController');

// Calculate fastest and greenest route
router.post('/calculate', greenRouteController.calculateRoutes);
// Get graph statistics
router.get('/graph-stats', greenRouteController.getGraphStats);
// Test Python bridge connection
router.get('/test-connection', greenRouteController.testConnection);
// Analyse post-trip data for green route comparison
router.post('/post-trip-analysis', greenRouteController.postTripAnalysis);

module.exports = router;