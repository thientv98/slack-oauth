# 🚀 Deployment Guide for Render

## Quick Deploy to Render

### 1. Connect Repository
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Choose this repository

### 2. Configure Service Settings
- **Name**: `slack-oauth` (or your preferred name)
- **Runtime**: Node
- **Build Command**: `npm ci`
- **Start Command**: `npm start`
- **Plan**: Free or Starter

### 3. Set Environment Variables
Add these environment variables in Render:

```
SLACK_CLIENT_ID=your_actual_slack_client_id
SLACK_CLIENT_SECRET=your_actual_slack_client_secret
SLACK_SIGNING_SECRET=your_actual_slack_signing_secret
NODE_ENV=production
BASE_URL=https://your-app-name.onrender.com
```

### 4. Update Slack App Settings
After deployment, update your Slack app's redirect URLs:

1. Go to [Slack Apps](https://api.slack.com/apps)
2. Select your app
3. Go to "OAuth & Permissions"
4. Update "Redirect URLs" to:
   ```
   https://your-app-name.onrender.com/slack/oauth/callback
   ```

## 🔧 Troubleshooting Render Deployment

### Common Issues & Solutions:

#### 1. **Deployment Timeout**
- ✅ **Fixed**: Server now listens on `0.0.0.0` instead of `localhost`
- ✅ **Fixed**: Added `/ping` health check endpoint for faster startup detection
- ✅ **Fixed**: Reduced startup time with optimized middleware

#### 2. **Service Unavailable**
- Make sure environment variables are set correctly
- Check logs in Render dashboard for specific errors

#### 3. **OAuth Errors**
- Ensure `BASE_URL` matches your actual Render URL
- Update Slack app redirect URLs to match your deployed URL

#### 4. **Memory Issues**
- ✅ **Fixed**: Added request size limits and timeouts
- ✅ **Fixed**: Optimized middleware stack

### Health Check Endpoints:
- `/ping` - Simple ping/pong for Render health checks
- `/health` - Basic health status
- `/status` - Detailed service status

### Deployment Checklist:
- [ ] Repository connected to Render
- [ ] Environment variables configured
- [ ] Slack app redirect URLs updated
- [ ] Health check endpoint responding
- [ ] OAuth flow tested

## 🐛 Debug Commands

Check your deployment status:
```bash
# Check if service is running
curl https://your-app-name.onrender.com/ping

# Check detailed status
curl https://your-app-name.onrender.com/health

# Check configuration
curl https://your-app-name.onrender.com/status
```

## 📝 Render Service Configuration

The `render.yaml` file is included for Infrastructure as Code deployment:

```yaml
services:
  - type: web
    name: slack-oauth
    runtime: node
    plan: starter
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /ping
    envVars:
      - key: NODE_ENV
        value: production
```

## 🔄 Redeployment

If you need to redeploy:
1. Push changes to your repository
2. Render will automatically redeploy
3. Or manually trigger redeploy in Render dashboard

## 📞 Support

If you're still experiencing timeouts:
1. Check Render logs for specific error messages
2. Verify all environment variables are set
3. Test the `/ping` endpoint after deployment
4. Check Slack app configuration matches deployed URLs 