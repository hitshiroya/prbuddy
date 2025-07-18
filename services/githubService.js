const { Octokit } = require('@octokit/rest');
const { config } = require('../config/config');

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token
    });
  }

  /**
   * Post a comment on a PR
   */
  async postPRComment(owner, repo, pullNumber, comment) {
    try {
      console.log(`📝 Posting comment to PR #${pullNumber} in ${owner}/${repo}`);
      
      const response = await this.octokit.rest.issues.createComment({
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

  /**
   * Post a summary review
   */
  async postSummaryReview(owner, repo, pullNumber, body) {
    try {
      console.log(`📋 Posting summary review for PR #${pullNumber}`);
      
      const response = await this.octokit.rest.pulls.createReview({
        owner: owner,
        repo: repo,
        pull_number: pullNumber,
        body: body,
        event: 'COMMENT'
      });
      
      console.log(`✅ Summary review posted! Review ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to post summary review:`, error.message);
      throw error;
    }
  }

  /**
   * Get PR files with their diffs
   */
  async getPRFiles(owner, repo, pullNumber) {
    try {
      console.log(`📂 Fetching files for PR #${pullNumber} in ${owner}/${repo}`);
      
      const response = await this.octokit.rest.pulls.listFiles({
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
        patch: file.patch
      }));
      
      console.log(`📁 Found ${files.length} files in PR`);
      return files;
    } catch (error) {
      console.error(`❌ Failed to fetch PR files:`, error.message);
      throw error;
    }
  }
}

module.exports = GitHubService; 