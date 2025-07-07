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
    const createInstallationsTableQuery = `
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
    
    const createChannelConfigsTableQuery = `
      CREATE TABLE IF NOT EXISTS channel_configs (
        id SERIAL PRIMARY KEY,
        team_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        translate_on_reaction BOOLEAN DEFAULT FALSE,
        translate_on_new_message BOOLEAN DEFAULT FALSE,
        translate_on_mention BOOLEAN DEFAULT FALSE,
        source_language VARCHAR(10) DEFAULT 'auto',
        target_language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, channel_id),
        FOREIGN KEY (team_id) REFERENCES slack_installations(team_id) ON DELETE CASCADE
      )
    `;
    
    await pool.query(createInstallationsTableQuery);
    await pool.query(createChannelConfigsTableQuery);
    console.log('✅ Database tables initialized successfully');
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
  const { channel } = req.query;
  
  if (!team_id) {
    return res.status(400).json({ 
      error: 'team_id is required',
      message: 'Please provide a team_id parameter'
    });
  }

  try {
    const installationQuery = 'SELECT * FROM slack_installations WHERE team_id = $1';
    const installationResult = await pool.query(installationQuery, [team_id]);
    
    if (installationResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'installation_not_found',
        message: `No installation found for team_id: ${team_id}` 
      });
    }
    
    const installation = installationResult.rows[0];
    
    // If channel parameter is provided, get specific channel config
    if (channel) {
      const channelConfigQuery = 'SELECT * FROM channel_configs WHERE team_id = $1 AND channel_id = $2';
      const channelConfigResult = await pool.query(channelConfigQuery, [team_id, channel]);
      
      let channelConfig;
      if (channelConfigResult.rows.length > 0) {
        // Return existing config from database
        const config = channelConfigResult.rows[0];
        channelConfig = {
          channel_id: config.channel_id,
          channel_name: config.channel_name,
          translate_on_reaction: config.translate_on_reaction,
          translate_on_new_message: config.translate_on_new_message,
          translate_on_mention: config.translate_on_mention,
          source_language: config.source_language,
          target_language: config.target_language,
          created_at: config.created_at,
          updated_at: config.updated_at
        };
      } else {
        // Return default config if no data found
        channelConfig = {
          channel_id: channel,
          channel_name: null,
          translate_on_reaction: true,  // Default to true
          translate_on_new_message: false,
          translate_on_mention: false,
          source_language: 'auto',
          target_language: 'en',
          created_at: null,
          updated_at: null
        };
      }
      
      return res.json({
        success: true,
        data: {
          team_id: installation.team_id,
          team_name: installation.team_name,
          access_token: installation.access_token,
          bot_user_id: installation.bot_user_id,
          scope: installation.scope,
          installed_at: installation.installed_at,
          updated_at: installation.updated_at,
          channel_config: channelConfig
        }
      });
    }
    
    // If no channel parameter, return default config
    const defaultConfig = {
      translate_on_reaction: true,  // Default to true
      translate_on_new_message: false,
      translate_on_mention: false,
      source_language: 'auto',
      target_language: 'en'
    };
    
    // Return installation data with default config
    res.json({
      success: true,
      data: {
        team_id: installation.team_id,
        team_name: installation.team_name,
        access_token: installation.access_token,
        bot_user_id: installation.bot_user_id,
        scope: installation.scope,
        installed_at: installation.installed_at,
        updated_at: installation.updated_at,
        default_config: defaultConfig
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

// Slash command: /translate-config
app.post('/slack/commands/translate-config', async (req, res) => {
  try {
    const { team_id, channel_id, channel_name, user_id, trigger_id } = req.body;
    
    console.log('Translate config command received:', { team_id, channel_id, channel_name, user_id });
    
    // Verify installation exists
    const installationQuery = 'SELECT access_token FROM slack_installations WHERE team_id = $1';
    const installationResult = await pool.query(installationQuery, [team_id]);
    
    if (installationResult.rows.length === 0) {
      return res.json({
        response_type: 'ephemeral',
        text: '❌ App not properly installed. Please reinstall the app.'
      });
    }
    
    const accessToken = installationResult.rows[0].access_token;
    
    // Get current channel config
    const configQuery = 'SELECT * FROM channel_configs WHERE team_id = $1 AND channel_id = $2';
    const configResult = await pool.query(configQuery, [team_id, channel_id]);
    
    let currentConfig;
    if (configResult.rows.length > 0) {
      // Use existing config from database
      currentConfig = configResult.rows[0];
      console.log('Using existing config from DB:', currentConfig);
    } else {
      // Use default config for new channel
      currentConfig = {
        translate_on_reaction: true,  // Default to true
        translate_on_new_message: false,
        translate_on_mention: false,
        source_language: 'auto',
        target_language: 'en'
      };
      console.log('Using default config for new channel:', currentConfig);
    }
    

    
    // Create modal view
    const modalView = {
      type: 'modal',
      callback_id: 'translate_config_modal',
      title: {
        type: 'plain_text',
        text: 'Translation Config'
      },
      submit: {
        type: 'plain_text',
        text: 'Save'
      },
      close: {
        type: 'plain_text',
        text: 'Cancel'
      },
      private_metadata: JSON.stringify({ team_id, channel_id, channel_name }),
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `Configure Translation for #${channel_name}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Translation Triggers*\nSelect when to automatically translate messages:'
          }
        },
        {
          type: 'section',
          block_id: 'translate_options_block',
          text: {
            type: 'mrkdwn',
            text: 'Choose translation options:'
          },
          accessory: {
            type: 'checkboxes',
            action_id: 'translate_options',
            ...((() => {
              const initialOptions = [];
              
              console.log('Current config for modal:', currentConfig);
              
              if (currentConfig.translate_on_reaction) {
                initialOptions.push({
                  text: { type: 'plain_text', text: 'Dịch khi react với 🌐' },
                  value: 'translate_on_reaction'
                });
              }
              if (currentConfig.translate_on_new_message) {
                initialOptions.push({
                  text: { type: 'plain_text', text: 'Dịch khi có tin nhắn mới' },
                  value: 'translate_on_new_message'
                });
              }
              if (currentConfig.translate_on_mention) {
                initialOptions.push({
                  text: { type: 'plain_text', text: 'Dịch khi được tag' },
                  value: 'translate_on_mention'
                });
              }
              
              console.log('Initial options for modal:', initialOptions);
              
              return initialOptions.length > 0 ? { initial_options: initialOptions } : {};
            })()),
            options: [
              {
                text: { type: 'plain_text', text: 'Dịch khi react với 🌐' },
                value: 'translate_on_reaction'
              },
              {
                text: { type: 'plain_text', text: 'Dịch khi có tin nhắn mới' },
                value: 'translate_on_new_message'
              },
              {
                text: { type: 'plain_text', text: 'Dịch khi được tag' },
                value: 'translate_on_mention'
              }
            ]
          }
        }
      ]
    };
    
    // Open modal using Slack API
    const modalResponse = await axios.post('https://slack.com/api/views.open', {
      trigger_id: trigger_id,
      view: modalView
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
    if (!modalResponse.data.ok) {
      console.error('Error opening modal:', modalResponse.data);
      return res.json({
        response_type: 'ephemeral',
        text: '❌ Error opening configuration modal. Please try again.'
      });
    }
    
    // Return empty response since modal is opened
    res.status(200).send();
    
  } catch (error) {
    console.error('Error in translate-config command:', error);
    res.json({
      response_type: 'ephemeral',
      text: '❌ Error processing command. Please try again.'
    });
  }
});

