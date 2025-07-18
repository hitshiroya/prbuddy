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
    
    const prompt = `You are an expert code reviewer. Analyze this code diff and provide constructive feedback.

**File:** ${filename}
**Changes:**
\`\`\`diff
${patch}
\`\`\`

Please review this code and provide:
1. **Issues found** (bugs, security, performance, style)
2. **Suggestions** for improvement
3. **Positive feedback** for good practices
4. **Overall assessment** (1-5 stars)

Keep feedback concise but helpful. Focus on meaningful issues, not nitpicks.

**Format your response as JSON:**
{
  "rating": 4,
  "issues": [
    {"type": "style", "description": "Consider using const instead of let", "severity": "low"},
    {"type": "performance", "description": "This loop could be optimized", "severity": "medium"}
  ],
  "suggestions": [
    "Great use of error handling!",
    "Consider adding type checking"
  ],
  "summary": "Overall good code with minor style improvements needed"
}`;

    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: process.env.GROQ_MODEL || 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 1000
    });

    const aiResponse = response.choices[0].message.content;
    console.log(`✅ AI analysis completed for ${filename}`);
    
    // Try to parse JSON response
    try {
      return JSON.parse(aiResponse);
    } catch (parseError) {
      console.warn(`⚠️ AI response not JSON, using fallback for ${filename}`);
      return {
        rating: 3,
        issues: [],
        suggestions: [aiResponse.substring(0, 200) + '...'],
        summary: "AI analysis completed"
      };
    }
    
  } catch (error) {
    console.error(`❌ AI analysis failed for ${filename}:`, error.message);
    return {
      rating: 3,
      issues: [],
      suggestions: [],
      summary: "AI analysis unavailable"
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
          
          // Create AI-enhanced summary comment
          const overallRating = analysisResults.length > 0 
            ? Math.round(analysisResults.reduce((sum, r) => sum + (r.aiAnalysis.rating || 3), 0) / analysisResults.length)
            : 3;
            
          const summaryBody = `🤖 **PR Buddy - AI Code Review** 🤖

Hello @${author}! I've analyzed your PR with AI and here's what I found:

## 📊 **Overview**
- **Files changed:** ${files.length}
- **Total lines:** +${files.reduce((sum, f) => sum + f.additions, 0)}/-${files.reduce((sum, f) => sum + f.deletions, 0)}
- **Issues found:** ${totalLineComments}
- **Overall rating:** ${'⭐'.repeat(overallRating)} (${overallRating}/5)

## 📁 **Detailed Analysis**
${analysisResults.map(file => {
  const ai = file.aiAnalysis;
  let fileSection = `### \`${file.filename}\` (${file.status}) - ${'⭐'.repeat(ai.rating || 3)} ${ai.rating || 3}/5
- **Changes:** +${file.additions}/-${file.deletions} lines
- **Issues:** ${ai.issues.length}`;

  if (ai.issues.length > 0) {
    fileSection += `\n\n**🔍 Issues Found:**`;
    ai.issues.forEach(issue => {
      const icon = issue.severity === 'high' ? '🚨' : 
                   issue.severity === 'medium' ? '⚠️' : '💡';
      fileSection += `\n- ${icon} **${issue.type}**: ${issue.description}`;
    });
  }

  if (ai.suggestions.length > 0) {
    fileSection += `\n\n**💡 AI Suggestions:**`;
    ai.suggestions.forEach(suggestion => {
      fileSection += `\n- ${suggestion}`;
    });
  }

  if (ai.summary) {
    fileSection += `\n\n**📝 Summary:** ${ai.summary}`;
  }
  
  return fileSection;
}).join('\n\n')}

## 🎯 **Overall Assessment**
${totalLineComments === 0 ? 
  `🎉 **Excellent work!** AI found no major issues. Your code follows good practices and is well-structured.` :
  `📝 **${totalLineComments} areas for improvement found.** The AI has identified some opportunities to enhance your code quality.`
}

${overallRating >= 4 ? '🏆 **High Quality Code** - Great job!' :
  overallRating >= 3 ? '👍 **Good Code** - Some room for improvement' :
  '📚 **Needs Improvement** - Consider addressing the issues above'}

## 🚀 **Next Steps**
${analysisResults.some(r => r.aiAnalysis.issues.some(i => i.severity === 'high')) ? 
  '- ⚠️ **High priority**: Address security/bug issues first' : ''}
${analysisResults.some(r => r.aiAnalysis.issues.some(i => i.severity === 'medium')) ? 
  '- 🔄 **Medium priority**: Performance and maintainability improvements' : ''}
${analysisResults.some(r => r.aiAnalysis.issues.some(i => i.severity === 'low')) ? 
  '- ✨ **Low priority**: Style and minor improvements' : ''}

Thanks for your contribution! Keep up the great work! 🎉

---
*🤖 Powered by AI • Generated by PR Buddy*`;

          // Post AI-enhanced summary review
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