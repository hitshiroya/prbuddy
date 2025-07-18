/**
 * Parse GitHub webhook payload (handles form-encoded format)
 */
function parseWebhookPayload(req) {
  try {
    if (!req.body || req.body.length === 0) {
      throw new Error('No body data received');
    }

    const bodyString = req.body.toString();
    
    // Check if it's form-encoded (GitHub's format)
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      const urlParams = new URLSearchParams(bodyString);
      const payloadString = urlParams.get('payload');
      
      if (!payloadString) {
        throw new Error('No payload parameter found in form data');
      }
      
      return JSON.parse(payloadString);
    } else {
      // Direct JSON parsing
      return JSON.parse(bodyString);
    }
  } catch (error) {
    console.error('❌ Webhook payload parsing failed:', error.message);
    return null;
  }
}

/**
 * Extract PR information from webhook payload
 */
function extractPRInfo(payload) {
  if (!payload || !payload.pull_request) {
    return null;
  }

  return {
    action: payload.action,
    pullNumber: payload.pull_request.number,
    title: payload.pull_request.title,
    owner: payload.repository?.owner?.login,
    repo: payload.repository?.name,
    author: payload.pull_request.user?.login
  };
}

/**
 * Check if webhook event should trigger processing
 */
function shouldProcessEvent(event, action) {
  // Only process pull request events
  if (event !== 'pull_request') {
    return false;
  }

  // Only process when PR is opened
  const triggerActions = ['opened'];
  return triggerActions.includes(action);
}

/**
 * Log webhook details
 */
function logWebhookInfo(req) {
  const event = req.headers['x-github-event'] || 'unknown';
  const delivery = req.headers['x-github-delivery'] || 'unknown';
  const hasSignature = !!req.headers['x-hub-signature-256'];
  const contentType = req.headers['content-type'] || 'unknown';

  console.log('\n🎯 === WEBHOOK TRIGGERED === 🎯');
  console.log('⏰ Time:', new Date().toISOString());
  console.log('📋 GitHub Event:', event);
  console.log('📦 GitHub Delivery:', delivery);
  console.log('🔐 Has Signature:', hasSignature ? 'Yes' : 'No');
  console.log('📄 Content-Type:', contentType);

  return { event, delivery, hasSignature, contentType };
}

module.exports = {
  parseWebhookPayload,
  extractPRInfo,
  shouldProcessEvent,
  logWebhookInfo
}; 