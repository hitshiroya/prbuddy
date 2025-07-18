const express = require('express');
const app = express();

// Simple root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'PR Buddy - Step 2: Webhook Data Logger' });
});

// Enhanced webhook endpoint with proper GitHub form data parsing
app.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  console.log('\n🎯 === WEBHOOK TRIGGERED === 🎯');
  console.log('⏰ Time:', new Date().toISOString());
  
  // Log important headers from GitHub
  console.log('📋 GitHub Event:', req.headers['x-github-event'] || 'unknown');
  console.log('📦 GitHub Delivery:', req.headers['x-github-delivery'] || 'unknown');
  console.log('🔐 Has Signature:', req.headers['x-hub-signature-256'] ? 'Yes' : 'No');
  console.log('📄 Content-Type:', req.headers['content-type'] || 'unknown');
  
  // DEBUG: Log raw payload info
  console.log('🔍 DEBUG: Body type:', typeof req.body);
  console.log('🔍 DEBUG: Body length:', req.body ? req.body.length : 'no body');
  console.log('🔍 DEBUG: Is Buffer:', Buffer.isBuffer(req.body));
  
  // Parse GitHub webhook data (handles both JSON and form-encoded)
  let payload = {};
  try {
    if (req.body && req.body.length > 0) {
      const bodyString = req.body.toString();
      console.log('🔍 DEBUG: Raw body preview:', bodyString.substring(0, 100) + '...');
      
      // Check if it's form-encoded (GitHub's format)
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        // Parse form data: payload={"action":"opened"...}
        const urlParams = new URLSearchParams(bodyString);
        const payloadString = urlParams.get('payload');
        if (payloadString) {
          payload = JSON.parse(payloadString);
          console.log('✅ Successfully parsed form-encoded GitHub payload');
        } else {
          console.log('❌ No payload parameter found in form data');
        }
      } else {
        // Direct JSON parsing
        payload = JSON.parse(bodyString);
        console.log('✅ Successfully parsed JSON payload');
      }
    } else {
      console.log('❌ No body data received');
    }
  } catch (error) {
    console.log('❌ Parse error:', error.message);
  }
  
  // Log payload info if it's a pull request event
  if (req.headers['x-github-event'] === 'pull_request') {
    console.log('🚀 PR Event Details:');
    console.log('   Action:', payload.action || 'unknown');
    console.log('   PR Number:', payload.pull_request?.number || 'unknown');
    console.log('   PR Title:', payload.pull_request?.title || 'unknown');
    console.log('   Repository:', payload.repository?.full_name || 'unknown');
    console.log('   Author:', payload.pull_request?.user?.login || 'unknown');
  } else {
    console.log('📝 Non-PR Event - Basic Info:');
    console.log('   Repository:', payload.repository?.full_name || 'unknown');
    console.log('   Action:', payload.action || 'no action');
  }
  
  console.log('🎯 === END WEBHOOK === 🎯\n');
  
  res.json({ 
    message: 'Webhook received and logged!',
    event: req.headers['x-github-event'],
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: /webhook`);
  console.log(`📊 Now logging detailed webhook data!`);
}); 