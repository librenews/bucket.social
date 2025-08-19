/**
 * PM2 Ecosystem Configuration Example for bucket.social CAN Service
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to ecosystem.config.cjs
 * 2. Update the deployment section with your actual server details
 * 3. Add your SSH key to the server
 * 4. Configure environment variables
 * 
 * DEPLOYMENT COMMANDS:
 * pm2 deploy ecosystem.config.cjs production setup
 * pm2 deploy ecosystem.config.cjs production
 */

module.exports = {
  apps: [
    // Development configuration
    {
      name: 'bucket-social-can-dev',
      script: './dist/index.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        PORT: 3003,
        CORS_ORIGINS: 'http://localhost:3000,http://localhost:3002,http://localhost:3003'
      },
      log_file: './logs/dev-combined.log',
      out_file: './logs/dev-out.log',
      error_file: './logs/dev-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    
    // Production configuration  
    {
      name: 'bucket-social-can',
      script: './dist/index.js',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // REQUIRED: Add your production environment variables here
        REDIS_URL: 'redis://localhost:6379',
        CORS_ORIGINS: 'https://bucket.social,https://*.bucket.social,https://cdn.bucket.social'
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Production-specific settings
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Health monitoring for production
      health_check_http: {
        path: '/health',
        port: 3000,
        timeout: 5000,
        interval: 10000
      },
      
      source_map_support: true
    },
    
    // Staging configuration
    {
      name: 'bucket-social-can-staging', 
      script: './dist/index.js',
      cwd: './',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'staging',
        PORT: 3001,
        REDIS_URL: 'redis://localhost:6379',
        CORS_ORIGINS: 'https://staging.bucket.social'
      },
      log_file: './logs/staging-combined.log',
      out_file: './logs/staging-out.log', 
      error_file: './logs/staging-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      // SSH connection details
      user: 'deploy', // Replace with your server user
      host: ['your-production-server.com'], // Replace with your server IP/domain
      ref: 'origin/main',
      repo: 'git@github.com:librenews/bucket.social.git',
      path: '/var/www/bucket.social',
      
      // SSH key configuration
      // Make sure your SSH key is added to the server's authorized_keys
      // ssh-copy-id -i ~/.ssh/id_rsa.pub deploy@your-production-server.com
      
      // Deployment commands
      'pre-setup': 'mkdir -p /var/www/bucket.social/logs',
      'post-setup': 'ls -la',
      'pre-deploy-local': '',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.cjs --env production',
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        REDIS_URL: 'redis://localhost:6379',
        CORS_ORIGINS: 'https://bucket.social,https://*.bucket.social,https://cdn.bucket.social'
      }
    },
    
    staging: {
      user: 'deploy',
      host: ['your-staging-server.com'], // Replace with your staging server IP/domain
      ref: 'origin/develop', // Or whatever branch you use for staging
      repo: 'git@github.com:librenews/bucket.social.git',
      path: '/var/www/bucket.social-staging',
      
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.cjs --env staging',
      
      env: {
        NODE_ENV: 'staging',
        PORT: 3001,
        REDIS_URL: 'redis://localhost:6379',
        CORS_ORIGINS: 'https://staging.bucket.social'
      }
    }
  }
};
