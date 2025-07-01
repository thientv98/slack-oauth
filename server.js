const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Configuration
const DATABASE_URL = process.env.DATABASE_URL || '';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database table
async function initializeDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS slack_installations (
        id SERIAL PRIMARY KEY,
        team_id VARCHAR(255) UNIQUE NOT NULL,
        team_name VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        bot_user_id VARCHAR(255),
        scope TEXT,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Database table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Initialize database on startup
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Slack OAuth Configuration
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Add request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(25000, () => {
    console.log('Request timeout');
    res.status(408).send('Request timeout');
  });
  next();
});

// Redirect URLs that you need to configure in your Slack app
const REDIRECT_URLS = {
  OAUTH_CALLBACK: `${BASE_URL}/slack/oauth/callback`,
  SUCCESS: `${BASE_URL}/success`,
  ERROR: `${BASE_URL}/error`
};

// Simple ping endpoint for Render health checks
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Root route - serves the main page with "Add to Slack" button
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Slack OAuth Integration</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
            }
            h1 { color: #333; margin-bottom: 30px; }
            .slack-button {
                display: inline-block;
                background-color: #4A154B;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
                transition: background-color 0.3s;
            }
            .slack-button:hover {
                background-color: #611f69;
            }
            .info {
                background-color: #e8f4f8;
                padding: 20px;
                border-radius: 5px;
                margin: 20px 0;
                text-align: left;
            }
            .url-list {
                background-color: #f1f1f1;
                padding: 15px;
                border-radius: 5px;
                margin: 10px 0;
                font-family: monospace;
                text-align: left;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Slack OAuth Integration</h1>
            <p>Click the button below to add this app to your Slack workspace</p>
            
            <a href="/slack/oauth/authorize" class="slack-button">
                Add to Slack
            </a>
            
            <div class="info">
                <h3>📋 Redirect URLs Configuration</h3>
                <p>You need to configure these redirect URLs in your Slack app settings:</p>
                <div class="url-list">
                    <strong>OAuth Callback URL:</strong><br>
                    ${REDIRECT_URLS.OAUTH_CALLBACK}
                </div>
                <div class="url-list">
                    <strong>Success URL:</strong><br>
                    ${REDIRECT_URLS.SUCCESS}
                </div>
                <div class="url-list">
                    <strong>Error URL:</strong><br>
                    ${REDIRECT_URLS.ERROR}
                </div>
            </div>
            
            <div class="info">
                <h3>⚙️ Setup Instructions</h3>
                <ol style="text-align: left;">
                    <li>Create a new Slack app at <a href="https://api.slack.com/apps" target="_blank">api.slack.com/apps</a></li>
                    <li>Go to "OAuth & Permissions" in your app settings</li>
                    <li>Add the OAuth Callback URL above to "Redirect URLs"</li>
                    <li>Copy your Client ID and Client Secret to your .env file</li>
                    <li>Add the required OAuth scopes for your app</li>
                </ol>
            </div>
        </div>
    </body>
    </html>
  `);
});

app.get('/cronjob_81925.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'cronjob_81925.html'));
});

// Initiate OAuth flow - redirects to Slack
app.get('/slack/oauth/authorize', (req, res) => {
  console.log('OAuth authorization requested');
  
  if (!SLACK_CLIENT_ID) {
    console.error('Slack Client ID not configured');
    return res.status(500).send(`
      <h1>Configuration Error</h1>
      <p>Slack Client ID not configured. Please set SLACK_CLIENT_ID environment variable.</p>
      <a href="/">← Back to Home</a>
    `);
  }

  try {
    const scopes = [
      'channels:read',
      'chat:write',
      'commands',
      'incoming-webhook',
      'users:read'
    ].join(',');

    const state = generateRandomState();
    
    const authUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${SLACK_CLIENT_ID}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URLS.OAUTH_CALLBACK)}&` +
      `state=${state}`;

    console.log('Redirecting to Slack OAuth URL');
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in OAuth authorization:', error);
    res.status(500).send(`
      <h1>OAuth Error</h1>
      <p>Error initiating OAuth flow: ${error.message}</p>
      <a href="/">← Back to Home</a>
    `);
  }
});

// OAuth callback - handles the response from Slack
app.get('/slack/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('OAuth error:', error);
    return res.redirect(`${REDIRECT_URLS.ERROR}?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return res.redirect(`${REDIRECT_URLS.ERROR}?error=no_code`);
  }

  console.log('code', code);

  res.redirect(`${REDIRECT_URLS.SUCCESS}}`);

  try {
    // Exchange authorization code for access token with timeout
    console.log('Exchanging OAuth code for token...');
    const tokenResponse = await axios.post('https://slack.com/api/oauth.v2.access', {
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URLS.OAUTH_CALLBACK
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000 // 15 second timeout
    });

    const { data } = tokenResponse;

    if (!data.ok) {
      console.error('Slack OAuth error:', data.error);
      return res.redirect(`${REDIRECT_URLS.ERROR}?error=${encodeURIComponent(data.error)}`);
    }

    // Store the access token and team info in database
    const installationData = {
      team_id: data.team.id,
      team_name: data.team.name,
      access_token: data.access_token,
      bot_user_id: data.bot_user_id,
      scope: data.scope,
      installed_at: new Date().toISOString()
    };

    console.log('Installation data:', installationData);

    // Save to database
    try {
      const insertQuery = `
        INSERT INTO slack_installations (team_id, team_name, access_token, bot_user_id, scope, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (team_id) 
        DO UPDATE SET 
          team_name = EXCLUDED.team_name,
          access_token = EXCLUDED.access_token,
          bot_user_id = EXCLUDED.bot_user_id,
          scope = EXCLUDED.scope,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await pool.query(insertQuery, [
        installationData.team_id,
        installationData.team_name,
        installationData.access_token,
        installationData.bot_user_id,
        installationData.scope
      ]);
      
      console.log('✅ Installation data saved to database successfully');
    } catch (dbError) {
      console.error('❌ Error saving installation data to database:', dbError);
      // Continue with the flow even if DB save fails
    }

    console.log('Slack app installed successfully:', {
      team_name: installationData.team_name,
      team_id: installationData.team_id,
      scopes: installationData.scope
    });

    // Redirect to success page
    res.redirect(`${REDIRECT_URLS.SUCCESS}?team=${encodeURIComponent(data.team.name)}`);

  } catch (error) {
    console.error('Error during OAuth callback:', error);
    
    // Handle specific axios timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Slack API timeout');
      return res.redirect(`${REDIRECT_URLS.ERROR}?error=slack_api_timeout`);
    }
    
    // Handle axios errors
    if (error.response) {
      console.error('Slack API error response:', error.response.data);
      return res.redirect(`${REDIRECT_URLS.ERROR}?error=slack_api_error`);
    }
    
    console.error('Generic OAuth error:', error.message);
    res.redirect(`${REDIRECT_URLS.ERROR}?error=oauth_failed`);
  }
});