// Handle interactive components (modal submissions)
app.post('/slack/interactive', async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);
    
    console.log('Interactive payload received:', payload.type);
    
    if (payload.type === 'view_submission' && payload.view.callback_id === 'translate_config_modal') {
      await handleTranslateConfigSubmission(payload);
    }
    
    res.json({});
  } catch (error) {
    console.error('Error handling interactive component:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle translate config modal submission
async function handleTranslateConfigSubmission(payload) {
  try {
    const { team_id, channel_id, channel_name } = JSON.parse(payload.view.private_metadata);
    const values = payload.view.state.values;
    
    console.log('Handling translate config submission for:', { team_id, channel_id, channel_name });
    
    // Extract form values
    console.log('Form values:', JSON.stringify(values, null, 2));
    
    // Find the translate options using the specific block_id
    const translateOptionsBlock = values.translate_options_block || {};
    const selectedOptions = translateOptionsBlock.translate_options?.selected_options || [];
    
    console.log('Translate options block:', JSON.stringify(translateOptionsBlock, null, 2));
    console.log('Selected options:', JSON.stringify(selectedOptions, null, 2));
    
    const config = {
      translate_on_reaction: selectedOptions.some(opt => opt.value === 'translate_on_reaction'),
      translate_on_new_message: selectedOptions.some(opt => opt.value === 'translate_on_new_message'),
      translate_on_mention: selectedOptions.some(opt => opt.value === 'translate_on_mention'),
      source_language: 'auto',  // Default to auto-detect
      target_language: 'en'     // Default to English
    };
    
    // If no options are selected, set default to translate_on_reaction
    if (!config.translate_on_reaction && !config.translate_on_new_message && !config.translate_on_mention) {
      config.translate_on_reaction = true;
    }
    
    console.log('Parsed config:', config);
    
    // Save to database
    const upsertQuery = `
      INSERT INTO channel_configs (team_id, channel_id, channel_name, translate_on_reaction, translate_on_new_message, translate_on_mention, source_language, target_language, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (team_id, channel_id) 
      DO UPDATE SET 
        channel_name = EXCLUDED.channel_name,
        translate_on_reaction = EXCLUDED.translate_on_reaction,
        translate_on_new_message = EXCLUDED.translate_on_new_message,
        translate_on_mention = EXCLUDED.translate_on_mention,
        source_language = EXCLUDED.source_language,
        target_language = EXCLUDED.target_language,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(upsertQuery, [
      team_id,
      channel_id,
      channel_name,
      config.translate_on_reaction,
      config.translate_on_new_message,
      config.translate_on_mention,
      config.source_language,
      config.target_language
    ]);
    
    console.log('✅ Channel config saved successfully');
    
    // Get access token for response
    const installationQuery = 'SELECT access_token FROM slack_installations WHERE team_id = $1';
    const installationResult = await pool.query(installationQuery, [team_id]);
    
    if (installationResult.rows.length > 0) {
      const accessToken = installationResult.rows[0].access_token;
      
      // Send success message to channel
      const enabledFeatures = [];
      if (config.translate_on_reaction) enabledFeatures.push('🌐 Dịch khi react');
      if (config.translate_on_new_message) enabledFeatures.push('📝 Dịch tin nhắn mới');
      if (config.translate_on_mention) enabledFeatures.push('🔔 Dịch khi được tag');
      
      const message = {
        channel: channel_id,
        text: `✅ Translation configuration updated for #${channel_name}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Cập nhật cấu hình dịch thuật cho #${channel_name}*`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Các tính năng đã bật:*\n${enabledFeatures.length > 0 ? enabledFeatures.join('\n') : '❌ Không có tính năng nào được bật'}`
            }
          }
        ]
      };
      
      await axios.post('https://slack.com/api/chat.postMessage', message, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    }
    
  } catch (error) {
    console.error('Error handling translate config submission:', error);
  }
}

