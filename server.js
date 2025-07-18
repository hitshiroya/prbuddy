const express = require('express');
const app = express();

// Parse JSON bodies
app.use(express.json());

// Simple root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'PR Buddy - Step 1: Basic Webhook Receiver' });
});

// Webhook endpoint - just log that it was triggered
app.post('/webhook', (req, res) => {
  console.log('🎯 WEBHOOK TRIGGERED! 🎯');
  res.json({ message: 'Webhook received' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: /webhook`);
}); 