// Success page
app.get('/success', (req, res) => {
  const teamName = req.query.team || 'your workspace';
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Installation Successful</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px;
                background-color: #f8f9fa;
                text-align: center;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .success-icon { font-size: 64px; color: #28a745; margin-bottom: 20px; }
            h1 { color: #333; }
            .back-link {
                display: inline-block;
                background-color: #007bff;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success-icon">✅</div>
            <h1>Installation Successful!</h1>
            <p>Your Slack app has been successfully installed to <strong>${teamName}</strong>.</p>
            <p>You can now use the app in your Slack workspace.</p>
            <a href="/" class="back-link">← Back to Home</a>
        </div>
    </body>
    </html>
  `);
});

// Error page
app.get('/error', (req, res) => {
  const error = req.query.error || 'unknown_error';
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Installation Error</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px;
                background-color: #f8f9fa;
                text-align: center;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .error-icon { font-size: 64px; color: #dc3545; margin-bottom: 20px; }
            h1 { color: #333; }
            .error-code { 
                background-color: #f8f9fa; 
                padding: 10px; 
                border-radius: 5px; 
                font-family: monospace; 
                margin: 20px 0; 
            }
            .back-link {
                display: inline-block;
                background-color: #007bff;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-icon">❌</div>
            <h1>Installation Failed</h1>
            <p>There was an error installing the Slack app.</p>
            <div class="error-code">Error: ${error}</div>
            <p>Please try again or contact support if the problem persists.</p>
            <a href="/" class="back-link">← Try Again</a>
        </div>
    </body>
    </html>
  `);
});

// Health check endpoint - Simple and fast for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// More detailed health check
app.get('/status', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    config: {
      client_id_configured: !!SLACK_CLIENT_ID,
      client_secret_configured: !!SLACK_CLIENT_SECRET,
      base_url: BASE_URL,
      redirect_urls: REDIRECT_URLS
    }
  });
});

// API endpoint to get access token by team ID
app.get('/api/installations/:team_id', async (req, res) => {
  const { team_id } = req.params;
  
  if (!team_id) {
    return res.status(400).json({ 
      error: 'team_id is required',
      message: 'Please provide a team_id parameter'
    });
  }

  try {
    const query = 'SELECT * FROM slack_installations WHERE team_id = $1';
    const result = await pool.query(query, [team_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'installation_not_found',
        message: `No installation found for team_id: ${team_id}` 
      });
    }
    
    const installation = result.rows[0];
    
    // Return installation data (excluding sensitive info in logs)
    res.json({
      success: true,
      data: {
        team_id: installation.team_id,
        team_name: installation.team_name,
        access_token: installation.access_token,
        bot_user_id: installation.bot_user_id,
        scope: installation.scope,
        installed_at: installation.installed_at,
        updated_at: installation.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error fetching installation:', error);
    res.status(500).json({ 
      error: 'database_error',
      message: 'Error fetching installation data'
    });
  }
});

// API endpoint to get all installations (for admin purposes)
app.get('/api/installations', async (req, res) => {
  try {
    const query = 'SELECT team_id, team_name, bot_user_id, scope, installed_at, updated_at FROM slack_installations ORDER BY installed_at DESC';
    const result = await pool.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching installations:', error);
    res.status(500).json({ 
      error: 'database_error',
      message: 'Error fetching installations data'
    });
  }
});

// Utility function to generate random state for OAuth
function generateRandomState() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  try {
    await pool.end();
    console.log('Database connection pool closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received');
  try {
    await pool.end();
    console.log('Database connection pool closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
  process.exit(0);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Main URL: ${BASE_URL}`);
  console.log(`🔗 OAuth Callback URL: ${REDIRECT_URLS.OAUTH_CALLBACK}`);
  console.log(`✅ Success URL: ${REDIRECT_URLS.SUCCESS}`);
  console.log(`❌ Error URL: ${REDIRECT_URLS.ERROR}`);
  console.log('\n📋 Configure these URLs in your Slack app settings:');
  console.log(`   - OAuth Callback URL: ${REDIRECT_URLS.OAUTH_CALLBACK}`);
  
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    console.log('\n⚠️  Warning: Slack credentials not configured!');
    console.log('   Please add SLACK_CLIENT_ID and SLACK_CLIENT_SECRET to environment variables.');
  }
  
  console.log('\n✅ Server ready for connections');
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Set server timeout
server.timeout = 30000; 