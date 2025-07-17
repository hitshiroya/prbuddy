const express = require('express');
const router = express.Router();
const PRProcessingService = require('../services/prProcessingService');
const { verifyGitHubSignature, extractPRInfo, shouldProcessEvent } = require('../utils/webhookUtils');

const prProcessingService = new PRProcessingService();

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

    // Only process pull request events
    if (event !== 'pull_request') {
      console.log(`⏭️  Ignoring non-PR event: ${event}`);
      return res.status(200).json({ message: 'Event ignored' });
    }

    // Parse the JSON payload
    const payload = JSON.parse(req.body.toString());
    
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