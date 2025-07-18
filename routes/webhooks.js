const express = require('express');
const router = express.Router();
const PRProcessingService = require('../services/prProcessingService');
const { verifyGitHubSignature, extractPRInfo, shouldProcessEvent } = require('../utils/webhookUtils');

const prProcessingService = new PRProcessingService();

/**
 * SIMPLE DEBUG WEBHOOK - Just log everything that comes in
 */
router.post('/debug', express.raw({ type: '*/*' }), async (req, res) => {
  console.log('\n🔥 === WEBHOOK DEBUG === 🔥');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🌐 Method:', req.method);
  console.log('📍 URL:', req.url);
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Body type:', typeof req.body);
  console.log('📏 Body length:', req.body ? req.body.length : 'N/A');
  console.log('🔍 Is Buffer:', Buffer.isBuffer(req.body));
  console.log('📄 Raw body preview:', req.body ? req.body.toString().substring(0, 200) + '...' : 'No body');
  console.log('🔥 === END DEBUG === 🔥\n');
  
  res.status(200).json({ 
    message: 'Debug webhook received!',
    timestamp: new Date().toISOString(),
    bodyType: typeof req.body,
    isBuffer: Buffer.isBuffer(req.body),
    headers: Object.keys(req.headers)
  });
});

/**
 * GitHub webhook endpoint
 */
router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('X-Hub-Signature-256');
    const event = req.get('X-GitHub-Event');
    const delivery = req.get('X-GitHub-Delivery');
    
    console.log(`📡 Received GitHub webhook: ${event} (${delivery})`);
    console.log(`🔍 Request body type: ${typeof req.body}, isBuffer: ${Buffer.isBuffer(req.body)}`);

    // Verify webhook signature for security
    if (!verifyGitHubSignature(req.body, signature)) {
      console.warn(`🚫 Invalid webhook signature for delivery: ${delivery}`);
      return res.status(401).json({ error: 'Invalid signature' });
    }
    console.log(`✅ Webhook signature verified`);

    // Only process pull request events
    if (event !== 'pull_request') {
      console.log(`⏭️  Ignoring non-PR event: ${event}`);
      return res.status(200).json({ message: 'Event ignored' });
    }

    // Parse the JSON payload from buffer
    const payload = JSON.parse(req.body.toString());
    console.log(`✅ Payload parsed successfully`);
    
    // Extract PR information
    const prInfo = extractPRInfo(payload);
    
    // Check if we should process this event
    if (!shouldProcessEvent(prInfo.action)) {
      console.log(`⏭️  Ignoring PR action: ${prInfo.action}`);
      return res.status(200).json({ message: 'Action ignored' });
    }

    // Log the PR being processed
    console.log(`🎯 Processing PR #${prInfo.pullNumber}: ${prInfo.title}`);
    console.log(`   Repository: ${prInfo.owner}/${prInfo.repo}`);
    console.log(`   Action: ${prInfo.action}`);
    console.log(`   Public: ${prInfo.isPublic}`);

    // Process the PR asynchronously (don't block the webhook response)
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
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  console.log('🏥 Health check endpoint accessed');
  try {
    const health = await prProcessingService.healthCheck();
    console.log('✅ Health check successful');
    res.status(200).json({
      status: 'healthy',
      services: health,
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

/**
 * Root endpoint with basic info
 */
router.get('/', (req, res) => {
  res.json({
    name: 'PR Buddy - AI Code Reviewer',
    version: '1.0.0',
    description: 'AI-powered pull request reviewer using GitHub webhooks',
    endpoints: {
      webhooks: '/webhooks/github',
      health: '/webhooks/health'
    },
    github: 'https://github.com/your-username/pr-buddy'
  });
});

module.exports = router; 