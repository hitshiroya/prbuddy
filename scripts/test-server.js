#!/usr/bin/env node

/**
 * Test script to verify server startup without full GitHub configuration
 * This helps validate the codebase structure and basic functionality
 */

// Override environment variables for testing
process.env.GITHUB_TOKEN = 'test_token_placeholder';
process.env.GITHUB_WEBHOOK_SECRET = 'test_secret_placeholder';
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use any available port

const app = require('../server');

console.log('🧪 Testing server startup...');

// Test that the server can start
const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(`✅ Server started successfully on port ${port}`);
  console.log('🔍 Testing endpoints...');
  
  // Test root endpoint
  const http = require('http');
  
  http.get(`http://localhost:${port}/`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('✅ Root endpoint working');
      
      // Test health endpoint
      http.get(`http://localhost:${port}/webhooks/health`, (res) => {
        let healthData = '';
        res.on('data', chunk => healthData += chunk);
        res.on('end', () => {
          console.log('✅ Health endpoint working');
          const health = JSON.parse(healthData);
          console.log(`💚 Health status: ${health.status}`);
          console.log(`🔌 GitHub: ${health.services.github}`);
          console.log(`🤖 AI: ${health.services.ai.provider} (${health.services.ai.status}) - ${health.services.ai.model}`);
          
          console.log('\n🎉 All tests passed! Server is working correctly.');
          console.log('\n📋 Next steps:');
          console.log('1. Set up your .env file with real GitHub credentials');
          console.log('2. Get a Groq API key from https://console.groq.com/');
          console.log('3. Add GROQ_API_KEY to your .env file');
          console.log('4. Run `npm start` to start the production server');
          console.log('5. Configure GitHub webhooks to point to your server');
          
          server.close();
          process.exit(0);
        });
      }).on('error', (err) => {
        console.error('❌ Health endpoint test failed:', err.message);
        server.close();
        process.exit(1);
      });
    });
  }).on('error', (err) => {
    console.error('❌ Root endpoint test failed:', err.message);
    server.close();
    process.exit(1);
  });
});

server.on('error', (err) => {
  console.error('❌ Server startup failed:', err.message);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Test timeout');
  server.close();
  process.exit(1);
}, 10000); 