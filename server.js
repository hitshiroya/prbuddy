const express = require('express');
const { Octokit } = require('@octokit/rest');

const app = express();

// Initialize GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Simple function to post a comment on a PR
async function postPRComment(owner, repo, pullNumber, comment) {
  try {
    console.log(`📝 Posting comment to PR #${pullNumber} in ${owner}/${repo}`);
    
    const response = await octokit.rest.issues.createComment({
      owner: owner,
      repo: repo,
      issue_number: pullNumber,
      body: comment
    });
    
    console.log(`✅ Comment posted successfully! Comment ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to post comment:`, error.message);
    throw error;
  }
}

// Simple function to get PR files
async function getPRFiles(owner, repo, pullNumber) {
  try {
    console.log(`📂 Fetching files for PR #${pullNumber} in ${owner}/${repo}`);
    
    const response = await octokit.rest.pulls.listFiles({
      owner: owner,
      repo: repo,
      pull_number: pullNumber
    });
    
    const files = response.data.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes
    }));
    
    console.log(`📁 Found ${files.length} files in PR`);
    return files;
  } catch (error) {
    console.error(`❌ Failed to fetch PR files:`, error.message);
    throw error;
  }
}

// Simple root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'PR Buddy - Step 3: GitHub API Integration' });
});

// Enhanced webhook endpoint with GitHub API integration
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  console.log('\n🎯 === WEBHOOK TRIGGERED === 🎯');
  console.log('⏰ Time:', new Date().toISOString());
  
  // Log important headers from GitHub
  console.log('📋 GitHub Event:', req.headers['x-github-event'] || 'unknown');
  console.log('📦 GitHub Delivery:', req.headers['x-github-delivery'] || 'unknown');
  console.log('🔐 Has Signature:', req.headers['x-hub-signature-256'] ? 'Yes' : 'No');
  console.log('📄 Content-Type:', req.headers['content-type'] || 'unknown');
  
  // Parse GitHub webhook data (handles both JSON and form-encoded)
  let payload = {};
  try {
    if (req.body && req.body.length > 0) {
      const bodyString = req.body.toString();
      
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
  
  // Handle pull request events
  if (req.headers['x-github-event'] === 'pull_request') {
    const action = payload.action;
    const pullNumber = payload.pull_request?.number;
    const title = payload.pull_request?.title;
    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;
    const author = payload.pull_request?.user?.login;
    
    console.log('🚀 PR Event Details:');
    console.log('   Action:', action || 'unknown');
    console.log('   PR Number:', pullNumber || 'unknown');
    console.log('   PR Title:', title || 'unknown');
    console.log('   Repository:', `${owner}/${repo}` || 'unknown');
    console.log('   Author:', author || 'unknown');
    
    // Process only 'opened' PRs for now
    if (action === 'opened' && pullNumber && owner && repo) {
      console.log(`🔥 Processing newly opened PR #${pullNumber}`);
      
      // Fetch PR files and post comment asynchronously
      setImmediate(async () => {
        try {
          // Get PR files
          const files = await getPRFiles(owner, repo, pullNumber);
          
          // Create simple comment
          const comment = `🤖 **PR Buddy here!** 🤖

Hello @${author}! I've detected your PR and here's what I found:

📊 **PR Summary:**
- **Title:** ${title}
- **Files changed:** ${files.length}
- **Total changes:** ${files.reduce((sum, f) => sum + f.changes, 0)} lines

📁 **Files in this PR:**
${files.map(f => `- \`${f.filename}\` (${f.status}): +${f.additions}/-${f.deletions}`).join('\n')}

Thanks for your contribution! 🚀`;

          // Post the comment
          await postPRComment(owner, repo, pullNumber, comment);
          
        } catch (error) {
          console.error(`❌ Error processing PR #${pullNumber}:`, error.message);
        }
      });
    }
  } else {
    console.log('📝 Non-PR Event - Basic Info:');
    console.log('   Repository:', payload.repository?.full_name || 'unknown');
    console.log('   Action:', payload.action || 'no action');
  }
  
  console.log('🎯 === END WEBHOOK === 🎯\n');
  
  res.json({ 
    message: 'Webhook received and processing!',
    event: req.headers['x-github-event'],
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: /webhook`);
  console.log(`🔗 GitHub integration: ${process.env.GITHUB_TOKEN ? 'Configured' : 'Missing GITHUB_TOKEN'}`);
}); 