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

      // Get the list of files changed in the PR
      const files = await this.githubService.getPRFiles(owner, repo, pullNumber);
      console.log(`📁 Found ${files.length} changed files`);

      // Filter files that should be reviewed
      const reviewableFiles = this.githubService.filterReviewableFiles(files);
      console.log(`✅ ${reviewableFiles.length} files selected for review`);

      if (reviewableFiles.length === 0) {
        console.log(`ℹ️  No reviewable files found in PR #${pullNumber}`);
        await this.githubService.postReviewComment(owner, repo, pullNumber, [
          '🤖 **AI Code Review**\n\nNo reviewable code files found in this PR. The changes might be documentation, configuration, or binary files that don\'t require code review.'
        ]);
        return;
      }

      // Process each file and collect review comments
      const reviewComments = [];
      
      for (const file of reviewableFiles) {
        try {
          console.log(`📖 Reviewing file: ${file.filename}`);
          
          // Get file content or use patch/diff
          let content;
          let language = this.getLanguageFromExtension(file.filename);

          if (file.status === 'added' || file.status === 'modified') {
            try {
              // Try to get full file content for better context
              content = await this.githubService.getFileContent(owner, repo, file.filename, headSha);
            } catch (error) {
              // Fall back to patch if file content is not available
              content = file.patch || '';
              console.log(`Using patch for ${file.filename}: ${error.message}`);
            }
          } else {
            // For other statuses, use the patch
            content = file.patch || '';
          }

          if (!content.trim()) {
            console.log(`⏭️  Skipping ${file.filename} - no content to review`);
            continue;
          }

          // Get AI review for this file
          const fileComments = await this.aiService.reviewCode(file.filename, content, language);
          reviewComments.push(...fileComments);

        } catch (error) {
          console.error(`❌ Error reviewing file ${file.filename}:`, error.message);
          reviewComments.push(`**${file.filename}**\n\n⚠️ Could not review this file: ${error.message}`);
        }
      }

      // Post the review comments
      await this.githubService.postReviewComment(owner, repo, pullNumber, reviewComments);
      console.log(`✅ Review completed for PR #${pullNumber}`);

    } catch (error) {
      console.error(`❌ Error processing PR #${pullNumber}:`, error.message);
      
      try {
        // Add a label indicating manual review is needed
        await this.githubService.addLabelToPR(owner, repo, pullNumber, 'manual review');
        
        // Post an error comment
        await this.githubService.postReviewComment(owner, repo, pullNumber, [
          '🤖 **AI Code Review - Error**\n\n❌ An error occurred while reviewing this PR. Manual review may be needed.\n\n' +
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