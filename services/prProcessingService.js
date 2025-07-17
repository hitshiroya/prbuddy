const GitHubService = require('./githubService');
const AIService = require('./aiService');
const { config } = require('../config/config');

class PRProcessingService {
  constructor() {
    this.githubService = new GitHubService();
    this.aiService = new AIService();
  }

  /**
   * Process a pull request for review
   * @param {Object} prInfo - Pull request information
   */
  async processPR(prInfo) {
    const { owner, repo, pullNumber, headSha } = prInfo;
    
    console.log(`🔍 Processing PR #${pullNumber} in ${owner}/${repo}`);

    try {
      // Only process public repositories
      if (!prInfo.isPublic) {
        console.log(`⏭️  Skipping private repository: ${owner}/${repo}`);
        return;
      }

      // Post simple acknowledgment message
      const message = `Hello hit, new PR raised with number #${pullNumber} 🚀\n\n**Title:** ${prInfo.title}`;

             console.log(`📝 Posting simple acknowledgment message for PR #${pullNumber}`);
       await this.githubService.postReviewComment(owner, repo, pullNumber, [message]);
       
       console.log(`✅ Simple acknowledgment posted successfully for PR #${pullNumber}`);
       return;

    } catch (error) {
      console.error(`❌ Error processing PR #${pullNumber}:`, error.message);
      
      try {
        // Post an error comment
        await this.githubService.postReviewComment(owner, repo, pullNumber, [
          '🤖 **PR Buddy - Error**\n\n❌ An error occurred while processing this PR.\n\n' +
          `Error: ${error.message}`
        ]);
      } catch (commentError) {
        console.error(`❌ Failed to post error comment:`, commentError.message);
      }
    }
  }

  /**
   * Get programming language from file extension
   * @param {string} filename - File name with extension
   * @returns {string} - Programming language identifier
   */
  getLanguageFromExtension(filename) {
    const extension = filename.substring(filename.lastIndexOf('.'));
    
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.rb': 'ruby',
      '.java': 'java',
      '.cs': 'csharp',
      '.php': 'php',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.clj': 'clojure',
      '.dart': 'dart',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.sql': 'sql'
    };

    return languageMap[extension] || 'text';
  }

  /**
   * Health check method
   */
  async healthCheck() {
    const aiStatus = this.aiService.getStatus();
    return {
      github: 'connected',
      ai: {
        provider: aiStatus.provider,
        status: aiStatus.ready ? 'ready' : 'not_configured',
        model: aiStatus.model
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = PRProcessingService; 