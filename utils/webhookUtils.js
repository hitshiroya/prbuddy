const crypto = require('crypto');
const { config } = require('../config/config');

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - GitHub signature from headers
 * @returns {boolean} - Whether the signature is valid
 */
function verifyGitHubSignature(payload, signature) {
  if (!signature) {
    return false;
  }

  const secret = config.github.webhookSecret;
  if (!secret) {
    console.warn('No webhook secret configured - webhook verification disabled');
    return true; // Allow in development if no secret set
  }

  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const expectedSignature = `sha256=${computedSignature}`;

  // Use crypto.timingSafeEqual to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Extract relevant information from webhook payload
 * @param {Object} payload - GitHub webhook payload
 * @returns {Object} - Extracted PR information
 */
function extractPRInfo(payload) {
  const pr = payload.pull_request;
  const repo = payload.repository;

  return {
    owner: repo.owner.login,
    repo: repo.name,
    pullNumber: pr.number,
    action: payload.action,
    title: pr.title,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    htmlUrl: pr.html_url,
    isPublic: !repo.private
  };
}

/**
 * Check if the webhook event should trigger a review
 * @param {string} action - GitHub webhook action
 * @returns {boolean} - Whether to process this event
 */
function shouldProcessEvent(action) {
  const triggerActions = ['opened', 'synchronize', 'ready_for_review'];
  return triggerActions.includes(action);
}

module.exports = {
  verifyGitHubSignature,
  extractPRInfo,
  shouldProcessEvent
}; 