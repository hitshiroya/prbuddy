const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { config, validateConfig } = require('./config/config');
const webhookRoutes = require('./routes/webhooks');

// Validate configuration before starting
try {
  validateConfig();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API endpoints
}));

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Parse JSON for non-webhook routes
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks/github')) {
    // Skip JSON parsing for GitHub webhooks (handled by raw middleware)
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Routes
app.use('/webhooks', webhookRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'PR Buddy',
    description: 'AI-powered GitHub Pull Request Reviewer',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      root: '/',
      webhooks: '/webhooks/github',
      health: '/webhooks/health'
    },
    documentation: {
      setup: 'See README.md for setup instructions',
      webhook_url: `${req.protocol}://${req.get('host')}/webhooks/github`
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    available_endpoints: [
      'GET /',
      'POST /webhooks/github',
      'GET /webhooks/health'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
const PORT = process.env.PORT || config.port || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 PR Buddy server started!');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhooks/github`);
  console.log(`💚 Health check: http://localhost:${PORT}/webhooks/health`);
  console.log('---');
  console.log('⚡ Ready to receive GitHub webhooks!');
});

module.exports = app; 