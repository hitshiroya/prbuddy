const express = require('express');
const { Octokit } = require('@octokit/rest');
const Groq = require('groq-sdk');

const app = express();

// Initialize GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Initialize Groq AI client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// AI-powered code analysis function
async function analyzeCodeWithAI(filename, patch, fileContent = '') {
  try {
    console.log(`🤖 Sending ${filename} to AI for analysis...`);
    
    const prompt = `You are a senior software engineer doing a thorough code review. Your job is to find REAL issues and bugs.

File: ${filename}
Code changes:
\`\`\`diff
${patch}
\`\`\`

CAREFULLY analyze this code for:
- Syntax errors, bugs, logical mistakes
- Security vulnerabilities 
- Performance issues
- Poor coding practices
- Missing error handling

Be strict and thorough. If the code has problems, rate it low (1-2 stars). Only give high ratings (4-5) for genuinely good code.

Return ONLY this JSON:
{
  "rating": 2,
  "issues": [
    {"type": "bug", "description": "Missing semicolon will cause error", "severity": "high"},
    {"type": "security", "description": "User input not validated", "severity": "medium"}
  ],
  "suggestions": ["Add error handling", "Use strict mode"],
  "summary": "Code has several issues that need fixing"
}`;

    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: process.env.GROQ_MODEL || 'llama3-8b-8192',
      temperature: 0.1,
      max_tokens: 800
    });

    const aiResponse = response.choices[0].message.content.trim();
    console.log(`🔍 Raw AI response for ${filename}:`, aiResponse.substring(0, 200) + '...');
    
    try {
      const parsed = JSON.parse(aiResponse);
      console.log(`✅ Successfully parsed JSON for ${filename}`);
      return parsed;
    } catch (parseError) {
      console.warn(`⚠️ JSON parse failed for ${filename}:`, parseError.message);
      
      // Simple fallback analysis
      return {
        rating: 3,
        issues: [],
        suggestions: ["I reviewed your code but had trouble formatting the response"],
        summary: "Code reviewed - see suggestions above"
      };
    }
    
  } catch (error) {
    console.error(`❌ AI analysis failed for ${filename}:`, error.message);
    return {
      rating: 3,
      issues: [],
      suggestions: ["AI service temporarily unavailable"],
      summary: "Could not analyze this file right now"
    };
  }
}

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
  res.json({ 
    message: 'PR Buddy - Step 5: AI-Powered Code Review',
    features: [
      '🤖 AI-powered code analysis',
      '📊 Intelligent issue detection', 
      '⭐ Code quality ratings',
      '💡 Smart suggestions',
      '🎯 Comprehensive reviews'
    ],
    ai: {
      provider: 'Groq',
      model: process.env.GROQ_MODEL || 'llama3-8b-8192',
      status: process.env.GROQ_API_KEY ? 'configured' : 'missing key'
    }
  });
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
          
          // Analyze each file with AI instead of simple pattern matching
          for (const file of files) {
            console.log(`🔍 Analyzing ${file.filename} with AI...`);
            
            // Use AI to analyze the file instead of simple pattern matching
            const aiAnalysis = await analyzeCodeWithAI(file.filename, file.patch);
            
            console.log(`📊 AI found ${aiAnalysis.issues.length} issues in ${file.filename} (Rating: ${aiAnalysis.rating}/5)`);
            
            analysisResults.push({
              filename: file.filename,
              issues: aiAnalysis.issues.length,
              changes: file.changes,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              aiAnalysis: aiAnalysis // Store the full AI analysis
            });
            
            totalLineComments += aiAnalysis.issues.length; // Count for summary stats
          }
          
          // Create human-readable AI summary comment
          const overallRating = analysisResults.length > 0 
            ? Math.round(analysisResults.reduce((sum, r) => sum + (r.aiAnalysis.rating || 3), 0) / analysisResults.length)
            : 3;
            
          const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
          const criticalIssues = analysisResults.reduce((count, r) => 
            count + r.aiAnalysis.issues.filter(i => i.severity === 'high').length, 0);
            
          const summaryBody = `Hey @${author}! 👋

I just finished reviewing your PR "${title}" and here's what I found:

${overallRating >= 4 ? 
  `🎉 **Great work!** Your code looks really solid. I'm giving this a ${overallRating}/5 rating.` :
  overallRating >= 3 ?
  `👍 **Pretty good overall!** There are a few things to clean up, but you're on the right track. Rating: ${overallRating}/5.` :
  `⚠️ **Needs some work.** I found several issues that should be addressed before merging. Rating: ${overallRating}/5.`
}

${analysisResults.map(file => {
  const ai = file.aiAnalysis;
  
  if (ai.issues.length === 0) {
    return `✅ **${file.filename}** - Looks good! No issues found.`;
  }
  
  let fileText = `📝 **${file.filename}** (${ai.rating}/5 stars):`;
  
  const highIssues = ai.issues.filter(i => i.severity === 'high');
  const mediumIssues = ai.issues.filter(i => i.severity === 'medium');
  const lowIssues = ai.issues.filter(i => i.severity === 'low');
  
  if (highIssues.length > 0) {
    fileText += `\n⚠️ **Critical issues:** ${highIssues.map(i => i.description).join(', ')}`;
  }
  
  if (mediumIssues.length > 0) {
    fileText += `\n🔧 **Improvements needed:** ${mediumIssues.map(i => i.description).join(', ')}`;
  }
  
  if (lowIssues.length > 0) {
    fileText += `\n💡 **Minor suggestions:** ${lowIssues.map(i => i.description).join(', ')}`;
  }
  
  if (ai.suggestions.length > 0) {
    fileText += `\n💭 **My thoughts:** ${ai.suggestions.join('. ')}`;
  }
  
  return fileText;
}).join('\n\n')}

${criticalIssues > 0 ? 
  `🚨 **Important:** I found ${criticalIssues} critical issue${criticalIssues > 1 ? 's' : ''} that should be fixed before merging.` : 
  totalLineComments > 0 ?
  `📋 **Summary:** Found ${totalLineComments} total suggestion${totalLineComments > 1 ? 's' : ''} across ${files.length} file${files.length > 1 ? 's' : ''}.` :
  `🎯 **All clear!** No major issues found in your ${totalChanges} line${totalChanges > 1 ? 's' : ''} of changes.`
}

${overallRating <= 2 ? 
  `🔄 **Next steps:** Please address the critical issues above before requesting another review.` :
  overallRating <= 3 ?
  `👀 **Suggestion:** Consider fixing the medium-priority items when you have a chance.` :
  `🚀 **Ready to go!** This looks good for merging once any final feedback is addressed.`
}

Keep up the good work! 🎉

---
*🤖 Reviewed by PR Buddy*`;

          // Post human-readable AI summary
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