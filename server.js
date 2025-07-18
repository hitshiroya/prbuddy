const express = require('express');
const app = express();

// Parse JSON bodies
app.use(express.json());

// Simple root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'PR Buddy - Step 2: Webhook Data Logger' });
});

// Enhanced webhook endpoint - log detailed information
app.post('/webhook', (req, res) => {
  console.log('\n🎯 === WEBHOOK TRIGGERED === 🎯');
  console.log('⏰ Time:', new Date().toISOString());
  
  // Log important headers from GitHub
  console.log('📋 GitHub Event:', req.headers['x-github-event'] || 'unknown');
  console.log('📦 GitHub Delivery:', req.headers['x-github-delivery'] || 'unknown');
  console.log('🔐 Has Signature:', req.headers['x-hub-signature-256'] ? 'Yes' : 'No');
  
  // Log payload info if it's a pull request event
  if (req.headers['x-github-event'] === 'pull_request') {
    const payload = req.body;
    console.log('🚀 PR Event Details:');
    console.log('   Action:', payload.action || 'unknown');
    console.log('   PR Number:', payload.pull_request?.number || 'unknown');
    console.log('   PR Title:', payload.pull_request?.title || 'unknown');
    console.log('   Repository:', payload.repository?.full_name || 'unknown');
    console.log('   Author:', payload.pull_request?.user?.login || 'unknown');
  } else {
    console.log('📝 Non-PR Event - Basic Info:');
    console.log('   Repository:', req.body.repository?.full_name || 'unknown');
    console.log('   Action:', req.body.action || 'no action');
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