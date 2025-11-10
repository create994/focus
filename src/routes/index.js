const express = require('express');
const apiRoutes = require('./api');
const config = require('../utils/config');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: config.env,
    mockMode: config.useMockMaxApi
  });
});

router.use('/api', apiRoutes);

router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = router;

