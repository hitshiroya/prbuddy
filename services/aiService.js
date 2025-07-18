const Groq = require('groq-sdk');
const { config } = require('../config/config');

class AIService {
  constructor() {
    this.groq = new Groq({
      apiKey: config.ai.apiKey
    });
    this.isConfigured = !!config.ai.apiKey;
  }

  /**
   * Analyze code with AI
   */
  async analyzeCode(filename, patch) {
    if (!this.isConfigured) {
      console.warn(`⚠️ AI not configured, using fallback for ${filename}`);
      return this.getFallbackAnalysis();
    }

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

      const response = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: config.ai.model,
        temperature: config.ai.temperature,
        max_tokens: config.ai.maxTokens
      });

      const aiResponse = response.choices[0].message.content.trim();
      console.log(`🔍 Raw AI response for ${filename}:`, aiResponse.substring(0, 200) + '...');
      
      try {
        const parsed = JSON.parse(aiResponse);
        console.log(`✅ Successfully parsed JSON for ${filename}`);
        return parsed;
      } catch (parseError) {
        console.warn(`⚠️ JSON parse failed for ${filename}:`, parseError.message);
        return this.getFallbackAnalysis(aiResponse);
      }
      
    } catch (error) {
      console.error(`❌ AI analysis failed for ${filename}:`, error.message);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Get fallback analysis when AI fails
   */
  getFallbackAnalysis(aiResponse = null) {
    return {
      rating: 3,
      issues: [],
      suggestions: aiResponse ? 
        [aiResponse.substring(0, 150) + '...'] : 
        ["AI service temporarily unavailable"],
      summary: aiResponse ? 
        "Code reviewed - see suggestions above" : 
        "Could not analyze this file right now"
    };
  }

  /**
   * Get AI service status
   */
  getStatus() {
    return {
      provider: config.ai.provider,
      model: config.ai.model,
      configured: this.isConfigured
    };
  }
}

module.exports = AIService; 