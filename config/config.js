const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // GitHub configuration
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },

  // AI configuration
  ai: {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama3-8b-8192',
    temperature: 0.1,
    maxTokens: 800
  }
};

// Validate required environment variables
function validateConfig() {
  const required = ['GITHUB_TOKEN', 'GITHUB_WEBHOOK_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY not configured - AI reviews will be limited');
  }
}

module.exports = {
  config,
  validateConfig
}; 