const crypto = require('crypto');
const http = require('http');

// Mock webhook payload
const mockPayload = {
  action: 'opened',
  number: 123,
  pull_request: {
    number: 123,
    title: 'Test PR for webhook validation',
    html_url: 'https://github.com/test/repo/pull/123',
    head: { sha: 'abc123' },
    base: { sha: 'def456' }
  },
  repository: {
    name: 'test-repo',
    private: false,
    owner: { login: 'test-user' }
  }
};

const payloadString = JSON.stringify(mockPayload);
const secret = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';

// Generate correct signature
const signature = crypto
  .createHmac('sha256', secret)
  .update(payloadString)
  .digest('hex');

const githubSignature = `sha256=${signature}`;

console.log('🧪 Testing webhook endpoint...');
console.log(`📝 Payload size: ${payloadString.length} bytes`);
console.log(`🔐 Generated signature: ${githubSignature}`);

// Test the webhook using Node.js http module
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/webhooks/github',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString),
    'X-GitHub-Event': 'pull_request',
    'X-GitHub-Delivery': 'test-delivery-123',
    'X-Hub-Signature-256': githubSignature,
    'User-Agent': 'GitHub-Hookshot/test'
  }
};

const req = http.request(options, (res) => {
  console.log(`📡 Response status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📋 Response data:', JSON.stringify(response, null, 2));
      console.log('✅ Webhook test completed');
    } catch (e) {
      console.log('📋 Response data (raw):', data);
      console.log('✅ Webhook test completed');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Webhook test failed:', error.message);
});

req.write(payloadString);
req.end(); 