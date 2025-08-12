# PM2 Quick Reference

## Available Commands

### Development
```bash
npm run pm2:start:dev    # Start development server on port 3003
npm run logs:dev         # View development logs
```

### Production  
```bash
npm run pm2:start:prod   # Start production server on port 3000 (clustered)
npm run logs             # View production logs
```

### Staging
```bash
npm run pm2:start:staging # Start staging server on port 3001
npm run logs:staging      # View staging logs
```

### Management
```bash
npm run pm2:status       # Show all process status
npm run pm2:monit        # Real-time monitoring
npm run pm2:stop         # Stop production processes
npm run pm2:restart      # Restart production processes
npm run pm2:reload       # Zero-downtime reload
npm run pm2:delete       # Remove processes from PM2
```

## Environment Configurations

| Environment | Port | Mode    | Instances | Memory Limit |
|-------------|------|---------|-----------|--------------|
| Development | 3003 | fork    | 1         | 256MB        |
| Staging     | 3001 | cluster | 2         | 384MB        |
| Production  | 3000 | cluster | max       | 512MB        |

## Log Files

- Development: `logs/dev-*.log`
- Staging: `logs/staging-*.log`  
- Production: `logs/*.log`

## Auto-startup (Production)

```bash
pm2 startup              # Generate startup script
pm2 save                 # Save current process list
```

## Deployment Features

✅ **Zero-downtime restarts** with `pm2 reload`  
✅ **Auto-restart** on crashes  
✅ **Memory monitoring** with automatic restart  
✅ **Health checks** via `/health` endpoint  
✅ **Log rotation** and management  
✅ **Cluster mode** for production scaling  
✅ **Source map support** for better debugging  

## Monitoring

- Real-time: `npm run pm2:monit`
- Web dashboard: Install PM2 Plus for advanced monitoring
- Health endpoint: `GET /health` on respective ports

## Troubleshooting

1. **Port conflicts**: Each environment uses different ports
2. **Memory issues**: Check `pm2 show <app-name>` for metrics  
3. **Logs**: Use `npm run logs:dev` or `pm2 logs <app-name>`
4. **Reset**: `pm2 delete all && pm2 kill` for clean restart
