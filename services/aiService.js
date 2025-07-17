const Groq = require('groq-sdk');
const { config } = require('../config/config');

/**
 * AI Service using Groq for fast LLM inference
 */
class AIService {
  constructor() {
    this.groq = null;
    this.isConfigured = false;
    this.model = config.ai.model;
    
    this.initializeGroq();
  }

  /**
   * Initialize Groq client
   */
  initializeGroq() {
    if (config.ai.apiKey && config.ai.provider === 'groq') {
      try {
        this.groq = new Groq({
          apiKey: config.ai.apiKey,
        });
        this.isConfigured = true;
        console.log(`✅ Groq AI service initialized with model: ${this.model}`);
      } catch (error) {
        console.error('❌ Failed to initialize Groq:', error.message);
        this.isConfigured = false;
      }
    } else {
      console.log('⚠️  Groq API key not configured - using placeholder mode');
      this.isConfigured = false;
    }
  }

  /**
   * Analyze code and provide review comments
   * @param {string} filename - Name of the file being reviewed
   * @param {string} fileContent - Content of the file (or diff)
   * @param {string} language - Programming language of the file
   * @returns {Promise<string[]>} Array of review comments
   */
  async reviewCode(filename, fileContent, language) {
    if (!this.isConfigured) {
      return this.getPlaceholderReview(filename, fileContent, language);
    }

    try {
      const prompt = this.buildReviewPrompt(filename, fileContent, language);
      
      console.log(`🤖 Requesting Groq review for ${filename} (${language})`);
      
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. Provide constructive, specific feedback focused on code quality, best practices, potential bugs, and improvements. Be concise but thorough. Format your response as actionable suggestions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: this.model,
        temperature: 0.3, // Lower temperature for more consistent reviews
        max_tokens: 1500,
        top_p: 1,
        stream: false
      });

      const review = completion.choices[0]?.message?.content;
      
      if (!review) {
        throw new Error('No review content received from Groq');
      }

      // Format the review as a single comment with the filename
      const formattedReview = `**${filename}** (${language})\n\n${review}`;
      
      console.log(`✅ Groq review completed for ${filename}`);
      return [formattedReview];

    } catch (error) {
      console.error(`❌ Groq review failed for ${filename}:`, error.message);
      
      // Fall back to placeholder if Groq fails
      return [`**${filename}**\n\n⚠️ AI review failed: ${error.message}\n\nPlease review this file manually.`];
    }
  }

  /**
   * Build the review prompt for Groq
   */
  buildReviewPrompt(filename, content, language) {
    // Truncate content if too long to avoid token limits
    const maxContentLength = 8000; // Conservative limit for context
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + '\n... (content truncated)'
      : content;

    return `Please review this ${language} code file: ${filename}

Code to review:
\`\`\`${language}
${truncatedContent}
\`\`\`

Please analyze the code for:
1. **Code formatting and style issues**
2. **Missing or inadequate comments/documentation**
3. **Potential bugs or logic errors**
4. **Best practices violations**
5. **Performance concerns**
6. **Security vulnerabilities**
7. **Code maintainability and readability**

Provide specific, actionable feedback. If the code looks good, mention what's done well. Keep feedback concise but helpful.`;
  }

  /**
   * Get placeholder review when Groq is not configured
   */
  getPlaceholderReview(filename, fileContent, language) {
    const lineCount = fileContent.split('\n').length;
    const fileSize = fileContent.length;
    
    return [
      `**${filename}** (${language})\n\n🤖 **Groq AI Review** (Placeholder Mode)\n\n` +
      `📊 **File Analysis:**\n` +
      `- Lines of code: ${lineCount}\n` +
      `- File size: ${fileSize} characters\n` +
      `- Language: ${language}\n\n` +
      `⚠️ **Groq API not configured**\n` +
      `To enable AI reviews, please set your GROQ_API_KEY in the environment variables.\n\n` +
      `🔍 **Manual Review Suggested:**\n` +
      `Please review this file manually for code quality, best practices, and potential issues.`
    ];
  }

  /**
   * Check if the AI service is properly configured
   */
  isReady() {
    return this.isConfigured;
  }

  /**
   * Get available Groq models
   */
  getAvailableModels() {
    return [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile', 
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
      'gemma-7b-it',
      'gemma2-9b-it'
    ];
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      provider: 'groq',
      configured: this.isConfigured,
      model: this.model,
      ready: this.isReady()
    };
  }
}

module.exports = AIService; 