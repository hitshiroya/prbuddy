const { Octokit } = require('@octokit/rest');
const { config } = require('../config/config');

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
      baseUrl: config.github_api.baseUrl,
      timeout: config.github_api.timeout,
    });
  }

  /**
   * Get the list of files changed in a pull request
   */
  async getPRFiles(owner, repo, pullNumber) {
    try {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
      });

      return data;
    } catch (error) {
      console.error('Error fetching PR files:', error.message);
      throw new Error(`Failed to fetch PR files: ${error.message}`);
    }
  }

  /**
   * Get the content of a specific file
   */
  async getFileContent(owner, repo, path, ref) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      // Decode base64 content
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      console.error(`Error fetching file content for ${path}:`, error.message);
      throw new Error(`Failed to fetch file content: ${error.message}`);
    }
  }

  /**
   * Post a review comment on a pull request
   */
  async postReviewComment(owner, repo, pullNumber, comments) {
    try {
      const { data } = await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        body: comments.length > 0 
          ? `## 🤖 AI Code Review\n\n${comments.join('\n\n---\n\n')}`
          : '## 🤖 AI Code Review\n\nCode looks good! No major issues found.',
        event: 'COMMENT',
      });

      return data;
    } catch (error) {
      console.error('Error posting review comment:', error.message);
      throw new Error(`Failed to post review comment: ${error.message}`);
    }
  }

  /**
   * Add a label to a pull request
   */
  async addLabelToPR(owner, repo, pullNumber, label) {
    try {
      await this.octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pullNumber,
        labels: [label],
      });
    } catch (error) {
      console.error('Error adding label to PR:', error.message);
      throw new Error(`Failed to add label to PR: ${error.message}`);
    }
  }

  /**
   * Check if a file should be reviewed based on size and type
   */
  shouldReviewFile(file) {
    // Skip deleted files
    if (file.status === 'removed') {
      return false;
    }

    // Skip binary files
    if (file.binary) {
      return false;
    }

    // Skip files that are too large
    if (file.changes > 500) { // Too many changes
      return false;
    }

    // Check file extension
    const extension = this.getFileExtension(file.filename);
    if (!config.supportedExtensions.includes(extension)) {
      return false;
    }

    return true;
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename) {
    return filename.substring(filename.lastIndexOf('.'));
  }

  /**
   * Filter files that should be reviewed
   */
  filterReviewableFiles(files) {
    const reviewableFiles = files.filter(file => this.shouldReviewFile(file));
    
    // Limit the number of files to avoid overwhelming the AI
    return reviewableFiles.slice(0, config.limits.maxFilesPerPR);
  }
}

module.exports = GitHubService; 