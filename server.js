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

// Trust proxy for Railway (secure configuration)
app.set('trust proxy', 1); // Trust only the first proxy (Railway's load balancer)

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
  // Skip rate limiting for webhook endpoints (GitHub handles this)
  skip: (req) => req.path.startsWith('/webhooks'),
});

app.use(limiter);

// Configure body parsing middleware with explicit path separation
app.use('/webhooks', express.raw({ type: 'application/json' })); // Raw for webhooks ONLY
app.use((req, res, next) => {
  // Only apply JSON parsing to NON-webhook routes
  if (!req.path.startsWith('/webhooks')) {
    express.json({ limit: '10mb' })(req, res, next);
  } else {
    next();
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
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('🚀 PR Buddy server started!');
  console.log(`📍 Server running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  
  // Show appropriate URLs based on environment
  if (config.nodeEnv === 'production') {
    console.log(`📡 Webhook endpoint: /webhooks/github`);
    console.log(`💚 Health check: /webhooks/health`);
    console.log(`🌐 Access your app at the Railway-provided URL`);
  } else {
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhooks/github`);
    console.log(`💚 Health check: http://localhost:${PORT}/webhooks/health`);
  }
  
  console.log('---');
  console.log('⚡ Ready to receive GitHub webhooks!');
});

// Add error handling for server startup
server.on('error', (error) => {
  console.error('❌ Server startup error:', error);
  process.exit(1);
});

module.exports = app; 