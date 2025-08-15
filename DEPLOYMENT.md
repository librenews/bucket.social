# Production Deployment Guide

This guide covers deploying the bucket.social CAN service to production using PM2.

## Prerequisites

- Production server with Node.js 20+ installed
- Redis server running
- SSH access to your production server
- GitHub repository access

## Step 1: Server Setup

### Install Node.js and PM2
```bash
# On your production server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### Install Redis
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# Or use Docker
docker run -d --name redis -p 6379:6379 redis:alpine
```

## Step 2: SSH Key Setup

### Generate SSH Key (if you don't have one)
```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

### Add SSH Key to Server
```bash
# Copy your public key to the server
ssh-copy-id -i ~/.ssh/id_rsa.pub deploy@your-production-server.com

# Test SSH connection
ssh deploy@your-production-server.com
```

## Step 3: Configure PM2 Ecosystem

### Copy Example Configuration
```bash
# On your local machine
cp ecosystem.config.example.cjs ecosystem.config.cjs
```

### Update Configuration
Edit `ecosystem.config.cjs` and update:

1. **Server Details:**
   ```javascript
   user: 'deploy', // Your server user
   host: ['your-production-server.com'], // Your server IP/domain
   ```

2. **Environment Variables:**
   ```javascript
   env: {
     NODE_ENV: 'production',
     PORT: 3000,
     REDIS_URL: 'redis://localhost:6379',
     CORS_ORIGINS: 'https://bucket.social,https://*.bucket.social,https://cdn.bucket.social'
   }
   ```

3. **Deployment Path:**
   ```javascript
   path: '/var/www/bucket.social', // Where to deploy on server
   ```

## Step 4: Initial Deployment

### Setup Deployment Directory
```bash
# This creates the deployment directory and clones the repo
pm2 deploy ecosystem.config.cjs production setup
```

### Deploy Application
```bash
# Deploy the application
pm2 deploy ecosystem.config.cjs production
```

## Step 5: Verify Deployment

### Check Application Status
```bash
# On your production server
pm2 status
pm2 logs bucket-social-can
```

### Test Health Endpoint
```bash
curl https://your-production-server.com/health
```

## Step 6: Configure Reverse Proxy (Nginx)

### Install Nginx
```bash
sudo apt-get install nginx
```

### Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/bucket.social
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name bucket.social www.bucket.social;
    
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

### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/bucket.social /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 7: SSL Certificate (Let's Encrypt)

### Install Certbot
```bash
sudo apt-get install certbot python3-certbot-nginx
```

### Get SSL Certificate
```bash
sudo certbot --nginx -d bucket.social -d www.bucket.social
```

## Step 8: Cloudflare Setup

### Add Domain to Cloudflare
1. Sign up/login to Cloudflare
2. Add `bucket.social` domain
3. Update nameservers at your domain registrar

### Configure DNS Records
```dns
A     bucket.social     YOUR_SERVER_IP
A     api.bucket.social YOUR_SERVER_IP
A     cdn.bucket.social YOUR_SERVER_IP
```

### SSL/TLS Settings
- **SSL/TLS encryption mode**: `Full (strict)`
- **Always Use HTTPS**: `On`
- **Minimum TLS Version**: `1.2`

## Step 9: Monitoring and Maintenance

### PM2 Monitoring
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart bucket-social-can

# Update application
pm2 deploy ecosystem.config.cjs production
```

### Health Checks
```bash
# Check application health
curl https://bucket.social/health

# Check Redis connection
curl https://bucket.social/health | jq '.redis'
```

## Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   ```bash
   # Test SSH connection
   ssh -T deploy@your-production-server.com
   
   # Check SSH key permissions
   chmod 600 ~/.ssh/id_rsa
   chmod 644 ~/.ssh/id_rsa.pub
   ```

2. **PM2 Process Not Starting**
   ```bash
   # Check logs
   pm2 logs bucket-social-can
   
   # Check environment variables
   pm2 env bucket-social-can
   ```

3. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   redis-cli ping
   
   # Check Redis status
   sudo systemctl status redis
   ```

### Useful Commands

```bash
# View all PM2 processes
pm2 list

# Restart all processes
pm2 restart all

# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

## Security Considerations

1. **Firewall Configuration**
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

2. **Environment Variables**
   - Never commit sensitive data to git
   - Use environment variables for secrets
   - Consider using a secrets management service

3. **Regular Updates**
   - Keep Node.js updated
   - Keep PM2 updated
   - Monitor security advisories

## Backup Strategy

### Database Backup (Redis)
```bash
# Create backup script
sudo nano /usr/local/bin/redis-backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/redis"
mkdir -p $BACKUP_DIR
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis_backup_$DATE.rdb
find $BACKUP_DIR -name "redis_backup_*.rdb" -mtime +7 -delete
```

### Application Backup
```bash
# Backup application files
tar -czf /var/backups/app_$(date +%Y%m%d).tar.gz /var/www/bucket.social
```

## Performance Optimization

1. **PM2 Clustering**
   - Uses all CPU cores
   - Automatic load balancing
   - Zero-downtime restarts

2. **Redis Optimization**
   - Configure memory limits
   - Enable persistence
   - Monitor memory usage

3. **Nginx Optimization**
   - Enable gzip compression
   - Configure caching
   - Optimize worker processes
