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

// Function to post line-specific review comments
async function postLineComment(owner, repo, pullNumber, filePath, position, comment) {
  try {
    console.log(`📍 Posting line comment on ${filePath} at position ${position}`);
    
    const response = await octokit.rest.pulls.createReviewComment({
      owner: owner,
      repo: repo,
      pull_number: pullNumber,
      body: comment,
      path: filePath,
      position: position  // Use position instead of line
    });
    
    console.log(`✅ Line comment posted! Comment ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to post line comment:`, error.message);
    throw error;
  }
}

// Function to post a summary review
async function postSummaryReview(owner, repo, pullNumber, body, lineCommentsCount) {
  try {
    console.log(`📋 Posting summary review for PR #${pullNumber}`);
    
    const response = await octokit.rest.pulls.createReview({
      owner: owner,
      repo: repo,
      pull_number: pullNumber,
      body: body,
      event: 'COMMENT' // Can be 'COMMENT', 'APPROVE', or 'REQUEST_CHANGES'
    });
    
    console.log(`✅ Summary review posted! Review ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to post summary review:`, error.message);
    throw error;
  }
}

// Function to get PR files with their diffs
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
      changes: file.changes,
      patch: file.patch // This contains the actual diff
    }));
    
    console.log(`📁 Found ${files.length} files in PR`);
    return files;
  } catch (error) {
    console.error(`❌ Failed to fetch PR files:`, error.message);
    throw error;
  }
}

// Simple code analysis function to find issues in lines
function analyzeCodeLine(line, position, filename) {
  const issues = [];
  
  // Check for console.log (simple example)
  if (line.includes('console.log')) {
    issues.push({
      position: position,
      message: "🚨 **Debug code detected!**\n\nConsider removing `console.log` statements before merging to production."
    });
  }
  
  // Check for TODO comments
  if (line.includes('TODO') || line.includes('FIXME')) {
    issues.push({
      position: position,
      message: "📝 **TODO/FIXME found!**\n\nDon't forget to address this before merging."
    });
  }
  
  // Check for var usage (JavaScript files)
  if (filename.endsWith('.js') && line.includes('var ')) {
    issues.push({
      position: position,
      message: "💡 **Modern JavaScript suggestion!**\n\nConsider using `const` or `let` instead of `var` for better scoping."
    });
  }
  
  // Check for missing semicolons (basic check)
  if (filename.endsWith('.js') && line.trim().length > 0 && !line.trim().endsWith(';') && 
      !line.trim().endsWith('{') && !line.trim().endsWith('}') && 
      !line.includes('//') && !line.includes('/*')) {
    issues.push({
      position: position,
      message: "🔧 **Style suggestion!**\n\nConsider adding a semicolon at the end of this statement."
    });
  }
  
  return issues;
}

// Function to analyze a file's patch and find line-specific issues
function analyzeFilePatch(filename, patch) {
  if (!patch) return [];
  
  const lineComments = [];
  const lines = patch.split('\n');
  let diffPosition = 0;  // Position in the diff (what GitHub API needs)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip diff headers
    if (line.startsWith('@@') || line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }
    
    // Increment position for all lines except headers
    diffPosition++;
    
    // Only analyze added lines (start with +)
    if (line.startsWith('+')) {
      const codeContent = line.substring(1); // Remove the '+' prefix
      
      // Analyze this line
      const issues = analyzeCodeLine(codeContent, diffPosition, filename);
      lineComments.push(...issues);
    }
  }
  
  return lineComments;
}

// Simple root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'PR Buddy - Step 4: Line-specific Code Review' });
});

// Enhanced webhook endpoint with line-specific commenting
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
      
      // Fetch PR files and analyze code asynchronously
      setImmediate(async () => {
        try {
          // Get PR files with diffs
          const files = await getPRFiles(owner, repo, pullNumber);
          
          let totalLineComments = 0;
          const analysisResults = [];
          
          // Analyze each file for line-specific issues
          for (const file of files) {
            console.log(`🔍 Analyzing ${file.filename}...`);
            
            const lineIssues = analyzeFilePatch(file.filename, file.patch);
            
            // Post line-specific comments
            for (const issue of lineIssues) {
              try {
                await postLineComment(owner, repo, pullNumber, file.filename, issue.position, issue.message);
                totalLineComments++;
              } catch (error) {
                console.error(`❌ Failed to post comment on ${file.filename}:${issue.position}:`, error.message);
              }
            }
            
            analysisResults.push({
              filename: file.filename,
              issues: lineIssues.length,
              changes: file.changes
            });
          }
          
          // Create summary review
          const summaryBody = `🤖 **PR Buddy - Code Review Summary** 🤖

Hello @${author}! I've reviewed your PR and here's what I found:

📊 **Review Statistics:**
- **Files analyzed:** ${files.length}
- **Total changes:** ${files.reduce((sum, f) => sum + f.changes, 0)} lines
- **Line comments posted:** ${totalLineComments}

📁 **File Analysis:**
${analysisResults.map(r => `- \`${r.filename}\`: ${r.changes} changes, ${r.issues} suggestions`).join('\n')}

${totalLineComments > 0 ? 
  `✨ **Found ${totalLineComments} suggestions above!** Please review the line-specific comments.` : 
  `🎉 **Great work!** No major issues found in this PR.`
}

Thanks for your contribution! 🚀`;

          // Post summary review
          await postSummaryReview(owner, repo, pullNumber, summaryBody, totalLineComments);
          
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