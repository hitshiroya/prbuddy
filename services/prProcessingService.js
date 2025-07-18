const GitHubService = require('./githubService');
const AIService = require('./aiService');

class PRProcessingService {
  constructor() {
    this.githubService = new GitHubService();
    this.aiService = new AIService();
  }

  /**
   * Process a pull request for review
   */
  async processPR(prInfo) {
    const { owner, repo, pullNumber, title, author } = prInfo;
    
    console.log(`🔥 Processing newly opened PR #${pullNumber}`);

    try {
      // Get PR files with diffs
      const files = await this.githubService.getPRFiles(owner, repo, pullNumber);
      
      let totalLineComments = 0;
      const analysisResults = [];
      
      // Analyze each file with AI
      for (const file of files) {
        console.log(`🔍 Analyzing ${file.filename} with AI...`);
        
        const aiAnalysis = await this.aiService.analyzeCode(file.filename, file.patch);
        
        console.log(`📊 AI found ${aiAnalysis.issues.length} issues in ${file.filename} (Rating: ${aiAnalysis.rating}/5)`);
        
        analysisResults.push({
          filename: file.filename,
          issues: aiAnalysis.issues.length,
          changes: file.changes,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          aiAnalysis: aiAnalysis
        });
        
        totalLineComments += aiAnalysis.issues.length;
      }
      
      // Generate and post human-readable summary
      const summaryComment = this.generateSummaryComment(
        author, title, files, analysisResults, totalLineComments
      );
      
      await this.githubService.postSummaryReview(owner, repo, pullNumber, summaryComment);
      
    } catch (error) {
      console.error(`❌ Error processing PR #${pullNumber}:`, error.message);
      
      // Post error comment as fallback
      try {
        const errorComment = `Hey @${author}! 👋

I tried to review your PR "${title}" but ran into some technical issues.

❌ **Error**: ${error.message}

Please try creating the PR again, or contact support if this keeps happening.

---
*🤖 PR Buddy - Error Report*`;

        await this.githubService.postSummaryReview(owner, repo, pullNumber, errorComment);
      } catch (commentError) {
        console.error(`❌ Failed to post error comment:`, commentError.message);
      }
    }
  }

  /**
   * Generate human-readable summary comment
   */
  generateSummaryComment(author, title, files, analysisResults, totalLineComments) {
    const overallRating = analysisResults.length > 0 
      ? Math.round(analysisResults.reduce((sum, r) => sum + (r.aiAnalysis.rating || 3), 0) / analysisResults.length)
      : 3;
      
    const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
    const criticalIssues = analysisResults.reduce((count, r) => 
      count + r.aiAnalysis.issues.filter(i => i.severity === 'high').length, 0);
      
    return `Hey @${author}! 👋

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
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    const aiStatus = this.aiService.getStatus();
    
    return {
      github: 'connected',
      ai: {
        provider: aiStatus.provider,
        status: aiStatus.configured ? 'ready' : 'not_configured',
        model: aiStatus.model
      }
    };
  }
}

module.exports = PRProcessingService; 