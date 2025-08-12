# PM2 Deployment Guide

This guide covers deploying the bucket.social CAN service using PM2 for production-ready process management.

## Prerequisites

1. **Node.js 18+** installed on your server
2. **PM2** installed globally: `npm install -g pm2`
3. **Git** access to the repository
4. **Environment variables** configured

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Application
```bash
npm run build
```

### 3. Start with PM2
```bash
# Development environment
npm run pm2:start:dev

# Production environment
npm run pm2:start:prod

# Staging environment
npm run pm2:start:staging
```

## PM2 Commands

### Process Management
```bash
# Start the application
npm run pm2:start

# Restart (kills and starts)
npm run pm2:restart

# Reload (zero-downtime restart)
npm run pm2:reload

# Stop the application
npm run pm2:stop

# Delete from PM2
npm run pm2:delete

# Check status
npm run pm2:status

# Monitor in real-time
npm run pm2:monit
```

### Logging
```bash
# View logs in real-time
npm run logs

# Clear logs
npm run logs:clear

# View specific log files
pm2 logs bucket-social-can --lines 100
```

### Auto-startup (Production)
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Resurrect saved processes after reboot
pm2 resurrect
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file or set these in your deployment environment:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# CORS Configuration
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# AT Protocol Configuration (add your specific variables)
# ATPROTO_SERVICE_URL=https://bsky.social
# ... other AT Protocol specific variables
```

### PM2 Environment Files

The ecosystem config supports multiple environments:

- **Production**: `--env production`
- **Staging**: `--env staging`  
- **Development**: `--env development`

## Deployment Strategies

### 1. Manual Deployment

```bash
# On your server
git pull origin main
npm install
npm run build
npm run pm2:reload  # Zero-downtime restart
```

### 2. PM2 Deploy (Advanced)

Configure the `deploy` section in `ecosystem.config.js`, then:

```bash
# First time setup
npm run deploy:setup

# Deploy updates
npm run deploy:prod
```

### 3. CI/CD Integration

Add to your CI/CD pipeline:

```bash
# Build and test
npm install
npm run build
npm test

# Deploy with PM2
pm2 start ecosystem.config.js --env production
```

## Monitoring & Maintenance

### Health Checks
The ecosystem config includes automatic health checking via `/health` endpoint.

### Memory Management
- Automatic restart if memory exceeds 512MB
- Clustering enabled for better performance
- Graceful shutdown handling

### Log Rotation
```bash
# Install PM2 log rotation
pm2 install pm2-logrotate

# Configure (optional)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## Production Checklist

- [ ] Environment variables configured
- [ ] HTTPS/SSL certificates installed
- [ ] Firewall configured (port 3000)
- [ ] PM2 startup script generated
- [ ] Log rotation configured
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Domain/DNS configured

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   pm2 stop all
   pm2 delete all
   ```

2. **Application won't start**
   ```bash
   npm run logs
   # Check error logs for details
   ```

3. **High memory usage**
   - Check for memory leaks
   - Adjust `max_memory_restart` in ecosystem config
   - Consider scaling horizontally

### Useful Commands

```bash
# Show detailed process info
pm2 show bucket-social-can

# Reset restart count
pm2 reset bucket-social-can

# Update PM2
npm install -g pm2@latest
pm2 update
```

## Advanced Configuration

### Load Balancing
The ecosystem uses `cluster` mode with `instances: 'max'` for automatic load balancing across CPU cores.

### Custom Deployment
Modify `ecosystem.config.js` to customize:
- Instance count
- Memory limits  
- Environment variables
- Health check settings
- Deployment hooks

### Integration with Reverse Proxy

Example Nginx configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Support

For issues specific to PM2, consult the [PM2 documentation](https://pm2.keymetrics.io/docs/).

For bucket.social CAN service issues, check the project repository and logs.
