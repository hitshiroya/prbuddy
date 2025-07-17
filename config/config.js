require('dotenv').config();

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
    provider: process.env.AI_PROVIDER || 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', // Default to Llama 3.3 70B
  },

  // File processing limits
  limits: {
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES) || 1048576, // 1MB default
    maxFilesPerPR: parseInt(process.env.MAX_FILES_PER_PR) || 50,
  },

  // Supported file extensions for review
  supportedExtensions: [
    '.js', '.jsx', '.ts', '.tsx',
    '.py', '.rb', '.java', '.cs',
    '.php', '.go', '.rs', '.cpp',
    '.c', '.h', '.hpp', '.swift',
    '.kt', '.scala', '.clj', '.dart',
    '.vue', '.svelte', '.html', '.css',
    '.scss', '.sass', '.less', '.sql'
  ],

  // GitHub API settings
  github_api: {
    baseUrl: 'https://api.github.com',
    timeout: 10000,
    retries: 3,
  }
};

// Validate required environment variables
function validateConfig() {
  const required = [
    'GITHUB_TOKEN',
    'GITHUB_WEBHOOK_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about missing Groq API key
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY not configured - AI reviews will use placeholder mode');
  }
}

module.exports = {
  config,
  validateConfig
}; 