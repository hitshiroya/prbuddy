const express = require('express');
const { config, validateConfig } = require('./config/config');
const PRProcessingService = require('./services/prProcessingService');
const { 
  parseWebhookPayload, 
  extractPRInfo, 
  shouldProcessEvent, 
  logWebhookInfo 
} = require('./utils/webhookUtils');

// Validate configuration before starting
try {
  validateConfig();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

const app = express();
const prProcessingService = new PRProcessingService();

// Root endpoint
app.get('/', async (req, res) => {
  try {
    const health = await prProcessingService.getHealthStatus();
    
    res.json({ 
      message: 'PR Buddy - AI-Powered Code Review (Refactored)',
      version: '2.0.0',
      features: [
        '🤖 AI-powered code analysis',
        '📊 Intelligent issue detection', 
        '⭐ Code quality ratings',
        '💡 Smart suggestions',
        '🎯 Human-readable reviews'
      ],
      status: health
    });
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Webhook endpoint
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  // Log webhook info
  const { event } = logWebhookInfo(req);
  
  try {
    // Parse webhook payload
    const payload = parseWebhookPayload(req);
    if (!payload) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    console.log('✅ Successfully parsed webhook payload');
    
    // Extract PR information
    const prInfo = extractPRInfo(payload);
    if (!prInfo) {
      console.log('📝 Non-PR event or missing PR data');
      return res.status(200).json({ message: 'Event ignored - not a PR' });
    }
    
    console.log('🚀 PR Event Details:');
    console.log('   Action:', prInfo.action);
    console.log('   PR Number:', prInfo.pullNumber);
    console.log('   PR Title:', prInfo.title);
    console.log('   Repository:', `${prInfo.owner}/${prInfo.repo}`);
    console.log('   Author:', prInfo.author);
    
    // Check if we should process this event
    if (!shouldProcessEvent(event, prInfo.action)) {
      console.log(`⏭️  Ignoring action: ${prInfo.action}`);
      return res.status(200).json({ message: 'Action ignored' });
    }
    
    // Process PR asynchronously (don't block webhook response)
    setImmediate(async () => {
      try {
        await prProcessingService.processPR(prInfo);
      } catch (error) {
        console.error(`❌ Async processing error for PR #${prInfo.pullNumber}:`, error.message);
      }
    });
    
    // Respond quickly to GitHub
    res.status(200).json({ 
      message: 'Webhook received and processing started',
      pullRequest: prInfo.pullNumber,
      repository: `${prInfo.owner}/${prInfo.repo}`,
      action: prInfo.action
    });
    
  } catch (error) {
    console.error(`❌ Webhook processing error:`, error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
  
  console.log('🎯 === END WEBHOOK === 🎯\n');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await prProcessingService.getHealthStatus();
    res.status(200).json({
      status: 'healthy',
      ...health,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 PR Buddy server started!');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`📡 Webhook endpoint: /webhook`);
  console.log(`💚 Health check: /health`);
  console.log('⚡ Ready to receive GitHub webhooks!');
}); 