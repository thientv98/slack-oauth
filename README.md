# 🚀 Slack OAuth Integration

A complete Express.js server implementation for Slack OAuth integration with proper redirect URL handling.

## 📋 Features

- ✅ Complete Slack OAuth 2.0 flow
- 🔗 Automatic redirect URL generation
- 🎨 Beautiful web interface with "Add to Slack" button
- ⚡ Built-in error handling and success pages
- 🔧 Health check endpoint
- 📱 Responsive design
- 🛡️ Secure OAuth state validation

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure your Slack app credentials:

```bash
cp env.example .env
```

Edit `.env` file with your Slack app credentials:

```env
SLACK_CLIENT_ID=your_slack_client_id_here
SLACK_CLIENT_SECRET=your_slack_client_secret_here
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000
```

### 3. Create Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Enter your app name and select a workspace
4. Click "Create App"

### 4. Configure OAuth & Permissions

1. In your Slack app settings, go to **"OAuth & Permissions"**
2. Scroll down to **"Redirect URLs"**
3. Add this redirect URL: `http://localhost:3000/slack/oauth/callback`
4. Click "Save URLs"

### 5. Add OAuth Scopes

In the "OAuth & Permissions" section, add these Bot Token Scopes:

- `channels:read` - View basic information about public channels
- `chat:write` - Send messages as the app
- `commands` - Add shortcuts and/or slash commands
- `incoming-webhook` - Post messages to specific channels
- `users:read` - View people in the workspace

### 6. Get App Credentials

1. In your Slack app settings, go to **"Basic Information"**
2. Copy the **Client ID** and **Client Secret** from the "App Credentials" section
3. Add these to your `.env` file

## 🚀 Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured port).

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main page with "Add to Slack" button |
| `/slack/oauth/authorize` | GET | Initiates OAuth flow |
| `/slack/oauth/callback` | GET | OAuth callback handler |
| `/success` | GET | Success page after installation |
| `/error` | GET | Error page for failed installations |
| `/health` | GET | Health check endpoint |

## 🔗 Required Redirect URLs

When setting up your Slack app, you need to configure these redirect URLs:

### For Local Development:
- **OAuth Callback URL**: `http://localhost:3000/slack/oauth/callback`

### For Production:
Replace `http://localhost:3000` with your actual domain:
- **OAuth Callback URL**: `https://yourdomain.com/slack/oauth/callback`

## 🛠️ Configuration Options

The server automatically generates redirect URLs based on your `BASE_URL` environment variable:

- **Local Development**: `http://localhost:3000`
- **Production**: Set `BASE_URL` to your production domain

## 📊 OAuth Flow

1. User clicks "Add to Slack" button
2. User is redirected to Slack OAuth authorization page
3. User authorizes the app
4. Slack redirects back to `/slack/oauth/callback` with authorization code
5. Server exchanges code for access token
6. User is redirected to success page

## 🔒 Security Features

- OAuth state parameter validation
- Secure credential handling via environment variables
- Error handling for OAuth failures
- CORS protection

## 🌐 Deployment

### Render (Recommended)

**Quick Deploy:**
1. Connect repository to [Render](https://dashboard.render.com/)
2. Set environment variables (see DEPLOYMENT.md)
3. Update Slack app redirect URLs

**Optimizations for Render:**
- ✅ Fixed timeout issues with proper server binding
- ✅ Added `/ping` health check endpoint
- ✅ Optimized startup time and error handling

📖 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete Render deployment guide**

### Other Platforms

#### Heroku
1. Create a new Heroku app
2. Set environment variables in Heroku config
3. Update `BASE_URL` to your Heroku app URL
4. Update redirect URLs in your Slack app settings

#### Vercel/Netlify
1. Deploy the app to your preferred platform
2. Set environment variables in your platform's settings
3. Update `BASE_URL` to your deployed URL
4. Update redirect URLs in your Slack app settings

## 🔍 Troubleshooting

### Common Issues:

1. **"Invalid redirect URI"** - Make sure the redirect URL in your Slack app matches exactly
2. **"Client ID not configured"** - Check your `.env` file has the correct `SLACK_CLIENT_ID`
3. **OAuth errors** - Check the `/error` page for specific error messages
4. **Render deployment timeout** - Fixed with optimized server startup and health checks

### Debug Endpoints:

```bash
# Quick ping test
curl https://your-app.onrender.com/ping

# Basic health check
curl https://your-app.onrender.com/health

# Detailed status
curl https://your-app.onrender.com/status
```

### Render Deployment Issues:

If you're experiencing timeout during Render deployment:

1. ✅ **Server binding fixed** - Now binds to `0.0.0.0` instead of `localhost`
2. ✅ **Health check optimized** - Added `/ping` endpoint for faster startup detection
3. ✅ **Error handling improved** - Better logging and timeout handling
4. ✅ **Graceful shutdown** - Proper signal handling for clean deployment

**Still having issues?** Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed troubleshooting guide.

## 📝 License

MIT License