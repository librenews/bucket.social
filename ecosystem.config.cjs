/**
 * PM2 Ecosystem Configuration for bucket.social CAN Service
 * Provides production-ready process management with clustering, monitoring, and auto-restart
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
        // Add your production environment variables here
        // CORS_ORIGINS: 'https://yourdomain.com,https://api.yourdomain.com'
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
        // Add staging-specific variables
      },
      log_file: './logs/staging-combined.log',
      out_file: './logs/staging-out.log', 
      error_file: './logs/staging-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      // SSH connection
      user: 'node',
      host: ['your-server.com'], // Replace with your server
      ref: 'origin/main',
      repo: 'git@github.com:librenews/bucket.social.git',
      path: '/var/www/bucket.social',
      
      // Deployment commands
      'pre-setup': 'mkdir -p /var/www/bucket.social/logs',
      'post-setup': 'ls -la',
      'pre-deploy-local': '',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      
      // Environment
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'node',
      host: ['staging-server.com'], // Replace with your staging server
      ref: 'origin/develop', // Or whatever branch you use for staging
      repo: 'git@github.com:librenews/bucket.social.git',
      path: '/var/www/bucket.social-staging',
      
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};