// Handle Slack events (messages, reactions, mentions)
app.post('/slack/events', async (req, res) => {
  try {
    const { type, challenge, event, team_id } = req.body;

    // Handle URL verification
    if (type === 'url_verification') {
      return res.json({ challenge });
    }

    // Handle events
    if (type === 'event_callback' && event) {
      console.log('Received event:', event.type, 'in team:', team_id);
      
      // Handle different event types
      switch (event.type) {
        case 'message':
          await handleMessageEvent(event, team_id);
          break;
        case 'reaction_added':
          await handleReactionEvent(event, team_id);
          break;
        case 'app_mention':
          await handleMentionEvent(event, team_id);
          break;
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error handling Slack event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle message events
async function handleMessageEvent(event, team_id) {
  try {
    // Skip bot messages and message changes
    if (event.bot_id || event.subtype === 'message_changed' || event.subtype === 'message_deleted') {
      return;
    }

    const { channel, text, user } = event;

    // Get channel config
    const configQuery = 'SELECT * FROM channel_configs WHERE team_id = $1 AND channel_id = $2';
    const configResult = await pool.query(configQuery, [team_id, channel]);

    if (configResult.rows.length === 0 || !configResult.rows[0].translate_on_new_message) {
      return; // No config or translate_on_new_message is disabled
    }

    const config = configResult.rows[0];
    
    // Translate the message
    const translatedText = await translateText(text, config.source_language, config.target_language);
    
    if (translatedText && translatedText !== text) {
      await postTranslation(team_id, channel, translatedText, `Auto-translated (${config.source_language} → ${config.target_language})`);
    }

  } catch (error) {
    console.error('Error handling message event:', error);
  }
}

// Handle reaction events
async function handleReactionEvent(event, team_id) {
  try {
    const { reaction, item, user } = event;

    // Only handle globe reaction
    if (reaction !== 'globe_with_meridians') {
      return;
    }

    // Get channel config
    const configQuery = 'SELECT * FROM channel_configs WHERE team_id = $1 AND channel_id = $2';
    const configResult = await pool.query(configQuery, [team_id, item.channel]);

    if (configResult.rows.length === 0 || !configResult.rows[0].translate_on_reaction) {
      return; // No config or translate_on_reaction is disabled
    }

    const config = configResult.rows[0];

    // Get the original message
    const accessToken = await getAccessToken(team_id);
    if (!accessToken) return;

    const messageResponse = await axios.post('https://slack.com/api/conversations.history', {
      channel: item.channel,
      latest: item.ts,
      limit: 1,
      inclusive: true
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!messageResponse.data.ok || !messageResponse.data.messages.length) {
      return;
    }

    const originalMessage = messageResponse.data.messages[0];
    const translatedText = await translateText(originalMessage.text, config.source_language, config.target_language);

    if (translatedText && translatedText !== originalMessage.text) {
      await postTranslation(team_id, item.channel, translatedText, `Translated (${config.source_language} → ${config.target_language})`, item.ts);
    }

  } catch (error) {
    console.error('Error handling reaction event:', error);
  }
}

// Handle mention events
async function handleMentionEvent(event, team_id) {
  try {
    const { channel, text, user } = event;

    // Get channel config
    const configQuery = 'SELECT * FROM channel_configs WHERE team_id = $1 AND channel_id = $2';
    const configResult = await pool.query(configQuery, [team_id, channel]);

    if (configResult.rows.length === 0 || !configResult.rows[0].translate_on_mention) {
      return; // No config or translate_on_mention is disabled
    }

    const config = configResult.rows[0];
    
    // Remove the mention from the text
    const textWithoutMention = text.replace(/<@[^>]+>/g, '').trim();
    
    if (!textWithoutMention) {
      return;
    }

    // Translate the message
    const translatedText = await translateText(textWithoutMention, config.source_language, config.target_language);
    
    if (translatedText && translatedText !== textWithoutMention) {
      await postTranslation(team_id, channel, translatedText, `Translated (${config.source_language} → ${config.target_language})`);
    }

  } catch (error) {
    console.error('Error handling mention event:', error);
  }
}

// Translation function (using Google Translate API or similar)
async function translateText(text, sourceLanguage, targetLanguage) {
  try {
    if (!text || !text.trim()) {
      return null;
    }

    // Skip if source and target languages are the same
    if (sourceLanguage === targetLanguage) {
      return null;
    }

    // For demo purposes, returning a mock translation
    // In production, you would use Google Translate API, AWS Translate, etc.
    const mockTranslation = `[TRANSLATED ${sourceLanguage} → ${targetLanguage}] ${text}`;
    
    // TODO: Implement actual translation API
    // Example with Google Translate API:
    /*
    const { Translate } = require('@google-cloud/translate').v2;
    const translate = new Translate({ projectId: 'your-project-id' });
    
    const [translation] = await translate.translate(text, {
      from: sourceLanguage === 'auto' ? undefined : sourceLanguage,
      to: targetLanguage
    });
    
    return translation;
    */

    return mockTranslation;
  } catch (error) {
    console.error('Error translating text:', error);
    return null;
  }
}

// Post translation to Slack
async function postTranslation(team_id, channel, translatedText, note, thread_ts = null) {
  try {
    const accessToken = await getAccessToken(team_id);
    if (!accessToken) return;

    const message = {
      channel: channel,
      text: `🌐 ${translatedText}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🌐 ${translatedText}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_${note}_`
            }
          ]
        }
      ]
    };

    // If thread_ts is provided, reply in thread
    if (thread_ts) {
      message.thread_ts = thread_ts;
    }

    await axios.post('https://slack.com/api/chat.postMessage', message, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error posting translation:', error);
  }
}

// Get access token for a team
async function getAccessToken(team_id) {
  try {
    const query = 'SELECT access_token FROM slack_installations WHERE team_id = $1';
    const result = await pool.query(query, [team_id]);
    
    if (result.rows.length === 0) {
      console.error('No access token found for team:', team_id);
      return null;
    }
    
    return result.rows[0].access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

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