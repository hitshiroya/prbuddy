# PR Buddy 🤖

AI-powered GitHub Pull Request reviewer that automatically analyzes code changes and provides intelligent feedback using AI language models.

## Features

- 🚀 **Automated PR Reviews**: Automatically triggers on PR creation and updates
- 🔒 **Secure Webhook Verification**: Validates GitHub webhook signatures for security
- 📊 **Smart File Filtering**: Only reviews relevant code files, skips binaries and large files
- 🎯 **Multi-language Support**: Supports 20+ programming languages
- ⚡ **Async Processing**: Non-blocking webhook responses for optimal performance
- 🏥 **Health Monitoring**: Built-in health check endpoints
- 🔧 **Configurable**: Easy environment-based configuration
- 🤖 **AI-Ready**: Flexible AI service interface (ready for any LLM provider)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd PRBuddy
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# GitHub Configuration (Required)
GITHUB_TOKEN=ghp_your_github_personal_access_token_here
GITHUB_WEBHOOK_SECRET=your_random_webhook_secret_here

# Groq AI Configuration (Required for AI reviews)
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Server Configuration (Optional)
PORT=3000
NODE_ENV=development

# File Processing Limits (Optional)
MAX_FILE_SIZE_BYTES=1048576
MAX_FILES_PER_PR=50
```

**Available Groq Models:**
- `llama-3.3-70b-versatile` (Default - Best balance of speed and quality)
- `llama-3.1-70b-versatile` (High quality, slower)
- `llama-3.1-8b-instant` (Fastest for simple reviews)
- `mixtral-8x7b-32768` (Good for complex code analysis)

### 3. GitHub Setup

#### Create a Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with these scopes:
   - `repo` (for accessing repository content)
   - `pull_requests:write` (for posting reviews)
   - `issues:write` (for adding labels)

#### Set up Webhook (for repositories you want to monitor)

1. Go to your repository → Settings → Webhooks
2. Add webhook with:
   - **Payload URL**: `http://your-server.com/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Same as `GITHUB_WEBHOOK_SECRET` in your `.env`
   - **Events**: Select "Pull requests"

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

### Webhook Endpoint
- **POST** `/webhooks/github` - GitHub webhook receiver

### Monitoring Endpoints
- **GET** `/` - API information and status
- **GET** `/webhooks/health` - Health check with service status

## Supported File Types

The system automatically reviews these file types:

- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Python**: `.py`
- **Ruby**: `.rb`
- **Java**: `.java`
- **C#**: `.cs`
- **PHP**: `.php`
- **Go**: `.go`
- **Rust**: `.rs`
- **C/C++**: `.c`, `.cpp`, `.h`, `.hpp`
- **Swift**: `.swift`
- **Kotlin**: `.kt`
- **Scala**: `.scala`
- **Clojure**: `.clj`
- **Dart**: `.dart`
- **Vue**: `.vue`
- **Svelte**: `.svelte`
- **Web**: `.html`, `.css`, `.scss`, `.sass`, `.less`
- **SQL**: `.sql`

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | ✅ | - | GitHub personal access token |
| `GITHUB_WEBHOOK_SECRET` | ✅ | - | Webhook secret for verification |
| `GROQ_API_KEY` | ⚠️ | - | Groq API key for AI reviews |
| `GROQ_MODEL` | ❌ | `llama-3.3-70b-versatile` | Groq model to use |
| `PORT` | ❌ | `3000` | Server port |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `MAX_FILE_SIZE_BYTES` | ❌ | `1048576` | Max file size to review (1MB) |
| `MAX_FILES_PER_PR` | ❌ | `50` | Max files to review per PR |

### File Processing Rules

- **Skipped files**: Binary files, deleted files, files over size limit
- **Size limit**: Files with >500 changes are skipped to avoid overwhelming
- **Extension filtering**: Only supported programming languages are reviewed
- **Batch processing**: Limited to `MAX_FILES_PER_PR` files per review

## Groq AI Integration

The application uses **Groq** for ultra-fast LLM inference, providing instant code reviews with high-quality feedback.

### Supported Models

- `llama-3.3-70b-versatile` (Default - Best balance of speed and quality)
- `llama-3.1-70b-versatile` (High quality, slower)
- `llama-3.1-8b-instant` (Fastest, good for simple reviews)
- `mixtral-8x7b-32768` (Good for complex code analysis)
- `gemma-7b-it` / `gemma2-9b-it` (Alternative options)

### Getting Your Groq API Key

1. Visit [Groq Console](https://console.groq.com/)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key
5. Add it to your `.env` file as `GROQ_API_KEY`

### Features

- ⚡ **Ultra-fast inference** - Reviews complete in seconds
- 🧠 **Smart analysis** - Detects bugs, security issues, best practices
- 💰 **Cost-effective** - Groq offers competitive pricing
- 🔧 **Multiple models** - Choose the right model for your needs

## Development

### Project Structure

```
PRBuddy/
├── config/
│   └── config.js          # Environment configuration
├── routes/
│   └── webhooks.js        # Webhook route handlers
├── services/
│   ├── githubService.js   # GitHub API interactions
│   ├── aiService.js       # AI service interface
│   └── prProcessingService.js # Main PR processing logic
├── utils/
│   └── webhookUtils.js    # Webhook verification utilities
├── server.js              # Main Express server
├── package.json
└── README.md
```

### Running in Development

```bash
# Install dependencies
npm install

# Start with auto-reload
npm run dev

# Check health
curl http://localhost:3000/webhooks/health
```

### Testing Webhooks Locally

Use [ngrok](https://ngrok.com/) to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL in your GitHub webhook configuration
# Example: https://abc123.ngrok.io/webhooks/github
```

## Security Features

- ✅ **Webhook Signature Verification**: Validates GitHub webhook authenticity
- ✅ **Rate Limiting**: Prevents abuse with request rate limits
- ✅ **Helmet Security**: HTTP security headers
- ✅ **Environment Variables**: Sensitive data stored securely
- ✅ **Public Repo Only**: Only processes public repositories
- ✅ **Error Handling**: Graceful error handling with fallbacks

## Monitoring and Logging

### Health Check Response

```json
{
  "status": "healthy",
  "services": {
    "github": "connected",
    "ai": {
      "provider": "groq",
      "status": "ready",
      "model": "llama-3.3-70b-versatile"
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "uptime": 3600,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Webhook Response

```json
{
  "message": "Webhook received and processing started",
  "pullRequest": 123,
  "repository": "owner/repo",
  "action": "opened"
}
```

## Error Handling

The system handles various error scenarios:

- **GitHub API Rate Limits**: Graceful handling with retries
- **Large Files**: Automatic skipping of oversized files
- **Network Issues**: Retry logic for transient failures
- **AI Service Failures**: Falls back to "manual review" labels
- **Invalid Webhooks**: Secure rejection of invalid requests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- 📖 Check this README
- 🐛 Open an issue on GitHub
- 💬 Check the health endpoint for service status

---

**Note**: This is a prototype designed for personal GitHub accounts and public repositories. For production use with private repositories or organizational accounts, additional security considerations may be needed. 